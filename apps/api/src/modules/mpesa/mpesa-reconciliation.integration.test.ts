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
import { MpesaDarajaClient, type StkQueryResult } from './mpesa-daraja.client.js';

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

    // Stuck beyond normal OAuth/STK deadlines plus the safety margin.
    await MpesaAttemptModel.updateOne({ _id: created.id }, {
      $set: {
        submissionState: 'SUBMITTING',
        submittedAt: new Date(Date.now() - 150000),
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

  describe('verification safety regressions', () => {
    const terminalResult = (state: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'): StkQueryResult => ({
      state, resultCode: state === 'SUCCESS' ? 0 : state === 'CANCELLED' ? 1032 : state === 'TIMEOUT' ? 1037 : 1,
      resultDesc: 'Synthetic query result', merchantRequestId: 'merchant-test', checkoutRequestId: 'checkout-test',
    });
    const submitted = async () => {
      const attempt = await service.create(invoiceId, input(), actor);
      await service.submit(attempt.id, 0, actor);
      return attempt.id;
    };
    const expectNoPosting = async () => {
      expect(await BillingPaymentModel.countDocuments()).toBe(0);
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ paidAmount: 0, balanceAmount: 100, status: 'PENDING' });
    };

    it.each((['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'] as const).flatMap((state) =>
      (['merchantRequestId', 'checkoutRequestId'] as const).map((field) => ({ state, field }))))(
      'rejects a mismatched $field on terminal $state', async ({ state, field }) => {
        const id = await submitted();
        vi.spyOn(client, 'query').mockResolvedValueOnce({ ...terminalResult(state), [field]: 'wrong-provider-id' });
        expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
          conflictingEvidence: field === 'merchantRequestId' ? 'MERCHANT_REQUEST_MISMATCH' : 'CHECKOUT_REQUEST_MISMATCH' });
        expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: true });
        await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
        await expectNoPosting();
      });

    it.each([null, 401, 429])('retains the invoice lock through real client parsing of %j', async (value) => {
      const id = await submitted();
      const http = vi.fn<typeof fetch>().mockResolvedValue(value === null
        ? Response.json({ ResponseCode: '0', MerchantRequestID: 'merchant-test', CheckoutRequestID: 'checkout-test', ResultCode: null, ResultDesc: 'Synthetic' })
        : Response.json({ errorCode: 'synthetic', errorMessage: 'Query rejected' }, { status: value }));
      const transport = new MpesaDarajaClient(http);
      vi.spyOn(client, 'query').mockImplementation((...args) => transport.query(...args));
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'UNRESOLVED', queryOutcome: 'UNKNOWN' });
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: true });
      await expect(service.create(invoiceId, input(), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
      await expectNoPosting();
    });

    it.each(['SUCCESS', 'FAILED'] as const)('preserves established %s evidence after uncertain queries', async (state) => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult(state));
      const established = await service.verify(id, actor);
      for (const observation of [{ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' }, { state: 'PENDING' }] satisfies StkQueryResult[]) {
        query.mockResolvedValueOnce(observation);
        expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: established.verificationStatus,
          queryOutcome: established.queryOutcome, recoveryStatus: established.recoveryStatus,
          lastVerifiedAt: established.lastVerifiedAt, lastQueryResult: established.lastQueryResult });
      }
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: state === 'SUCCESS' });
      await expectNoPosting();
    });

    it.each(['SUCCESS', 'FAILED'] as const)('retains contradictory terminal evidence after established %s', async (first) => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult(first));
      const original = await service.verify(id, actor);
      query.mockResolvedValueOnce(terminalResult(first === 'SUCCESS' ? 'FAILED' : 'SUCCESS'));
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT',
        conflictingEvidence: 'QUERY_OUTCOME_CONFLICT', recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
        queryOutcome: original.queryOutcome, lastQueryResult: original.lastQueryResult });
      query.mockResolvedValueOnce(terminalResult(first));
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', conflictingEvidence: 'QUERY_OUTCOME_CONFLICT' });
      await expectNoPosting();
    });

    it('does not erase established success when an older overlapping query times out', async () => {
      const id = await submitted();
      let release: (result: StkQueryResult) => void = () => { throw new Error('Deferred response not initialized'); };
      const delayed = new Promise<StkQueryResult>((resolve) => { release = resolve; });
      const query = vi.spyOn(client, 'query').mockReturnValueOnce(delayed);
      const older = service.verify(id, actor);
      await vi.waitFor(() => expect(query).toHaveBeenCalledOnce());
      query.mockResolvedValueOnce(terminalResult('SUCCESS'));
      const established = await service.verify(id, actor);
      release({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
      expect(await older).toMatchObject({ verificationStatus: 'VERIFIED', queryOutcome: 'SUCCESS', lastVerifiedAt: established.lastVerifiedAt });
      await expectNoPosting();
    });

    it('reconciliation shares strict merchant-ID validation', async () => {
      const id = await submitted();
      vi.spyOn(client, 'query').mockResolvedValueOnce({ ...terminalResult('SUCCESS'), merchantRequestId: 'wrong-merchant' });
      await service.reconcileEligible({ limit: 1 }, actor);
      expect(await service.get(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', conflictingEvidence: 'MERCHANT_REQUEST_MISMATCH' });
      await expectNoPosting();
    });

    it('a delayed reconciliation authentication failure cannot downgrade concurrent verification', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { reconciliationRetries: 4 } });
      let release: (token: string | undefined) => void = () => { throw new Error('Deferred token not initialized'); };
      const delayed = new Promise<string | undefined>((resolve) => { release = resolve; });
      vi.mocked(client.token).mockClear().mockReturnValueOnce(delayed);
      const older = service.reconcileEligible({ limit: 1 }, actor);
      await vi.waitFor(() => expect(client.token).toHaveBeenCalledOnce());
      vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult('SUCCESS'));
      const established = await service.verify(id, actor);
      release(undefined);
      await older;
      expect(await service.get(id, actor)).toMatchObject({ verificationStatus: 'VERIFIED', queryOutcome: 'SUCCESS', recoveryStatus: 'RESOLVED', lastVerifiedAt: established.lastVerifiedAt });
      await expectNoPosting();
    });

    it('requires a saved merchant ID before trusting terminal evidence', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $unset: { merchantRequestId: 1 } });
      vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult('SUCCESS'));
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', conflictingEvidence: 'MERCHANT_REQUEST_MISMATCH' });
      await expectNoPosting();
    });

    it('keeps existing review conflicts latched after matching successful verification', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { verificationStatus: 'CONFLICT', recoveryStatus: 'MANUAL_REVIEW_REQUIRED', conflictingEvidence: 'AMOUNT_MISMATCH' } });
      vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult('SUCCESS'));
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', recoveryStatus: 'MANUAL_REVIEW_REQUIRED', conflictingEvidence: 'AMOUNT_MISMATCH' });
      await expectNoPosting();
    });

    it('flags late contradictory callback evidence even when the next query is uncertain', async () => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValueOnce(terminalResult('SUCCESS'));
      await service.verify(id, actor);
      await callbacks.receive(callbackPayload(1032));
      query.mockResolvedValueOnce({ state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' });
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'CONFLICT', queryOutcome: 'SUCCESS',
        conflictingEvidence: 'CALLBACK_FAILED_BUT_QUERY_SUCCESS', recoveryStatus: 'MANUAL_REVIEW_REQUIRED' });
      await expectNoPosting();
    });

    it('does not downgrade posted success when rechecking a now-paid invoice', async () => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValue(terminalResult('SUCCESS'));
      await service.verify(id, actor);
      // Persist a historical posting snapshot only in this isolated test database.
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { postingStatus: 'POSTED' } });
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { status: 'PAID', paidAmount: 100, balanceAmount: 0 } });
      const before = await BillingInvoiceModel.findById(invoiceId).lean();
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'VERIFIED', queryOutcome: 'SUCCESS', postingStatus: 'POSTED', conflictingEvidence: null });
      query.mockResolvedValueOnce({ state: 'UNKNOWN', error: 'PROVIDER_QUERY_REJECTED' });
      expect(await service.verify(id, actor)).toMatchObject({ verificationStatus: 'VERIFIED', queryOutcome: 'SUCCESS', postingStatus: 'POSTED' });
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toEqual(before);
      expect(await BillingPaymentModel.countDocuments()).toBe(0);
    });

    it('rejects verification after merchant configuration changes before making provider calls', async () => {
      const id = await submitted();
      const changedService = new MpesaAttemptService(repository, new MpesaCallbackRepository(), billing, client, 'sandbox', { ...merchant, partyB: '600000' });
      const query = vi.spyOn(client, 'query');
      vi.mocked(client.token).mockClear();
      await expect(changedService.verify(id, actor)).rejects.toMatchObject({ code: 'MPESA_MERCHANT_CONFLICT' });
      expect(query).not.toHaveBeenCalled();
      expect(client.token).not.toHaveBeenCalled();
      expect(await service.get(id, actor)).toMatchObject({ verificationStatus: 'UNVERIFIED', version: 2 });
    });
  });

  describe('reconciliation safety regressions', () => {
    const success: StkQueryResult = { state: 'SUCCESS', resultCode: 0, resultDesc: 'Processed',
      merchantRequestId: 'merchant-test', checkoutRequestId: 'checkout-test' };
    const uncertain: StkQueryResult = { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    const submitted = async () => {
      const attempt = await service.create(invoiceId, input(), actor);
      await service.submit(attempt.id, 0, actor);
      vi.mocked(client.submit).mockClear();
      vi.mocked(client.token).mockClear();
      return attempt.id;
    };
    const due = (id: string) => MpesaAttemptModel.updateOne({ _id: id }, { $set: { nextReconciliationAt: new Date(0) } });

    afterEach(async () => {
      expect(client.submit).not.toHaveBeenCalled();
      expect(await BillingPaymentModel.countDocuments()).toBe(0);
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ paidAmount: 0, balanceAmount: 100, status: 'PENDING' });
    });

    it('does not claim or query an attempt outside staff branch scope', async () => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect(await service.reconcileEligible({ limit: 10 }, outsider)).toEqual({ processed: 0, resolved: 0, unresolved: 0, conflicts: 0 });
      expect(query).not.toHaveBeenCalled();
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 0, version: 2 });
    });

    it('enforces permission and branch scope through the reconciliation HTTP endpoint', async () => {
      const id = await submitted();
      const { app, services } = await buildApp();
      try {
        services.mpesaAttempts = service;
        vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({ id: outsider, username: 'outsider',
          fullName: 'Outside scope', email: null, status: 'active', patientId: null });
        const permission = vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(false);
        const query = vi.spyOn(client, 'query').mockResolvedValue(success);
        const request = { method: 'POST' as const, url: '/api/payments/mpesa/reconcile',
          headers: { authorization: 'Bearer synthetic' }, payload: { limit: 10 } };
        expect((await app.inject(request)).statusCode).toBe(403);
        permission.mockResolvedValue(true);
        const scoped = await app.inject(request);
        expect(scoped.statusCode).toBe(200);
        expect(scoped.json().data.processed).toBe(0);
        expect(query).not.toHaveBeenCalled();
        expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 0, version: 2 });
      } finally { await app.close(); }
    });

    it('intersects worker and staff scope with the merchant branch allowlist', async () => {
      const id = await submitted();
      const otherBranch = new Types.ObjectId().toString();
      const snapshot = await repository.get(id);
      await MpesaAttemptModel.create({ ...snapshot, _id: new Types.ObjectId().toString(), invoiceId: new Types.ObjectId().toString(),
        branchId: otherBranch, checkoutRequestId: 'other-checkout', idempotencyKey: randomUUID() });
      const query = vi.spyOn(client, 'query').mockResolvedValue(uncertain);
      const multiBranch = new MpesaAttemptService(repository, new MpesaCallbackRepository(), billing, client, 'sandbox', { ...merchant, branchIds: [branchId, otherBranch] });
      expect((await multiBranch.reconcileEligible({ limit: 10 }, actor)).processed).toBe(1);
      expect(query).toHaveBeenCalledOnce();
      expect(await MpesaAttemptModel.findOne({ branchId: otherBranch }).lean()).toMatchObject({ reconciliationRetries: 0 });
      // System sweeps also respect merchant configuration, even without a staff scope.
      expect((await service.reconcileEligible({ limit: 10 })).processed).toBe(0);
      expect(query).toHaveBeenCalledOnce();
    });

    it.each(['oauth', 'query'])('rejects revoked staff scope during %s', async (stage) => {
      const id = await submitted();
      const revoke = () => UserModel.updateOne({ _id: actor }, { $set: { branchIds: [] } });
      const query = vi.spyOn(client, 'query').mockImplementation(async () => {
        if (stage === 'query') await revoke();
        return success;
      });
      if (stage === 'oauth') vi.mocked(client.token).mockImplementationOnce(async () => { await revoke(); return 'synthetic-token'; });
      expect((await service.reconcileEligible({ limit: 1 }, actor)).unresolved).toBe(1);
      if (stage === 'oauth') expect(query).not.toHaveBeenCalled();
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'UNVERIFIED', reconciliationRetries: 1, reconciliationClaimedBy: null });
    });

    it.each([
      { submissionState: 'UNKNOWN', verificationStatus: 'UNRESOLVED' },
      { submissionState: 'PENDING', verificationStatus: 'UNVERIFIED' },
      { submissionState: 'PENDING', verificationStatus: 'UNRESOLVED' },
    ])('honours future due times for $submissionState/$verificationStatus', async (state) => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { ...state, nextReconciliationAt: new Date(Date.now() + 60000) } });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(0);
      expect(query).not.toHaveBeenCalled();
      await due(id);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).resolved).toBe(1);
    });

    it('backs off uncertainty and counts each reserved retry once', async () => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockResolvedValue(uncertain);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(1);
      const first = await repository.get(id);
      expect(first).toMatchObject({ reconciliationRetries: 1, verificationStatus: 'UNRESOLVED', active: true, reconciliationClaimedBy: null });
      expect(first!.nextReconciliationAt!.getTime()).toBeGreaterThan(Date.now() + 25000);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(0);
      await due(id);
      await service.reconcileEligible({ limit: 10 }, actor);
      const second = await repository.get(id);
      expect(second?.reconciliationRetries).toBe(2);
      expect(second!.nextReconciliationAt!.getTime()).toBeGreaterThan(Date.now() + 55000);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('stops after the fifth uncertain query and keeps the invoice lock', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { reconciliationRetries: 4 } });
      const query = vi.spyOn(client, 'query').mockResolvedValue(uncertain);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(1);
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 5, recoveryStatus: 'MANUAL_REVIEW_REQUIRED', active: true, nextReconciliationAt: null });
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(0);
      expect(query).toHaveBeenCalledOnce();
    });

    it('recovers a crashed fifth reservation without a sixth provider request', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { reconciliationRetries: 5, recoveryStatus: 'IN_RECOVERY',
        reconciliationClaimedBy: 'crashed-worker', reconciliationClaimedAt: new Date(Date.now() - 65000) } });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 5, recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
        conflictingEvidence: 'RECONCILIATION_RETRIES_EXHAUSTED', active: true, reconciliationClaimedBy: null });
      expect(query).not.toHaveBeenCalled();
      expect(client.token).not.toHaveBeenCalled();
    });

    it('atomically gives one live lease and reserves one retry across concurrent claimers', async () => {
      const id = await submitted();
      const claims = await Promise.all(['worker-a', 'worker-b'].map((worker) => repository.claimForReconciliation('sandbox', worker, 60000, [branchId])));
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 1, version: 3 });
    });

    it('fences late results and lease release after another worker takes over', async () => {
      const id = await submitted();
      let finish: (result: StkQueryResult) => void = () => { throw new Error('Deferred query not initialized'); };
      const pending = new Promise<StkQueryResult>((resolve) => { finish = resolve; });
      const query = vi.spyOn(client, 'query').mockReturnValueOnce(pending).mockResolvedValue(success);
      const old = service.reconcileEligible({ limit: 1 }, actor);
      await vi.waitFor(() => expect(query).toHaveBeenCalledOnce());
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { reconciliationClaimedAt: new Date(Date.now() - 65000) } });
      const replacement = await repository.claimForReconciliation('sandbox', 'replacement-worker', 60000, [branchId]);
      expect(replacement).not.toBeNull();
      finish(success);
      expect((await old).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'UNVERIFIED', reconciliationRetries: 2,
        reconciliationClaimedBy: 'replacement-worker', reconciliationClaimedAt: replacement!.reconciliationClaimedAt });
      expect(await service.reconcileSingle(replacement!, 'replacement-worker', actor)).toMatchObject({ status: 'RESOLVED' });
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'VERIFIED', reconciliationClaimedBy: null });
    });

    it('does not query an expired claim', async () => {
      const id = await submitted();
      const claim = await repository.claimForReconciliation('sandbox', 'expired-worker', 60000, [branchId]);
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { reconciliationClaimedAt: new Date(Date.now() - 65000) } });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect(await service.reconcileSingle(claim!, 'expired-worker', actor)).toMatchObject({ status: 'STALE' });
      expect(query).not.toHaveBeenCalled();
    });

    it('releases failed queries with a future due time without retrying in the same batch', async () => {
      const id = await submitted();
      const query = vi.spyOn(client, 'query').mockRejectedValue(new Error('synthetic transport failure'));
      expect((await service.reconcileEligible({ limit: 10 }, actor)).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 1, reconciliationClaimedBy: null, active: true });
      expect((await repository.get(id))!.nextReconciliationAt!.getTime()).toBeGreaterThan(Date.now());
      expect(query).toHaveBeenCalledOnce();
    });

    it('rolls back completed evidence when its audit fails, retaining the reserved retry', async () => {
      const id = await submitted();
      vi.spyOn(client, 'query').mockResolvedValue(success);
      const audit = repository.audit.bind(repository);
      vi.spyOn(repository, 'audit').mockImplementation(async (...args) => {
        if (args[0] === 'mpesa.attempt.reconciled') throw new Error('synthetic audit unavailable');
        return audit(...args);
      });
      expect((await service.reconcileEligible({ limit: 10 }, actor)).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'UNVERIFIED', reconciliationRetries: 1, reconciliationClaimedBy: null });
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.reconciled' })).toBe(0);
    });

    it('rolls back retry reservation when claim audit fails', async () => {
      const id = await submitted();
      vi.spyOn(repository, 'audit').mockRejectedValue(new Error('synthetic audit unavailable'));
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      await expect(service.reconcileEligible({ limit: 1 }, actor)).rejects.toThrow();
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 0, version: 2 });
      expect(query).not.toHaveBeenCalled();
    });

    it('replays durable unmatched callbacks before evaluating provider evidence', async () => {
      const id = await submitted();
      const audit = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('synthetic audit unavailable'));
      await expect(callbacks.receive(callbackPayload())).rejects.toThrow();
      expect(await MpesaCallbackEventModel.findOne().lean()).toMatchObject({ processingStatus: 'UNMATCHED' });
      audit.mockRestore();
      vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 1 }, actor)).resolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'VERIFIED', reportedOutcome: 'SUCCESS', receiptNumber: 'TESTRECEIPT1' });
      expect(await MpesaCallbackEventModel.findOne().lean()).toMatchObject({ processingStatus: 'MATCHED' });
    });

    it('keeps worker audit attribution distinct from callbacks', async () => {
      const id = await submitted();
      vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 1 })).resolved).toBe(1);
      const events = await AuditLogModel.find({ eventType: { $in: ['mpesa.reconciliation.claimed', 'mpesa.attempt.reconciled'] } }).lean();
      expect(events).toHaveLength(2);
      for (const event of events) expect(event.metadataJson).toMatchObject({ attemptId: id, source: 'RECONCILIATION_WORKER' });
    });

    it('rejects results when immutable payer details change while querying', async () => {
      const id = await submitted();
      vi.spyOn(client, 'query').mockImplementationOnce(async () => {
        await MpesaAttemptModel.updateOne({ _id: id }, { $set: { payerPhone: '254700000002' } });
        return success;
      });
      expect((await service.reconcileEligible({ limit: 1 }, actor)).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'UNVERIFIED', active: true });
    });

    it('requires manual review after merchant configuration changes without querying', async () => {
      const id = await submitted();
      const changed = new MpesaAttemptService(repository, new MpesaCallbackRepository(), billing, client, 'sandbox', { ...merchant, partyB: '600000' });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await changed.reconcileEligible({ limit: 10 }, actor)).unresolved).toBe(1);
      expect(await repository.get(id)).toMatchObject({ verificationStatus: 'UNRESOLVED', recoveryStatus: 'MANUAL_REVIEW_REQUIRED', conflictingEvidence: 'MERCHANT_CONFIGURATION_CHANGED' });
      expect((await AuditLogModel.findOne({ eventType: 'mpesa.reconciliation.manual_review_needed' }).lean())?.metadataJson)
        .toMatchObject({ newVerificationStatus: 'UNRESOLVED', newRecoveryStatus: 'MANUAL_REVIEW_REQUIRED' });
      expect(query).not.toHaveBeenCalled();
      expect(client.token).not.toHaveBeenCalled();
    });

    it('counts conflicts separately from unresolved attempts', async () => {
      await submitted();
      vi.spyOn(client, 'query').mockResolvedValue({ ...success, merchantRequestId: 'wrong-merchant' });
      expect(await service.reconcileEligible({ limit: 10 }, actor)).toEqual({ processed: 1, resolved: 0, unresolved: 0, conflicts: 1 });
    });

    it('stops before claiming when shutdown is already requested', async () => {
      const id = await submitted();
      const controller = new AbortController(); controller.abort();
      expect((await service.reconcileEligible({ limit: 10 }, undefined, controller.signal)).processed).toBe(0);
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 0 });
    });

    it('rejects malformed batch limits before claiming', async () => {
      const id = await submitted();
      for (const limit of [0, 51]) await expect(service.reconcileEligible({ limit }, actor)).rejects.toThrow();
      expect(await repository.get(id)).toMatchObject({ reconciliationRetries: 0 });
    });

    it('does not steal a normally progressing STK submission', async () => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { submissionState: 'SUBMITTING', submittedAt: new Date(Date.now() - 45000) } });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(0);
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      { verificationStatus: 'VERIFIED' }, { recoveryStatus: 'MANUAL_REVIEW_REQUIRED' },
      { postingStatus: 'POSTED' }, { conflictingEvidence: 'AMOUNT_MISMATCH' },
    ])('excludes terminal, posted or conflicting attempts: %j', async (fields) => {
      const id = await submitted();
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: fields });
      const query = vi.spyOn(client, 'query').mockResolvedValue(success);
      expect((await service.reconcileEligible({ limit: 10 }, actor)).processed).toBe(0);
      expect(query).not.toHaveBeenCalled();
    });
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
