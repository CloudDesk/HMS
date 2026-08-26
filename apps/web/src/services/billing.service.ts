import {
  billingApi,
  type BillingInvoiceListParams,
  type CollectBillingPaymentPayload,
  type CreateBillingInvoicePayload,
  type LinkAdmissionBillingContextPayload,
  type LinkProcedureBillingContextPayload,
  type UpdateBillingInvoicePayload,
} from '../api/billing';

export const billingService = {
  list: (params: BillingInvoiceListParams = {}) => billingApi.list(params),
  summary: (params: Pick<BillingInvoiceListParams, 'branch_id' | 'date_from' | 'date_to'> = {}) =>
    billingApi.summary(params),
  getById: (id: string) => billingApi.getById(id),
  create: (payload: CreateBillingInvoicePayload) => billingApi.create(payload),
  update: (id: string, payload: UpdateBillingInvoicePayload) => billingApi.update(id, payload),
  linkAdmissionContext: (id: string, payload: LinkAdmissionBillingContextPayload) => billingApi.linkAdmissionContext(id, payload),
  linkProcedureContext: (id: string, payload: LinkProcedureBillingContextPayload) => billingApi.linkProcedureContext(id, payload),
  cancel: (id: string) => billingApi.cancel(id),
  collectPayment: (id: string, payload: CollectBillingPaymentPayload) => billingApi.collectPayment(id, payload),
  payments: (id: string) => billingApi.payments(id),
  receipt: (paymentId: string) => billingApi.receipt(paymentId),
};
