import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { createServiceRegistry } from '../../shared/services/service-registry.js';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingInvoiceModel, BillingPaymentModel } from '../billing/billing.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { MpesaAttemptModel } from './mpesa-attempt.model.js';
import { MpesaAttemptRepository } from './mpesa-attempt.repository.js';
import { MpesaAttemptService } from './mpesa-attempt.service.js';
import { MpesaCallbackRepository } from './mpesa-callback.repository.js';
import { MpesaCallbackEventModel } from './mpesa-callback.model.js';
import { MpesaCallbackService } from './mpesa-callback.service.js';
import { MpesaDarajaClient } from './mpesa-daraja.client.js';
import { registerMpesaAttemptRoutes } from './mpesa-attempt.routes.js';

const branchId = new Types.ObjectId().toString();
const actor = new Types.ObjectId().toString();
const outsider = new Types.ObjectId().toString();
const merchant: MpesaMerchant = {
  consumerKey: 'synthetic-key', consumerSecret: 'synthetic-secret', passkey: 'synthetic-passkey',
  businessShortCode: '174379', partyB: '174379', transactionType: 'CustomerPayBillOnline',
  callbackUrl: 'https://example.test/api/payments/mpesa/callback', branchIds: [branchId],
};
const payload = (code = 0, amount = 10, phone = 254700000001, merchantId = 'merchant-test') => ({ Body: { stkCallback: {
  MerchantRequestID: merchantId, CheckoutRequestID: 'checkout-test', ResultCode: code, ResultDesc: 'Synthetic',
  ...(code === 0 ? { CallbackMetadata: { Item: [
    { Name: 'Amount', Value: amount }, { Name: 'PhoneNumber', Value: phone },
    { Name: 'MpesaReceiptNumber', Value: 'TESTRECEIPT1' },
  ] } } : {}),
} } });

describe('M-PESA attempts: real replica-set transactions, no provider calls', () => {
  let mongo: MongoMemoryReplSet;
  let invoiceId: string;
  let repository: MpesaAttemptRepository;
  let billing: BillingRepository;
  let client: MpesaDarajaClient;
  let service: MpesaAttemptService;
  let callbacks: MpesaCallbackService;
  const input = () => ({ amount: 10, payerPhone: '254700000001', idempotencyKey: randomUUID() });
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([MpesaAttemptModel.init(), MpesaCallbackEventModel.init(), BillingInvoiceModel.init(),
      BillingPaymentModel.init(), UserModel.init(), BranchModel.init(), AuditLogModel.init()]);
  }, 60000);
  beforeEach(async () => {
    await Promise.all([MpesaAttemptModel.deleteMany({}), MpesaCallbackEventModel.deleteMany({}), BillingInvoiceModel.deleteMany({}),
      BillingPaymentModel.deleteMany({}), UserModel.deleteMany({}), BranchModel.deleteMany({}), AuditLogModel.deleteMany({})]);
    await BranchModel.create({ _id: branchId, code: 'TEST', name: 'Synthetic branch', status: 'ACTIVE' });
    await UserModel.create([
      { _id: actor, username: 'test-user', email: 'test@example.test', fullName: 'Synthetic user', passwordHash: 'unused', branchIds: [branchId] },
      { _id: outsider, username: 'outsider', email: 'outsider@example.test', fullName: 'Outside scope', passwordHash: 'unused', branchIds: [] },
    ]);
    const invoice = await BillingInvoiceModel.create({
      invoiceNumber: 'TEST-INVOICE', patientId: new Types.ObjectId(), visitId: new Types.ObjectId(), branchId,
      invoiceDate: new Date(), status: 'PENDING', subtotal: 100, totalAmount: 100, paidAmount: 0, balanceAmount: 100,
    });
    invoiceId = invoice._id.toString();
    repository = new MpesaAttemptRepository(); billing = new BillingRepository(); client = new MpesaDarajaClient();
    vi.spyOn(client, 'token').mockResolvedValue('synthetic-token');
    vi.spyOn(client, 'submit').mockResolvedValue({ state: 'PENDING', merchantRequestId: 'merchant-test', checkoutRequestId: 'checkout-test' });
    const callbackRepository = new MpesaCallbackRepository();
    service = new MpesaAttemptService(repository, callbackRepository, billing, client, 'sandbox', merchant);
    callbacks = new MpesaCallbackService(callbackRepository, new AuthRateLimitRepository(),
      { environment: 'sandbox', perIpLimit: 120, globalLimit: 600 }, service);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it('creates a scoped durable attempt and rejects cross-branch reads/creation', async () => {
    const result = await service.create(invoiceId, input(), actor);
    expect(result).toMatchObject({ invoiceId, amount: 10, currency: 'KES', submissionState: 'CREATED', reportedOutcome: 'PENDING',
      verificationStatus: 'UNVERIFIED', postingStatus: 'DISABLED', payerPhoneMasked: '********0001' });
    expect(result).not.toHaveProperty('payerPhone');
    expect(await MpesaAttemptModel.findById(result.id).lean()).toMatchObject({ branchId, createdBy: actor });
    await expect(service.get(result.id, outsider)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.create(invoiceId, input(), outsider)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.submit(result.id, result.version, outsider)).rejects.toMatchObject({ statusCode: 404 });
    expect(client.submit).not.toHaveBeenCalled();
  });

  it.each(['INDEX_INITIALIZATION', 'ATTEMPT_WRITE', 'AUDIT_WRITE'] as const)(
    'diagnoses %s without exposing raw errors or leaving partial writes', async (stage) => {
      const failure = Object.assign(new Error('PRIVATE_DATABASE_URI PRIVATE_DOCUMENT'), { code: stage === 'INDEX_INITIALIZATION' ? 85 : 121 });
      if (stage === 'INDEX_INITIALIZATION') vi.spyOn(repository, 'ensureIndexes').mockRejectedValueOnce(failure);
      else if (stage === 'ATTEMPT_WRITE') vi.spyOn(repository, 'create').mockRejectedValueOnce(failure);
      else vi.spyOn(repository, 'audit').mockRejectedValueOnce(failure);
      await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({
        code: 'MPESA_ATTEMPT_UNAVAILABLE', statusCode: 503, diagnostic: { stage,
          category: stage === 'INDEX_INITIALIZATION' ? 'INDEX_OPTIONS_CONFLICT' : 'DOCUMENT_VALIDATION' },
      });
      expect(await MpesaAttemptModel.countDocuments()).toBe(0);
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ __v: 0, paidAmount: 0, balanceAmount: 100 });
      expect(await BillingPaymentModel.countDocuments()).toBe(0);
      expect(client.submit).not.toHaveBeenCalled();
    });

  it('retains MongoDB transient transaction retries before classifying the error', async () => {
    const create = repository.create.bind(repository);
    const failure = new mongoose.mongo.MongoServerError({ message: 'PRIVATE_WRITE_CONFLICT', code: 112 });
    failure.addErrorLabel('TransientTransactionError');
    const writes = vi.spyOn(repository, 'create').mockRejectedValueOnce(failure).mockImplementation(create);
    const result = await service.create(invoiceId, input(), actor);
    expect(result.submissionState).toBe('CREATED');
    expect(writes).toHaveBeenCalledTimes(2);
    expect(await MpesaAttemptModel.countDocuments()).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.created' })).toBe(1);
  });

  it('logs fixed diagnostics on the server while keeping the HTTP response and logs private', async () => {
    const services = createServiceRegistry();
    services.mpesaAttempts = service;
    vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({ id: actor, username: 'test-user',
      fullName: 'Synthetic user', email: null, status: 'active', patientId: null });
    vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(true);
    vi.spyOn(repository, 'ensureIndexes').mockRejectedValueOnce(Object.assign(new Error('PRIVATE_URI_AND_INDEX_KEYS'), { code: 85 }));
    const lines: string[] = [];
    const app = Fastify({ logger: { level: 'info', stream: { write: (line: string) => { lines.push(line); } } } });
    await registerMpesaAttemptRoutes(app, services);
    try {
      const response = await app.inject({ method: 'POST', url: `/api/billing/invoices/${invoiceId}/mpesa-attempts`,
        headers: { authorization: 'Bearer PRIVATE_TOKEN' }, payload: input() });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MPESA_ATTEMPT_UNAVAILABLE');
      expect(response.body).not.toMatch(/diagnostic|INDEX_INITIALIZATION|INDEX_OPTIONS_CONFLICT|PRIVATE/);
      const error = lines.map((line) => JSON.parse(line)).find((line) => line.level === 50);
      expect(error).toMatchObject({ code: 'MPESA_ATTEMPT_UNAVAILABLE', diagnostic: {
        stage: 'INDEX_INITIALIZATION', category: 'INDEX_OPTIONS_CONFLICT', databaseCode: 85,
      } });
      expect(lines.join('')).not.toContain('PRIVATE');
      expect(lines.join('')).not.toContain('254700000001');
    } finally { await app.close(); }
  });
  it.each(['DRAFT', 'CANCELLED', 'PAID'])('rejects invoice status %s', async (status) => {
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { status } });
    await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_INVOICE_NOT_PAYABLE' });
  });
  it('rejects overpayment, fractions, invalid payer and mismatched idempotency input', async () => {
    await expect(service.create(invoiceId, { ...input(), amount: 101 }, actor)).rejects.toMatchObject({ code: 'MPESA_INVOICE_NOT_PAYABLE' });
    await expect(service.create(invoiceId, { ...input(), amount: 1.5 }, actor)).rejects.toMatchObject({ code: 'MPESA_REQUEST_INVALID' });
    await expect(service.create(invoiceId, { ...input(), payerPhone: '0700000001' }, actor)).rejects.toMatchObject({ code: 'MPESA_REQUEST_INVALID' });
    const data = input();
    const first = await service.create(invoiceId, data, actor);
    expect((await service.create(invoiceId, data, actor)).id).toBe(first.id);
    await expect(service.create(invoiceId, { ...data, amount: 11 }, actor)).rejects.toMatchObject({ code: 'MPESA_IDEMPOTENCY_CONFLICT' });
    expect(await MpesaAttemptModel.countDocuments()).toBe(1);
  });
  it('serializes simultaneous creation with identical keys', async () => {
    const data = input();
    const repeated = await Promise.all(Array.from({ length: 4 }, () => service.create(invoiceId, data, actor)));
    expect(new Set(repeated.map((item) => item.id)).size).toBe(1);
    await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
    expect(await MpesaAttemptModel.countDocuments()).toBe(1);
  });
  it('allows only one concurrent creation with different keys', async () => {
    const results = await Promise.allSettled([service.create(invoiceId, input(), actor), service.create(invoiceId, input(), actor)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await MpesaAttemptModel.countDocuments()).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.created' })).toBe(1);
  });
  it('rolls back creation and the invoice lock when audit persistence fails', async () => {
    const before = await BillingInvoiceModel.findById(invoiceId).lean();
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('synthetic audit outage'));
    await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_UNAVAILABLE' });
    expect(await MpesaAttemptModel.countDocuments()).toBe(0);
    expect(await BillingInvoiceModel.findById(invoiceId).lean()).toEqual(before);
  });
  it('only submits once under concurrent requests and rejects stale retries', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    const results = await Promise.allSettled([service.submit(attempt.id, 0, actor), service.submit(attempt.id, 0, actor)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(client.submit).toHaveBeenCalledOnce();
    await expect(service.submit(attempt.id, 0, actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_CONFLICT' });
    expect(await service.get(attempt.id, actor)).toMatchObject({ submissionState: 'PENDING', checkoutRequestId: 'checkout-test', version: 2 });
  });
  it('records uncertain submission and prevents new attempts or resends', async () => {
    vi.mocked(client.submit).mockResolvedValue({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
    const attempt = await service.create(invoiceId, input(), actor);
    expect(await service.submit(attempt.id, 0, actor)).toMatchObject({ submissionState: 'UNKNOWN', reportedOutcome: 'PENDING' });
    await expect(service.submit(attempt.id, 2, actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_CONFLICT' });
    await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
  });
  it('definite OAuth failure never sends STK and permits a fresh attempt', async () => {
    vi.mocked(client.token).mockResolvedValue(undefined);
    const attempt = await service.create(invoiceId, input(), actor);
    expect(await service.submit(attempt.id, 0, actor)).toMatchObject({ submissionState: 'REJECTED', submissionError: 'AUTHENTICATION_FAILED_NOT_SENT' });
    expect(client.submit).not.toHaveBeenCalled();
    expect((await service.create(invoiceId, input(), actor)).id).not.toBe(attempt.id);
  });
  it('revalidates invoice changes after OAuth before sending', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    vi.mocked(client.token).mockImplementation(async () => {
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { status: 'PAID', balanceAmount: 0 } });
      return 'synthetic-token';
    });
    expect(await service.submit(attempt.id, 0, actor)).toMatchObject({ submissionState: 'REJECTED', submissionError: 'INVOICE_REVALIDATION_FAILED_NOT_SENT' });
    expect(client.submit).not.toHaveBeenCalled();
  });
  it('replays an early callback after IDs attach and never posts a payment', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    vi.mocked(client.submit).mockImplementation(async () => {
      await callbacks.receive(payload());
      expect(await MpesaCallbackEventModel.findOne().lean()).toMatchObject({ processingStatus: 'UNMATCHED' });
      return { state: 'PENDING', merchantRequestId: 'merchant-test', checkoutRequestId: 'checkout-test' };
    });
    const result = await service.submit(attempt.id, 0, actor);
    expect(result).toMatchObject({ reportedOutcome: 'SUCCESS', verificationStatus: 'UNVERIFIED', postingStatus: 'DISABLED' });
    expect(await MpesaCallbackEventModel.findOne().lean()).toMatchObject({ processingStatus: 'MATCHED', attemptId: attempt.id });
    expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ status: 'PENDING', paidAmount: 0, balanceAmount: 100 });
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });
  it('handles duplicate, conflicting, mismatched and missing-success-metadata callbacks', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    await service.submit(attempt.id, 0, actor);
    await callbacks.receive(payload(0, 99));
    await callbacks.receive(payload(0, 10, 254700000002));
    await callbacks.receive(payload(0, 10, 254700000001, 'wrong-merchant'));
    await callbacks.receive({ Body: { stkCallback: { MerchantRequestID: 'merchant-test', CheckoutRequestID: 'checkout-test', ResultCode: 0, ResultDesc: 'Missing metadata' } } });
    expect(await MpesaCallbackEventModel.countDocuments({ processingStatus: 'CONFLICT' })).toBe(4);
    await Promise.all([callbacks.receive(payload()), callbacks.receive(payload())]);
    const first = await service.get(attempt.id, actor);
    await callbacks.receive(payload(1032));
    expect(await service.get(attempt.id, actor)).toMatchObject({ reportedOutcome: 'SUCCESS', version: first.version });
    expect(await MpesaCallbackEventModel.countDocuments({ processingStatus: 'MATCHED' })).toBe(1);
    await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
  });
  it('rolls back a correlation audit failure, preserves the event and recovers by replay', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    await service.submit(attempt.id, 0, actor);
    const audit = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('synthetic failure'));
    await expect(callbacks.receive(payload())).rejects.toMatchObject({ code: 'MPESA_CALLBACK_UNAVAILABLE' });
    expect(await service.get(attempt.id, actor)).toMatchObject({ reportedOutcome: 'PENDING', version: 2 });
    expect(await MpesaCallbackEventModel.findOne().lean()).toMatchObject({ processingStatus: 'UNMATCHED' });
    audit.mockRestore();
    expect(await service.correlatePending(attempt.id, actor)).toMatchObject({ reportedOutcome: 'SUCCESS' });
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.callback.correlated' })).toBe(1);
  });
  it('leaves submission locked if saving an accepted provider response fails', async () => {
    const attempt = await service.create(invoiceId, input(), actor);
    vi.mocked(client.submit).mockImplementation(async () => {
      vi.spyOn(repository, 'transition').mockRejectedValueOnce(new Error('synthetic write failure'));
      return { state: 'PENDING', merchantRequestId: 'merchant-test', checkoutRequestId: 'checkout-test' };
    });
    await expect(service.submit(attempt.id, 0, actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_UNAVAILABLE' });
    expect(await service.get(attempt.id, actor)).toMatchObject({ submissionState: 'SUBMITTING' });
    await expect(service.submit(attempt.id, 1, actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_CONFLICT' });
    expect(client.submit).toHaveBeenCalledOnce();
  });
  it('exposes staff endpoints behind authentication and existing CollectPayment permission', async () => {
    const { app, services } = await buildApp();
    try {
      const url = `/api/billing/invoices/${invoiceId}/mpesa-attempts`;
      expect((await app.inject({ method: 'POST', url, payload: input() })).statusCode).toBe(401);
      vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({ id: actor, username: 'test-user', fullName: 'Synthetic user', email: null, status: 'active', patientId: null });
      vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(false);
      vi.spyOn(services.permissions, 'auditDeniedAccess').mockResolvedValue();
      expect((await app.inject({ method: 'POST', url, headers: { authorization: 'Bearer synthetic' }, payload: input() })).statusCode).toBe(403);
      expect(services.permissions.userHasPermission).toHaveBeenCalledWith(actor, 'Billing', 'Invoices', 'CollectPayment');
      vi.mocked(services.permissions.userHasPermission).mockResolvedValue(true);
      services.mpesaAttempts = service;
      const headers = { authorization: 'Bearer synthetic' };
      const created = await app.inject({ method: 'POST', url, headers, payload: input() });
      expect(created.statusCode).toBe(200);
      const id: string = created.json().data.id;
      const submitted = await app.inject({ method: 'POST', url: `/api/payments/mpesa/attempts/${id}/submit`, headers, payload: { expectedVersion: 0 } });
      expect(submitted.statusCode).toBe(200);
      expect(submitted.json().data).toMatchObject({ submissionState: 'PENDING', postingStatus: 'DISABLED' });
      const read = await app.inject({ method: 'GET', url: `/api/payments/mpesa/attempts/${id}`, headers });
      expect(read.statusCode).toBe(200);
      expect(read.json().data).not.toHaveProperty('payerPhone');
      expect(services.permissions.userHasPermission).toHaveBeenLastCalledWith(actor, 'Billing', 'Invoices', 'View');
    } finally { await app.close(); }
  });
});
