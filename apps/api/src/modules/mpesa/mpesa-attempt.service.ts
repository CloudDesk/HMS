import { createHash, randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import { executeTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import { MpesaAttemptCreationError, type MpesaCreationStage } from './mpesa-attempt-error.js';
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
import { MPESA_RECONCILIATION_LEASE_MS, MPESA_RECONCILIATION_MAX_RETRIES, reconciliationDelay } from './mpesa-reconciliation.policy.js';
import {
  createAttemptSchema,
  parseAttemptInput,
  reconcileOptionsSchema,
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
    let stage: MpesaCreationStage = 'INVOICE_READ';

    try {
      // Authorization always precedes returning an idempotent response.
      const invoice = await this.invoice(invoiceId, actor);
      if (!merchant.branchIds.includes(invoice.branch_id)) {
        throw new AppError('M-PESA is not configured for this branch', 409, 'MPESA_BRANCH_NOT_CONFIGURED');
      }
      stage = 'INDEX_INITIALIZATION';
      await this.repository.ensureIndexes();

      try {
        stage = 'TRANSACTION_START';
        await this.transaction(async (session) => {
          stage = 'ATTEMPT_LOOKUP';
          const existing = await this.repository.get(id, session);
          if (existing) {
            if (existing.fingerprint !== fingerprint) {
              throw new AppError('Idempotency key was used with different input', 409, 'MPESA_IDEMPOTENCY_CONFLICT');
            }
            stage = 'TRANSACTION_COMMIT';
            return;
          }
          stage = 'INVOICE_REVALIDATION';
          const current = await this.invoice(invoiceId, actor, session);
          this.payable(current, data.amount);
          stage = 'INVOICE_LOCK';
          if (!await this.billing.lockForMpesaAttempt(current, session)) throw conflict();
          stage = 'ATTEMPT_WRITE';
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
          stage = 'ATTEMPT_READBACK';
          const created = await this.repository.get(id, session);
          if (!created) throw unavailable();
          stage = 'AUDIT_WRITE';
          await this.repository.audit('mpesa.attempt.created', created, actor, { from: null, to: 'CREATED' }, session);
          stage = 'TRANSACTION_COMMIT';
        });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
          stage = 'DUPLICATE_LOOKUP';
          const existing = await this.repository.get(id);
          if (!existing || existing.fingerprint !== fingerprint) {
            throw new AppError('An unresolved attempt already exists or the key conflicts', 409, 'MPESA_ACTIVE_ATTEMPT_EXISTS');
          }
        } else {
          throw error;
        }
      }
      stage = 'RESULT_READ';
      return await this.get(id, actor);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new MpesaAttemptCreationError(stage, error);
    }
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
    // A reconciliation retry is reserved atomically when acquiring its lease.
    const retries = attempt.reconciliationRetries || 0;
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

    const terminal = queryResult.state !== 'PENDING' && queryResult.state !== 'UNKNOWN';
    const establishedOutcome = attempt.verificationStatus === 'VERIFIED' || attempt.postingStatus === 'POSTED'
      ? 'SUCCESS'
      : attempt.verificationStatus === 'FAILED' && ['FAILED', 'CANCELLED', 'TIMEOUT'].includes(attempt.queryOutcome)
        ? attempt.queryOutcome : undefined;
    const identifierConflict = terminal
      ? !attempt.checkoutRequestId || queryResult.checkoutRequestId !== attempt.checkoutRequestId
        ? 'CHECKOUT_REQUEST_MISMATCH'
        : !attempt.merchantRequestId || queryResult.merchantRequestId !== attempt.merchantRequestId
          ? 'MERCHANT_REQUEST_MISMATCH' : undefined
      : undefined;
    const outcomeConflict = terminal && establishedOutcome && queryResult.state !== establishedOutcome;
    const callbackConflict = establishedOutcome === 'SUCCESS' && ['FAILED', 'CANCELLED', 'TIMEOUT'].includes(attempt.reportedOutcome)
      ? 'CALLBACK_FAILED_BUT_QUERY_SUCCESS'
      : establishedOutcome && establishedOutcome !== 'SUCCESS' && attempt.reportedOutcome === 'SUCCESS'
        ? 'CALLBACK_SUCCESS_BUT_QUERY_FAILED' : undefined;
    const preserveEvidence = Boolean(establishedOutcome || attempt.conflictingEvidence || attempt.verificationStatus === 'CONFLICT');

    if (identifierConflict || attempt.conflictingEvidence || attempt.verificationStatus === 'CONFLICT' || callbackConflict || outcomeConflict) {
      conflictingEvidence = attempt.conflictingEvidence ?? identifierConflict ?? callbackConflict ?? 'QUERY_OUTCOME_CONFLICT';
      verificationStatus = 'CONFLICT';
      recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
      queryOutcome = establishedOutcome ? attempt.queryOutcome : queryResult.state;
    } else if (establishedOutcome && (!terminal || establishedOutcome !== 'SUCCESS' || attempt.postingStatus === 'POSTED')) {
      // Later transport uncertainty cannot erase trusted evidence or release its lock.
      // Matching repeated results after posting must not fail invoice-payability checks.
      verificationStatus = attempt.verificationStatus;
      recoveryStatus = attempt.recoveryStatus;
      queryOutcome = attempt.queryOutcome;
    } else if (queryResult.state === 'SUCCESS') {
      queryOutcome = 'SUCCESS';
      if (attempt.reportedOutcome === 'FAILED' || attempt.reportedOutcome === 'CANCELLED' || attempt.reportedOutcome === 'TIMEOUT') {
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
        if (retries >= MPESA_RECONCILIATION_MAX_RETRIES) {
          recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
          verificationStatus = 'UNRESOLVED';
        } else {
          recoveryStatus = 'IN_RECOVERY';
          const delayMs = reconciliationDelay(retries);
          nextReconciliationAt = new Date(now.getTime() + delayMs);
        }
      } else {
        recoveryStatus = 'IN_RECOVERY';
      }
    } else {
      queryOutcome = 'UNKNOWN';
      verificationStatus = 'UNRESOLVED';
      if (source === 'RECONCILIATION') {
        if (retries >= MPESA_RECONCILIATION_MAX_RETRIES) {
          recoveryStatus = 'MANUAL_REVIEW_REQUIRED';
        } else {
          recoveryStatus = 'IN_RECOVERY';
          const delayMs = reconciliationDelay(retries);
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
      verificationSource: preserveEvidence ? attempt.verificationSource : source,
      verificationAttempts,
      lastVerifiedAt: preserveEvidence ? attempt.lastVerifiedAt : now,
      lastQueryResult: preserveEvidence ? attempt.lastQueryResult : baseResultRecord,
      conflictingEvidence,
      postingStatus,
      reconciliationRetries: retries,
      nextReconciliationAt: nextReconciliationAt ?? null,
      reconciliationClaimedAt: null,
      reconciliationClaimedBy: null,
    };

    return {
      updates,
      auditDetails: {
        previousVerificationStatus: attempt.verificationStatus,
        newVerificationStatus: verificationStatus,
        previousRecoveryStatus: attempt.recoveryStatus,
        newRecoveryStatus: recoveryStatus,
        resultCode: baseResultRecord.resultCode,
        observedQueryState: queryResult.state,
        establishedQueryOutcome: attempt.queryOutcome,
        evidencePreserved: preserveEvidence,
      },
    };
  }

  private assertVerificationMerchant(attempt: MpesaAttempt, merchant: MpesaMerchant) {
    if (attempt.environment !== this.environment || !merchant.branchIds.includes(attempt.branchId) ||
      attempt.businessShortCode !== merchant.businessShortCode || attempt.partyB !== merchant.partyB ||
      attempt.transactionType !== merchant.transactionType) {
      throw new AppError('Merchant configuration changed', 409, 'MPESA_MERCHANT_CONFLICT');
    }
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
    this.assertVerificationMerchant(attempt, merchant);
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

  private async reconciliationBranches(actor?: string) {
    const merchant = this.configured();
    const scope = actor ? await this.billing.resolveBranchScope(actor) : undefined;
    return merchant.branchIds.filter((id) => !scope || scope.includes(id));
  }

  private ownsReconciliation(current: MpesaAttempt, claim: MpesaAttempt, workerId: string) {
    return current.active && current.reconciliationClaimedBy === workerId && claim.reconciliationClaimedBy === workerId &&
      current.reconciliationClaimedAt?.getTime() === claim.reconciliationClaimedAt?.getTime() &&
      Boolean(current.reconciliationClaimedAt && current.reconciliationClaimedAt.getTime() > Date.now() - MPESA_RECONCILIATION_LEASE_MS) &&
      current.environment === claim.environment && current.invoiceId === claim.invoiceId && current.branchId === claim.branchId &&
      current.patientId === claim.patientId && current.amount === claim.amount && current.payerPhone === claim.payerPhone && current.checkoutRequestId === claim.checkoutRequestId &&
      current.merchantRequestId === claim.merchantRequestId && current.businessShortCode === claim.businessShortCode &&
      current.partyB === claim.partyB && current.transactionType === claim.transactionType && !current.conflictingEvidence &&
      ['UNVERIFIED', 'UNRESOLVED'].includes(current.verificationStatus) &&
      !['POSTED', 'POSTING', 'MANUAL_REVIEW_REQUIRED'].includes(current.postingStatus) &&
      !['RESOLVED', 'MANUAL_REVIEW_REQUIRED', 'ABANDONED'].includes(current.recoveryStatus);
  }

  private async reconciliationContext(claim: MpesaAttempt, workerId: string, actor?: string, session?: ClientSession) {
    const current = await this.repository.get(claim._id, session);
    if (!current || !this.ownsReconciliation(current, claim, workerId)) return undefined;
    const branches = await this.reconciliationBranches(actor);
    if (!branches.includes(current.branchId)) throw new AppError('Reconciliation branch access denied', 403, 'BRANCH_SCOPE_DENIED');
    const invoice = await this.billing.getById(current.invoiceId, branches, session);
    return { current, invoice };
  }

  private async recordReconciliation(
    claim: MpesaAttempt, workerId: string, actor: string | undefined,
    queryResult: StkQueryResult, reviewReason?: string,
  ) {
    return this.transaction(async (session) => {
      const context = await this.reconciliationContext(claim, workerId, actor, session);
      if (!context) return { id: claim._id, status: 'STALE' };
      const { current, invoice } = context;
      const evaluated = this.evaluateVerification(current, invoice, queryResult, 'RECONCILIATION');
      if (reviewReason) {
        evaluated.updates = { ...evaluated.updates, verificationStatus: 'UNRESOLVED',
          recoveryStatus: 'MANUAL_REVIEW_REQUIRED', conflictingEvidence: reviewReason, nextReconciliationAt: null,
          ...(reviewReason === 'MISSING_CHECKOUT_REQUEST_ID' ? {
            submissionState: 'UNKNOWN', submissionError: current.submissionError ?? 'STUCK_WITHOUT_CHECKOUT_ID',
          } : {}),
        };
      }
      const updated = await this.repository.updateReconciliation(claim, current.version, evaluated.updates, session);
      if (!updated) return { id: claim._id, status: 'STALE' };
      await this.repository.audit(reviewReason ? 'mpesa.reconciliation.manual_review_needed' : 'mpesa.attempt.reconciled', updated, actor, {
        ...evaluated.auditDetails, workerId, source: actor ? 'STAFF' : 'RECONCILIATION_WORKER',
        reason: reviewReason ?? ('error' in queryResult ? queryResult.error : 'PROVIDER_QUERY'),
        queryState: queryResult.state, verificationStatus: updated.verificationStatus,
        recoveryStatus: updated.recoveryStatus, conflictingEvidence: updated.conflictingEvidence ?? null,
        newVerificationStatus: updated.verificationStatus, newRecoveryStatus: updated.recoveryStatus,
        reconciliationRetries: updated.reconciliationRetries,
      }, session);
      return { id: claim._id, status: updated.verificationStatus === 'CONFLICT' ? 'CONFLICT' : updated.recoveryStatus };
    });
  }

  async reconcileSingle(claim: MpesaAttempt, workerId: string, actor?: string, exhausted = false): Promise<{ id: string; status: string }> {
    try {
      const context = await this.reconciliationContext(claim, workerId, actor);
      if (!context) return { id: claim._id, status: 'STALE' };
      if (exhausted || !context.current.checkoutRequestId) {
        const reason = exhausted ? 'RECONCILIATION_RETRIES_EXHAUSTED' : 'MISSING_CHECKOUT_REQUEST_ID';
        return await this.recordReconciliation(claim, workerId, actor, { state: 'UNKNOWN', error: reason }, reason);
      }
      try {
        this.assertVerificationMerchant(context.current, this.configured());
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== 'MPESA_MERCHANT_CONFLICT') throw error;
        return await this.recordReconciliation(claim, workerId, actor,
          { state: 'UNKNOWN', error: 'MERCHANT_CONFIGURATION_CHANGED' }, 'MERCHANT_CONFIGURATION_CHANGED');
      }
      await this.replay(context.current);
      let owned = await this.reconciliationContext(claim, workerId, actor);
      if (!owned) return { id: claim._id, status: 'STALE' };
      const merchant = this.configured();
      const token = await this.daraja.token(merchant, owned.current.environment);
      if (!token) return await this.recordReconciliation(claim, workerId, actor, { state: 'UNKNOWN', error: 'PROVIDER_AUTH_FAILED' });
      owned = await this.reconciliationContext(claim, workerId, actor);
      if (!owned) return { id: claim._id, status: 'STALE' };
      const result = await this.daraja.query(merchant, owned.current, token);
      return await this.recordReconciliation(claim, workerId, actor, result);
    } finally {
      // Also release leases on stale/failed processing, but never another owner's
      // claim. A future due time avoids a hot loop after storage/audit errors.
      await this.repository.releaseReconciliation(claim, new Date(Date.now() + reconciliationDelay(claim.reconciliationRetries)))
        .catch(() => undefined);
    }
  }

  async reconcileEligible(options?: ReconcileOptions, actor?: string, signal?: AbortSignal) {
    const { limit } = parseAttemptInput(reconcileOptionsSchema, options ?? {});
    const workerId = `${actor ? `staff:${actor}` : 'worker'}:${randomUUID()}`;
    const report = { processed: 0, resolved: 0, unresolved: 0, conflicts: 0 };
    for (let i = 0; i < limit && !signal?.aborted; i++) {
      const owned = await this.transaction(async (session) => {
        const branches = await this.reconciliationBranches(actor);
        if (!branches.length) return undefined;
        const exhausted = await this.repository.claimExhaustedReconciliation(this.environment, workerId, branches, session);
        const claim = exhausted ?? await this.repository.claimForReconciliation(this.environment, workerId, MPESA_RECONCILIATION_LEASE_MS, branches, session);
        if (!claim) return undefined;
        await this.repository.audit('mpesa.reconciliation.claimed', claim, actor, {
          workerId, source: actor ? 'STAFF' : 'RECONCILIATION_WORKER',
          retry: claim.reconciliationRetries, exhausted: Boolean(exhausted), claimedAt: claim.reconciliationClaimedAt,
        }, session);
        return { claim, exhausted: Boolean(exhausted) };
      });
      if (!owned) break;
      report.processed++;
      try {
        const outcome = await this.reconcileSingle(owned.claim, workerId, actor, owned.exhausted);
        if (outcome.status === 'RESOLVED') report.resolved++;
        else if (outcome.status === 'CONFLICT') report.conflicts++;
        else report.unresolved++;
      } catch {
        report.unresolved++;
      }
    }
    return report;
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
