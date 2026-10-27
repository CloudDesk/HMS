import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MpesaCallbackRepository } from './mpesa-callback.repository.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { MpesaCallbackService } from './mpesa-callback.service.js';
import { registerMpesaCallbackRoutes } from './mpesa-callback.routes.js';
import { parseMpesaCallback } from './mpesa-callback.schemas.js';
import { parseMpesaConfiguration } from '../../config/mpesa.js';

const payload = (resultCode = 0) => ({ Body: { stkCallback: {
  MerchantRequestID: 'test-merchant', CheckoutRequestID: 'test-checkout',
  ResultCode: resultCode, ResultDesc: 'Synthetic outcome',
} } });

const setup = async () => {
  const repository = new MpesaCallbackRepository();
  const record = vi.spyOn(repository, 'record').mockResolvedValue();
  const limits = new AuthRateLimitRepository();
  const consume = vi.spyOn(limits, 'consume').mockResolvedValue(true);
  const service = new MpesaCallbackService(repository, limits, parseMpesaConfiguration({}));
  const app = Fastify();
  await registerMpesaCallbackRoutes(app, { mpesaCallback: service });
  return { app, record, consume, service };
};

afterEach(() => vi.restoreAllMocks());

describe('M-PESA callback contract', () => {
  it.each([[0, 'SUCCESS'], [1032, 'CANCELLED'], [1037, 'TIMEOUT'], [1, 'FAILED']])(
    'records %s as an unverified %s without metadata or JWT', async (code, outcome) => {
      const { app, record } = await setup();
      try {
        const response = await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: payload(Number(code)) });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ data: { received: true } });
        expect(record).toHaveBeenCalledWith(expect.objectContaining({
          processingStatus: 'UNMATCHED', reportedOutcome: outcome,
          verificationStatus: 'UNVERIFIED', financialPostingEnabled: false,
        }));
      } finally { await app.close(); }
    },
  );

  it.each(['CheckoutRequestID', 'MerchantRequestID', 'ResultCode', 'ResultDesc'])('rejects missing %s', (key) => {
    const original = payload();
    const callback = Object.fromEntries(Object.entries(original.Body.stkCallback).filter(([name]) => name !== key));
    expect(() => parseMpesaCallback({ Body: { stkCallback: callback } })).toThrow('Invalid M-PESA callback payload');
  });

  it('rejects wrong types, unknown top-level fields and ambiguous metadata', () => {
    expect(() => parseMpesaCallback({ ...payload(), invoiceId: 'untrusted' })).toThrow();
    expect(() => parseMpesaCallback({ Body: { stkCallback: { ...payload().Body.stkCallback, ResultCode: '0' } } })).toThrow();
    for (const Item of [
      [{ Name: 'Amount', Value: -1 }],
      [{ Name: 'Amount', Value: 1 }, { Name: 'Amount', Value: 2 }],
      [{ Name: 'PhoneNumber', Value: 'not-a-phone' }],
      [{ Name: 'TransactionDate', Value: 20260230000000 }],
      [{ Name: 'MpesaReceiptNumber' }],
    ]) {
      expect(() => parseMpesaCallback({ Body: { stkCallback: { ...payload().Body.stkCallback, CallbackMetadata: { Item } } } })).toThrow();
    }
  });

  it('accepts bounded optional metadata without Value and extracts by name', async () => {
    const { app, service, record } = await setup();
    try {
      const Item = [
        { Name: 'Balance' }, { Name: 'PhoneNumber', Value: 254700000001 },
        { Name: 'MpesaReceiptNumber', Value: 'TESTONLY123' }, { Name: 'Amount', Value: 1 },
        { Name: 'TransactionDate', Value: 20261026150000 },
      ];
      await service.receive({ Body: { stkCallback: { ...payload().Body.stkCallback, CallbackMetadata: { Item } } } });
      await service.receive({ Body: { stkCallback: { ...payload().Body.stkCallback, CallbackMetadata: { Item: [...Item].reverse() } } } });
      expect(record.mock.calls[0]?.[0]).toMatchObject({ amount: 1, phoneNumber: '254700000001', transactionDate: '20261026150000' });
      expect(record.mock.calls[0]?.[0]._id).toBe(record.mock.calls[1]?.[0]._id);
    } finally { await app.close(); }
  });

  it('acknowledges only after storage completes', async () => {
    const { app, record } = await setup();
    try {
      let release: () => void = () => undefined;
      record.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
      let completed = false;
      const pending = app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: payload() }).then((response) => {
        completed = true;
        return response;
      });
      await vi.waitFor(() => expect(record).toHaveBeenCalledOnce());
      expect(completed).toBe(false);
      release();
      expect((await pending).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('returns sanitized retryable errors on event or limiter storage failure', async () => {
    const { app, record, consume } = await setup();
    try {
      record.mockRejectedValue(new Error('private phone / connection secret'));
      const response = await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: payload() });
      expect(response.statusCode).toBe(503);
      expect(response.headers['retry-after']).toBe('60');
      expect(response.body).not.toContain('private');
      record.mockClear();
      consume.mockRejectedValue(new Error('private storage detail'));
      expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/callback', payload: payload() })).statusCode).toBe(503);
      expect(record).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('keeps body, query, authorization and underlying storage errors out of logs', async () => {
    const lines: string[] = [];
    const repository = new MpesaCallbackRepository();
    vi.spyOn(repository, 'record').mockRejectedValue(new Error('PRIVATE_DATABASE_DETAIL'));
    const limits = new AuthRateLimitRepository();
    vi.spyOn(limits, 'consume').mockResolvedValue(true);
    const app = Fastify({ logger: { level: 'info', stream: { write: (line: string) => { lines.push(line); } } } });
    await registerMpesaCallbackRoutes(app, {
      mpesaCallback: new MpesaCallbackService(repository, limits, parseMpesaConfiguration({})),
    });
    try {
      const body = payload();
      body.Body.stkCallback.ResultDesc = 'PRIVATE_DESCRIPTION';
      const response = await app.inject({
        method: 'POST', url: '/api/payments/mpesa/callback?patient=PRIVATE_PATIENT',
        headers: { authorization: 'Bearer PRIVATE_TOKEN' }, payload: body,
      });
      expect(response.statusCode).toBe(503);
      const logs = lines.join('');
      expect(logs).toContain('MPESA_CALLBACK_UNAVAILABLE');
      expect(logs).not.toContain('PRIVATE_');
    } finally { await app.close(); }
  });

  it('rejects malformed JSON, oversized bodies, unsupported content type and throttled requests', async () => {
    const { app, record, consume } = await setup();
    try {
      const request = { method: 'POST' as const, url: '/api/payments/mpesa/callback', headers: { 'content-type': 'application/json' } };
      const malformed = await app.inject({ ...request, payload: '{"privatePhone":' });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.body).not.toContain('privatePhone');
      expect((await app.inject({ ...request, payload: 'x'.repeat(17000) })).statusCode).toBe(413);
      expect((await app.inject({ ...request, headers: { 'content-type': 'application/xml' }, payload: '<body/>' })).statusCode).toBe(415);
      consume.mockResolvedValue(false);
      expect((await app.inject({ ...request, payload: payload() })).statusCode).toBe(429);
      expect(record).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});

describe('M-PESA configuration', () => {
  it('starts without OAuth secrets and validates environment and limits', () => {
    expect(parseMpesaConfiguration({})).toEqual({ environment: 'sandbox', perIpLimit: 120, globalLimit: 600 });
    expect(parseMpesaConfiguration({ MPESA_ENVIRONMENT: 'production' }).environment).toBe('production');
    for (const values of [{ MPESA_ENVIRONMENT: 'live' }, { MPESA_CALLBACK_GLOBAL_LIMIT: '0' }, { MPESA_CALLBACK_PER_IP_LIMIT: '12x' }]) {
      expect(() => parseMpesaConfiguration(values)).toThrow('Invalid M-PESA');
    }
  });
});
