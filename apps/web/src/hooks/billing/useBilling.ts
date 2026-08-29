import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  type BillingInvoiceListParams,
  type CollectBillingPaymentPayload,
  type CreateBillingInvoicePayload,
  type LinkAdmissionBillingContextPayload,
  type LinkProcedureBillingContextPayload,
  type UpdateBillingInvoicePayload,
} from '../../api/billing';
import { billingService } from '../../services/billing.service';

type BillingMutationNotificationOptions = {
  notifyOnError?: boolean;
  notifyOnSuccess?: boolean;
};

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
    queryFn: () => billingService.list(params),
    enabled,
  });
}

export function useBillingSummary(
  params: Pick<BillingInvoiceListParams, 'branch_id' | 'date_from' | 'date_to'>,
  enabled = true,
) {
  return useQuery({
    queryKey: billingKeys.summary(params),
    queryFn: () => billingService.summary(params),
    enabled,
  });
}

export function useBillingInvoiceDetails(id: string | null) {
  return useQuery({
    queryKey: id ? billingKeys.detail(id) : billingKeys.details(),
    queryFn: () => billingService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useBillingPayments(invoiceId: string | null) {
  return useQuery({
    queryKey: invoiceId ? billingKeys.paymentList(invoiceId) : billingKeys.payments(),
    queryFn: () => billingService.payments(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useCreateBillingInvoice(options: BillingMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBillingInvoicePayload) => billingService.create(payload),
    onSuccess: async () => {
      if (options.notifyOnSuccess !== false) toast.success('Invoice draft created.');
      // Creating a new invoice affects the list view and summary totals only.
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: billingKeys.summaries() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getBillingErrorMessage(error));
    },
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
    }) => billingService.update(id, { ...payload, ...(finalize ? { status: 'PENDING' } : {}) }),
    onSuccess: async (_result, { id, finalize }) => {
      toast.success(finalize ? 'Invoice finalized and ready for payment.' : 'Invoice updated.');
      // The specific invoice detail changed; lists and summaries may reflect status/amount changes.
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: billingKeys.summaries() });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useCancelBillingInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => billingService.cancel(id),
    onSuccess: async (_result, id) => {
      toast.success('Invoice cancelled.');
      // Cancellation changes both the invoice detail and list/summary aggregates.
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: billingKeys.summaries() });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useLinkAdmissionBillingContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LinkAdmissionBillingContextPayload }) =>
      billingService.linkAdmissionContext(id, payload),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(invoice.id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useLinkProcedureBillingContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LinkProcedureBillingContextPayload }) =>
      billingService.linkProcedureContext(id, payload),
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(invoice.id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useCollectBillingPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CollectBillingPaymentPayload }) =>
      billingService.collectPayment(id, payload),
    onSuccess: async (result) => {
      toast.success(result.invoice.status === 'PAID' ? 'Invoice paid in full.' : 'Partial payment collected.');
      const id = result.invoice.id;
      // Payment changes the invoice detail, its payment list, and list/summary aggregates.
      await queryClient.invalidateQueries({ queryKey: billingKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.paymentList(id) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: billingKeys.summaries() });
    },
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}

export function useBillingReceipt() {
  return useMutation({
    mutationFn: (paymentId: string) => billingService.receipt(paymentId),
    onError: (error) => toast.error(getBillingErrorMessage(error)),
  });
}
