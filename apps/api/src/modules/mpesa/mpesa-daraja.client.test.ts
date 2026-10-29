import { describe, expect, it, vi } from 'vitest';
import { parseMpesaOutboundConfiguration, type MpesaMerchant } from '../../config/mpesa-outbound.js';
import { MpesaDarajaClient } from './mpesa-daraja.client.js';

const merchant: MpesaMerchant = {
  consumerKey: 'test-key',
  consumerSecret: 'test-secret',
  passkey: 'test-passkey',
  businessShortCode: '174379',
  partyB: '174379',
  transactionType: 'CustomerPayBillOnline',
  callbackUrl: 'https://example.test/api/payments/mpesa/callback',
  branchIds: ['012345678901234567890123'],
};
const attempt = {
  _id: 'a'.repeat(64),
  environment: 'sandbox' as const,
  businessShortCode: '174379',
  partyB: '174379',
  transactionType: 'CustomerPayBillOnline' as const,
  amount: 10,
  payerPhone: '254700000001',
};
const queryAttempt = {
  environment: 'sandbox' as const,
  businessShortCode: '174379',
  checkoutRequestId: 'ws_CO_281020261200001',
};

describe('Daraja client transport boundary', () => {
  it('uses server credentials and the sandbox contract, preserving provider IDs', async () => {
    const http = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'test-token' }))
      .mockResolvedValueOnce(Response.json({ ResponseCode: '0', MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1' }));
    const client = new MpesaDarajaClient(http);
    expect(await client.token(merchant, 'sandbox')).toBe('test-token');
    expect(http.mock.calls[0][0]).toBe('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials');
    expect(http.mock.calls[0][1]?.headers).toEqual({ Authorization: `Basic ${Buffer.from('test-key:test-secret').toString('base64')}` });
    expect(await client.submit(merchant, attempt, 'test-token')).toEqual({ state: 'PENDING', merchantRequestId: 'merchant-1', checkoutRequestId: 'checkout-1' });
    const request = http.mock.calls[1][1];
    expect(request?.redirect).toBe('error');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      BusinessShortCode: '174379',
      Amount: 10,
      PhoneNumber: attempt.payerPhone,
      CallBackURL: merchant.callbackUrl,
      AccountReference: 'aaaaaaaaaaaa',
    });
    expect(body.Timestamp).toMatch(/^\d{14}$/);
    expect(Buffer.from(body.Password, 'base64').toString()).toBe(`174379test-passkey${body.Timestamp}`);
  });

  it.each([500, 408, 200])('retains ambiguous response %s as UNKNOWN without retries', async (status) => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: 'ambiguous' }, { status }));
    expect(await new MpesaDarajaClient(http).submit(merchant, attempt, 'test-token')).toEqual({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
    expect(http).toHaveBeenCalledOnce();
  });

  it('retains transport timeouts as UNKNOWN and never exposes raw failures', async () => {
    const http = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive synthetic error'));
    expect(await new MpesaDarajaClient(http).submit(merchant, attempt, 'test-token')).toEqual({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
    expect(http).toHaveBeenCalledOnce();
  });

  it('recognizes explicit provider rejection and handles OAuth failure before sending', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ errorCode: 'test', errorMessage: 'rejected' }, { status: 400 }));
    const client = new MpesaDarajaClient(http);
    expect(await client.submit(merchant, attempt, 'test-token')).toEqual({ state: 'REJECTED', error: 'PROVIDER_REJECTED' });
    expect(await client.token(merchant, 'production')).toBeUndefined();
    expect(http.mock.calls[1][0]).toContain('https://api.safaricom.co.ke/');
  });

  it('disables outbound calls by default and rejects incomplete configuration', () => {
    expect(parseMpesaOutboundConfiguration({})).toBeUndefined();
    expect(() => parseMpesaOutboundConfiguration({ MPESA_STK_ENABLED: 'true' })).toThrow('Invalid or incomplete');
  });

  describe('STK Push Query (/mpesa/stkpushquery/v1/query)', () => {
    const responseBody = (code: unknown) => ({ ResponseCode: '0', MerchantRequestID: 'merchant-query-1',
      CheckoutRequestID: queryAttempt.checkoutRequestId, ResultCode: code, ResultDesc: 'Synthetic result' });

    it.each([null, false, true, '', ' ', '0.0', '0e0', ' 0', '00', [], {}, -1, 0.5, 2147483648, '2147483648'])(
      'keeps malformed ResultCode %j uncertain', async (code) => {
        const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json(responseBody(code)));
        expect(await new MpesaDarajaClient(http).query(merchant, queryAttempt, 'test-token'))
          .toEqual({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
        expect(http).toHaveBeenCalledOnce();
      });

    it.each([0, '0', 1032, '1032', 1037, '1037', 1, '1'])('accepts canonical result code %j', async (code) => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json(responseBody(code)));
      const result = await new MpesaDarajaClient(http).query(merchant, queryAttempt, 'test-token');
      expect(result).toMatchObject({ resultCode: Number(code), merchantRequestId: 'merchant-query-1',
        checkoutRequestId: queryAttempt.checkoutRequestId });
    });

    it.each([400, 401, 403, 404, 429])('query HTTP %s is not payment failure', async (status) => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ errorCode: 'synthetic', errorMessage: 'Synthetic query rejection' }, { status }));
      expect(await new MpesaDarajaClient(http).query(merchant, queryAttempt, 'test-token'))
        .toEqual({ state: 'UNKNOWN', error: 'PROVIDER_QUERY_REJECTED' });
      expect(http).toHaveBeenCalledOnce();
    });

    it.each(['MerchantRequestID', 'CheckoutRequestID', 'ResultCode'])('requires %s on terminal responses', async (field) => {
      const body: Record<string, unknown> = responseBody(0);
      delete body[field];
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
      expect(await new MpesaDarajaClient(http).query(merchant, queryAttempt, 'test-token')).toMatchObject({ state: 'UNKNOWN' });
    });

    it('queries Daraja status and parses ResultCode 0 as SUCCESS', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        ResponseCode: '0',
        MerchantRequestID: 'merchant-query-1',
        CheckoutRequestID: queryAttempt.checkoutRequestId,
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
      }));
      const client = new MpesaDarajaClient(http);
      const res = await client.query(merchant, queryAttempt, 'query-token');
      expect(res).toEqual({
        state: 'SUCCESS',
        resultCode: 0,
        resultDesc: 'The service request is processed successfully.',
        merchantRequestId: 'merchant-query-1',
        checkoutRequestId: queryAttempt.checkoutRequestId,
      });
      const [url, req] = http.mock.calls[0];
      expect(url).toBe('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query');
      expect(req?.headers).toMatchObject({ Authorization: 'Bearer query-token' });
      const body = JSON.parse(String(req?.body));
      expect(body.BusinessShortCode).toBe('174379');
      expect(body.CheckoutRequestID).toBe(queryAttempt.checkoutRequestId);
    });

    it('parses ResultCode 1032 as CANCELLED', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        ResponseCode: '0',
        MerchantRequestID: 'merchant-query-1',
        CheckoutRequestID: queryAttempt.checkoutRequestId,
        ResultCode: 1032,
        ResultDesc: 'Request cancelled by user',
      }));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'CANCELLED',
        resultCode: 1032,
        resultDesc: 'Request cancelled by user',
        merchantRequestId: 'merchant-query-1',
        checkoutRequestId: queryAttempt.checkoutRequestId,
      });
    });

    it('parses ResultCode 1037 as TIMEOUT', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        ResponseCode: '0',
        MerchantRequestID: 'merchant-query-1',
        CheckoutRequestID: queryAttempt.checkoutRequestId,
        ResultCode: 1037,
        ResultDesc: 'DS timeout user cannot be reached',
      }));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'TIMEOUT',
        resultCode: 1037,
        resultDesc: 'DS timeout user cannot be reached',
        merchantRequestId: 'merchant-query-1',
        checkoutRequestId: queryAttempt.checkoutRequestId,
      });
    });

    it('parses other ResultCode as FAILED', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        ResponseCode: '0',
        MerchantRequestID: 'merchant-query-1',
        CheckoutRequestID: queryAttempt.checkoutRequestId,
        ResultCode: 1,
        ResultDesc: 'The balance is insufficient for the transaction.',
      }));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'FAILED',
        resultCode: 1,
        resultDesc: 'The balance is insufficient for the transaction.',
        merchantRequestId: 'merchant-query-1',
        checkoutRequestId: queryAttempt.checkoutRequestId,
      });
    });

    it('recognizes in-process pending responses from Safaricom', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
        ResponseCode: '1',
        errorCode: '500.001.1001',
        errorMessage: 'The transaction is being processed',
      }, { status: 500 }));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'PENDING',
        resultDesc: 'The transaction is being processed',
      });
    });

    it('returns UNKNOWN for 500 or 408 server errors', async () => {
      const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: 'server error' }, { status: 500 }));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'UNKNOWN',
        error: 'PROVIDER_UNCERTAIN',
      });
    });

    it('returns UNKNOWN for transport timeouts or network exceptions', async () => {
      const http = vi.fn<typeof fetch>().mockRejectedValue(new Error('Connection timeout'));
      const client = new MpesaDarajaClient(http);
      expect(await client.query(merchant, queryAttempt, 'query-token')).toEqual({
        state: 'UNKNOWN',
        error: 'PROVIDER_UNCERTAIN',
      });
    });

    it('returns UNKNOWN without making a network call if checkoutRequestId is missing', async () => {
      const http = vi.fn<typeof fetch>();
      const client = new MpesaDarajaClient(http);
      const res = await client.query(merchant, { environment: 'sandbox', businessShortCode: '174379' }, 'token');
      expect(res).toEqual({ state: 'UNKNOWN', error: 'MISSING_CHECKOUT_REQUEST_ID' });
      expect(http).not.toHaveBeenCalled();
    });
  });
});
