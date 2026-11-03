import type { MpesaAttemptView } from '../api/mpesa';
import { mpesaRecovery } from './mpesa-recovery';

export function mpesaAmountError(amount: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.';
  if (!Number.isInteger(amount)) return 'M-Pesa accepts whole KES amounts only. Decimals are not supported.';
  if (amount > 250000) return 'M-Pesa payment amount cannot exceed KES 250,000.';
  if (amount > balance) return 'Amount cannot exceed outstanding balance.';
  return null;
}

export function mpesaReviewReason(reason: string | null): string {
  switch (reason) {
    case 'MERCHANT_CONFIGURATION_CHANGED': return 'Merchant settings changed since this payment request was created.';
    case 'INVOICE_ALREADY_PAID': return 'This invoice was already paid before this payment could be applied.';
    case 'INVOICE_CANCELLED_WHILE_PAYMENT_VERIFIED': return 'This invoice was cancelled before this payment could be applied.';
    case 'PAYMENT_EXCEEDS_BALANCE': return 'The payment exceeds the invoice’s remaining balance.';
    default: return 'The payment could not be safely confirmed or applied to the invoice.';
  }
}

export function mpesaPaymentSummary(attempt: MpesaAttemptView) {
  const state = mpesaRecovery(attempt);
  if (state.review) return { tone: 'error', title: 'Billing supervisor review needed',
    message: `${mpesaReviewReason(attempt.conflictingEvidence)} Contact your billing supervisor. Do not request another payment until this has been reviewed.` };
  if (state.posted) return { tone: 'success', title: 'Payment applied to invoice',
    message: 'The payment is recorded in HMS. You can view the receipt below.' };
  if (state.canPost) return { tone: 'info', title: 'Payment confirmed — ready to apply',
    message: 'Safaricom success and receipt evidence are available. Select “Apply confirmed payment” to update this invoice.' };
  if (attempt.verificationStatus === 'FAILED' || attempt.submissionState === 'REJECTED') {
    return { tone: 'error', title: attempt.reportedOutcome === 'TIMEOUT' ? 'Payment timed out'
      : attempt.reportedOutcome === 'CANCELLED' ? 'Payment cancelled' : 'Payment unsuccessful',
    message: 'This attempt has not been applied to the invoice. Start a new payment request only when the retry action is available.' };
  }
  if (attempt.submissionState === 'CREATED') return { tone: 'info', title: 'Payment request not sent',
    message: 'This saved attempt has not started submission. Select “Send saved payment request” to continue.' };
  if (attempt.submissionState === 'SUBMITTING') return { tone: 'info', title: 'Sending payment request',
    message: 'HMS is submitting the request. Do not send another request.' };
  if (attempt.reportedOutcome !== 'PENDING' || attempt.verificationStatus === 'UNRESOLVED' ||
    attempt.submissionState === 'UNKNOWN' || attempt.postingStatus === 'POSTING_FAILED') {
    return { tone: 'warning', title: 'Payment outcome needs confirmation',
      message: 'Do not request another payment. Check with Safaricom when available, or ask your billing supervisor to review the saved details.' };
  }
  return { tone: 'info', title: 'Payment request accepted — waiting for confirmation',
    message: 'Ask the customer to check their phone. If a Safaricom prompt appears, they should check the merchant and amount, then enter their M-Pesa PIN on that phone. Never enter or share the PIN in HMS. Request acceptance does not confirm that the prompt was delivered.' };
}
