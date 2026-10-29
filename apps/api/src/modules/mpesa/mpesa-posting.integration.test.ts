import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { BillingInvoiceModel, BillingInvoiceItemModel, BillingPaymentModel } from '../billing/billing.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { AdvancePaymentService } from '../advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../advance-payment/advance-payment.repository.js';
import { AdvancePaymentModel } from '../advance-payment/advance-payment.model.js';
import { ServiceRepository } from '../services/service.repository.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import { OpdClinicalOrderRepository } from '../opd/opd-clinical-order.repository.js';
import { MpesaAttemptModel } from './mpesa-attempt.model.js';
import { MpesaAttemptRepository } from './mpesa-attempt.repository.js';
import { MpesaAttemptService } from './mpesa-attempt.service.js';
import { MpesaPostingService } from './mpesa-posting.service.js';
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

const callbackPayload = (code = 0, amount = 10, checkoutRequestId = 'checkout-test', receipt = 'TESTRECEIPT1') => ({
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
            { Name: 'MpesaReceiptNumber', Value: receipt },
          ],
        },
      } : {}),
    },
  },
});

describe('M-PESA Phase 2: Verified Financial Posting & Billing Integration', () => {
  let mongo: MongoMemoryReplSet;
  let invoiceId: string;
  let patientId: string;
  let repository: MpesaAttemptRepository;
  let billingRepository: BillingRepository;
  let advancePaymentService: AdvancePaymentService;
  let billingService: BillingService;
  let client: MpesaDarajaClient;
  let attemptService: MpesaAttemptService;
  let postingService: MpesaPostingService;
  let callbacks: MpesaCallbackService;

  const input = (amount = 10) => ({
    amount,
    payerPhone: '254700000001',
    idempotencyKey: randomUUID(),
  });

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      MpesaAttemptModel.init(),
      MpesaCallbackEventModel.init(),
      BillingInvoiceModel.init(),
      BillingInvoiceItemModel.init(),
      BillingPaymentModel.init(),
      AdvancePaymentModel.init(),
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
      BillingInvoiceItemModel.deleteMany({}),
      BillingPaymentModel.deleteMany({}),
      AdvancePaymentModel.deleteMany({}),
      UserModel.deleteMany({}),
      BranchModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ]);

    await BranchModel.create({ _id: branchId, code: 'TEST', name: 'Synthetic branch', status: 'ACTIVE' });
    await UserModel.create([
      { _id: actor, username: 'test-user', email: 'test@example.test', fullName: 'Synthetic user', passwordHash: 'unused', branchIds: [branchId] },
      { _id: outsider, username: 'outsider', email: 'outsider@example.test', fullName: 'Outside scope', passwordHash: 'unused', branchIds: [] },
    ]);

    patientId = new Types.ObjectId().toString();
    const invoice = await BillingInvoiceModel.create({
      invoiceNumber: 'INV-TEST-001',
      patientId: new Types.ObjectId(patientId),
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
    billingRepository = new BillingRepository();
    const advancePaymentRepo = new AdvancePaymentRepository();
    advancePaymentService = new AdvancePaymentService(advancePaymentRepo);

    billingService = new BillingService(
      billingRepository,
      new PatientRepository(),
      new OpdVisitRepository(),
      new AppointmentRepository(),
      new OpdConsultationRepository(),
      new OpdClinicalOrderRepository(),
      new ServiceRepository(),
      advancePaymentService,
    );

    postingService = new MpesaPostingService(
      repository,
      billingRepository,
      advancePaymentService,
      billingService,
    );

    client = new MpesaDarajaClient();
    vi.spyOn(client, 'token').mockResolvedValue('synthetic-token');
    vi.spyOn(client, 'submit').mockResolvedValue({
      state: 'PENDING',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });

    const callbackRepository = new MpesaCallbackRepository();
    attemptService = new MpesaAttemptService(
      repository,
      callbackRepository,
      billingRepository,
      client,
      'sandbox',
      merchant,
    );

    callbacks = new MpesaCallbackService(
      callbackRepository,
      new AuthRateLimitRepository(),
      { environment: 'sandbox', perIpLimit: 120, globalLimit: 600 },
      attemptService,
    );
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  // Helper to establish a verified attempt with receipt
  async function createVerifiedAttempt(amount = 10, checkoutId = 'checkout-test', receipt = 'TESTRECEIPT1') {
    const created = await attemptService.create(invoiceId, input(amount), actor);
    vi.mocked(client.submit).mockResolvedValueOnce({ state: 'PENDING', merchantRequestId: 'merchant-test', checkoutRequestId: checkoutId });
    await attemptService.submit(created.id, 0, actor);
    await callbacks.receive(callbackPayload(0, amount, checkoutId, receipt));

    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Success',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: checkoutId,
    });

    await attemptService.verify(created.id, actor);
    return created.id;
  }

  it('1. Verified successful transaction posts exactly once', async () => {
    const attemptId = await createVerifiedAttempt(50);
    const result = await postingService.postPayment(attemptId, actor);

    expect(result.idempotent).toBe(false);
    expect(result.attempt.postingStatus).toBe('POSTED');
    expect(result.attempt.billingPaymentId).toBeDefined();
    expect(result.payment.amount).toBe(50);
    expect(result.payment.payment_method).toBe('MPESA');
    expect(result.payment.reference_number).toBe('TESTRECEIPT1');

    // Exactly one payment in DB
    expect(await BillingPaymentModel.countDocuments()).toBe(1);

    // Calling postPayment again is idempotent
    const repeat = await postingService.postPayment(attemptId, actor);
    expect(repeat.idempotent).toBe(true);
    expect(repeat.payment?.id).toBe(result.payment.id);
    expect(await BillingPaymentModel.countDocuments()).toBe(1);
  });

  it('2. Invoice becomes partially paid when partial amount posted', async () => {
    const attemptId = await createVerifiedAttempt(40);
    const result = await postingService.postPayment(attemptId, actor);

    expect(result.invoice.status).toBe('PARTIALLY_PAID');
    expect(result.invoice.paid_amount).toBe(40);
    expect(result.invoice.balance_amount).toBe(60);

    const dbInvoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(dbInvoice?.status).toBe('PARTIALLY_PAID');
    expect(dbInvoice?.paidAmount).toBe(40);
    expect(dbInvoice?.balanceAmount).toBe(60);
  });

  it('3. Invoice becomes fully paid when full balance posted', async () => {
    const attemptId = await createVerifiedAttempt(100);
    const result = await postingService.postPayment(attemptId, actor);

    expect(result.invoice.status).toBe('PAID');
    expect(result.invoice.paid_amount).toBe(100);
    expect(result.invoice.balance_amount).toBe(0);

    const dbInvoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(dbInvoice?.status).toBe('PAID');
    expect(dbInvoice?.balanceAmount).toBe(0);
  });

  it('4. Billing payment record is persisted with all M-Pesa provider references', async () => {
    const attemptId = await createVerifiedAttempt(25, 'checkout-test', 'MPESAREC999');
    await postingService.postPayment(attemptId, actor);

    const payment = await BillingPaymentModel.findOne({ mpesaAttemptId: attemptId }).lean();
    expect(payment).toBeDefined();
    expect(payment).toMatchObject({
      amount: 25,
      paymentMethod: 'MPESA',
      provider: 'MPESA',
      referenceNumber: 'MPESAREC999',
      mpesaReceiptNumber: 'MPESAREC999',
      checkoutRequestId: 'checkout-test',
      merchantRequestId: 'merchant-test',
    });
    expect(payment?.transactionVerificationTimestamp).toBeDefined();
    expect(payment?.financialPostingTimestamp).toBeDefined();
  });

  it('5. Receipt is available after posting and format conforms to official RCT number', async () => {
    const attemptId = await createVerifiedAttempt(30, 'checkout-test', 'RCTPROOF01');
    await postingService.postPayment(attemptId, actor);

    const receipt = await postingService.getReceiptForAttempt(attemptId, actor);
    expect(receipt.receipt_number).toMatch(/^RCT-\d{8}-[A-F0-9]{8}$/);
    expect(receipt.payment.payment_method).toBe('MPESA');
    expect(receipt.payment.reference_number).toBe('RCTPROOF01');
    expect(receipt.invoice.id).toBe(invoiceId);

    // Audit log recorded receipt generation
    expect(await AuditLogModel.countDocuments({ eventType: 'billing.receipt.generated' })).toBe(1);
  });

  it('6. Duplicate callbacks do not duplicate ledger entries', async () => {
    const attemptId = await createVerifiedAttempt(50);
    await postingService.postPayment(attemptId, actor);

    // Receive duplicate callbacks
    await callbacks.receive(callbackPayload(0, 50, 'checkout-test'));
    await callbacks.receive(callbackPayload(0, 50, 'checkout-test'));

    expect(await BillingPaymentModel.countDocuments()).toBe(1);
    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(50);
  });

  it('7. Duplicate verification does not duplicate posting', async () => {
    const attemptId = await createVerifiedAttempt(50);
    await postingService.postPayment(attemptId, actor);

    // Staff clicks verify again
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Success',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });
    await attemptService.verify(attemptId, actor);

    // Payment remains exactly one
    expect(await BillingPaymentModel.countDocuments()).toBe(1);
    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('POSTED');
  });

  it('8. Concurrent posting requests create exactly one payment', async () => {
    const attemptId = await createVerifiedAttempt(50);

    // Trigger two posting requests simultaneously
    const [res1, res2] = await Promise.allSettled([
      postingService.postPayment(attemptId, actor),
      postingService.postPayment(attemptId, actor),
    ]);

    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Storage level uniqueness: only 1 BillingPayment exists
    expect(await BillingPaymentModel.countDocuments()).toBe(1);
    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(50);
    expect(invoice?.balanceAmount).toBe(50);
  });

  it('9. Database transaction failure rolls back all changes', async () => {
    const attemptId = await createVerifiedAttempt(50);

    // Simulate an audit logging failure inside transaction
    vi.spyOn(billingRepository, 'audit').mockRejectedValueOnce(new Error('Synthetic audit outage'));

    await expect(postingService.postPayment(attemptId, actor)).rejects.toThrow();

    // Invariant: zero billing payments, invoice untouched
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(0);
    expect(invoice?.balanceAmount).toBe(100);

    // Attempt reflects posting failure
    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('POSTING_FAILED');
  });

  it('10. Unverified attempts cannot post', async () => {
    const created = await attemptService.create(invoiceId, input(50), actor);
    await attemptService.submit(created.id, 0, actor);

    // Attempt is unverified
    await expect(postingService.postPayment(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_NOT_VERIFIED',
    });
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('11. Failed, cancelled, or timeout attempts cannot post', async () => {
    const created = await attemptService.create(invoiceId, input(50), actor);
    await attemptService.submit(created.id, 0, actor);

    // Simulate query returning CANCELLED
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'CANCELLED',
      resultCode: 1032,
      resultDesc: 'Cancelled by user',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });
    await attemptService.verify(created.id, actor);

    await expect(postingService.postPayment(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_NOT_VERIFIED',
    });
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('12. Conflicting evidence blocks posting', async () => {
    const created = await attemptService.create(invoiceId, input(50), actor);
    await attemptService.submit(created.id, 0, actor);
    await callbacks.receive(callbackPayload(1032, 50, 'checkout-test'));

    // STK query says SUCCESS -> CONFLICT
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Success',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });
    await attemptService.verify(created.id, actor);

    await expect(postingService.postPayment(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_CONFLICT',
    });
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('13. Missing verified receipt reference blocks posting', async () => {
    const created = await attemptService.create(invoiceId, input(50), actor);
    await attemptService.submit(created.id, 0, actor);

    // STK query succeeds, but callback never arrived (missing MpesaReceiptNumber)
    vi.spyOn(client, 'query').mockResolvedValueOnce({
      state: 'SUCCESS',
      resultCode: 0,
      resultDesc: 'Success',
      merchantRequestId: 'merchant-test',
      checkoutRequestId: 'checkout-test',
    });
    await attemptService.verify(created.id, actor);

    await expect(postingService.postPayment(created.id, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_MISSING_RECEIPT',
    });
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
  });

  it('14. Already-paid invoice conflict is handled with auditable exception state', async () => {
    const attemptId = await createVerifiedAttempt(50);

    // Settle invoice manually via Cash first
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, {
      $set: { status: 'PAID', paidAmount: 100, balanceAmount: 0 },
    });

    await expect(postingService.postPayment(attemptId, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_INVOICE_ALREADY_PAID',
    });

    // Invariant: no duplicate payment, attempt enters MANUAL_REVIEW_REQUIRED
    expect(await BillingPaymentModel.countDocuments()).toBe(0);
    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(attempt.conflictingEvidence).toBe('INVOICE_ALREADY_PAID');

    // Recorded in audit
    expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.posting.exception' })).toBe(1);
  });

  it('15. Manual payment and M-Pesa concurrency is controlled without overpayment', async () => {
    const attemptId = await createVerifiedAttempt(70);

    // Another payment reduced balance to KES 20
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, {
      $set: { status: 'PARTIALLY_PAID', paidAmount: 80, balanceAmount: 20 },
    });

    // Attempt amount is 70 > 20
    await expect(postingService.postPayment(attemptId, actor)).rejects.toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
    });

    expect(await BillingPaymentModel.countDocuments()).toBe(0);
    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(attempt.conflictingEvidence).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  it('16. Admission advance requirements are updated only after committed posting', async () => {
    const admissionRequestId = new Types.ObjectId().toString();

    // Link invoice to admission request context
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, {
      $set: {
        contextType: 'ADMISSION_REQUEST',
        contextId: new Types.ObjectId(admissionRequestId),
      },
    });

    // Create advance requirement
    await advancePaymentService.syncRequirement({
      source_type: 'ADMISSION_REQUEST',
      source_id: admissionRequestId,
      patient_id: patientId,
      branch_id: branchId,
      required_amount: 50,
      requirement_status: 'REQUIRED',
    }, actor);

    const attemptId = await createVerifiedAttempt(50);
    await postingService.postPayment(attemptId, actor);

    // Requirement is satisfied
    const req = await advancePaymentService.getBySource('ADMISSION_REQUEST', admissionRequestId);
    expect(req).toBeDefined();
    expect(req?.paid_amount).toBe(50);
    expect(req?.payment_status).toBe('PAID');
  });

  it('17. No overpayment occurs if attempt exceeds invoice balance', async () => {
    // Attempt created for 50 when invoice balance was 100
    const attemptId = await createVerifiedAttempt(50);

    // Later invoice balance is reduced to 20 by another payment
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, {
      $set: { status: 'PARTIALLY_PAID', paidAmount: 80, balanceAmount: 20 },
    });

    await expect(postingService.postPayment(attemptId, actor)).rejects.toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
    });

    const invoice = await BillingInvoiceModel.findById(invoiceId).lean();
    expect(invoice?.paidAmount).toBe(80);
    expect(invoice?.balanceAmount).toBe(20);

    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('18. Branch RBAC and patient isolation are preserved', async () => {
    const attemptId = await createVerifiedAttempt(50);

    // Outsider user from another branch cannot post
    await expect(postingService.postPayment(attemptId, outsider)).rejects.toMatchObject({
      statusCode: 404,
    });

    // Outsider cannot get payment or receipt
    await expect(postingService.getPaymentForAttempt(attemptId, outsider)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(postingService.getReceiptForAttempt(attemptId, outsider)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('19. Late verified transactions enter a safe exception workflow if invoice was cancelled', async () => {
    const attemptId = await createVerifiedAttempt(50);

    // Invoice cancelled while payment was in transit
    await BillingInvoiceModel.updateOne({ _id: invoiceId }, {
      $set: { status: 'CANCELLED', balanceAmount: 0 },
    });

    await expect(postingService.postPayment(attemptId, actor)).rejects.toMatchObject({
      code: 'MPESA_POSTING_INVOICE_CANCELLED',
    });

    const attempt = await attemptService.get(attemptId, actor);
    expect(attempt.postingStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(attempt.conflictingEvidence).toBe('INVOICE_CANCELLED_WHILE_PAYMENT_VERIFIED');

    // Listed in exceptions
    const exceptions = await postingService.listExceptions(actor);
    expect(exceptions.items.some((e) => e.id === attemptId)).toBe(true);
  });

  it('20. Financial posting remains idempotent after service restart', async () => {
    const attemptId = await createVerifiedAttempt(50);
    const firstResult = await postingService.postPayment(attemptId, actor);

    // Simulate application restart by instantiating fresh service instances
    const freshPostingService = new MpesaPostingService(
      new MpesaAttemptRepository(),
      new BillingRepository(),
      advancePaymentService,
      billingService,
    );

    const restartResult = await freshPostingService.postPayment(attemptId, actor);
    expect(restartResult.idempotent).toBe(true);
    expect(restartResult.payment?.id).toBe(firstResult.payment.id);
    expect(await BillingPaymentModel.countDocuments()).toBe(1);

    const receipt = await freshPostingService.getReceiptForAttempt(attemptId, actor);
    expect(receipt.receipt_number).toBe(firstResult.payment.payment_number.replace(/^PAY-/, 'RCT-'));
  });

  describe('billing-posting safety regressions', () => {
    const expectNoPayment = async () => {
      expect(await BillingPaymentModel.countDocuments()).toBe(0);
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ paidAmount: 0, balanceAmount: 100 });
    };
    const beforeTransaction = (mutation: () => Promise<unknown>) => {
      const original = repository.session.bind(repository);
      vi.spyOn(repository, 'session').mockImplementationOnce(async () => {
        await mutation();
        return original();
      });
    };

    it.each([
      { name: 'verification status', update: { $set: { verificationStatus: 'UNVERIFIED' } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'conflicting evidence', update: { $set: { conflictingEvidence: 'LATE_EVIDENCE_CONFLICT' } }, code: 'MPESA_POSTING_CONFLICT' },
      { name: 'manual review', update: { $set: { recoveryStatus: 'MANUAL_REVIEW_REQUIRED' } }, code: 'MPESA_POSTING_CONFLICT' },
      { name: 'receipt removal', update: { $unset: { receiptNumber: 1 } }, code: 'MPESA_POSTING_MISSING_RECEIPT' },
      { name: 'invalid receipt', update: { $set: { receiptNumber: 'NOT A RECEIPT' } }, code: 'MPESA_POSTING_MISSING_RECEIPT' },
      { name: 'changed receipt', update: { $set: { receiptNumber: 'DIFFERENTRECEIPT' } }, code: 'MPESA_POSTING_CONFLICT' },
      { name: 'query outcome', update: { $set: { queryOutcome: 'UNKNOWN' } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'query result', update: { $set: { 'lastQueryResult.resultCode': 1 } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'verification provenance', update: { $set: { verificationSource: 'CALLBACK' } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'verification timestamp', update: { $unset: { lastVerifiedAt: 1 } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'callback outcome', update: { $set: { reportedOutcome: 'CANCELLED' } }, code: 'MPESA_POSTING_NOT_VERIFIED' },
      { name: 'checkout identifier', update: { $unset: { checkoutRequestId: 1 } }, code: 'MPESA_POSTING_INVALID_STATE' },
      { name: 'merchant identifier', update: { $unset: { merchantRequestId: 1 } }, code: 'MPESA_POSTING_INVALID_STATE' },
      { name: 'changed checkout identifier', update: { $set: { checkoutRequestId: 'different-checkout' } }, code: 'MPESA_POSTING_CONFLICT' },
      { name: 'submission state', update: { $set: { submissionState: 'REJECTED' } }, code: 'MPESA_POSTING_INVALID_STATE' },
      { name: 'invalid amount', update: { $set: { amount: 0 } }, code: 'MPESA_POSTING_INVALID_STATE' },
      { name: 'changed amount', update: { $set: { amount: 25 } }, code: 'MPESA_POSTING_CONFLICT' },
      { name: 'stale version', update: { $inc: { version: 1 } }, code: 'MPESA_POSTING_CONFLICT' },
    ])('rechecks $name after preflight and before posting', async ({ update, code }) => {
      const id = await createVerifiedAttempt(50);
      beforeTransaction(() => MpesaAttemptModel.updateOne({ _id: id }, update));
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ code });
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ postingStatus: 'DISABLED', active: true });
      await expectNoPayment();
    });

    it('rechecks patient and branch identity inside the transaction', async () => {
      const id = await createVerifiedAttempt(50);
      beforeTransaction(() => BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { patientId: new Types.ObjectId() } }));
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ code: 'MPESA_ATTEMPT_CONFLICT' });
      await expectNoPayment();
    });

    it('rechecks staff branch access inside the transaction', async () => {
      const id = await createVerifiedAttempt(50);
      beforeTransaction(() => UserModel.updateOne({ _id: actor }, { $set: { branchIds: [] } }));
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ statusCode: 404 });
      await expectNoPayment();
    });

    it('rejects a verification change after the transaction snapshot and preserves the conflict on retry', async () => {
      const id = await createVerifiedAttempt(50);
      const update = repository.updatePosting.bind(repository);
      vi.spyOn(repository, 'updatePosting').mockImplementationOnce(async (...args) => {
        await MpesaAttemptModel.updateOne({ _id: id }, { $set: { verificationStatus: 'CONFLICT',
          conflictingEvidence: 'CONCURRENT_VERIFICATION_CONFLICT', recoveryStatus: 'MANUAL_REVIEW_REQUIRED' }, $inc: { version: 1 } });
        return update(...args);
      });
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ code: 'MPESA_POSTING_CONFLICT' });
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ verificationStatus: 'CONFLICT',
        conflictingEvidence: 'CONCURRENT_VERIFICATION_CONFLICT', postingStatus: 'DISABLED', active: true });
      await expectNoPayment();
    });

    it('decides cancelled-invoice exceptions from the current transactional invoice', async () => {
      const id = await createVerifiedAttempt(50);
      beforeTransaction(() => BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { status: 'CANCELLED' } }));
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ code: 'MPESA_POSTING_INVOICE_CANCELLED' });
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ postingStatus: 'MANUAL_REVIEW_REQUIRED', active: true });
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.posting.exception' })).toBe(1);
      await expectNoPayment();
    });

    it('posts two separately verified partial attempts without leaving the invoice locked', async () => {
      const firstId = await createVerifiedAttempt(40, 'checkout-first', 'TESTFIRST1');
      const first = await postingService.postPayment(firstId, actor);
      expect(first.invoice).toMatchObject({ status: 'PARTIALLY_PAID', balance_amount: 60 });
      expect(await MpesaAttemptModel.findById(firstId).lean()).toMatchObject({ active: false });
      const secondId = await createVerifiedAttempt(60, 'checkout-second', 'TESTSECOND2');
      const second = await postingService.postPayment(secondId, actor);
      expect(second.invoice).toMatchObject({ status: 'PAID', paid_amount: 100, balance_amount: 0 });
      expect(await MpesaAttemptModel.countDocuments({ active: true })).toBe(0);
      expect(await BillingPaymentModel.countDocuments()).toBe(2);
      const retry = await postingService.postPayment(firstId, actor);
      expect(retry.idempotent).toBe(true);
      expect(retry.payment.id).toBe(first.payment.id);
      expect(await BillingPaymentModel.countDocuments()).toBe(2);
    });

    it('allows only one new unresolved attempt after a partial posting', async () => {
      const id = await createVerifiedAttempt(40);
      await postingService.postPayment(id, actor);
      const results = await Promise.allSettled([attemptService.create(invoiceId, input(10), actor), attemptService.create(invoiceId, input(10), actor)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await MpesaAttemptModel.countDocuments({ active: true })).toBe(1);
    });

    it('safely releases a legacy posted lock only after validating its existing ledger payment', async () => {
      const id = await createVerifiedAttempt(40);
      const posted = await postingService.postPayment(id, actor);
      await MpesaAttemptModel.updateOne({ _id: id }, { $set: { active: true } });
      const recovered = await postingService.postPayment(id, actor);
      expect(recovered.idempotent).toBe(true);
      expect(recovered.payment.id).toBe(posted.payment.id);
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: false });
      expect(await BillingPaymentModel.countDocuments()).toBe(1);
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.lock_released' })).toBe(1);
      await postingService.postPayment(id, actor);
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.lock_released' })).toBe(1);
      expect(await attemptService.create(invoiceId, input(60), actor)).toMatchObject({ amount: 60 });
    });

    it.each(['POSTED', 'MANUAL_REVIEW_REQUIRED'] as const)('failure annotation preserves concurrent %s state', async (state) => {
      const id = await createVerifiedAttempt(50);
      let afterRollback = false;
      const get = repository.get.bind(repository);
      vi.spyOn(repository, 'get').mockImplementation(async (...args) => {
        if (!args[1] && afterRollback) {
          afterRollback = false;
          if (state === 'POSTED') {
            const otherWorker = new MpesaPostingService(new MpesaAttemptRepository(), new BillingRepository(), advancePaymentService, billingService);
            await otherWorker.postPayment(id, actor);
          } else {
            await MpesaAttemptModel.updateOne({ _id: id }, { $set: { postingStatus: 'MANUAL_REVIEW_REQUIRED',
              recoveryStatus: 'MANUAL_REVIEW_REQUIRED', conflictingEvidence: 'CONCURRENT_REVIEW' }, $inc: { version: 1 } });
          }
        }
        return get(...args);
      });
      vi.spyOn(billingRepository, 'audit').mockImplementationOnce(async () => {
        afterRollback = true;
        throw new Error('Synthetic audit failure');
      });
      await expect(postingService.postPayment(id, actor)).rejects.toThrow('Synthetic audit failure');
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ postingStatus: state });
      if (state === 'POSTED') {
        expect(await BillingPaymentModel.countDocuments()).toBe(1);
        expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ paidAmount: 50, balanceAmount: 50 });
      } else {
        expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ conflictingEvidence: 'CONCURRENT_REVIEW', active: true });
        await expectNoPayment();
      }
    });

    it('rolls back lock release and permits an idempotent retry after audit storage recovers', async () => {
      const id = await createVerifiedAttempt(50);
      vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('Synthetic secret-like storage failure'));
      await expect(postingService.postPayment(id, actor)).rejects.toThrow();
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: true, postingStatus: 'POSTING_FAILED' });
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.posting.failed' })).toBe(1);
      expect((await attemptService.get(id, actor)).postingError).not.toContain('secret-like');
      await expect(attemptService.create(invoiceId, input(10), actor)).rejects.toMatchObject({ code: 'MPESA_ACTIVE_ATTEMPT_EXISTS' });
      await expectNoPayment();
      const retry = await postingService.postPayment(id, actor);
      expect(retry.attempt.postingStatus).toBe('POSTED');
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: false });
      expect(await BillingPaymentModel.countDocuments()).toBe(1);
      expect(await AuditLogModel.countDocuments({ eventType: 'mpesa.attempt.posted' })).toBe(1);
    });

    it('rolls back invoice, ledger, procedure advance, audit and lock together', async () => {
      const bookingId = new Types.ObjectId().toString();
      await BillingInvoiceModel.updateOne({ _id: invoiceId }, { $set: { contextType: 'PROCEDURE_BOOKING', contextId: new Types.ObjectId(bookingId) } });
      await advancePaymentService.syncRequirement({ source_type: 'PROCEDURE_BOOKING', source_id: bookingId,
        patient_id: patientId, branch_id: branchId, required_amount: 50, requirement_status: 'REQUIRED' }, actor);
      const id = await createVerifiedAttempt(50);
      vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('Synthetic final audit failure'));
      await expect(postingService.postPayment(id, actor)).rejects.toThrow();
      expect((await advancePaymentService.getBySource('PROCEDURE_BOOKING', bookingId))?.paid_amount).toBe(0);
      expect(await AuditLogModel.countDocuments({ eventType: 'billing.payment.collected' })).toBe(0);
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ active: true });
      await expectNoPayment();
      await postingService.postPayment(id, actor);
      expect((await advancePaymentService.getBySource('PROCEDURE_BOOKING', bookingId))?.paid_amount).toBe(50);
      expect(await BillingPaymentModel.countDocuments()).toBe(1);
    });

    it.each(['missing', 'inconsistent'] as const)('does not claim idempotent success for %s posted ledger linkage', async (state) => {
      const id = await createVerifiedAttempt(50);
      const posted = await postingService.postPayment(id, actor);
      if (state === 'missing') await BillingPaymentModel.deleteOne({ _id: posted.payment.id });
      else await BillingPaymentModel.updateOne({ _id: posted.payment.id }, { $set: { mpesaReceiptNumber: 'WRONGRECEIPT' } });
      await expect(postingService.postPayment(id, actor)).rejects.toMatchObject({ code: 'MPESA_POSTING_CONFLICT' });
      expect(await MpesaAttemptModel.findById(id).lean()).toMatchObject({ postingStatus: 'POSTED', active: false });
      expect(await BillingInvoiceModel.findById(invoiceId).lean()).toMatchObject({ paidAmount: 50, balanceAmount: 50 });
    });
  });

  it('21. Staff endpoints verify permissions and return sanitized output', async () => {
    const { app, services } = await buildApp();
    try {
      const attemptId = await createVerifiedAttempt(50);
      services.mpesaPosting = postingService;
      services.mpesaAttempts = attemptService;

      // 401 unauthenticated
      expect((await app.inject({ method: 'POST', url: `/api/payments/mpesa/attempts/${attemptId}/post` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: `/api/payments/mpesa/attempts/${attemptId}/payment` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: `/api/payments/mpesa/attempts/${attemptId}/receipt` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/payments/mpesa/exceptions' })).statusCode).toBe(401);

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

      const headers = { authorization: 'Bearer synthetic' };
      const postRes = await app.inject({
        method: 'POST',
        url: `/api/payments/mpesa/attempts/${attemptId}/post`,
        headers,
      });
      expect(postRes.statusCode).toBe(200);
      expect(postRes.json().data.payment).toMatchObject({ payment_method: 'MPESA', amount: 50 });

      // Linked payment endpoint
      const payRes = await app.inject({
        method: 'GET',
        url: `/api/payments/mpesa/attempts/${attemptId}/payment`,
        headers,
      });
      expect(payRes.statusCode).toBe(200);
      expect(payRes.json().data.payment.payment_method).toBe('MPESA');

      // Receipt endpoint
      const rctRes = await app.inject({
        method: 'GET',
        url: `/api/payments/mpesa/attempts/${attemptId}/receipt`,
        headers,
      });
      expect(rctRes.statusCode).toBe(200);
      expect(rctRes.json().data.receipt_number).toMatch(/^RCT-/);

      // Exceptions list endpoint
      const excRes = await app.inject({
        method: 'GET',
        url: '/api/payments/mpesa/exceptions',
        headers,
      });
      expect(excRes.statusCode).toBe(200);
      expect(excRes.json().data.items).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
