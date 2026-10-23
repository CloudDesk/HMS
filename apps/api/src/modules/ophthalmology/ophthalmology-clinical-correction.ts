import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const reference = id.nullable().optional().default(null);
const plan = z.object({ id: id.optional(), diagnosis_code: z.string().trim().min(1).max(80).toUpperCase(), diagnosis_laterality: z.enum(['OD', 'OS', 'OU', 'NOT_APPLICABLE']),
  treatment: z.string().trim().min(1).max(4000), action_type: z.enum(['MEDICATION', 'OPTICAL', 'INVESTIGATION', 'PROCEDURE', 'REFERRAL', 'FOLLOW_UP', 'OTHER']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']), status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  medication_prescription_id: reference, optical_prescription_id: reference,
  clinical_order_ids: z.array(id).max(50).refine((ids) => new Set(ids).size === ids.length).optional().default([]),
  procedure_recommendation_id: reference, referral_id: reference, follow_up_id: reference }).strict();
export const clinicalCorrectionSchema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('clinical_summary'), after_value: z.string().trim().min(1).max(10000) }).strict(),
  z.object({ section: z.literal('patient_instructions'), after_value: z.string().trim().max(4000).nullable() }).strict(),
  z.object({ section: z.literal('follow_up_decision'), after_value: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable() }).strict(),
  z.object({ section: z.literal('treatment_plans'), after_value: z.array(plan).max(100).refine((plans) => { const ids = plans.flatMap((p) => p.id ? [p.id] : []); return new Set(ids).size === ids.length; }, 'Repeated treatment plan identity') }).strict(),
]);
export type ClinicalCorrection = z.infer<typeof clinicalCorrectionSchema>;
