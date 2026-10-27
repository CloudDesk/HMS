import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import { executeTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { BillingRepository } from '../billing/billing.repository.js';
import type { BillingInvoice } from '../billing/billing.types.js';
import type { MpesaAttempt, MpesaSubmissionState } from './mpesa-attempt.model.js';
import type { MpesaAttemptRepository } from './mpesa-attempt.repository.js';
import type { MpesaCallbackRepository } from './mpesa-callback.repository.js';
import type { MpesaCallbackEvent } from './mpesa-callback.model.js';
import type { MpesaDarajaClient, StkSubmission } from './mpesa-daraja.client.js';
import { createAttemptSchema, parseAttemptInput, type CreateMpesaAttempt } from './mpesa-attempt.schemas.js';

const transitions: Record<MpesaSubmissionState, readonly MpesaSubmissionState[]> = {
  CREATED: ['SUBMITTING'], SUBMITTING: ['PENDING', 'UNKNOWN', 'REJECTED'], PENDING: [], UNKNOWN: [], REJECTED: [],
};
const conflict = () => new AppError('Payment attempt changed or cannot be submitted again', 409, 'MPESA_ATTEMPT_CONFLICT');
const unavailable = () => new AppError('M-PESA attempt storage unavailable; do not resend payment', 503, 'MPESA_ATTEMPT_UNAVAILABLE');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export class MpesaAttemptService {
  constructor(
    private readonly repository: MpesaAttemptRepository,
    private readonly callbacks: MpesaCallbackRepository,
    private readonly billing: BillingRepository,
    private readonly daraja: MpesaDarajaClient,
    private readonly environment: 'sandbox' | 'production',
    private readonly merchant?: MpesaMerchant,
  ) {}

  private transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    return executeTransaction(this.repository, async (session) => {
      if (!session) throw new AppError('M-PESA attempts require MongoDB transactions', 503, 'MPESA_TRANSACTIONS_REQUIRED');
      return operation(session);
    });
  }
  private configured(): MpesaMerchant {
    if (!this.merchant) throw new AppError('M-PESA submission is not configured', 503, 'MPESA_NOT_CONFIGURED');
    return this.merchant;
  }
  private payable(invoice: BillingInvoice, amount: number) {
    if (!['PENDING', 'PARTIALLY_PAID'].includes(invoice.status) || invoice.balance_amount < amount) {
      throw new AppError('Invoice is not payable for the requested amount', 409, 'MPESA_INVOICE_NOT_PAYABLE');
    }
  }
  private async invoice(id: string, actor: string, session?: ClientSession) {
    const scope = await this.billing.resolveBranchScope(actor);
    const invoice = await this.billing.getById(id, scope, session);
    if (!invoice) throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
    return invoice;
  }
  private async scoped(id: string, actor: string, session?: ClientSession) {
    const attempt = await this.repository.get(id, session);
    if (!attempt) throw new AppError('Payment attempt not found', 404, 'MPESA_ATTEMPT_NOT_FOUND');
    const invoice = await this.invoice(attempt.invoiceId, actor, session);
    if (invoice.branch_id !== attempt.branchId || invoice.patient_id !== attempt.patientId) throw conflict();
    return { attempt, invoice };
  }
  private view(attempt: MpesaAttempt) {
    return { id: attempt._id, invoiceId: attempt.invoiceId, amount: attempt.amount, currency: attempt.currency,
      payerPhoneMasked: `********${attempt.payerPhone.slice(-4)}`, environment: attempt.environment,
      submissionState: attempt.submissionState, reportedOutcome: attempt.reportedOutcome,
      verificationStatus: attempt.verificationStatus, postingStatus: attempt.postingStatus,
      version: attempt.version, checkoutRequestId: attempt.checkoutRequestId ?? null,
      merchantRequestId: attempt.merchantRequestId ?? null, submissionError: attempt.submissionError ?? null,
      createdAt: attempt.createdAt, updatedAt: attempt.updatedAt };
  }
  async get(id: string, actor: string) { return this.view((await this.scoped(id, actor)).attempt); }

  async create(invoiceId: string, input: CreateMpesaAttempt, actor: string) {
    const data = parseAttemptInput(createAttemptSchema, input);
    const merchant = this.configured();
    const id = hash(`${this.environment}:${invoiceId.toLowerCase()}:${data.idempotencyKey}`);
    const fingerprint = hash(JSON.stringify([data.amount, data.payerPhone]));
    // Authorization always precedes returning an idempotent response.
    const invoice = await this.invoice(invoiceId, actor);
    if (!merchant.branchIds.includes(invoice.branch_id)) throw new AppError('M-PESA is not configured for this branch', 409, 'MPESA_BRANCH_NOT_CONFIGURED');
    await this.repository.ensureIndexes();
    try {
      await this.transaction(async (session) => {
        const existing = await this.repository.get(id, session);
        if (existing) {
          if (existing.fingerprint !== fingerprint) throw new AppError('Idempotency key was used with different input', 409, 'MPESA_IDEMPOTENCY_CONFLICT');
          return;
        }
        const current = await this.invoice(invoiceId, actor, session);
        this.payable(current, data.amount);
        if (!await this.billing.lockForMpesaAttempt(current, session)) throw conflict();
        await this.repository.create({
          _id: id, invoiceId: current.id, patientId: current.patient_id, branchId: current.branch_id,
          createdBy: actor, environment: this.environment, provider: 'MPESA', currency: 'KES',
          businessShortCode: merchant.businessShortCode, partyB: merchant.partyB, transactionType: merchant.transactionType,
          amount: data.amount, payerPhone: data.payerPhone, fingerprint, active: true, version: 0,
          submissionState: 'CREATED', reportedOutcome: 'PENDING', verificationStatus: 'UNVERIFIED', postingStatus: 'DISABLED',
        }, session);
        const created = await this.repository.get(id, session);
        if (!created) throw unavailable();
        await this.repository.audit('mpesa.attempt.created', created, actor, { from: null, to: 'CREATED' }, session);
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const existing = await this.repository.get(id);
        if (!existing || existing.fingerprint !== fingerprint) throw new AppError('An unresolved attempt already exists or the key conflicts', 409, 'MPESA_ACTIVE_ATTEMPT_EXISTS');
      } else if (error instanceof AppError) throw error;
      else throw unavailable();
    }
    return this.get(id, actor);
  }

  private async transition(attempt: MpesaAttempt, to: MpesaSubmissionState, actor: string,
    fields: Partial<MpesaAttempt>, session: ClientSession) {
    if (!transitions[attempt.submissionState].includes(to)) throw conflict();
    const updated = await this.repository.transition(attempt._id, attempt.version, attempt.submissionState,
      { ...fields, submissionState: to }, session);
    if (!updated) throw conflict();
    await this.repository.audit('mpesa.attempt.submission', updated, actor,
      { from: attempt.submissionState, to, reason: fields.submissionError ?? 'STAFF_SUBMISSION', version: updated.version }, session);
    return updated;
  }

  async submit(id: string, expectedVersion: number, actor: string) {
    const merchant = this.configured();
    const claimed = await this.transaction(async (session) => {
      const { attempt, invoice } = await this.scoped(id, actor, session);
      if (attempt.version !== expectedVersion || attempt.submissionState !== 'CREATED') throw conflict();
      if (attempt.environment !== this.environment || !merchant.branchIds.includes(attempt.branchId) ||
        attempt.businessShortCode !== merchant.businessShortCode || attempt.partyB !== merchant.partyB ||
        attempt.transactionType !== merchant.transactionType) throw new AppError('Merchant configuration changed', 409, 'MPESA_MERCHANT_CONFLICT');
      this.payable(invoice, attempt.amount);
      if (!await this.billing.lockForMpesaAttempt(invoice, session)) throw conflict();
      return this.transition(attempt, 'SUBMITTING', actor, { submittedAt: new Date() }, session);
    });
    const token = await this.daraja.token(merchant, claimed.environment);
    let result: StkSubmission;
    if (!token) result = { state: 'REJECTED', error: 'AUTHENTICATION_FAILED_NOT_SENT' };
    else {
      // OAuth can be slow. Revalidate after it, immediately before the STK call.
      try {
        await this.transaction(async (session) => {
          const invoice = await this.invoice(claimed.invoiceId, actor, session);
          this.payable(invoice, claimed.amount);
          if (!await this.billing.lockForMpesaAttempt(invoice, session)) throw conflict();
        });
      } catch {
        return this.finish(claimed, { state: 'REJECTED', error: 'INVOICE_REVALIDATION_FAILED_NOT_SENT' }, actor);
      }
      result = await this.daraja.submit(merchant, claimed, token);
    }
    return this.finish(claimed, result, actor);
  }
  private async finish(claimed: MpesaAttempt, result: StkSubmission, actor: string) {
    try {
      const saved = await this.transaction((session) => this.transition(claimed, result.state, actor,
        result.state === 'PENDING'
          ? { merchantRequestId: result.merchantRequestId, checkoutRequestId: result.checkoutRequestId }
          : { submissionError: result.error, active: result.state !== 'REJECTED' }, session));
      if (saved.checkoutRequestId) await this.replay(saved);
      // Read after replay since callback correlation may increment the version.
      return this.get(saved._id, actor);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    }
  }

  private mismatch(event: MpesaCallbackEvent, attempt: MpesaAttempt, invoice: BillingInvoice | null) {
    if (event.merchantRequestId !== attempt.merchantRequestId) return 'MERCHANT_REQUEST_MISMATCH';
    if (event.amount !== undefined && event.amount !== attempt.amount) return 'AMOUNT_MISMATCH';
    if (event.phoneNumber !== undefined && event.phoneNumber !== attempt.payerPhone) return 'PAYER_MISMATCH';
    if (event.reportedOutcome === 'SUCCESS' && (event.amount === undefined || !event.mpesaReceiptNumber)) return 'INCOMPLETE_SUCCESS_METADATA';
    if (!invoice || invoice.branch_id !== attempt.branchId || invoice.patient_id !== attempt.patientId ||
      !['PENDING', 'PARTIALLY_PAID'].includes(invoice.status) || invoice.balance_amount < attempt.amount) return 'INVOICE_CHANGED';
    if (attempt.reportedOutcome !== 'PENDING' && (attempt.reportedOutcome !== event.reportedOutcome ||
      (event.reportedOutcome === 'SUCCESS' && attempt.receiptNumber !== event.mpesaReceiptNumber))) return 'OUTCOME_CONFLICT';
    return undefined;
  }
  async correlate(eventId: string): Promise<void> {
    // Unmatched Postman callbacks still work on the original standalone test DB.
    const event = await this.callbacks.get(eventId);
    if (!event || event.processingStatus !== 'UNMATCHED') return;
    const found = await this.repository.byCheckout(event.environment, event.checkoutRequestId);
    if (!found) return;
    await this.transaction(async (session) => {
      const currentEvent = await this.callbacks.get(eventId, session);
      if (!currentEvent || currentEvent.processingStatus !== 'UNMATCHED') return;
      const attempt = await this.repository.byCheckout(currentEvent.environment, currentEvent.checkoutRequestId, session);
      if (!attempt) return;
      const invoice = await this.billing.getById(attempt.invoiceId, [attempt.branchId], session);
      const reason = this.mismatch(currentEvent, attempt, invoice);
      if (!reason && invoice && !await this.billing.lockForMpesaAttempt(invoice, session)) throw conflict();
      if (!reason && attempt.reportedOutcome === 'PENDING') {
        const updated = await this.repository.recordOutcome(attempt, {
          reportedOutcome: currentEvent.reportedOutcome, reportedEventId: currentEvent._id,
          ...(currentEvent.mpesaReceiptNumber ? { receiptNumber: currentEvent.mpesaReceiptNumber } : {}),
        }, session);
        if (!updated) throw conflict();
      }
      if (!await this.callbacks.mark(eventId, attempt._id, reason, session)) throw conflict();
      await this.repository.audit('mpesa.callback.correlated', attempt, undefined,
        { eventId, from: attempt.reportedOutcome, reportedOutcome: currentEvent.reportedOutcome,
          result: reason ? 'CONFLICT' : 'MATCHED', reason: reason ?? 'IDENTIFIERS_AND_METADATA_MATCH', verified: false }, session);
    });
  }
  private async replay(attempt: MpesaAttempt) {
    if (!attempt.checkoutRequestId) return;
    for (const event of await this.callbacks.pending(attempt.environment, attempt.checkoutRequestId)) await this.correlate(event._id);
  }
  async correlatePending(id: string, actor: string) {
    const { attempt } = await this.scoped(id, actor);
    await this.replay(attempt);
    return this.get(id, actor);
  }
}
