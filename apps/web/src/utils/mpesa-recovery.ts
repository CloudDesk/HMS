import type { MpesaAttemptView } from '../api/mpesa';

// Presentation/action eligibility only. The backend remains authoritative.
export function mpesaRecovery(attempt: MpesaAttemptView) {
  const posted = attempt.postingStatus === 'POSTED';
  const review = Boolean(attempt.conflictingEvidence) || attempt.verificationStatus === 'CONFLICT' ||
    attempt.postingStatus === 'MANUAL_REVIEW_REQUIRED' ||
    attempt.recoveryStatus === 'MANUAL_REVIEW_REQUIRED' || attempt.recoveryStatus === 'ABANDONED';
  const failed = attempt.verificationStatus === 'FAILED' && attempt.recoveryStatus === 'RESOLVED';
  return {
    posted,
    review,
    canRetry: !posted && !review && (failed || attempt.submissionState === 'REJECTED'),
    canVerify: !posted && !review && !failed && Boolean(attempt.checkoutRequestId) &&
      ['PENDING', 'UNKNOWN'].includes(attempt.submissionState),
    canPost: !posted && !review && attempt.verificationStatus === 'VERIFIED' &&
      attempt.reportedOutcome === 'SUCCESS' && attempt.queryOutcome === 'SUCCESS' &&
      Boolean(attempt.receiptNumber) && ['DISABLED', 'READY', 'POSTING_FAILED'].includes(attempt.postingStatus),
    stopPolling: posted || review || failed || attempt.submissionState === 'REJECTED' ||
      attempt.postingStatus === 'POSTING_FAILED',
  };
}
