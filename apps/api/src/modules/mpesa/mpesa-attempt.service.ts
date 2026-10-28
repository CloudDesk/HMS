import { createHash, randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import { executeTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { BillingRepository } from '../billing/billing.repository.js';
import type { BillingInvoice } from '../billing/billing.types.js';
import type {
  MpesaAttempt,
  MpesaQueryResultRecord,
  MpesaQueryOutcome,
  MpesaRecoveryStatus,
  MpesaSubmissionState,
  MpesaVerificationSource,
  MpesaVerificationStatus,
  MpesaPostingStatus,
} from './mpesa-attempt.model.js';
import type { MpesaAttemptRepository } from './mpesa-attempt.repository.js';
import type { MpesaCallbackRepository } from './mpesa-callback.repository.js';
import type { MpesaCallbackEvent } from './mpesa-callback.model.js';
import type { MpesaDarajaClient, StkQueryResult, StkSubmission } from './mpesa-daraja.client.js';
import {
  createAttemptSchema,
  parseAttemptInput,
  type CreateMpesaAttempt,
  type ListAttemptsQuery,
  type ReconcileOptions,
} from './mpesa-attempt.schemas.js';

const transitions: Record<MpesaSubmissionState, readonly MpesaSubmissionState[]> = {
  CREATED: ['SUBMITTING'],
  SUBMITTING: ['PENDING', 'UNKNOWN', 'REJECTED'],
  PENDING: [],
  UNKNOWN: [],
  REJECTED: [],
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
    return {
      id: attempt._id,
      invoiceId: attempt.invoiceId,
      patientId: attempt.patientId,
      branchId: attempt.branchId,
      amount: attempt.amount,
      currency: attempt.currency,
      payerPhoneMasked: `********${attempt.payerPhone ? attempt.payerPhone.slice(-4) : '****'}`,
      environment: attempt.environment,
      submissionState: attempt.submissionState,
      reportedOutcome: attempt.reportedOutcome,
      verificationStatus: attempt.verificationStatus,
      postingStatus: attempt.postingStatus,
      version: attempt.version,
      checkoutRequestId: attempt.checkoutRequestId ?? null,
      merchantRequestId: attempt.merchantRequestId ?? null,
      receiptNumber: attempt.receiptNumber ?? null,
      submissionError: attempt.submissionError ?? null,
      verificationSource: attempt.verificationSource ?? null,
      verificationAttempts: attempt.verificationAttempts ?? 0,
      lastVerifiedAt: attempt.lastVerifiedAt ?? null,
      lastQueryResult: attempt.lastQueryResult ?? null,
      queryOutcome: attempt.queryOutcome ?? 'NONE',
      conflictingEvidence: attempt.conflictingEvidence ?? null,
      recoveryStatus: attempt.recoveryStatus ?? 'NONE',
      nextReconciliationAt: attempt.nextReconciliationAt ?? null,
      reconciliationRetries: attempt.reconciliationRetries ?? 0,
      billingPaymentId: attempt.billingPaymentId ?? null,
      billingPaymentNumber: attempt.billingPaymentNumber ?? null,
      postedAt: attempt.postedAt ?? null,
      postingError: attempt.postingError ?? null,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  async get(id: string, actor: string) {
    return this.view((await this.scoped(id, actor)).attempt);
  }

  async create(invoiceId: string, input: CreateMpesaAttempt, actor: string) {
    const data = parseAttemptInput(createAttemptSchema, input);
    const merchant = this.configured();
    const id = hash(`${this.environment}:${invoiceId.toLowerCase()}:${data.idempotencyKey}`);
    const fingerprint = hash(JSON.stringify([data.amount, data.payerPhone]));

    // Authorization always precedes returning an idempotent response.
    const invoice = await this.invoice(invoiceId, actor);
    if (!merchant.branchIds.includes(invoice.branch_id)) {
      throw new AppError('M-PESA is not configured for this branch', 409, 'MPESA_BRANCH_NOT_CONFIGURED');
    }
    await this.repository.ensureIndexes();

    try {
      await this.transaction(async (session) => {
        const existing = await this.repository.get(id, session);
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new AppError('Idempotency key was used with different input', 409, 'MPESA_IDEMPOTENCY_CONFLICT');
          }
          return;
        }
        const current = await this.invoice(invoiceId, actor, session);
        this.payable(current, data.amount);
        if (!await this.billing.lockForMpesaAttempt(current, session)) throw conflict();
        await this.repository.create({
          _id: id,
          invoiceId: current.id,
          patientId: current.patient_id,
          branchId: current.branch_id,
          createdBy: actor,
          environment: this.environment,
          provider: 'MPESA',
          currency: 'KES',
          businessShortCode: merchant.businessShortCode,
          partyB: merchant.partyB,
          transactionType: merchant.transactionType,
          amount: data.amount,
          payerPhone: data.payerPhone,
          fingerprint,
          active: true,
          version: 0,
          submissionState: 'CREATED',
          reportedOutcome: 'PENDING',
          verificationStatus: 'UNVERIFIED',
          postingStatus: 'DISABLED',
          verificationAttempts: 0,
          queryOutcome: 'NONE',
          recoveryStatus: 'NONE',
          reconciliationRetries: 0,
        }, session);
        const created = await this.repository.get(id, session);
        if (!created) throw unavailable();
        await this.repository.audit('mpesa.attempt.created', created, actor, { from: null, to: 'CREATED' }, session);
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const existing = await this.repository.get(id);
        if (!existing || existing.fingerprint !== fingerprint) {
          throw new AppError('An unresolved attempt already exists or the key conflicts', 409, 'MPESA_ACTIVE_ATTEMPT_EXISTS');
        }
      } else if (error instanceof AppError) {
        throw error;
      } else {
        throw unavailable();
      }
    }
    return this.get(id, actor);
  }

  private async transition(
    attempt: MpesaAttempt,
    to: MpesaSubmissionState,
    actor: string,
    fields: Partial<MpesaAttempt>,
    session: ClientSession,
  ) {
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
        attempt.transactionType !== merchant.transactionType) {
        throw new AppError('Merchant configuration changed', 409, 'MPESA_MERCHANT_CONFLICT');
      }
      this.payable(invoice, attempt.amount);
      if (!await this.billing.lockForMpesaAttempt(invoice, session)) throw conflict();
      return this.transition(attempt, 'SUBMITTING', actor, { submittedAt: new Date() }, session);
    });

    const token = await this.daraja.token(merchant, claimed.environment);
    let result: StkSubmission;
    if (!token) {
      result = { state: 'REJECTED', error: 'AUTHENTICATION_FAILED_NOT_SENT' };
    } else {
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
          reportedOutcome: currentEvent.reportedOutcome,
          reportedEventId: currentEvent._id,
          ...(currentEvent.mpesaReceiptNumber ? { receiptNumber: currentEvent.mpesaReceiptNumber } : {}),
        }, session);
        if (!updated) throw conflict();
      }
      if (!await this.callbacks.mark(eventId, attempt._id, reason, session)) throw conflict();
      await this.repository.audit('mpesa.callback.correlated', attempt, undefined,
        {
          eventId,
          from: attempt.reportedOutcome,
          reportedOutcome: currentEvent.reportedOutcome,
          result: reason ? 'CONFLICT' : 'MATCHED',
          reason: reason ?? 'IDENTIFIERS_AND_METADATA_MATCH',
          verified: false,
        }, session);
    });
  }

  private async replay(attempt: MpesaAttempt) {
    if (!attempt.checkoutRequestId) return;
    for (const event of await this.callbacks.pending(attempt.environment, attempt.checkoutRequestId)) {
      await this.correlate(event._id);
    }
  }

  async correlatePending(id: string, actor: string) {
    const { attempt } = await this.scoped(id, actor);
    await this.replay(attempt);
    return this.get(id, actor);
  }

  private evaluateVerification(
    attempt: MpesaAttempt,
    invoice: BillingInvoice | null,
    queryResult: StkQueryResult,
    source: MpesaVerificationSource,
  ): {
    updates: Partial<MpesaAttempt>;
    auditDetails: Record<string, unknown>;
  } {
    const now = new Date();
    const retries = (attempt.reconciliationRetries || 0) + (source === 'RECONCILIATION' ? 1 : 0);
    const verificationAttempts = (attempt.verificationAttempts || 0) + 1;

    let verificationStatus: MpesaVerificationStatus;
    let recoveryStatus: MpesaRecoveryStatus;
    let conflictingEvidence: string | undefined = attempt.conflictingEvidence;
    let queryOutcome: MpesaQueryOutcome;
    let active = attempt.active;
    const postingStatus: MpesaPostingStatus = attempt.postingStatus;
    let nextReconciliationAt: Date | undefined = undefined;

    const baseResultRecord: MpesaQueryResultRecord = {
      state: queryResult.state,
      resultCode: 'resultCode' in queryResult ? queryResult.resultCode : undefined,
      resultDesc: 'resultDesc' in queryResult ? queryResult.resultDesc : ('error' in queryResult ? queryResult.error : undefined),
      queriedAt: now,
    };

    if (queryResult.state === 'SUCCESS') {
      queryOutcome = 'SUCCESS';
      if (queryResult.checkoutRequestId && attempt.checkoutRequestId && queryResult.checkoutRequestId !== attempt.checkoutRequestId) {
        conflictingEvidence = 'CHECKOUT_REQUEST_MISMATCH';
        verificationStatus = 'CONFLICT';
        recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
      } else if (attempt.reportedOutcome === 'FAILED' || attempt.reportedOutcome === 'CANCELLED' || attempt.reportedOutcome === 'TIMEOUT') {
        conflictingEvidence = 'CALLBACK_FAILED_BUT_QUERY_SUCCESS';
        verificationStatus = 'CONFLICT';
        recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
      } else if (!invoice || invoice.branch_id !== attempt.branchId || invoice.patient_id !== attempt.patientId ||
        !['PENDING', 'PARTIALLY_PAID'].includes(invoice.status) || invoice.balance_amount < attempt.amount) {
        conflictingEvidence = 'INVOICE_STATE_CHANGED';
        verificationStatus = 'CONFLICT';
        recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
      } else {
        verificationStatus = 'VERIFIED';
        recoveryStatus = 'RESOLVED';
        // Active remains true with postingStatus 'DISABLED' pending Phase 2 financial posting
      }
    } else if (queryResult.state === 'CANCELLED' || queryResult.state === 'TIMEOUT' || queryResult.state === 'FAILED') {
      queryOutcome = queryResult.state;
      if (attempt.reportedOutcome === 'SUCCESS') {
        conflictingEvidence = 'CALLBACK_SUCCESS_BUT_QUERY_FAILED';
        verificationStatus = 'CONFLICT';
        recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
      } else {
        verificationStatus = 'FAILED';
        recoveryStatus = 'RESOLVED';
        active = false; // Safe to release invoice for fresh attempt
      }
    } else if (queryResult.state === 'PENDING') {
      queryOutcome = 'PENDING';
      verificationStatus = 'UNVERIFIED';
      if (source === 'RECONCILIATION') {
        if (retries >= 5) {
          recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
          verificationStatus = 'UNRESOLVED';
        } else {
          recoveryStatus = 'IN_RECOVERY';
          const delayMs = Math.min(300_000, 15_000 * Math.pow(2, retries));
          nextReconciliationAt = new Date(now.getTime() + delayMs);
        }
      } else {
        recoveryStatus = 'IN_RECOVERY';
      }
    } else {
      queryOutcome = 'UNKNOWN';
      verificationStatus = 'UNRESOLVED';
      if (source === 'RECONCILIATION') {
        if (retries >= 5) {
          recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
        } else {
          recoveryStatus = 'IN_RECOVERY';
          const delayMs = Math.min(300_000, 15_000 * Math.pow(2, retries));
          nextReconciliationAt = new Date(now.getTime() + delayMs);
        }
      } else {
        recoveryStatus = 'IN_RECOVERY';
      }
    }

    const updates: Partial<MpesaAttempt> = {
      verificationStatus,
      recoveryStatus,
      queryOutcome,
      active,
      verificationSource: source,
      verificationAttempts,
      lastVerifiedAt: now,
      lastQueryResult: baseResultRecord,
      conflictingEvidence,
      postingStatus,
      reconciliationRetries: retries,
      nextReconciliationAt: nextReconciliationAt ?? (null as unknown as Date),
      reconciliationClaimedAt: null as unknown as Date,
      reconciliationClaimedBy: null as unknown as string,
    };

    return {
      updates,
      auditDetails: {
        previousVerificationStatus: attempt.verificationStatus,
        newVerificationStatus: verificationStatus,
        previousRecoveryStatus: attempt.recoveryStatus,
        newRecoveryStatus: recoveryStatus,
        resultCode: baseResultRecord.resultCode,
      },
    };
  }

  async verify(id: string, actor: string) {
    const { attempt } = await this.scoped(id, actor);

    if (attempt.submissionState === 'CREATED') {
      throw new AppError('Cannot verify an unsubmitted payment attempt', 409, 'MPESA_ATTEMPT_NOT_SUBMITTED');
    }
    if (attempt.submissionState === 'REJECTED') {
      throw new AppError('Payment attempt was rejected and cannot be queried', 409, 'MPESA_ATTEMPT_REJECTED');
    }

    if (!attempt.checkoutRequestId) {
      await this.transaction(async (session) => {
        const current = await this.repository.get(id, session);
        if (!current) return;
        await this.repository.updateVerification(id, current.version, {
          recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
          verificationStatus: 'UNRESOLVED',
          conflictingEvidence: 'MISSING_CHECKOUT_REQUEST_ID',
        }, session);
        await this.repository.audit('mpesa.attempt.manual_review_required', current, actor, {
          reason: 'MISSING_CHECKOUT_REQUEST_ID',
        }, session);
      });
      throw new AppError('Payment attempt has no CheckoutRequestID to verify', 409, 'MPESA_ATTEMPT_MISSING_CHECKOUT_ID');
    }

    const merchant = this.configured();
    const token = await this.daraja.token(merchant, attempt.environment);
    if (!token) {
      throw new AppError('Daraja authentication failed', 503, 'MPESA_PROVIDER_AUTH_FAILED');
    }

    const queryResult = await this.daraja.query(merchant, attempt, token);

    try {
      await this.transaction(async (session) => {
        const current = await this.repository.get(id, session);
        if (!current) throw conflict();
        const currentInvoice = await this.invoice(current.invoiceId, actor, session);
        const evaluated = this.evaluateVerification(current, currentInvoice, queryResult, 'QUERY');
        const updated = await this.repository.updateVerification(id, current.version, evaluated.updates, session);
        if (!updated) throw conflict();

        await this.repository.audit('mpesa.attempt.verified', updated, actor, {
          queryState: queryResult.state,
          verificationStatus: evaluated.updates.verificationStatus,
          recoveryStatus: evaluated.updates.recoveryStatus,
          conflictingEvidence: evaluated.updates.conflictingEvidence ?? null,
          ...evaluated.auditDetails,
        }, session);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable();
    }

    return this.get(id, actor);
  }

  async reconcileSingle(
    attempt: MpesaAttempt,
    workerId: string,
    actor?: string,
  ): Promise<{ id: string; status: string }> {
    try {
      if (!attempt.checkoutRequestId) {
        await this.transaction(async (session) => {
          const current = await this.repository.get(attempt._id, session);
          if (!current) return;
          const updated = await this.repository.updateVerification(attempt._id, current.version, {
            submissionState: 'UNKNOWN',
            submissionError: current.submissionError ?? 'STUCK_WITHOUT_CHECKOUT_ID',
            verificationStatus: 'UNRESOLVED',
            recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
            conflictingEvidence: 'MISSING_CHECKOUT_REQUEST_ID',
            reconciliationClaimedAt: null as unknown as Date,
            reconciliationClaimedBy: null as unknown as string,
            nextReconciliationAt: null as unknown as Date,
          }, session);
          if (updated) {
            await this.repository.audit('mpesa.reconciliation.manual_review_needed', updated, actor, {
              reason: 'MISSING_CHECKOUT_REQUEST_ID',
              submissionState: updated.submissionState,
            }, session);
          }
        });
        return { id: attempt._id, status: 'MANUAL_REVIEW_REQUIRED' };
      }

      const merchant = this.configured();
      const token = await this.daraja.token(merchant, attempt.environment);
      if (!token) {
        const retries = (attempt.reconciliationRetries || 0) + 1;
        const delayMs = Math.min(300_000, 15_000 * Math.pow(2, retries));
        await this.transaction(async (session) => {
          const current = await this.repository.get(attempt._id, session);
          if (!current) return;
          await this.repository.updateVerification(attempt._id, current.version, {
            reconciliationRetries: retries,
            recoveryStatus: retries >= 5 ? 'MANUAL_REVIEW_REQUIRED' : 'IN_RECOVERY',
            verificationStatus: retries >= 5 ? 'UNRESOLVED' : current.verificationStatus,
            nextReconciliationAt: retries >= 5 ? (null as unknown as Date) : new Date(Date.now() + delayMs),
            reconciliationClaimedAt: null as unknown as Date,
            reconciliationClaimedBy: null as unknown as string,
          }, session);
        });
        return { id: attempt._id, status: retries >= 5 ? 'MANUAL_REVIEW_REQUIRED' : 'UNRESOLVED' };
      }

      const queryResult = await this.daraja.query(merchant, attempt, token);
      const outcome = await this.transaction(async (session) => {
        const current = await this.repository.get(attempt._id, session);
        if (!current) return { id: attempt._id, status: 'UNRESOLVED' };
        const invoice = await this.billing.getById(current.invoiceId, [current.branchId], session);
        const evaluated = this.evaluateVerification(current, invoice, queryResult, 'RECONCILIATION');
        const updated = await this.repository.updateVerification(attempt._id, current.version, evaluated.updates, session);
        if (!updated) throw conflict();

        await this.repository.audit('mpesa.attempt.reconciled', updated, actor, {
          queryState: queryResult.state,
          verificationStatus: evaluated.updates.verificationStatus,
          recoveryStatus: evaluated.updates.recoveryStatus,
          conflictingEvidence: evaluated.updates.conflictingEvidence ?? null,
          reconciliationRetries: evaluated.updates.reconciliationRetries,
          ...evaluated.auditDetails,
        }, session);

        return { id: attempt._id, status: evaluated.updates.recoveryStatus ?? 'UNRESOLVED' };
      });
      return outcome;
    } catch (err) {
      try {
        await this.transaction(async (session) => {
          const current = await this.repository.get(attempt._id, session);
          if (current && current.reconciliationClaimedBy === workerId) {
            await this.repository.updateVerification(attempt._id, current.version, {
              reconciliationClaimedAt: null as unknown as Date,
              reconciliationClaimedBy: null as unknown as string,
            }, session);
          }
        });
      } catch {
        // ignore lease release error during exception unwind
      }
      throw err;
    }
  }

  async reconcileEligible(options?: ReconcileOptions, actor?: string) {
    const limit = options?.limit ?? 10;
    const workerId = actor ? `staff:${actor}` : `worker:${randomUUID()}`;
    let processed = 0;
    let resolved = 0;
    let unresolved = 0;
    let conflicts = 0;

    for (let i = 0; i < limit; i++) {
      const claimed = await this.repository.claimForReconciliation(this.environment, workerId);
      if (!claimed) break;
      processed++;
      try {
        const outcome = await this.reconcileSingle(claimed, workerId, actor);
        if (outcome.status === 'RESOLVED') resolved++;
        else if (outcome.status === 'CONFLICT') conflicts++;
        else unresolved++;
      } catch {
        unresolved++;
      }
    }

    return { processed, resolved, unresolved, conflicts };
  }

  async list(query: ListAttemptsQuery, actor: string) {
    const scope = await this.billing.resolveBranchScope(actor);
    if (Array.isArray(scope) && scope.length === 0) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    const result = await this.repository.list({
      branchIds: scope,
      invoiceId: query.invoiceId,
      submissionState: query.submissionState,
      verificationStatus: query.verificationStatus,
      unresolvedOnly: query.unresolvedOnly,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: result.items.map((item) => this.view(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
