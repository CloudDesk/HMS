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

export const dentalStageStatusSchema = z.enum([
  'PLANNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]);

export const patientDentalStageSchema = z.object({
  id: z.string(),
  episode_id: z.string().default(''),
  plan_item_id: z.string().default(''),
  tooth_number: z.number().nullable().optional().transform((v) => v ?? null),
  service_id: z.string().nullable().optional().transform((v) => v ?? null),
  procedure_name: z.string().optional(),
  stage_name: z.string().default(''),
  stage_number: z.number().optional(),
  total_stages: z.number().optional(),
  sequence: z.number().default(1),
  assigned_doctor_id: z.string().nullable().optional().transform((v) => v ?? null),
  assigned_doctor_name: z.string().default(''),
  doctor_name: z.string().optional(),
  status: dentalStageStatusSchema,
  planned_date: z.string().nullable().optional().transform((v) => v ?? null),
  completed_at: z.string().nullable().optional().transform((v) => v ?? null),
  completed_by_doctor_id: z.string().nullable().optional().transform((v) => v ?? null),
  completed_by_doctor_name: z.string().nullable().optional().transform((v) => v ?? null),
  appointment_id: z.string().nullable().optional().transform((v) => v ?? null),
  prosthetic_lab_order_id: z.string().nullable().optional().transform((v) => v ?? null),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  branch_id: z.string().optional(),
  department_id: z.string().optional(),
  patient_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  episode_number: z.string().optional(),
  treatment_plan_summary: z.string().nullable().optional().transform((v) => v ?? null),
  lab_order_status: z.string().nullable().optional().transform((v) => v ?? null),
  lab_order_number: z.string().nullable().optional().transform((v) => v ?? null),
  appointment_date: z.string().nullable().optional().transform((v) => v ?? null),
  appointment_start_time: z.string().nullable().optional().transform((v) => v ?? null),
  appointment_status: z.string().nullable().optional().transform((v) => v ?? null),
  is_blocked_by_prerequisite: z.boolean().default(false),
  reference_video_url: z.string().nullable().optional().transform((v) => v ?? null),
  reference_video_title: z.string().nullable().optional().transform((v) => v ?? null),
});

export const patientDentalStagesListSchema = z.array(patientDentalStageSchema);

export type DentalStageStatus = z.infer<typeof dentalStageStatusSchema>;
export type PatientDentalStage = z.infer<typeof patientDentalStageSchema>;

export function getStageStatusLabel(stageOrStatus: PatientDentalStage | DentalStageStatus | string): string {
  if (typeof stageOrStatus === 'string') {
    switch (stageOrStatus.toUpperCase()) {
      case 'COMPLETED':
        return 'Completed';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'SCHEDULED':
        return 'Scheduled';
      case 'ON_HOLD':
        return 'On Hold';
      case 'CANCELLED':
        return 'Cancelled';
      case 'PLANNED':
        return 'Planned';
      default:
        return stageOrStatus;
    }
  }
  const stage = stageOrStatus;
  if (stage.status === 'COMPLETED') return 'Completed';
  if (stage.status === 'IN_PROGRESS') return 'In Progress';
  if (stage.status === 'SCHEDULED') return 'Scheduled';
  if (stage.status === 'ON_HOLD') return 'On Hold';
  if (stage.status === 'CANCELLED') return 'Cancelled';
  if (stage.is_blocked_by_prerequisite) return 'Waiting for Previous Stage';
  if (stage.lab_order_status === 'SENT_TO_LAB' || stage.lab_order_status === 'IN_LAB') {
    return 'In Lab Preparation';
  }
  if (stage.lab_order_status === 'READY') {
    return 'Lab Ready for Fitting';
  }
  return 'Planned';
}

export function getStageBadgeVariant(
  stageOrStatus: PatientDentalStage | DentalStageStatus | string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const status = typeof stageOrStatus === 'string' ? stageOrStatus.toUpperCase() : stageOrStatus.status;
  if (typeof stageOrStatus !== 'string') {
    if (stageOrStatus.lab_order_status === 'READY') return 'success';
    if (stageOrStatus.lab_order_status === 'SENT_TO_LAB' || stageOrStatus.lab_order_status === 'IN_LAB') return 'warning';
    if (stageOrStatus.is_blocked_by_prerequisite) return 'neutral';
  }
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'ON_HOLD') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

