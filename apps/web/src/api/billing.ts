import { apiClient } from './client';

export type BillingInvoiceStatus = 'DRAFT' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type BillingServiceType = 'CONSULTATION' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PHARMACY';
export type BillingSourceType = 'OPD' | 'EMERGENCY' | 'PROCEDURE';
export type ManualBillingServiceType = Exclude<BillingServiceType, 'PHARMACY'>;
export type BillingPaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';

export type BillingInvoiceItem = {
  id: string;
  invoice_id: string;
  service_id: string;
  service_name: string;
  service_type: BillingServiceType;
  originating_order_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingInvoice = {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_number: string | null;
  patient_name: string | null;
  visit_id: string;
  visit_number: string | null;
  source_type: BillingSourceType;
  encounter_id: string;
  admission_id: string | null;
  procedure_id: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  branch_id: string;
  context_type: 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING' | null;
  context_id: string | null;
  branch_name: string | null;
  invoice_date: string;
  status: BillingInvoiceStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  items: BillingInvoiceItem[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingPayment = {
  id: string;
  invoice_id: string;
  patient_id: string;
  branch_id: string;
  payment_number: string;
  amount: number;
  payment_method: BillingPaymentMethod;
  payment_date: string;
  reference_number: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingReceipt = {
  receipt_number: string;
  generated_at: string;
  payment: BillingPayment;
  invoice: BillingInvoice;
};

export type BillingInvoiceListParams = Partial<{
  invoice_number: string;
  patient_id: string;
  admission_id: string;
  status: BillingInvoiceStatus;
  date_from: string;
  date_to: string;
  branch_id: string;
  page: number;
  limit: number;
  sortBy: 'invoice_number' | 'invoice_date' | 'status' | 'total_amount' | 'balance_amount' | 'created_at';
  sortOrder: 'asc' | 'desc';
}>;

export type BillingInvoiceList = {
  data: BillingInvoice[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type BillingSummary = {
  total_invoices: number;
  billed_amount: number;
  collected_amount: number;
  outstanding_amount: number;
  by_status: Record<BillingInvoiceStatus, number>;
};

export type SaveBillingInvoiceItem = {
  service_id: string;
  service_type: ManualBillingServiceType;
  quantity: number;
};

export type CreateBillingInvoicePayload = {
  patient_id: string;
  visit_id: string;
  appointment_id?: string | null;
  branch_id: string;
  invoice_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  items: SaveBillingInvoiceItem[];
};

export type UpdateBillingInvoicePayload = Partial<Pick<
  CreateBillingInvoicePayload,
  'invoice_date' | 'discount_amount' | 'tax_amount' | 'items'
>> & { status?: 'PENDING' };

export type CollectBillingPaymentPayload = {
  amount: number;
  payment_method: BillingPaymentMethod;
  payment_date?: string;
  reference_number?: string | null;
};

export type LinkAdmissionBillingContextPayload = {
  patient_id: string;
  branch_id: string;
  request_id: string;
};

export type LinkProcedureBillingContextPayload = {
  patient_id: string;
  branch_id: string;
  booking_id: string;
};

const queryString = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const billingApi = {
  list(params: BillingInvoiceListParams = {}) {
    return apiClient.request<BillingInvoiceList>(`/billing/invoices${queryString(params)}`);
  },
  summary(params: Pick<BillingInvoiceListParams, 'branch_id' | 'date_from' | 'date_to'> = {}) {
    return apiClient.request<BillingSummary>(`/billing/summary${queryString(params)}`);
  },
  getById(id: string) {
    return apiClient.request<BillingInvoice>(`/billing/invoices/${encodeURIComponent(id)}`);
  },
  create(payload: CreateBillingInvoicePayload) {
    return apiClient.request<BillingInvoice>('/billing/invoices', { method: 'POST', body: payload });
  },
  update(id: string, payload: UpdateBillingInvoicePayload) {
    return apiClient.request<BillingInvoice>(`/billing/invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
  },
  linkAdmissionContext(id: string, payload: LinkAdmissionBillingContextPayload) {
    return apiClient.request<BillingInvoice>(`/billing/invoices/${encodeURIComponent(id)}/admission-context`, { method: 'PATCH', body: payload });
  },
  linkProcedureContext(id: string, payload: LinkProcedureBillingContextPayload) {
    return apiClient.request<BillingInvoice>(`/billing/invoices/${encodeURIComponent(id)}/procedure-context`, { method: 'PATCH', body: payload });
  },
  cancel(id: string) {
    return apiClient.request<BillingInvoice>(`/billing/invoices/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  },
  collectPayment(id: string, payload: CollectBillingPaymentPayload) {
    return apiClient.request<{ payment: BillingPayment; invoice: BillingInvoice }>(
      `/billing/invoices/${encodeURIComponent(id)}/payments`,
      { method: 'POST', body: payload },
    );
  },
  payments(id: string) {
    return apiClient.request<BillingPayment[]>(`/billing/invoices/${encodeURIComponent(id)}/payments`);
  },
  receipt(paymentId: string) {
    return apiClient.request<BillingReceipt>(`/billing/payments/${encodeURIComponent(paymentId)}/receipt`);
  },
};

