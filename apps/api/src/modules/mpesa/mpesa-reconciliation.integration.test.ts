import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
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

const branchId = new Types.ObjectId().toString();
const actor = new Types.ObjectId().toString();
const outsider = new Types.ObjectId().toString();

const merchant: MpesaMerchant = {
  consumerKey: 'synthetic-key',
  consumerSecret: 'synthetic-secret',
  passkey: 'synthetic-passkey',
  businessShortCode: '174379',
  partyB: '174379',
  transactionType: 'CustomerPayBillOnline',
  callbackUrl: 'https://example.test/api/payments/mpesa/callback',
  branchIds: [branchId],
};

const callbackPayload = (code = 0, amount = 10, checkoutRequestId = 'checkout-test') => ({
  Body: {
    stkCallback: {
      MerchantRequestID: 'merchant-test',
      CheckoutRequestID: checkoutRequestId,
      ResultCode: code,
      ResultDesc: code === 0 ? 'Success' : 'Failed',
      ...(code === 0 ? {
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: amount },
            { Name: 'PhoneNumber', Value: 254700000001 },
            { Name: 'MpesaReceiptNumber', Value: 'TESTRECEIPT1' },
          ],
        },
      } : {}),
    },
  },
});

describe('M-PESA Phase 1: Daraja Verification, Reconciliation & Recovery', () => {
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
    await Promise.all([
      MpesaAttemptModel.init(),
      MpesaCallbackEventModel.init(),
      BillingInvoiceModel.init(),
      BillingPaymentModel.init(),
      UserModel.init(),
      BranchModel.init(),
      AuditLogModel.init(),
    ]);
  }, 60000);

  beforeEach(async () => {
    await Promise.all([
      MpesaAttemptModel.deleteMany({}),
      MpesaCallbackEventModel.deleteMany({}),
      BillingInvoiceModel.deleteMany({}),
      BillingPaymentModel.deleteMany({}) as unknown,
      UserModel.deleteMany({}),
      BranchModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ]);

    await BranchModel.create({ _id: branchId, code: 'TEST', name: 'Synthetic branch', status: 'ACTIVE' });
    await UserModel.create([
      { _id: actor, username: 'test-user', email: 'test@example.test', fullName: 'Synthetic user', passwordHash: 'unused', branchIds: [branchId] },
      { _id: outsider, username: 'outsider', email: 'outsider@example.test', fullName: 'Outside scope', passwordHash: 'unused', branchIds: [] },
    ]);

    const invoice = await BillingInvoiceModel.create({
      invoiceNumber: 'TEST-INVOICE',
      patientId: new Types.ObjectId(),
      visitId: new Types.ObjectId(),
      branchId,
      invoiceDate: new Date(),
      status: 'PENDING',
      subtotal: 100,
      totalAmount: 100,
      paidAmount: 0,
      balanceAmount: 100,
    });
    invoiceId = invoice._id.toString();

    repository = new MpesaAttemptRepository();
    billing = new BillingRepository();
    client = new MpesaDarajaClient();

    vi.spyOn(client, 'token').mockResolvedValue('synthetic-token');
    vi.spyOn(client, 'submit').mockResolvedValue({
      state: 'PENDING',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const callbackRepository = new MpesaCallbackRepository();
    service = new MpesaAttemptService(repository, callbackRepository, billing, client, 'sandbox', merchant);
    callbacks = new MpesaCallbackService(
      callbackRepository,
      new AuthRateLimitRepository(),
      { environment: 'sandbox', perIpLimit: 120, globalLimit: 600 },
      service,
    );
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('1. Authoritative verification via STK query succeeds without callback', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Mock Daraja STK query responding with ResultCode 0
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const verified = await service.verify(created.id, actor);

    expect(verified).toMatchObject({
      verificationStatus: 'VERIFIED',
      recoveryStatus: 'RESOLVED',
      queryOutcome: 'SUCCESS',
      reportedOutcome: 'PENDING', // no callback arrived, so reportedOutcome remains PENDING
      postingStatus: 'DISABLED',  // Phase 1 invariant: posting remains disabled
    });
    expect(verified.verificationAttempts).toBe(1);
    expect(verified.lastVerifiedAt).toBeDefined();

    // Invariant: zero billing payment records created
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(0);
    expect(invoice?.balanceAmount).toBe(100);

    // Audit log was recorded
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.verified' })).toBe(1);
  });

  it('2. Authoritative verification succeeds when callback and query both confirm SUCCESS', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Callback arrives with success
    await callbacks.receive(callbackPayload(0, 10, 'checkout-test'));

    const withCallback = await service.get(created.id, actor);
    expect(withCallback.reportedOutcome).toBe('SUCCESS');
    expect(withCallback.verificationStatus).toBe('UNVERIFIED');

    // Now staff verifies via STK query
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const verified = await service.verify(created.id, actor);
    expect(verified).toMatchObject({
      verificationStatus: 'VERIFIED',
      recoveryStatus: 'RESOLVED',
      queryOutcome: 'SUCCESS',
      reportedOutcome: 'SUCCESS',
      postingStatus: 'DISABLED',
    });

    // Zero billing mutation
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('3. Conflicting evidence: callback reported FAILED but query reports SUCCESS -> CONFLICT', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Callback arrives indicating cancellation/failure
    await callbacks.receive(callbackPayload(1032, 10, 'checkout-test'));

    const before = await service.get(created.id, actor);
    expect(before.reportedOutcome).toBe('CANCELLED');

    // Query unexpectedly reports SUCCESS
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const verified = await service.verify(created.id, actor);
    expect(verified).toMatchObject({
      verificationStatus: 'CONFLICT',
      recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
      conflictingEvidence: 'CALLBACK_FAILED_BUT_QUERY_SUCCESS',
      queryOutcome: 'SUCCESS',
      reportedOutcome: 'CANCELLED',
      postingStatus: 'DISABLED',
    });

    // Invoice remains untouched and attempt is NOT verified
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('4. Conflicting evidence: callback reported SUCCESS but query reports FAILED -> CONFLICT', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Callback reports SUCCESS
    await callbacks.receive(callbackPayload(0, 10, 'checkout-test'));

    // Query reports FAILED
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'FAILED',
      resultCode: 1,
      resultDesc: 'Insufficient balance',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const verified = await service.verify(created.id, actor);
    expect(verified).toMatchObject({
      verificationStatus: 'CONFLICT',
      recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
      conflictingEvidence: 'CALLBACK_SUCCESS_BUT_QUERY_FAILED',
      queryOutcome: 'FAILED',
      reportedOutcome: 'SUCCESS',
      postingStatus: 'DISABLED',
    });
  });

  it('5. Missing CheckoutRequestID cannot be queried and is flagged for manual review', async () => {
    const created = await service.create(invoiceId, input(), actor);

    // Attempt is in CREATED state without submission
    await expect(service.verify(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_ATTEMPT_NOT_SUBMITTED',
    });

    // Manually simulate an attempt stuck in SUBMITTING without checkoutRequestId
    await MpesaAttemptModel.updateOne({ _id: created.id }, {
      $set: { submissionState: 'SUBMITTING', submittedAt: new Date(Date.now() - 60000) },
    });

    await expect(service.verify(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_ATTEMPT_MISSING_CHECKOUT_ID',
    });

    const flagged = await service.get(created.id, actor);
    expect(flagged).toMatchObject({
      verificationStatus: 'UNRESOLVED',
      recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
      conflictingEvidence: 'MISSING_CHECKOUT_REQUEST_ID',
    });
  });

  it('6. Safe recovery of stuck SUBMITTING attempt via reconciliation worker', async () => {
    const created = await service.create(invoiceId, input(), actor);

    // Simulate an attempt stuck in SUBMITTING for > 30s without checkoutRequestId
    await MpesaAttemptModel.updateOne({ _id: created.id }, {
      $set: {
        submissionState: 'SUBMITTING',
        submittedAt: new Date(Date.now() - 45000),
      },
    });

    // Run reconciliation worker
    const report = await service.reconcileEligible({ limit: 10 }, actor);
    expect(report.processed).toBe(1);

    const reconciled = await service.get(created.id, actor);
    expect(reconciled).toMatchObject({
      submissionState: 'UNKNOWN',
      verificationStatus: 'UNRESOLVED',
      recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
    });

    // Audit event was created
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.reconciliation.manual_review_needed' })).toBe(1);
  });

  it('7. Safe recovery of UNKNOWN attempt with CheckoutRequestID', async () => {
    const created = await service.create(invoiceId, input(), actor);

    // Simulate provider submission failure returning UNKNOWN with checkoutRequestId
    await MpesaAttemptModel.updateOne({ _id: created.id }, {
      $set: {
        submissionState: 'UNKNOWN',
        checkoutRequestId: 'checkout-unknown-test',
        merchantRequestId: 'merchant-test',
      },
    });

    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-unknown-test',
    });

    const report = await service.reconcileEligible({ limit: 10 }, actor);
    expect(report.processed).toBe(1);
    expect(report.resolved).toBe(1);

    const reconciled = await service.get(created.id, actor);
    expect(reconciled).toMatchObject({
      verificationStatus: 'VERIFIED',
      recoveryStatus: 'RESOLVED',
      queryOutcome: 'SUCCESS',
    });
  });

  it('8. Single-worker lease and claim concurrency prevents race conditions', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Attempt is active and PENDING
    const worker1 = 'worker-1';
    const worker2 = 'worker-2';

    // Both workers attempt to claim the same eligible attempt concurrently
    const [claim1, claim2] = await Promise.all([
      repository.claimForReconciliation('sandbox', worker1),
      repository.claimForReconciliation('sandbox', worker2),
    ]);

    // Exactly one worker must succeed in acquiring the lease
    const winners = [claim1, claim2].filter((c) => c !== null);
    expect(winners).toHaveLength(1);

    const claimed = winners[0]!;
    expect(claimed._id).toBe(created.id);
    expect(claimed.reconciliationClaimedBy).toMatch(/worker-[12]/);
    expect(claimed.recoveryStatus).toBe('IN_RECOVERY');

    // A third claim immediately afterwards also gets null because lease is active
    expect(await repository.claimForReconciliation('sandbox', 'worker-3')).toBeNull();
  });

  it('9. Bounded retries and exponential backoff scheduling', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    // Query returns PENDING (Safaricom still processing)
    vi.spyOn(client, 'query').mockResolvedValue({
      state: 'PENDING',
      resultDesc: 'The transaction is being processed',
    });

    // 1st reconciliation: retry count becomes 1, backoff scheduled
    await service.reconcileEligible({ limit: 1 }, actor);
    let attempt = await service.get(created.id, actor);
    expect(attempt.reconciliationRetries).toBe(1);
    expect(attempt.recoveryStatus).toBe('IN_RECOVERY');
    expect(attempt.nextReconciliationAt).toBeDefined();

    // Simulate 4 more retries reaching the bound of 5
    await MpesaAttemptModel.updateOne({ _id: created.id }, {
      $set: {
        reconciliationRetries: 4,
        nextReconciliationAt: new Date(Date.now() - 1000), // make eligible again
      },
    });

    await service.reconcileEligible({ limit: 1 }, actor);
    attempt = await service.get(created.id, actor);
    expect(attempt.reconciliationRetries).toBe(5);
    expect(attempt.recoveryStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(attempt.verificationStatus).toBe('UNRESOLVED');
  });

  it('10. Permissions and branch isolation on new endpoints', async () => {
    const { app, services } = await buildApp();
    try {
      const created = await service.create(invoiceId, input(), actor);
      await service.submit(created.id, 0, actor);
      services.mpesaAttempts = service;

      // Unauthenticated requests are rejected
      expect((await app.inject({ method: 'POST', url: `/api/payments/mpesa/attempts/${created.id}/verify` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/payments/mpesa/attempts' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/api/payments/mpesa/reconcile' })).statusCode).toBe(401);

      // Authenticated with CollectPayment
      vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({
        id: actor,
        username: 'test-user',
        fullName: 'Synthetic user',
        email: null,
        status: 'active',
        patientId: null,
      });
      vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(true);

      vi.spyOn(client, 'query').mockResolvedValueOnce({
        state: 'SUCCESS',
        resultCode: 0,
        resultDesc: 'Processed',
        merchantRequestId: 'merchant-test',
        checkoutRequestId: 'checkout-test',
      });

      const headers = { authorization: 'Bearer synthetic' };
      const verifyRes = await app.inject({
        method: 'POST',
        url: `/api/payments/mpesa/attempts/${created.id}/verify`,
        headers,
      });
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.json().data).toMatchObject({ verificationStatus: 'VERIFIED' });

      // List attempts
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/payments/mpesa/attempts',
        headers,
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.items).toHaveLength(1);
      expect(listRes.json().data.items[0]).not.toHaveProperty('payerPhone');

      // Reconcile endpoint
      const recRes = await app.inject({
        method: 'POST',
        url: '/api/payments/mpesa/reconcile',
        headers,
        payload: { limit: 5 },
      });
      expect(recRes.statusCode).toBe(200);
      expect(recRes.json().data).toMatchObject({ processed: expect.any(Number) });
    } finally {
      await app.close();
    }
  });

  it('11. Transaction rollback on verification failure preserves prior state', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Success',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    // Force audit log failure to trigger rollback
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('Synthetic audit failure'));

    await expect(service.verify(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_ATTEMPT_UNAVAILABLE',
    });

    // Verification changes rolled back
    const unchanged = await service.get(created.id, actor);
    expect(unchanged.verificationStatus).toBe('UNVERIFIED');
    expect(unchanged.recoveryStatus).toBe('NONE');
    expect(unchanged.version).toBe(2); // unchanged from post-submission
  });

  it('12. Invariant: Financial posting remains disabled across all operations', async () => {
    const created = await service.create(invoiceId, input(), actor);
    await service.submit(created.id, 0, actor);

    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Processed',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const verified = await service.verify(created.id, actor);
    expect(verified.postingStatus).toBe('DISABLED');

    // Confirm that absolutely no financial records or balances have changed
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(0);
    expect(invoice?.balanceAmount).toBe(100);
    expect(invoice?.status).toBe('PENDING');
  });
});
