import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i);
const referenceId = z.string().trim().min(1).max(100);

export const surgeryIdSchema = z.object({ id });
export const surgeryBranchSchema = z.object({ branch_id: id });
export const surgeryListSchema = z.object({
  branch_id: id,
  status: z.enum(['ACTIVE', 'BOOKED', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED']).optional(),
  patient_id: id.optional(),
  doctor_id: id.optional(),
  service_id: id.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const createRecommendationSchema = z.object({
  patient_id: id,
  branch_id: id,
  department_id: id,
  recommending_doctor_id: id,
  service_id: id,
  encounter_type: z.enum(['OPD_VISIT', 'DIRECT', 'EMERGENCY']).optional().default('DIRECT'),
  encounter_id: id.nullable().optional(),
  clinical_reason: z.string().trim().min(3).max(1000),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export const createBookingSchema = z.object({
  recommendation_id: id,
  branch_id: id,
  doctor_id: id,
  scheduled_start: z.string().trim().min(10, 'Valid scheduled start is required'),
  hold_id: referenceId.nullable().optional(),
  consent_document_id: referenceId.nullable().optional(),
  deposit_invoice_id: referenceId.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export const confirmBookingSchema = z.object({
  consent_document_id: referenceId.nullable().optional(),
  deposit_invoice_id: referenceId.nullable().optional(),
  hold_id: referenceId.nullable().optional(),
});
export const rescheduleBookingSchema = z.object({
  scheduled_start: z.string().trim().min(10, 'Valid scheduled start is required'),
  reason: z.string().trim().min(3).max(500),
  doctor_id: id.optional(),
  hold_id: referenceId.nullable().optional(),
  consent_document_id: referenceId.nullable().optional(),
  deposit_invoice_id: referenceId.nullable().optional(),
});
export const surgeryAlternativesSchema = surgeryBranchSchema.extend({
  department_id: id,
  service_id: id,
  scheduled_start: z.string().trim().min(10, 'Valid scheduled start is required'),
  doctor_id: id.optional(),
});
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });

