import { apiClient } from './client';
import type { BillingInvoice, BillingPayment, BillingReceipt } from './billing';

export type MpesaSubmissionState = 'CREATED' | 'SUBMITTING' | 'PENDING' | 'UNKNOWN' | 'REJECTED';
export type MpesaReportedOutcome = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
export type MpesaVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'FAILED' | 'CONFLICT' | 'UNRESOLVED';
export type MpesaPostingStatus = 'DISABLED' | 'READY' | 'POSTING' | 'POSTED' | 'POSTING_FAILED' | 'MANUAL_REVIEW_REQUIRED';
export type MpesaQueryOutcome = 'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'UNKNOWN';
export type MpesaRecoveryStatus = 'NONE' | 'IN_RECOVERY' | 'RESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'ABANDONED';

export type MpesaAttemptView = {
  id: string;
  invoiceId: string;
  patientId: string;
  branchId: string;
  amount: number;
  currency: string;
  payerPhoneMasked: string;
  environment: 'sandbox' | 'production';
  submissionState: MpesaSubmissionState;
  reportedOutcome: MpesaReportedOutcome;
  verificationStatus: MpesaVerificationStatus;
  postingStatus: MpesaPostingStatus;
  version: number;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  receiptNumber: string | null;
  submissionError: string | null;
  verificationSource: string | null;
  verificationAttempts: number;
  lastVerifiedAt: string | null;
  lastQueryResult: unknown | null;
  queryOutcome: MpesaQueryOutcome;
  conflictingEvidence: string | null;
  recoveryStatus: MpesaRecoveryStatus;
  nextReconciliationAt: string | null;
  reconciliationRetries: number;
  billingPaymentId: string | null;
  billingPaymentNumber: string | null;
  postedAt: string | null;
  postingError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMpesaAttemptPayload = {
  amount: number;
  payerPhone: string;
  idempotencyKey: string;
};

export type SubmitMpesaAttemptPayload = {
  expectedVersion: number;
};

export type PostMpesaPaymentResult = {
  attempt: MpesaAttemptView;
  payment: BillingPayment;
  invoice: BillingInvoice;
  idempotent: boolean;
};

export type MpesaExceptionsResponse = {
  data: MpesaAttemptView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ListMpesaAttemptsParams = Partial<{
  page: number;
  limit: number;
  invoiceId: string;
  submissionState: MpesaSubmissionState;
  verificationStatus: MpesaVerificationStatus;
  postingStatus: MpesaPostingStatus;
  unresolvedOnly: boolean;
}>;

const queryString = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const mpesaApi = {
  createAttempt(invoiceId: string, payload: CreateMpesaAttemptPayload) {
    return apiClient.request<MpesaAttemptView>(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/mpesa-attempts`,
      { method: 'POST', body: payload },
    );
  },

  submitAttempt(attemptId: string, payload: SubmitMpesaAttemptPayload) {
    return apiClient.request<MpesaAttemptView>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/submit`,
      { method: 'POST', body: payload },
    );
  },

  getAttempt(attemptId: string) {
    return apiClient.request<MpesaAttemptView>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}`,
    );
  },

  verifyAttempt(attemptId: string) {
    return apiClient.request<MpesaAttemptView>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/verify`,
      { method: 'POST' },
    );
  },

  postPayment(attemptId: string) {
    return apiClient.request<PostMpesaPaymentResult>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/post`,
      { method: 'POST' },
    );
  },

  getPayment(attemptId: string) {
    return apiClient.request<BillingPayment>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/payment`,
    );
  },

  getReceipt(attemptId: string) {
    return apiClient.request<BillingReceipt>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/receipt`,
    );
  },

  listExceptions(params: { page?: number; limit?: number } = {}) {
    return apiClient.request<MpesaExceptionsResponse>(
      `/payments/mpesa/exceptions${queryString(params)}`,
    );
  },

  listAttempts(params: ListMpesaAttemptsParams = {}) {
    return apiClient.request<{ data: MpesaAttemptView[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/payments/mpesa/attempts${queryString(params)}`,
    );
  },
};
