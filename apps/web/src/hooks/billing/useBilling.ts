import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  billingApi,
  type BillingInvoiceListParams,
  type CollectBillingPaymentPayload,
  type CreateBillingInvoicePayload,
  type UpdateBillingInvoicePayload,
} from '../../api/billing';

export const getBillingErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage billing.';
    if (error.status === 404) return 'The selected invoice or payment could not be found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) return 'The billing service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the billing request.';
};

export const billingKeys = {
  all: ['billing'] as const,
  lists: () => [...billingKeys.all, 'invoices'] as const,
  list: (params: BillingInvoiceListParams) => [...billingKeys.lists(), params] as const,
  summaries: () => [...billingKeys.all, 'summary'] as const,
  summary: (params: Pick<BillingInvoiceListParams, 'branch_id' | 'date_from' | 'date_to'>) =>
    [...billingKeys.summaries(), params] as const,
  details: () => [...billingKeys.all, 'invoice'] as const,
  detail: (id: string) => [...billingKeys.details(), id] as const,
  payments: () => [...billingKeys.all, 'payments'] as const,
  paymentList: (id: string) => [...billingKeys.payments(), id] as const,
};

export function useBillingInvoices(params: BillingInvoiceListParams, enabled = true) {
  return useQuery({
    queryKey: billingKeys.list(params),
    queryFn: () => billingApi.list(params),
    enabled,
  });
}

export function useBillingSummary(
  params: Pick<BillingInvoiceListParams, 'branch_id' | 'date_from' | 'date_to'>,
  enabled = true,
) {
  return useQuery({
    queryKey: billingKeys.summary(params),
    queryFn: () => billingApi.summary(params),
    enabled,
  });
}

export function useBillingInvoiceDetails(id: string | null) {
  return useQuery({
    queryKey: id ? billingKeys.detail(id) : billingKeys.details(),
    queryFn: () => billingApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useBillingPayments(invoiceId: string | null) {
  return useQuery({
    queryKey: invoiceId ? billingKeys.paymentList(invoiceId) : billingKeys.payments(),
    queryFn: () => billingApi.payments(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useCreateBillingInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBillingInvoicePayload) => billingApi.create(payload),
    onSuccess: async () => {
      toast.success('Invoice draft created.');
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useUpdateBillingInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      finalize,
    }: {
      id: string;
      payload: UpdateBillingInvoicePayload;
      finalize?: boolean;
    }) => billingApi.update(id, { ...payload, ...(finalize ? { status: 'PENDING' } : {}) }),
    onSuccess: async (_result, { finalize }) => {
      toast.success(finalize ? 'Invoice finalized and ready for payment.' : 'Invoice updated.');
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useCancelBillingInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => billingApi.cancel(id),
    onSuccess: async () => {
      toast.success('Invoice cancelled.');
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useCollectBillingPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CollectBillingPaymentPayload }) =>
      billingApi.collectPayment(id, payload),
    onSuccess: async (result) => {
      toast.success(result.invoice.status === 'PAID' ? 'Invoice paid in full.' : 'Partial payment collected.');
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useBillingReceipt() {
  return useMutation({
    mutationFn: (paymentId: string) => billingApi.receipt(paymentId),
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}
