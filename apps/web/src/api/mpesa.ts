import { apiClient } from './client';
import { z } from 'zod';
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

export type MpesaAttemptsResponse = {
  items: MpesaAttemptView[];
  total: number;
  page: number;
  limit: number;
};
export type MpesaExceptionsResponse = MpesaAttemptsResponse;

const nullableText = z.string().nullable();
const attemptSchema: z.ZodType<MpesaAttemptView> = z.object({
  id: z.string().min(1), invoiceId: z.string().min(1), patientId: z.string().min(1), branchId: z.string().min(1),
  amount: z.number().int().positive(), currency: z.literal('KES'), payerPhoneMasked: z.string(),
  environment: z.enum(['sandbox', 'production']),
  submissionState: z.enum(['CREATED', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'REJECTED']),
  reportedOutcome: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT']),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'FAILED', 'CONFLICT', 'UNRESOLVED']),
  postingStatus: z.enum(['DISABLED', 'READY', 'POSTING', 'POSTED', 'POSTING_FAILED', 'MANUAL_REVIEW_REQUIRED']),
  version: z.number().int().nonnegative(), checkoutRequestId: nullableText, merchantRequestId: nullableText,
  receiptNumber: nullableText, submissionError: nullableText, verificationSource: nullableText,
  verificationAttempts: z.number().int().nonnegative(), lastVerifiedAt: nullableText, lastQueryResult: z.unknown(),
  queryOutcome: z.enum(['NONE', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT', 'UNKNOWN']),
  conflictingEvidence: nullableText,
  recoveryStatus: z.enum(['NONE', 'IN_RECOVERY', 'RESOLVED', 'MANUAL_REVIEW_REQUIRED', 'ABANDONED']),
  nextReconciliationAt: nullableText, reconciliationRetries: z.number().int().nonnegative(),
  billingPaymentId: nullableText, billingPaymentNumber: nullableText, postedAt: nullableText, postingError: nullableText,
  createdAt: z.string(), updatedAt: z.string(),
});
const attemptsSchema = z.object({
  items: z.array(attemptSchema), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), limit: z.number().int().min(1).max(100),
});

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
    return apiClient.request<{ payment: BillingPayment; invoice: BillingInvoice }>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/payment`,
    );
  },

  getReceipt(attemptId: string) {
    return apiClient.request<BillingReceipt>(
      `/payments/mpesa/attempts/${encodeURIComponent(attemptId)}/receipt`,
    );
  },

  async listExceptions(params: { page?: number; limit?: number } = {}): Promise<MpesaExceptionsResponse> {
    return attemptsSchema.parse(await apiClient.request<unknown>(
      `/payments/mpesa/exceptions${queryString(params)}`,
    ));
  },

  async listAttempts(params: ListMpesaAttemptsParams = {}): Promise<MpesaAttemptsResponse> {
    return attemptsSchema.parse(await apiClient.request<unknown>(
      `/payments/mpesa/attempts${queryString(params)}`,
    ));
  },
};
