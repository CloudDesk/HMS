import { z } from 'zod';

export const portalInvoiceSummaryItemSchema = z.object({
  id: z.string(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  status: z.string(),
  total_amount: z.number(),
  paid_amount: z.number(),
  balance_amount: z.number(),
});

export const invoiceLineItemSchema = z.object({
  id: z.string(),
  service_name: z.string(),
  service_type: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  line_total: z.number(),
});

export const invoicePaymentRecordSchema = z.object({
  id: z.string(),
  payment_number: z.string(),
  payment_date: z.string(),
  amount: z.number(),
  payment_method: z.string(),
  reference_number: z.string().nullable().optional().transform((v) => v ?? null),
});

export const portalInvoicePatientSchema = z.object({
  id: z.string(),
  patient_number: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional().transform((v) => v ?? null),
  email: z.string().nullable().optional().transform((v) => v ?? null),
  address: z.record(z.string(), z.string().nullable().optional().transform((v) => v ?? null)).nullable().optional().transform((v) => v ?? null),
});

export const portalInvoiceBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional().transform((v) => v ?? null),
  email: z.string().nullable().optional().transform((v) => v ?? null),
  address: z.string().nullable().optional().transform((v) => v ?? null),
  city: z.string().nullable().optional().transform((v) => v ?? null),
  state: z.string().nullable().optional().transform((v) => v ?? null),
  country: z.string().nullable().optional().transform((v) => v ?? null),
  postal_code: z.string().nullable().optional().transform((v) => v ?? null),
});

export const portalInvoiceDetailsSchema = z.object({
  id: z.string(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  status: z.string(),
  subtotal: z.number(),
  discount_amount: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  paid_amount: z.number(),
  balance_amount: z.number(),
  patient: portalInvoicePatientSchema.nullable().optional().transform((v) => v ?? null),
  branch: portalInvoiceBranchSchema.nullable().optional().transform((v) => v ?? null),
  items: z.array(invoiceLineItemSchema).default([]),
  payments: z.array(invoicePaymentRecordSchema).default([]),
});

export const billingOverviewDataSchema = z.object({
  invoices: z.array(portalInvoiceSummaryItemSchema).default([]),
  summary: z
    .object({
      outstanding_invoices: z.number().default(0),
    })
    .optional(),
});

export type PortalInvoiceSummaryItem = z.infer<typeof portalInvoiceSummaryItemSchema>;
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;
export type InvoicePaymentRecord = z.infer<typeof invoicePaymentRecordSchema>;
export type PortalInvoicePatient = z.infer<typeof portalInvoicePatientSchema>;
export type PortalInvoiceBranch = z.infer<typeof portalInvoiceBranchSchema>;
export type PortalInvoiceDetails = z.infer<typeof portalInvoiceDetailsSchema>;
export type BillingOverviewData = z.infer<typeof billingOverviewDataSchema>;

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0.00';
  }
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatInvoiceDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getInvoiceStatusLabel(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PAID':
      return 'Paid in Full';
    case 'PARTIALLY_PAID':
      return 'Partially Paid';
    case 'PENDING':
      return 'Pending Payment';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status || 'Issued';
  }
}

export function getInvoiceStatusStyle(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status?.toUpperCase()) {
    case 'PAID':
      return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
    case 'PARTIALLY_PAID':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case 'PENDING':
      return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
    case 'CANCELLED':
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    default:
      return { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' };
  }
}
