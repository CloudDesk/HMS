import { z } from 'zod';

export const dentalQuotationStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'POSTPONED',
  'EXPIRED',
]);

export const dentalQuotationItemSchema = z.object({
  id: z.string().optional(),
  treatment_plan_item_id: z.string().nullable().optional().transform((v) => v ?? null),
  service_id: z.string().nullable().optional().transform((v) => v ?? null),
  procedure_name: z.string(),
  tooth_number: z.number().nullable().optional().transform((v) => v ?? null),
  quantity: z.number(),
  unit_price: z.number(),
  discount_amount: z.number().default(0),
  tax_amount: z.number().default(0),
  line_total: z.number(),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
});

export const dentalQuotationOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  sequence: z.number(),
  items: z.array(dentalQuotationItemSchema).default([]),
  subtotal: z.number(),
  discount_amount: z.number().default(0),
  tax_amount: z.number().default(0),
  total: z.number(),
});

export const dentalQuotationSchema = z.object({
  id: z.string(),
  quotation_number: z.string(),
  patient_id: z.string(),
  patient_number: z.string(),
  patient_name: z.string(),
  treatment_episode_id: z.string().optional(),
  treatment_episode_number: z.string().nullable().optional().transform((v) => v ?? null),
  doctor_id: z.string().optional(),
  doctor_name: z.string(),
  branch_id: z.string().optional(),
  department_id: z.string().optional(),
  status: dentalQuotationStatusSchema,
  currency: z.string().default('KES'),
  subtotal: z.number(),
  discount_amount: z.number().default(0),
  tax_amount: z.number().default(0),
  total: z.number(),
  items: z.array(dentalQuotationItemSchema).default([]),
  options: z.array(dentalQuotationOptionSchema).default([]),
  selected_option_id: z.string().nullable().optional().transform((v) => v ?? null),
  selected_option_name: z.string().nullable().optional().transform((v) => v ?? null),
  accepted_at: z.string().nullable().optional().transform((v) => v ?? null),
  accepted_by: z.string().nullable().optional().transform((v) => v ?? null),
  decision_reason: z.string().nullable().optional().transform((v) => v ?? null),
  decision_at: z.string().nullable().optional().transform((v) => v ?? null),
  sent_at: z.string().nullable().optional().transform((v) => v ?? null),
  sent_by: z.string().nullable().optional().transform((v) => v ?? null),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  valid_until: z.string().nullable().optional().transform((v) => v ?? null),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export const dentalQuotationsListSchema = z.array(dentalQuotationSchema);

export type DentalQuotationStatus = z.infer<typeof dentalQuotationStatusSchema>;
export type DentalQuotationItem = z.infer<typeof dentalQuotationItemSchema>;
export type DentalQuotationOption = z.infer<typeof dentalQuotationOptionSchema>;
export type DentalQuotation = z.infer<typeof dentalQuotationSchema>;

export function formatDentalCurrency(amount: number, currency = 'KES'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${currency} 0.00`;
  }
  const prefix = currency === 'INR' ? '₹' : `${currency} `;
  return `${prefix}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getDentalStatusLabel(status: DentalQuotationStatus | string): string {
  switch (status?.toUpperCase()) {
    case 'SENT':
      return 'Pending Your Decision';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Declined';
    case 'POSTPONED':
      return 'Decision Postponed';
    case 'DRAFT':
      return 'Draft Preparation';
    case 'EXPIRED':
      return 'Quotation Expired';
    default:
      return status || 'Issued';
  }
}

export function getDentalStatusStyle(status: DentalQuotationStatus | string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
      return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
    case 'SENT':
      return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
    case 'POSTPONED':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case 'REJECTED':
    case 'EXPIRED':
      return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
    case 'DRAFT':
    default:
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  }
}

export function formatToothDescription(toothNumber: number | null): string {
  if (!toothNumber) return 'General Dental';
  return `Tooth #${toothNumber}`;
}
