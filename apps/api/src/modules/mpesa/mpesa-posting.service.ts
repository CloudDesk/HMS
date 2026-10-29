import type { ClientSession } from 'mongoose';
import { executeTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { BillingRepository } from '../billing/billing.repository.js';
import type { BillingService } from '../billing/billing.service.js';
import type { AdvancePaymentService } from '../advance-payment/advance-payment.service.js';
import { createBillingNumber } from '../billing/billing-number.js';
import type { MpesaAttempt } from './mpesa-attempt.model.js';
import type { MpesaAttemptRepository } from './mpesa-attempt.repository.js';
import type { BillingInvoice, BillingPayment, BillingRequestMetadata } from '../billing/billing.types.js';

export class MpesaPostingService {
  constructor(
    private readonly repository: MpesaAttemptRepository,
    private readonly billingRepository: BillingRepository,
    private readonly advancePaymentService: AdvancePaymentService,
    private readonly billingService: BillingService,
  ) {}

  private transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    return executeTransaction(this.repository, async (session) => {
      if (!session) {
        throw new AppError('M-PESA financial posting requires MongoDB transactions', 503, 'MPESA_TRANSACTIONS_REQUIRED');
      }
      return operation(session);
    });
  }

  view(attempt: MpesaAttempt) {
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

  private assertContext(attempt: MpesaAttempt, invoice: BillingInvoice) {
    if (invoice.id !== attempt.invoiceId || invoice.branch_id !== attempt.branchId || invoice.patient_id !== attempt.patientId) {
      throw new AppError('Payment attempt changed or belongs to different context', 409, 'MPESA_ATTEMPT_CONFLICT');
    }
  }

  private assertSettlement(attempt: MpesaAttempt) {
    if (attempt.conflictingEvidence || attempt.recoveryStatus === 'MANUAL_REVIEW_REQUIRED' || attempt.postingStatus === 'MANUAL_REVIEW_REQUIRED') {
      throw new AppError('Payment attempt has conflicting evidence and requires manual review', 409, 'MPESA_POSTING_CONFLICT');
    }
    if (attempt.verificationStatus !== 'VERIFIED') {
      throw new AppError('Payment attempt is not verified with M-PESA provider', 409, 'MPESA_POSTING_NOT_VERIFIED');
    }
    if (!attempt.receiptNumber || !/^[A-Za-z0-9]{1,32}$/.test(attempt.receiptNumber)) {
      throw new AppError('Verified M-PESA receipt reference is missing or invalid', 409, 'MPESA_POSTING_MISSING_RECEIPT');
    }
    if (attempt.queryOutcome !== 'SUCCESS' || attempt.lastQueryResult?.state !== 'SUCCESS' || attempt.lastQueryResult.resultCode !== 0 ||
      !['QUERY', 'RECONCILIATION'].includes(attempt.verificationSource ?? '') || !attempt.lastVerifiedAt ||
      !Number.isFinite(attempt.lastVerifiedAt.getTime()) || attempt.reportedOutcome !== 'SUCCESS') {
      throw new AppError('Trusted verification and correlated receipt evidence are required', 409, 'MPESA_POSTING_NOT_VERIFIED');
    }
    const identifier = /^[A-Za-z0-9_-]{1,128}$/;
    if (!identifier.test(attempt.checkoutRequestId ?? '') || !identifier.test(attempt.merchantRequestId ?? '') ||
      !attempt.active || !['PENDING', 'UNKNOWN'].includes(attempt.submissionState) ||
      !['DISABLED', 'READY', 'POSTING_FAILED'].includes(attempt.postingStatus) ||
      attempt.provider !== 'MPESA' || attempt.currency !== 'KES' || !Number.isSafeInteger(attempt.amount) || attempt.amount <= 0) {
      throw new AppError('Payment attempt state or provider context is invalid for posting', 409, 'MPESA_POSTING_INVALID_STATE');
    }
  }

  private assertSnapshot(initial: MpesaAttempt, current: MpesaAttempt) {
    const fields = ['invoiceId', 'patientId', 'branchId', 'environment', 'amount', 'currency', 'provider',
      'merchantRequestId', 'checkoutRequestId', 'receiptNumber', 'fingerprint'] as const;
    if (initial.version !== current.version || fields.some((field) => initial[field] !== current[field])) {
      throw new AppError('Payment evidence changed; check status before retrying', 409, 'MPESA_POSTING_CONFLICT');
    }
  }

  private assertPostedPayment(attempt: MpesaAttempt, payment: BillingPayment | null): asserts payment is BillingPayment {
    if (!payment || (attempt.billingPaymentId && payment.id !== attempt.billingPaymentId) ||
      payment.invoice_id !== attempt.invoiceId || payment.patient_id !== attempt.patientId || payment.branch_id !== attempt.branchId ||
      payment.amount !== attempt.amount || payment.provider !== 'MPESA' || payment.payment_method !== 'MPESA' ||
      payment.mpesa_attempt_id !== attempt._id || payment.checkout_request_id !== attempt.checkoutRequestId ||
      payment.merchant_request_id !== attempt.merchantRequestId || payment.mpesa_receipt_number !== attempt.receiptNumber) {
      throw new AppError('Posted payment linkage is missing or inconsistent; manual review is required', 409, 'MPESA_POSTING_CONFLICT');
    }
  }

  private invoiceException(attempt: MpesaAttempt, invoice: BillingInvoice) {
    if (invoice.status === 'CANCELLED') return { reason: 'INVOICE_CANCELLED_WHILE_PAYMENT_VERIFIED',
      error: new AppError('Invoice was cancelled; verified payment requires manual review or refund', 409, 'MPESA_POSTING_INVOICE_CANCELLED') };
    if (invoice.status === 'PAID' || invoice.balance_amount === 0) return { reason: 'INVOICE_ALREADY_PAID',
      error: new AppError('Invoice is already paid; verified payment requires manual review or refund', 409, 'MPESA_POSTING_INVOICE_ALREADY_PAID') };
    if (attempt.amount > invoice.balance_amount) return { reason: 'PAYMENT_EXCEEDS_BALANCE',
      error: new AppError(`Payment amount of KES ${attempt.amount} exceeds invoice balance of KES ${invoice.balance_amount}`,
        400, 'PAYMENT_EXCEEDS_BALANCE', { balance_amount: invoice.balance_amount }) };
    return undefined;
  }

  async postPayment(
    attemptId: string,
    actorUserId: string,
    metadata?: BillingRequestMetadata,
  ) {
    const scope = await this.billingRepository.resolveBranchScope(actorUserId);
    const initialAttempt = await this.repository.get(attemptId);
    if (!initialAttempt) {
      throw new AppError('Payment attempt not found', 404, 'MPESA_ATTEMPT_NOT_FOUND');
    }

    const initialInvoice = await this.billingRepository.getById(initialAttempt.invoiceId, scope);
    if (!initialInvoice) {
      throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
    }
    if (initialInvoice.branch_id !== initialAttempt.branchId || initialInvoice.patient_id !== initialAttempt.patientId) {
      throw new AppError('Payment attempt changed or belongs to different context', 409, 'MPESA_ATTEMPT_CONFLICT');
    }

    let postingVersion: number | undefined;
    try {
      const result = await this.transaction(async (session) => {
        // These checks run again on every MongoDB transaction retry.
        const currentScope = await this.billingRepository.resolveBranchScope(actorUserId);
        const attempt = await this.repository.get(attemptId, session);
        if (!attempt) throw new AppError('Payment attempt not found', 404, 'MPESA_ATTEMPT_NOT_FOUND');
        const invoice = await this.billingRepository.getById(attempt.invoiceId, currentScope, session);
        if (!invoice) throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
        this.assertContext(attempt, invoice);
        if (attempt.invoiceId !== initialAttempt.invoiceId) {
          throw new AppError('Payment attempt context changed', 409, 'MPESA_ATTEMPT_CONFLICT');
        }
        if (attempt.postingStatus === 'POSTED') {
          const payment = await this.billingRepository.getPaymentByMpesaAttemptId(attempt._id, session);
          this.assertPostedPayment(attempt, payment);
          if (attempt.active) {
            const released = await this.repository.updatePosting(attempt._id, attempt.version, { active: false }, session);
            if (!released) throw new AppError('Concurrent posting conflict', 409, 'MPESA_POSTING_CONFLICT');
            await this.repository.audit('mpesa.attempt.lock_released', released, actorUserId, {
              reason: 'POSTED_LEDGER_CONFIRMED', invoiceId: invoice.id, paymentId: payment.id,
              activeBefore: true, activeAfter: false,
            }, session);
            return { attempt: released, payment, invoice, idempotent: true };
          }
          return { attempt, payment, invoice, idempotent: true };
        }
        if (attempt.postingStatus === 'POSTING') {
          throw new AppError('Payment posting is already in progress', 409, 'MPESA_POSTING_IN_PROGRESS');
        }
        this.assertSettlement(attempt);
        this.assertSnapshot(initialAttempt, attempt);

        const exception = this.invoiceException(attempt, invoice);
        if (exception) {
          const reviewed = await this.repository.updatePosting(attempt._id, attempt.version, {
            postingStatus: 'MANUAL_REVIEW_REQUIRED', recoveryStatus: 'MANUAL_REVIEW_REQUIRED',
            conflictingEvidence: exception.reason,
          }, session);
          if (!reviewed) throw new AppError('Concurrent posting conflict', 409, 'MPESA_POSTING_CONFLICT');
          await this.repository.audit('mpesa.posting.exception', reviewed, actorUserId, {
            reason: exception.reason, invoiceId: invoice.id, attemptAmount: attempt.amount, balanceAmount: invoice.balance_amount,
            from: attempt.postingStatus, to: 'MANUAL_REVIEW_REQUIRED',
          }, session);
          return { error: exception.error };
        }
        if (!['PENDING', 'PARTIALLY_PAID'].includes(invoice.status)) {
          throw new AppError('Invoice balance or status changed during posting', 409, 'PAYMENT_CONFLICT');
        }

        postingVersion = attempt.version;
        // Optimistic transition to POSTING
        const claimed = await this.repository.updatePosting(attempt._id, attempt.version, {
          postingStatus: 'POSTING',
        }, session);
        if (!claimed) {
          throw new AppError('Concurrent posting conflict', 409, 'MPESA_POSTING_CONFLICT');
        }

        // Check duplicate payment record by attempt ID or checkout ID
        const existingByAttempt = await this.billingRepository.getPaymentByMpesaAttemptId(attempt._id, session);
        if (existingByAttempt) {
          throw new AppError('A billing payment has already been recorded for this attempt', 409, 'MPESA_PAYMENT_ALREADY_POSTED');
        }

        const paymentNumber = createBillingNumber('PAY');
        const payment = await this.billingRepository.createPayment(invoice, paymentNumber, {
          amount: attempt.amount,
          payment_method: 'MPESA',
          payment_date: new Date().toISOString(),
          reference_number: attempt.receiptNumber,
          provider: 'MPESA',
          mpesa_attempt_id: attempt._id,
          merchant_request_id: attempt.merchantRequestId ?? null,
          checkout_request_id: attempt.checkoutRequestId ?? null,
          mpesa_receipt_number: attempt.receiptNumber,
          transaction_verification_timestamp: attempt.lastVerifiedAt,
          financial_posting_timestamp: new Date(),
        }, actorUserId, session);

        const updatedInvoice = await this.billingRepository.applyPayment(invoice, attempt.amount, actorUserId, session);
        if (!updatedInvoice) {
          throw new AppError('Failed to apply payment to invoice balance', 409, 'PAYMENT_CONFLICT');
        }

        // Advance payment sync if invoice is linked to an admission or procedure
        if (updatedInvoice.context_type === 'ADMISSION_REQUEST' || updatedInvoice.context_type === 'PROCEDURE_BOOKING') {
          if (updatedInvoice.context_id) {
            await this.advancePaymentService.processPayment(
              updatedInvoice.context_type,
              updatedInvoice.context_id,
              attempt.amount,
              actorUserId,
              session,
            );
          }
        }

        const postedAttempt = await this.repository.updatePosting(attempt._id, claimed.version, {
          postingStatus: 'POSTED',
          active: false,
          billingPaymentId: payment.id,
          billingPaymentNumber: payment.payment_number,
          postedAt: new Date(),
          recoveryStatus: 'RESOLVED',
        }, session);
        if (!postedAttempt) {
          throw new AppError('Failed to record posted state on payment attempt', 500, 'MPESA_POSTING_FAILED');
        }

        await this.billingRepository.audit('billing.payment.collected', actorUserId, metadata ?? {}, {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          paymentId: payment.id,
          paymentNumber: payment.payment_number,
          amount: payment.amount,
          paymentMethod: 'MPESA',
          referenceNumber: attempt.receiptNumber,
          status: updatedInvoice.status,
          balanceAmount: updatedInvoice.balance_amount,
        }, session);

        await this.repository.audit('mpesa.attempt.posted', postedAttempt, actorUserId, {
          paymentId: payment.id,
          paymentNumber: payment.payment_number,
          invoiceId: invoice.id,
          amount: attempt.amount,
          receiptNumber: attempt.receiptNumber,
          from: attempt.postingStatus, to: 'POSTED', activeBefore: attempt.active, activeAfter: false,
        }, session);

        return { attempt: postedAttempt, payment, invoice: updatedInvoice, idempotent: false };
      });

      if ('error' in result) throw result.error;
      return {
        attempt: this.view(result.attempt),
        payment: result.payment,
        invoice: result.invoice,
        idempotent: result.idempotent,
      };
    } catch (error) {
      if (postingVersion !== undefined) {
        try {
          const cur = await this.repository.get(attemptId);
          if (cur && cur.version === postingVersion && ['DISABLED', 'READY', 'POSTING_FAILED'].includes(cur.postingStatus) &&
            cur.verificationStatus === 'VERIFIED' && !cur.conflictingEvidence && cur.recoveryStatus !== 'MANUAL_REVIEW_REQUIRED') {
            await this.transaction(async (session) => {
              const failed = await this.repository.updatePosting(attemptId, cur.version, {
                postingStatus: 'POSTING_FAILED',
                postingError: 'Financial posting failed; check status before retrying',
              }, session);
              if (failed) await this.repository.audit('mpesa.posting.failed', failed, actorUserId, {
                from: cur.postingStatus, to: 'POSTING_FAILED', reason: 'POSTING_TRANSACTION_FAILED', invoiceId: cur.invoiceId,
              }, session);
            });
          }
        } catch {
          // Preserve the original posting error if failure annotation cannot commit.
        }
      }
      throw error;
    }
  }

  async getPaymentForAttempt(attemptId: string, actorUserId: string) {
    const scope = await this.billingRepository.resolveBranchScope(actorUserId);
    const attempt = await this.repository.get(attemptId);
    if (!attempt) {
      throw new AppError('Payment attempt not found', 404, 'MPESA_ATTEMPT_NOT_FOUND');
    }
    const invoice = await this.billingRepository.getById(attempt.invoiceId, scope);
    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
    }

    if (!attempt.billingPaymentId) {
      throw new AppError('No billing payment has been posted for this attempt', 404, 'MPESA_PAYMENT_NOT_POSTED');
    }
    const payment = await this.billingRepository.getPaymentById(attempt.billingPaymentId, scope);
    if (!payment) {
      throw new AppError('Linked billing payment not found', 404, 'BILLING_PAYMENT_NOT_FOUND');
    }
    return { payment, invoice };
  }

  async getReceiptForAttempt(attemptId: string, actorUserId: string, metadata?: BillingRequestMetadata) {
    const scope = await this.billingRepository.resolveBranchScope(actorUserId);
    const attempt = await this.repository.get(attemptId);
    if (!attempt) {
      throw new AppError('Payment attempt not found', 404, 'MPESA_ATTEMPT_NOT_FOUND');
    }
    const invoice = await this.billingRepository.getById(attempt.invoiceId, scope);
    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'BILLING_INVOICE_NOT_FOUND');
    }

    if (!attempt.billingPaymentId) {
      throw new AppError('No official receipt available: payment has not been posted', 404, 'MPESA_RECEIPT_NOT_AVAILABLE');
    }
    return this.billingService.receipt(attempt.billingPaymentId, actorUserId, metadata ?? {});
  }

  async listExceptions(actorUserId: string, query?: { page?: number; limit?: number }) {
    const scope = await this.billingRepository.resolveBranchScope(actorUserId);
    if (Array.isArray(scope) && scope.length === 0) {
      return { items: [], total: 0, page: query?.page ?? 1, limit: query?.limit ?? 20 };
    }
    const result = await this.repository.list({
      branchIds: scope,
      exceptionsOnly: true,
      page: query?.page ?? 1,
      limit: query?.limit ?? 20,
    });
    return {
      items: result.items.map((item) => this.view(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
