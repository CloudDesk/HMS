export type BillingInvoiceStatus = 'DRAFT' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type BillingServiceType = 'CONSULTATION' | 'LAB_TEST' | 'IMAGING_SERVICE' | 'PHARMACY';
export type BillingSourceType = 'OPD' | 'EMERGENCY' | 'PROCEDURE' | 'IP_ADMISSION';
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
  created_at: Date;
  updated_at: Date;
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
  invoice_date: Date;
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
  created_at: Date;
  updated_at: Date;
};

export type BillingPayment = {
  id: string;
  invoice_id: string;
  patient_id: string;
  branch_id: string;
  payment_number: string;
  amount: number;
  payment_method: BillingPaymentMethod;
  payment_date: Date;
  reference_number: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BillingReceipt = {
  receipt_number: string;
  generated_at: Date;
  payment: BillingPayment;
  invoice: BillingInvoice;
};

export type BillingInvoiceListQuery = {
  invoice_number?: string;
  patient_id?: string;
  status?: BillingInvoiceStatus;
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  page?: number;
  limit?: number;
  sortBy?: 'invoice_number' | 'invoice_date' | 'status' | 'total_amount' | 'balance_amount' | 'created_at';
  sortOrder?: 'asc' | 'desc';
};

export type BillingSummaryQuery = {
  branch_id?: string;
  date_from?: string;
  date_to?: string;
};

export type SaveBillingInvoiceItemDTO = {
  service_id: string;
  service_type: ManualBillingServiceType;
  quantity: number;
};

export type CreateBillingInvoiceDTO = {
  patient_id: string;
  visit_id: string;
  appointment_id?: string | null;
  branch_id: string;
  invoice_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  items: SaveBillingInvoiceItemDTO[];
};

export type UpdateBillingInvoiceDTO = {
  invoice_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  items?: SaveBillingInvoiceItemDTO[];
  status?: 'PENDING';
};

export type CollectBillingPaymentDTO = {
  amount: number;
  payment_method: BillingPaymentMethod;
  payment_date?: string;
  reference_number?: string | null;
};

export type BillingRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type DepositVerification = {
  required_amount: number;
  paid_amount: number;
  remaining_amount: number;
  satisfied: boolean;
  invoice_id: string | null;
  payment_ids: string[];
  verified_at: Date;
};

export type ResolvedBillingItem = {
  serviceId: string;
  serviceName: string;
  serviceType: BillingServiceType;
  originatingOrderId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

