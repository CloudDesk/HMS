import { z } from 'zod';
import { apiClient } from './client';
import { eyeSchema, ophthalmologyIdSchema as id } from './ophthalmology';
import { clinicalReviewSchema, opticalPowerSchema, opticalSchema, treatmentWriteSchema } from './ophthalmology-care';

const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
export const completionCodeSchema = z.enum(['INTAKE_COMPLETED', 'MANDATORY_TESTS_REVIEWED', 'ALL_RESULTS_RESOLVED', 'ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED', 'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED']);
const requirement = z.object({ code: completionCodeSchema, satisfied: z.boolean(), details: z.string(), resource_ids: z.array(z.string().min(1).max(200)) });
export const readinessSchema = z.object({ ready: z.boolean(), context_version: version, consultation_version: version, clinical_review_version: version.nullable(), optical_prescription_version: version.nullable(), configuration_version_id: id, configuration_revision: version, requirements: z.array(requirement).min(1).max(9).refine((rows) => new Set(rows.map((row) => row.code)).size === rows.length, 'Duplicate readiness requirements.') }).refine((value) => value.ready === value.requirements.every((row) => row.satisfied), 'Readiness flag does not match its requirement results.');
// Retain only contracted completion metadata. Broad summary/configuration snapshots and replay secrets are excluded.
export const finalizationSchema = z.object({
  id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, status: z.enum(['OPEN', 'COMPLETED', 'AMENDMENT_OPEN']), version,
  deferrals: z.array(z.object({ id, source_type: z.enum(['TEST_TASK', 'CLINICAL_ORDER']), source_id: id, reason: z.string(), review_plan: z.string().nullable(), due_at: instant.nullable(), responsible_doctor_id: id, recorded_by: id, recorded_at: instant })),
  overrides: z.array(z.object({ id, unmet_codes: z.array(completionCodeSchema), unmet_snapshot: z.array(requirement.omit({ satisfied: true })), reason: z.string(), doctor_id: id, actor_user_id: id, created_at: instant })),
  completions: z.array(z.object({ clinical_version: version, configuration_version_id: id, configuration_revision: version, consultation_version: version, clinical_review_version: version, optical_prescription_version: version.nullable(), requirement_snapshot: z.array(requirement), approver_user_id: id, approver_doctor_id: id, approved_at: instant, supersedes_clinical_version: version.nullable() })),
  amendment_episodes: z.array(z.object({ id, source_clinical_version: version, reason: z.string(), status: z.enum(['OPEN', 'PENDING_REAPPROVAL', 'COMPLETED']), opened_by: id, opened_at: instant, changes: z.array(z.object({ source_type: z.enum(['OPD_CONSULTATION', 'CLINICAL_REVIEW', 'OPTICAL_PRESCRIPTION']), source_id: id, from_source_version: version, to_source_version: version, reason: z.string(), changed_by: id, changed_at: instant })) })),
  created_at: instant, updated_at: instant,
});
export const deferralWriteSchema = z.object({ expected_version: version, source_type: z.enum(['TEST_TASK', 'CLINICAL_ORDER']), source_id: id, reason: z.string().trim().min(1).max(1000), review_plan: z.string().max(2000).nullable().optional(), due_at: instant.nullable().optional(), responsible_doctor_id: id }).strict().superRefine((body, ctx) => {
  if (!body.review_plan?.trim() && !body.due_at) ctx.addIssue({ code: 'custom', path: ['review_plan'], message: 'Record a review plan or due date.' });
  if (body.due_at && Date.parse(body.due_at) <= Date.now()) ctx.addIssue({ code: 'custom', path: ['due_at'], message: 'Due date must be in the future.' });
});
export const overrideWriteSchema = z.object({ expected_version: version, expected_unmet_codes: z.array(completionCodeSchema).min(1).max(9).refine((codes) => new Set(codes).size === codes.length, 'Duplicate unmet requirement.'), reason: z.string().trim().min(1).max(2000) }).strict();
const diagnosisSchema = z.object({ code: z.string().min(1), display: z.string().min(1), codingSystem: z.string().min(1), type: z.enum(['PRIMARY', 'SECONDARY']), laterality: eyeSchema.nullable().optional(), status: z.enum(['SUSPECTED', 'CONFIRMED', 'RULED_OUT']).nullable().optional(), severity: z.string().nullable().optional(), stage: z.string().nullable().optional(), differential: z.boolean().optional(), notes: z.string().nullable().optional() });
const consultationSummarySchema = z.object({ id, status: z.enum(['DRAFT', 'COMPLETED']), version, assessment: z.string().nullable(), diagnoses: z.array(diagnosisSchema), treatment_plan: z.string().nullable(), doctor_notes: z.string().nullable(), completed_at: instant.nullable() });
export const completionSummarySchema = z.object({
  context: z.object({ id, visit_id: id, patient_id: id, branch_id: id, department_id: id, workflow_status: z.string(), version }),
  consultation: consultationSummarySchema.nullable(),
  clinical_review: z.object({ id, status: z.enum(['DRAFT', 'COMPLETED']), version, current_clinical_version: version, current: clinicalReviewSchema.shape.current }).nullable(),
  optical_prescription: z.object({ id, status: z.enum(['DRAFT', 'APPROVED']), version, current_clinical_version: version, current: opticalSchema.shape.current }).nullable(),
  test_tasks: z.array(z.object({ id, test_code: z.string(), test_name: z.string(), laterality: eyeSchema, status: z.string(), reviewed_clinical_version: version.nullable(), version })),
  test_results: z.array(z.object({ id, task_id: id, status: z.string(), current_clinical_version: version, version, current: z.object({ form_type: z.string(), laterality: eyeSchema, reliability: z.string().nullable(), performed_at: instant, completed_at: instant.nullable() }) })),
});
export const summaryResponseSchema = z.object({ finalization: finalizationSchema.nullable(), summary: completionSummarySchema });
export const completeWriteSchema = z.object({ expected_version: version, expected_context_version: version, expected_consultation_version: version, expected_clinical_review_version: version, expected_optical_prescription_version: version.nullable().optional() }).strict();
export const reopenWriteSchema = z.object({ expected_version: version, expected_status: z.literal('COMPLETED'), reason: z.string().trim().min(1).max(2000) }).strict();
const correctionEnvelope = { expected_version: version, expected_status: z.literal('AMENDMENT_OPEN'), episode_id: id, expected_source_version: version, reason: z.string().trim().min(1).max(2000) };
const nullableText = z.string().max(10000).nullable();
export const consultationCorrectionWriteSchema = z.object({ ...correctionEnvelope, consultation: z.object({ assessment: nullableText.optional(), treatment_plan: nullableText.optional(), doctor_notes: nullableText.optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Enter at least one correction.') }).strict();
const clinicalPayloadSchema = z.object({ clinical_summary: z.string().trim().min(1).max(10000), treatment_plans: z.array(treatmentWriteSchema).max(100), follow_up_decision: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable().optional(), patient_instructions: z.string().max(4000).nullable().optional() }).strict();
export const clinicalCorrectionWriteSchema = z.object({ ...correctionEnvelope, clinical_review: clinicalPayloadSchema }).strict();
const optionalNumber = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
const opticalPayloadSchema = z.object({ prescription_type: z.enum(['DISTANCE', 'NEAR', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL']), power: z.object({ OD: opticalPowerSchema.nullable().optional(), OS: opticalPowerSchema.nullable().optional() }).strict(), pupillary_distance: z.object({ format: z.enum(['BINOCULAR', 'MONOCULAR']), binocular: optionalNumber(30, 90), OD: optionalNumber(15, 50), OS: optionalNumber(15, 50) }).strict(), segment_height: z.object({ OD: optionalNumber(5, 50), OS: optionalNumber(5, 50) }).strict().nullable().optional(), lens_type: z.string().trim().min(1).max(80), material: z.string().trim().min(1).max(80), coating_codes: z.array(z.string().trim().min(1).max(80)).max(20), usage_instructions: z.string().trim().min(1).max(2000), valid_until: instant, review_date: instant.nullable().optional() }).strict();
export const opticalCorrectionWriteSchema = z.object({ ...correctionEnvelope, optical_prescription: opticalPayloadSchema }).strict();
export type CompletionReadiness = z.infer<typeof readinessSchema>;
export type Finalization = z.infer<typeof finalizationSchema>;
export type DeferralWrite = z.infer<typeof deferralWriteSchema>;
export type OverrideWrite = z.infer<typeof overrideWriteSchema>;
export type CompletionCode = z.infer<typeof completionCodeSchema>;
export type CompletionSummary = z.infer<typeof completionSummarySchema>;
export type CompletionSummaryResponse = z.infer<typeof summaryResponseSchema>;
export type CompleteWrite = z.infer<typeof completeWriteSchema>;
export type ReopenWrite = z.infer<typeof reopenWriteSchema>;
export type ConsultationCorrectionWrite = z.infer<typeof consultationCorrectionWriteSchema>;
export type ClinicalCorrectionWrite = z.infer<typeof clinicalCorrectionWriteSchema>;
export type OpticalCorrectionWrite = z.infer<typeof opticalCorrectionWriteSchema>;
const path = (visitId: string) => `/opd/visits/${id.parse(visitId)}/ophthalmology`;
export const ophthalmologyCompletionApi = {
  readiness: async (visitId: string, signal?: AbortSignal) => readinessSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/completion-readiness`, { signal })),
  history: async (visitId: string, signal?: AbortSignal) => finalizationSchema.nullable().parse(await apiClient.request<unknown>(`${path(visitId)}/completion-history`, { signal })),
  summary: async (visitId: string, signal?: AbortSignal) => summaryResponseSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/summary`, { signal })),
  defer: async (visitId: string, body: DeferralWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/result-deferrals`, { method: 'POST', body: deferralWriteSchema.parse(body) })),
  override: async (visitId: string, body: OverrideWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/completion-overrides`, { method: 'POST', body: overrideWriteSchema.parse(body) })),
  complete: async (visitId: string, body: CompleteWrite, key: string) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/complete`, { method: 'POST', headers: { 'Idempotency-Key': z.string().min(8).max(200).parse(key) }, body: completeWriteSchema.parse(body) })),
  reopen: async (visitId: string, body: ReopenWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/reopen`, { method: 'POST', body: reopenWriteSchema.parse(body) })),
  correctConsultation: async (visitId: string, body: ConsultationCorrectionWrite) => z.object({ finalization: finalizationSchema, source: consultationSummarySchema }).parse(await apiClient.request<unknown>(`${path(visitId)}/corrections/consultation`, { method: 'POST', body: consultationCorrectionWriteSchema.parse(body) })),
  correctClinical: async (visitId: string, body: ClinicalCorrectionWrite) => z.object({ finalization: finalizationSchema, source: clinicalReviewSchema }).parse(await apiClient.request<unknown>(`${path(visitId)}/corrections/clinical-review`, { method: 'POST', body: clinicalCorrectionWriteSchema.parse(body) })),
  correctOptical: async (visitId: string, body: OpticalCorrectionWrite) => z.object({ finalization: finalizationSchema, source: opticalSchema }).parse(await apiClient.request<unknown>(`${path(visitId)}/corrections/optical-prescription`, { method: 'POST', body: opticalCorrectionWriteSchema.parse(body) })),
};
