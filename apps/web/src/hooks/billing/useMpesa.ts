import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  type CreateMpesaAttemptPayload,
  type MpesaAttemptView,
  type SubmitMpesaAttemptPayload,
} from '../../api/mpesa';
import { mpesaService } from '../../services/mpesa.service';
import { billingKeys } from './useBilling';

export const getMpesaErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to perform this M-Pesa billing action.';
    if (error.status === 404) return 'The payment attempt or linked invoice could not be found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) {
      if (error.code === 'MPESA_ATTEMPT_UNAVAILABLE' || error.code === 'MPESA_PROVIDER_AUTH_FAILED') {
        return 'M-Pesa services are currently unavailable. Please verify network status or try again shortly.';
      }
      return error.message || 'M-Pesa operation failed. Please check status before retrying.';
    }
    return error.message;
  }
  return 'Unable to process M-Pesa request.';
};

export const mpesaKeys = {
  all: ['mpesa'] as const,
  attempt: (id: string) => [...mpesaKeys.all, 'attempt', id] as const,
  exceptions: (page?: number, limit?: number) => [...mpesaKeys.all, 'exceptions', page ?? 1, limit ?? 20] as const,
  invoiceAttempts: (invoiceId: string) => [...mpesaKeys.all, 'invoice', invoiceId] as const,
};

/**
 * Hook to retrieve an M-Pesa attempt with bounded polling.
 * Automatically polls while the transaction is active/pending, and stops
 * once terminal or conflict states are reached.
 */
export function useMpesaAttempt(
  attemptId: string | null,
  options?: {
    enabled?: boolean;
    pollingInterval?: number;
    maxPollCount?: number;
  },
) {
  const enabled = Boolean(attemptId) && (options?.enabled !== false);
  const interval = options?.pollingInterval ?? 3500;

  return useQuery({
    queryKey: attemptId ? mpesaKeys.attempt(attemptId) : mpesaKeys.all,
    queryFn: () => mpesaService.getAttempt(attemptId!),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data as MpesaAttemptView | undefined;
      if (!data) return interval;

      // Stop polling if payment is committed
      if (data.postingStatus === 'POSTED') return false;

      // Stop polling if attempt has reached terminal failure or manual review
      if (
        data.postingStatus === 'MANUAL_REVIEW_REQUIRED' ||
        data.postingStatus === 'POSTING_FAILED' ||
        data.submissionState === 'REJECTED' ||
        data.reportedOutcome === 'FAILED' ||
        data.reportedOutcome === 'CANCELLED' ||
        data.verificationStatus === 'CONFLICT' ||
        data.verificationStatus === 'FAILED'
      ) {
        return false;
      }

      // Continue polling while awaiting submission, callback, or settlement verification
      if (
        data.submissionState === 'CREATED' ||
        data.submissionState === 'SUBMITTING' ||
        data.submissionState === 'PENDING' ||
        data.reportedOutcome === 'PENDING' ||
        data.postingStatus === 'POSTING' ||
        (data.verificationStatus === 'UNVERIFIED' && data.reportedOutcome === 'SUCCESS')
      ) {
        return interval;
      }

      return false;
    },
  });
}

/**
 * Creates an M-Pesa payment attempt for an invoice.
 */
export function useCreateMpesaAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      payload,
    }: {
      invoiceId: string;
      payload: CreateMpesaAttemptPayload;
    }) => mpesaService.createAttempt(invoiceId, payload),
    onSuccess: (attempt) => {
      queryClient.setQueryData(mpesaKeys.attempt(attempt.id), attempt);
      void queryClient.invalidateQueries({ queryKey: mpesaKeys.invoiceAttempts(attempt.invoiceId) });
    },
    onError: (error) => {
      toast.error(getMpesaErrorMessage(error));
    },
  });
}

/**
 * Submits an STK Push for an existing attempt.
 */
export function useSubmitMpesaAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attemptId,
      payload,
    }: {
      attemptId: string;
      payload: SubmitMpesaAttemptPayload;
    }) => mpesaService.submitAttempt(attemptId, payload),
    onSuccess: (attempt) => {
      queryClient.setQueryData(mpesaKeys.attempt(attempt.id), attempt);
      if (attempt.submissionState === 'PENDING') {
        toast.info('STK Push sent. Please ask the customer to enter their M-Pesa PIN.');
      } else if (attempt.submissionState === 'REJECTED') {
        toast.error('STK Push was rejected by Safaricom. Please check details and try again.');
      }
    },
    onError: (error) => {
      toast.error(getMpesaErrorMessage(error));
    },
  });
}

/**
 * Triggers an authoritative transaction verification status query against Daraja.
 */
export function useVerifyMpesaAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attemptId: string) => mpesaService.verifyAttempt(attemptId),
    onSuccess: (attempt) => {
      queryClient.setQueryData(mpesaKeys.attempt(attempt.id), attempt);
      if (attempt.verificationStatus === 'VERIFIED') {
        toast.success('M-Pesa payment verified with Safaricom.');
      } else if (attempt.verificationStatus === 'CONFLICT') {
        toast.warning('Transaction has conflicting evidence and requires manual review.');
      } else if (attempt.verificationStatus === 'FAILED') {
        toast.error('Transaction was cancelled or failed.');
      }
    },
    onError: (error) => {
      toast.error(getMpesaErrorMessage(error));
    },
  });
}

/**
 * Posts a verified M-Pesa transaction to the billing ledger (Phase 2 integration).
 */
export function usePostMpesaPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attemptId: string) => mpesaService.postPayment(attemptId),
    onSuccess: async (result) => {
      toast.success(
        result.invoice.status === 'PAID'
          ? 'M-Pesa payment collected! Invoice paid in full.'
          : 'M-Pesa partial payment posted to invoice.',
      );
      // Update local attempt cache
      queryClient.setQueryData(mpesaKeys.attempt(result.attempt.id), result.attempt);

      // Invalidate billing queries to refresh balances, payments, summaries
      const invoiceId = result.invoice.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.detail(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: billingKeys.paymentList(invoiceId) }),
        queryClient.invalidateQueries({ queryKey: billingKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: billingKeys.summaries() }),
        queryClient.invalidateQueries({ queryKey: mpesaKeys.exceptions() }),
      ]);
    },
    onError: (error) => {
      toast.error(getMpesaErrorMessage(error));
    },
  });
}

/**
 * Fetches the official receipt for a posted M-Pesa payment attempt.
 */
export function useMpesaReceipt() {
  return useMutation({
    mutationFn: (attemptId: string) => mpesaService.getReceipt(attemptId),
    onError: (error) => {
      toast.error(getMpesaErrorMessage(error));
    },
  });
}

/**
 * Lists payment attempts requiring manual review.
 */
export function useMpesaExceptions(page = 1, limit = 20, enabled = true) {
  return useQuery({
    queryKey: mpesaKeys.exceptions(page, limit),
    queryFn: () => mpesaService.listExceptions({ page, limit }),
    enabled,
  });
}

/**
 * Lists payment attempts for a specific invoice.
 */
export function useMpesaInvoiceAttempts(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: invoiceId ? mpesaKeys.invoiceAttempts(invoiceId) : mpesaKeys.all,
    queryFn: () => mpesaService.listAttempts({ invoiceId: invoiceId!, limit: 50 }),
    enabled: Boolean(invoiceId) && enabled,
  });
}
