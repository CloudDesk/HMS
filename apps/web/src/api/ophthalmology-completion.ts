import { clinicalReviewSchema, treatmentWriteSchema } from './ophthalmology-care';
import { z } from 'zod';
import { apiClient } from './client';
import { ophthalmologyIdSchema as id } from './ophthalmology';

const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
export const completionCodeSchema = z.enum(['INTAKE_COMPLETED', 'MANDATORY_TESTS_REVIEWED', 'ALL_RESULTS_RESOLVED', 'ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED', 'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED']);
const requirement = z.object({ code: completionCodeSchema, satisfied: z.boolean(), details: z.string(), resource_ids: z.array(id) });
export const readinessSchema = z.object({ ready: z.boolean(), context_version: version, consultation_version: version, clinical_review_version: version.nullable(), optical_prescription_version: version.nullable(), configuration_version_id: id, configuration_revision: version, requirements: z.array(requirement).min(1).max(9).refine((rows) => new Set(rows.map((row) => row.code)).size === rows.length, 'Duplicate readiness requirements.') }).refine((value) => value.ready === value.requirements.every((row) => row.satisfied), 'Readiness flag does not match its requirement results.');
// Retain only contracted completion metadata. Broad summary/configuration snapshots and replay secrets are excluded.
export const finalizationSchema = z.object({
  id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, status: z.enum(['OPEN', 'COMPLETED', 'AMENDMENT_OPEN']), version,
  deferrals: z.array(z.object({ id, source_type: z.enum(['TEST_TASK', 'CLINICAL_ORDER']), source_id: id, reason: z.string(), review_plan: z.string().nullable(), due_at: instant.nullable(), responsible_doctor_id: id, recorded_by: id, recorded_at: instant })),
  overrides: z.array(z.object({ id, unmet_codes: z.array(completionCodeSchema), unmet_snapshot: z.array(requirement.omit({ satisfied: true })), reason: z.string(), doctor_id: id, actor_user_id: id, created_at: instant })),
  completions: z.array(z.object({ clinical_version: version, configuration_version_id: id, configuration_revision: version, consultation_version: version, clinical_review_version: version, optical_prescription_version: version.nullable(), requirement_snapshot: z.array(requirement), approver_user_id: id, approver_doctor_id: id, approved_at: instant, supersedes_clinical_version: version.nullable() })),
  amendment_episodes: z.array(z.object({ id, source_clinical_version: version, reason: z.string(), status: z.enum(['OPEN', 'PENDING_REAPPROVAL', 'COMPLETED']), opened_by: id, opened_at: instant, changes: z.array(z.object({ section: z.string(), before_value: z.unknown(), after_value: z.unknown(), reason: z.string(), changed_by: id, changed_at: instant })) })),
  created_at: instant, updated_at: instant,
});
export const deferralWriteSchema = z.object({ expected_version: version, source_type: z.enum(['TEST_TASK', 'CLINICAL_ORDER']), source_id: id, reason: z.string().trim().min(1).max(1000), review_plan: z.string().max(2000).nullable().optional(), due_at: instant.nullable().optional(), responsible_doctor_id: id }).strict().superRefine((body, ctx) => {
  if (!body.review_plan?.trim() && !body.due_at) ctx.addIssue({ code: 'custom', path: ['review_plan'], message: 'Record a review plan or due date.' });
  if (body.due_at && Date.parse(body.due_at) <= Date.now()) ctx.addIssue({ code: 'custom', path: ['due_at'], message: 'Due date must be in the future.' });
});
export const overrideWriteSchema = z.object({ expected_version: version, expected_unmet_codes: z.array(completionCodeSchema).min(1).max(9).refine((codes) => new Set(codes).size === codes.length, 'Duplicate unmet requirement.'), reason: z.string().trim().min(1).max(2000) }).strict();
export type CompletionReadiness = z.infer<typeof readinessSchema>;
export type Finalization = z.infer<typeof finalizationSchema>;
export type DeferralWrite = z.infer<typeof deferralWriteSchema>;
export type OverrideWrite = z.infer<typeof overrideWriteSchema>;
export type CompletionCode = z.infer<typeof completionCodeSchema>;
export const completeWriteSchema = z.object({ expected_version: version, expected_context_version: version, expected_consultation_version: version,
  expected_clinical_review_version: version, expected_optical_prescription_version: version.nullable().optional() }).strict();
export const reopenWriteSchema = z.object({ expected_version: version, expected_status: z.literal('COMPLETED'), reason: z.string().trim().min(1).max(2000) }).strict();
export const planCorrectionSchema = treatmentWriteSchema.extend({ id: id.optional() });
const amendmentBase = z.object({ expected_version: version, expected_status: z.literal('AMENDMENT_OPEN'), episode_id: id, reason: z.string().trim().min(1).max(2000) });
export const amendmentWriteSchema = z.discriminatedUnion('section', [
  amendmentBase.extend({ section: z.literal('patient_instructions'), before_value: z.string().nullable(), after_value: z.string().trim().max(4000).nullable() }).strict(),
  amendmentBase.extend({ section: z.literal('clinical_summary'), before_value: z.string().nullable(), after_value: z.string().trim().min(1).max(10000) }).strict(),
  amendmentBase.extend({ section: z.literal('follow_up_decision'), before_value: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable(), after_value: z.enum(['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']).nullable() }).strict(),
  amendmentBase.extend({ section: z.literal('treatment_plans'), before_value: clinicalReviewSchema.shape.current.shape.treatment_plans, after_value: z.array(planCorrectionSchema).max(100) }).strict(),
]).superRefine((body, ctx) => { if (JSON.stringify(body.before_value) === JSON.stringify(body.after_value)) ctx.addIssue({ code: 'custom', path: ['after_value'], message: 'Enter a changed value.' }); });
export type CompleteWrite = z.infer<typeof completeWriteSchema>;
export type ReopenWrite = z.infer<typeof reopenWriteSchema>;
export type AmendmentWrite = z.infer<typeof amendmentWriteSchema>;
export type ConsultationSummaryData = {
  finalization: Finalization | null;
  summary: Record<string, unknown>;
};
const path = (visitId: string) => `/opd/visits/${id.parse(visitId)}/ophthalmology`;
export const ophthalmologyCompletionApi = {
  complete: async (visitId: string, body: CompleteWrite, key: string) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/complete`, { method: 'POST', headers: { 'Idempotency-Key': z.string().min(8).max(200).parse(key) }, body: completeWriteSchema.parse(body) })),
  reopen: async (visitId: string, body: ReopenWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/reopen`, { method: 'POST', body: reopenWriteSchema.parse(body) })),
  amend: async (visitId: string, body: AmendmentWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/amendments`, { method: 'POST', body: amendmentWriteSchema.parse(body) })),
  readiness: async (visitId: string, signal?: AbortSignal) => readinessSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/completion-readiness`, { signal })),
  history: async (visitId: string, signal?: AbortSignal) => finalizationSchema.nullable().parse(await apiClient.request<unknown>(`${path(visitId)}/completion-history`, { signal })),
  summary: async (visitId: string, signal?: AbortSignal) => apiClient.request<{ finalization: Finalization | null; summary: Record<string, unknown> }>(`${path(visitId)}/summary`, { signal }),
  defer: async (visitId: string, body: DeferralWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/result-deferrals`, { method: 'POST', body: deferralWriteSchema.parse(body) })),
  override: async (visitId: string, body: OverrideWrite) => finalizationSchema.parse(await apiClient.request<unknown>(`${path(visitId)}/completion-overrides`, { method: 'POST', body: overrideWriteSchema.parse(body) })),
};
