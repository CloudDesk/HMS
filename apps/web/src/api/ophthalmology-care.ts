import { z } from 'zod';
import { apiClient } from './client';
import { eyeSchema, ophthalmologyIdSchema as id } from './ophthalmology';
import { queueTaskSchema } from './ophthalmology-queue';

const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
const reference = id.nullable().optional();
const scope = { id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id };
export const treatmentActionTypeSchema = z.enum(['MEDICATION', 'OPTICAL', 'INVESTIGATION', 'PROCEDURE', 'REFERRAL', 'FOLLOW_UP', 'OTHER']);
export const treatmentWriteBaseSchema = z.object({
  diagnosis_code: text(80), diagnosis_laterality: eyeSchema, treatment: text(4000), action_type: treatmentActionTypeSchema,
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']), status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  medication_prescription_id: reference, optical_prescription_id: reference,
  clinical_order_ids: z.array(id).max(50).refine((ids) => new Set(ids).size === ids.length, 'Duplicate order references.').optional(),
  procedure_recommendation_id: reference, referral_id: reference, follow_up_id: reference,
}).strict();
type TreatmentWriteInput = z.infer<typeof treatmentWriteBaseSchema>;
function validateTreatmentReference(plan: TreatmentWriteInput, ctx: z.RefinementCtx) {
  const references = {
    MEDICATION: Boolean(plan.medication_prescription_id), OPTICAL: Boolean(plan.optical_prescription_id),
    INVESTIGATION: Boolean(plan.clinical_order_ids?.length), PROCEDURE: Boolean(plan.procedure_recommendation_id),
    REFERRAL: Boolean(plan.referral_id), FOLLOW_UP: Boolean(plan.follow_up_id),
  } as const;
  if (plan.action_type !== 'OTHER' && !references[plan.action_type]) {
    ctx.addIssue({ code: 'custom', path: [plan.action_type === 'MEDICATION' ? 'medication_prescription_id'
      : plan.action_type === 'OPTICAL' ? 'optical_prescription_id' : plan.action_type === 'INVESTIGATION' ? 'clinical_order_ids'
        : plan.action_type === 'PROCEDURE' ? 'procedure_recommendation_id' : plan.action_type === 'REFERRAL' ? 'referral_id' : 'follow_up_id'],
    message: `Select the saved ${plan.action_type.toLowerCase()} record for this action.` });
  }
  const conflicting = Object.entries(references).some(([type, selected]) => selected && type !== plan.action_type);
  if (conflicting || plan.action_type === 'OTHER' && Object.values(references).some(Boolean)) {
    ctx.addIssue({ code: 'custom', path: ['action_type'], message: 'Keep only the reference that matches the selected action.' });
  }
}
export const treatmentWriteSchema = treatmentWriteBaseSchema.superRefine(validateTreatmentReference);
export const treatmentCorrectionSchema = treatmentWriteBaseSchema.extend({ id: id.optional() }).superRefine(validateTreatmentReference);
export const clinicalReviewWriteSchema = z.object({ expected_version: version, clinical_summary: z.string().trim().max(10000).optional(), treatment_plans: z.array(treatmentWriteSchema).max(100), follow_up_decision: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable().optional(), patient_instructions: z.string().max(4000).nullable().optional() }).strict().superRefine((body, ctx) => {
  const seen = new Set<string>();
  body.treatment_plans.forEach((plan, index) => { const key = `${plan.diagnosis_code.toUpperCase()}:${plan.diagnosis_laterality}:${plan.action_type}`; if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['treatment_plans', index], message: 'Duplicate diagnosis, eye and action.' }); seen.add(key); });
});
const treatmentSchema = z.object({
  id, clinician_user_id: id, diagnosis_code: z.string(), diagnosis_laterality: eyeSchema, treatment: z.string(),
  action_type: treatmentActionTypeSchema.nullable(), legacy_category: z.string().nullable(),
  priority: treatmentWriteBaseSchema.shape.priority, status: treatmentWriteBaseSchema.shape.status,
  medication_prescription_id: id.nullable(), optical_prescription_id: id.nullable(), clinical_order_ids: z.array(id),
  procedure_recommendation_id: id.nullable(), referral_id: id.nullable(), follow_up_id: id.nullable(),
}).strict();
const clinicalVersionSchema = z.object({ clinical_version: version, clinical_summary: z.string(), treatment_plans: z.array(treatmentSchema), follow_up_decision: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable(), patient_instructions: z.string().nullable(), created_by: id, created_at: instant });
export const clinicalReviewSchema = z.object({ ...scope, current_clinical_version: version, status: z.enum(['DRAFT', 'COMPLETED']), current: clinicalVersionSchema, history: z.array(clinicalVersionSchema), version, created_at: instant, updated_at: instant });
const optionalNumber = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
export const opticalPowerSchema = z.object({ sphere: z.number().min(-40).max(40), cylinder: optionalNumber(-20, 20), axis: optionalNumber(0, 180), addition: optionalNumber(0, 10), prism: optionalNumber(0, 30), prism_base: z.string().max(40).nullable().optional() }).strict();
const opticalFields = {
  prescription_type: z.enum(['DISTANCE', 'NEAR', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL']).nullable().optional(),
  power: z.object({ OD: opticalPowerSchema.nullable().optional(), OS: opticalPowerSchema.nullable().optional() }).strict(),
  pupillary_distance: z.object({ format: z.enum(['BINOCULAR', 'MONOCULAR']).optional(), binocular: optionalNumber(30, 90), OD: optionalNumber(15, 50), OS: optionalNumber(15, 50) }).strict(),
  segment_height: z.object({ OD: optionalNumber(5, 50), OS: optionalNumber(5, 50) }).strict().nullable().optional(),
  lens_type: text(80), material: text(80), coating_codes: z.array(text(80)).max(20).refine((codes) => new Set(codes).size === codes.length, 'Duplicate coating codes.'),
  usage_instructions: text(2000), valid_until: instant, review_date: instant.nullable().optional(),
};
export const opticalWriteSchema = z.object({ expected_version: version, ...opticalFields }).strict().superRefine((body, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  for (const eye of ['OD', 'OS'] as const) {
    if (body.power[eye]?.cylinder != null && body.power[eye]?.axis == null) issue(['power', eye, 'axis'], 'Axis is required when cylinder is supplied.');
  }
  if (Date.parse(body.valid_until) <= Date.now()) issue(['valid_until'], 'Validity must be in the future.');
  if (body.review_date && Date.parse(body.review_date) > Date.parse(body.valid_until)) issue(['review_date'], 'Review date must not be after validity.');
});
// Historical reads do not apply today's validity-date rules.
const opticalVersionSchema = z.object({ ...opticalFields, clinical_version: version, status: z.enum(['DRAFT', 'APPROVED']), approver_user_id: id.nullable(), approver_doctor_id: id.nullable(), approved_at: instant.nullable(), created_by: id, created_at: instant });
export const opticalSchema = z.object({ ...scope, current_clinical_version: version, status: z.enum(['DRAFT', 'APPROVED']), current: opticalVersionSchema, history: z.array(opticalVersionSchema), version, created_at: instant, updated_at: instant });
export const approveOpticalSchema = z.object({ expected_version: version, expected_status: z.literal('DRAFT') }).strict();
export const resultReviewWriteSchema = z.object({ expected_task_version: version, expected_result_version: version, expected_clinical_version: z.number().int().positive(), comment: z.string().max(2000).nullable().optional() }).strict();
export type ClinicalReview = z.infer<typeof clinicalReviewSchema>;
export type ClinicalReviewWrite = z.infer<typeof clinicalReviewWriteSchema>;
export type OpticalPrescription = z.infer<typeof opticalSchema>;
export type OpticalWrite = z.infer<typeof opticalWriteSchema>;
export type ResultReviewWrite = z.infer<typeof resultReviewWriteSchema>;
const path = (visitId: string) => `/opd/visits/${id.parse(visitId)}/ophthalmology`;
export const ophthalmologyCareApi = {
  clinical: async (visitId: string, signal?: AbortSignal) => clinicalReviewSchema.nullable().parse(await apiClient.request<unknown>(`${path(visitId)}/clinical-review`, { signal })),
  optical: async (visitId: string, signal?: AbortSignal) => opticalSchema.nullable().parse(await apiClient.request<unknown>(`${path(visitId)}/optical-prescription`, { signal })),
  saveClinical: async (visitId: string, body: ClinicalReviewWrite) => clinicalReviewSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/clinical-review/draft`, { method: 'PUT', body: clinicalReviewWriteSchema.parse(body) })),
  saveOptical: async (visitId: string, body: OpticalWrite) => opticalSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/optical-prescription/draft`, { method: 'PUT', body: opticalWriteSchema.parse(body) })),
  approveOptical: async (visitId: string, body: z.infer<typeof approveOpticalSchema>) => opticalSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/optical-prescription/approve`, { method: 'POST', body: approveOpticalSchema.parse(body) })),
  reviewResult: async (taskId: string, body: ResultReviewWrite) => queueTaskSchema.parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks/${id.parse(taskId)}/result/review`, { method: 'POST', body: resultReviewWriteSchema.parse(body) })),
};
