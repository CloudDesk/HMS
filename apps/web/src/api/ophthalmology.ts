import { z } from 'zod';
import { apiClient } from './client';

export const ophthalmologyIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record.');
const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
const opaqueObject = z.record(z.string(), z.unknown());
const nullableText = (max: number) => z.string().max(max).nullable();
export const eyeSchema = z.enum(['OD', 'OS', 'OU', 'NOT_APPLICABLE']);
export const contextEyeSchema = z.enum(['OD', 'OS', 'OU', 'NOT_SPECIFIED']);
export const subtypeSchema = z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW']);
export type OphthalmologyVisitSubtype = z.infer<typeof subtypeSchema>;
export const coreFormSchema = z.enum(['VISUAL_ACUITY', 'LENSOMETRY', 'AUTOREFRACTION_KERATOMETRY', 'OBJECTIVE_REFRACTION', 'SUBJECTIVE_REFRACTION', 'INTRAOCULAR_PRESSURE', 'SLIT_LAMP_ANTERIOR_SEGMENT', 'POSTERIOR_FUNDUS_EXAM']);
export const testFormSchema = z.enum([...coreFormSchema.options, 'PACHYMETRY', 'COLOUR_VISION', 'MOTILITY_SQUINT_BINOCULAR', 'DRY_EYE', 'VISUAL_FIELD', 'OCT', 'FUNDUS_PHOTOGRAPHY', 'CORNEAL_TOPOGRAPHY', 'BIOMETRY_IOL', 'B_SCAN', 'GONIOSCOPY', 'CONTACT_LENS', 'PAEDIATRIC_VISION']);
export type TestFormType = z.infer<typeof testFormSchema>;
export type CoreFormType = z.infer<typeof coreFormSchema>;
export const taskStatusSchema = z.enum(['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'IN_PROGRESS', 'DRAFT', 'COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED', 'REPEAT_REQUIRED', 'UNABLE_TO_PERFORM', 'CANCELLED']);
const scope = { visit_id: ophthalmologyIdSchema, patient_id: ophthalmologyIdSchema, branch_id: ophthalmologyIdSchema, department_id: ophthalmologyIdSchema };
export const contextSchema = z.object({
  id: ophthalmologyIdSchema, ...scope, doctor_id: ophthalmologyIdSchema, visit_subtype: subtypeSchema, affected_eye: contextEyeSchema,
  workflow_status: z.enum(['CHECKED_IN', 'PRELIMINARY_EXAMINATION', 'AWAITING_DOCTOR', 'UNDER_CONSULTATION', 'TESTS_ORDERED', 'AWAITING_RESULTS', 'CLINICAL_REVIEW', 'REVIEW_COMPLETED', 'CONSULTATION_COMPLETED']),
  configuration_version_id: ophthalmologyIdSchema, workflow_profile_version_id: ophthalmologyIdSchema, version,
});
export const clinicalWorkspaceSchema = z.object({ context: contextSchema.nullable(), visit: z.object({
  id: ophthalmologyIdSchema, visit_number: z.string(), patient_id: ophthalmologyIdSchema, patient_number: z.string(), patient_name: z.string(), doctor_name: z.string(),
  branch_id: ophthalmologyIdSchema, department_id: ophthalmologyIdSchema, visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY', 'WALK_IN', 'REVIEW']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']), status: z.enum(['CHECKED_IN', 'WAITING_FOR_VITALS', 'READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'SKIPPED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  reason: z.string().nullable().optional(), notes: z.string().nullable().optional(),
}) });
export type OphthalmologyContext = z.infer<typeof contextSchema>;
export const createContextSchema = z.object({ visit_subtype: subtypeSchema, affected_eye: contextEyeSchema, configuration_version_id: ophthalmologyIdSchema, workflow_profile_version_id: ophthalmologyIdSchema }).strict();
export const updateContextSchema = z.object({ expected_version: version, visit_subtype: subtypeSchema.optional(), affected_eye: contextEyeSchema.optional(), workflow_profile_version_id: ophthalmologyIdSchema.optional() }).strict().refine((body) => body.visit_subtype !== undefined || body.affected_eye !== undefined || body.workflow_profile_version_id !== undefined, 'Change at least one context field.');
export type UpdateOphthalmologyContext = z.infer<typeof updateContextSchema>;
export const configurationSchema = z.object({
  id: ophthalmologyIdSchema, branch_id: ophthalmologyIdSchema, type: z.string(), code: z.string(), name: z.string(), revision: version,
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']), version, values: opaqueObject,
});
export type OphthalmologyConfiguration = z.infer<typeof configurationSchema>;
export const workflowSchema = z.object({ id: ophthalmologyIdSchema, branch_id: ophthalmologyIdSchema, name: z.string(), visit_subtype: subtypeSchema, status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']), version });
const codeList = z.array(z.string().trim().min(1).max(80)).max(100).refine((codes) => new Set(codes.map((code) => code.toUpperCase())).size === codes.length, 'Selections must be unique.');
const correctionUse = z.object({ uses: z.boolean(), age_months: z.number().int().min(0).max(1200).nullable(), wearing_pattern: nullableText(500) }).strict();
export const intakeFieldsSchema = z.object({
  complaint_codes: codeList, affected_eye: contextEyeSchema, duration_value: z.number().min(0).max(1000).nullable(),
  duration_unit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).nullable(), onset: z.enum(['SUDDEN', 'GRADUAL', 'UNKNOWN']).nullable(),
  progression: z.enum(['IMPROVING', 'STABLE', 'WORSENING', 'INTERMITTENT']).nullable(), severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).nullable(),
  associated_symptom_codes: codeList, description: nullableText(4000), no_significant_ophthalmic_history: z.boolean(),
  previous_eye_disease_codes: codeList,
  previous_eye_surgeries: z.array(z.object({ procedure: z.string().trim().min(1).max(250), laterality: eyeSchema, date: instant })).max(50),
  current_eye_treatments: z.array(z.object({ type: z.string().trim().min(1).max(120), details: z.string().trim().min(1).max(1000) })).max(50),
  previous_eye_injury_or_laser: z.array(z.object({ type: z.enum(['INJURY', 'LASER']), laterality: eyeSchema, date: instant.nullable(), details: z.string().trim().min(1).max(1000) })).max(50),
  spectacle_use: correctionUse, contact_lens_use: correctionUse, long_term_steroid_use: z.boolean(), long_term_steroid_details: nullableText(1000),
  family_history_codes: codeList, previous_report_document_ids: z.array(ophthalmologyIdSchema).max(50), shared_medical_history_reviewed: z.boolean(),
  shared_allergy_reviewed: z.boolean(), emergency_criterion_codes: codeList, other_urgent_condition_detail: nullableText(1000),
}).strict();
export type OphthalmologyIntakeFields = z.infer<typeof intakeFieldsSchema>;
export const saveIntakeSchema = intakeFieldsSchema.extend({ expected_version: version.nullable(), complaint_configuration_version_id: ophthalmologyIdSchema, emergency_configuration_version_id: ophthalmologyIdSchema }).superRefine((body, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (body.no_significant_ophthalmic_history && (body.previous_eye_disease_codes.length || body.previous_eye_surgeries.length || body.current_eye_treatments.length || body.previous_eye_injury_or_laser.length || body.spectacle_use.uses || body.contact_lens_use.uses || body.long_term_steroid_use || body.family_history_codes.length)) issue('no_significant_ophthalmic_history', 'Clear conflicting positive history before selecting no significant history.');
  for (const key of ['spectacle_use', 'contact_lens_use'] as const) if (!body[key].uses && (body[key].age_months !== null || body[key].wearing_pattern?.trim())) issue(key, 'Use must be selected to record these details.');
  if (!body.long_term_steroid_use && body.long_term_steroid_details?.trim()) issue('long_term_steroid_details', 'Select steroid use to record details.');
  if (body.emergency_criterion_codes.some((code) => ['OTHER', 'OTHER_URGENT_CONDITION'].includes(code.toUpperCase())) && !body.other_urgent_condition_detail?.trim()) issue('other_urgent_condition_detail', 'Describe the other urgent condition.');
  for (const surgery of body.previous_eye_surgeries) if (new Date(surgery.date) > new Date()) issue('previous_eye_surgeries', 'Previous surgery cannot be in the future.');
  for (const injury of body.previous_eye_injury_or_laser) if (injury.date && new Date(injury.date) > new Date()) issue('previous_eye_injury_or_laser', 'Previous injury or laser cannot be in the future.');
});
export type SaveOphthalmologyIntake = z.infer<typeof saveIntakeSchema>;
const intakeSchema = intakeFieldsSchema.extend({ id: ophthalmologyIdSchema, context_id: ophthalmologyIdSchema, ...scope, status: z.enum(['DRAFT', 'COMPLETED']), version, complaint_configuration_version_id: ophthalmologyIdSchema, emergency_configuration_version_id: ophthalmologyIdSchema }).strip();
export type OphthalmologyIntake = z.infer<typeof intakeSchema>;
const alertSchema = z.object({ id: ophthalmologyIdSchema, ...scope, type: z.literal('EMERGENCY_SCREENING'), status: z.enum(['ACTIVE', 'ACKNOWLEDGED']), reason: z.string(), version, triggered_by: ophthalmologyIdSchema, triggered_at: instant, acknowledged_by: ophthalmologyIdSchema.nullable(), acknowledged_at: instant.nullable(), acknowledgement_note: z.string().nullable() });
export type OphthalmologyAlert = z.infer<typeof alertSchema>;
const intakeViewSchema = z.object({ intake: intakeSchema.nullable(), alerts: z.array(alertSchema), shared_history: z.object({ history_present_illness: z.string().nullable(), past_history: z.string().nullable(), family_history: z.string().nullable(), allergies: z.string().nullable() }) });
export type OphthalmologyIntakeView = z.infer<typeof intakeViewSchema>;
export const taskSchema = z.object({
  id: ophthalmologyIdSchema, context_id: ophthalmologyIdSchema, ...scope, test_code: z.string(), test_name: z.string(), laterality: eyeSchema,
  priority: z.enum(['ROUTINE', 'PRIORITY', 'EMERGENCY']), status: taskStatusSchema, version, station_id: ophthalmologyIdSchema.nullable(), assigned_user_id: ophthalmologyIdSchema.nullable(),
  device_code: z.string().nullable(), started_at: instant.nullable(), completed_at: instant.nullable(), special_instructions: z.string().nullable(),
});
export type OphthalmologyTask = z.infer<typeof taskSchema>;
const resultVersionSchema = z.object({
  clinical_version: version, status: z.enum(['DRAFT', 'COMPLETED']), form_type: testFormSchema, form_schema_version: z.string(), form_profile_version_id: ophthalmologyIdSchema,
  form_profile_revision: version, form_profile_snapshot: opaqueObject, laterality: eyeSchema, station_id: ophthalmologyIdSchema,
  performer_user_id: ophthalmologyIdSchema, performed_at: instant, device_code: z.string().nullable(),
  device_snapshot: z.object({ code: z.string(), name: z.string(), calibration_status: z.string() }).nullable(),
  source_type: z.enum(['MANUAL', 'DEVICE_IMPORT', 'MANUAL_CORRECTION']), reliability: z.enum(['GOOD', 'FAIR', 'POOR']), reliability_reason: z.string().nullable(), comments: z.string().nullable(),
  document_ids: z.array(ophthalmologyIdSchema), payload: opaqueObject, supersedes_clinical_version: version.nullable(), amendment_reason: z.string().nullable(), completed_at: instant.nullable(),
});
export const resultSchema = z.object({ id: ophthalmologyIdSchema, task_id: ophthalmologyIdSchema, context_id: ophthalmologyIdSchema, ...scope, version, status: z.enum(['DRAFT', 'COMPLETED']), current_clinical_version: version, current: resultVersionSchema, history: z.array(resultVersionSchema) });
export type OphthalmologyResult = z.infer<typeof resultSchema>;
export const saveResultSchema = z.object({
  expected_task_status: z.enum(['IN_PROGRESS', 'DRAFT']), expected_task_version: version, expected_result_version: version.nullable(),
  form_type: testFormSchema, form_schema_version: z.string().min(1).max(40), form_profile_version_id: ophthalmologyIdSchema, performed_at: instant,
  source_type: z.literal('MANUAL'), reliability: z.enum(['GOOD', 'FAIR', 'POOR']), reliability_reason: nullableText(1000), comments: nullableText(4000), document_ids: z.array(ophthalmologyIdSchema).max(50),
  // Payload is externally versioned by form/profile; only the typed form registry builds editable paths.
  payload: opaqueObject,
}).strict().superRefine((body, ctx) => {
  if (body.reliability === 'POOR' && !body.reliability_reason?.trim()) ctx.addIssue({ code: 'custom', path: ['reliability_reason'], message: 'Explain poor reliability.' });
});
export type SaveOphthalmologyResult = z.infer<typeof saveResultSchema>;
export const amendResultSchema = z.object({ ...saveResultSchema.shape, expected_task_status: z.literal('COMPLETED'), expected_result_version: version, source_type: z.literal('MANUAL_CORRECTION'), reason: z.string().trim().min(1).max(1000) }).strict().superRefine((body, ctx) => {
  if (body.reliability === 'POOR' && !body.reliability_reason?.trim()) ctx.addIssue({ code: 'custom', path: ['reliability_reason'], message: 'Explain poor reliability.' });
});
export type AmendOphthalmologyResult = z.infer<typeof amendResultSchema>;
export const attachmentSchema = z.object({ id: ophthalmologyIdSchema, context_id: ophthalmologyIdSchema, ...scope, task_id: ophthalmologyIdSchema, result_id: ophthalmologyIdSchema.nullable(), patient_document_id: ophthalmologyIdSchema, test_code: z.string(), laterality: z.string(), device_code: z.string().nullable(), acquired_at: instant, provenance: z.enum(['MANUAL_UPLOAD', 'DEVICE_IMPORT']), checksum_sha256: z.string(), mime_type: z.string(), file_size_bytes: version, original_file_name: z.string(), review_state: z.enum(['PENDING', 'VERIFIED', 'REJECTED']), publication_state: z.enum(['INTERNAL', 'APPROVED_FOR_PORTAL', 'WITHDRAWN']), uploaded_by: ophthalmologyIdSchema });
export type OphthalmologyAttachment = z.infer<typeof attachmentSchema>;
export const uploadAttachmentSchema = z.object({ task_id: ophthalmologyIdSchema, result_id: ophthalmologyIdSchema.nullable(), title: z.string().trim().min(1).max(250), acquired_at: instant });
export type UploadOphthalmologyAttachment = z.infer<typeof uploadAttachmentSchema> & { file: File; key: string };
const completeIntakeSchema = z.object({ expected_version: version, expected_status: z.literal('DRAFT'), expected_context_version: version }).strict();
const completeResultSchema = z.object({ expected_task_status: z.literal('DRAFT'), expected_task_version: version, expected_result_version: version }).strict();
export type CompleteOphthalmologyResult = z.infer<typeof completeResultSchema>;
const alertActionSchema = z.object({ expected_version: version, expected_status: z.literal('ACTIVE'), note: nullableText(1000).optional() }).strict();
export type AlertAction = z.infer<typeof alertActionSchema>;
const escalateAlertSchema = z.object({
  reason: z.string().min(1).max(2000),
  trigger_findings: z.array(z.string().max(200)).max(20).optional(),
  urgency: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']).optional(),
}).strict();
export type EscalateAlertBody = z.infer<typeof escalateAlertSchema>;
const metaSchema = z.object({ page: z.number().int().positive(), limit: z.number().int().positive(), total: version, totalPages: version });
const pageOf = <T extends z.ZodType>(schema: T) => z.object({ data: z.array(schema), meta: metaSchema });
export type OphthalmologyPage<T> = { data: T[]; meta: z.infer<typeof metaSchema> };
export type ConfigurationType = 'COMPLAINT' | 'CLINICAL_THRESHOLD' | 'FORM_PROFILE' | 'COMPLETION_PROFILE' | 'OPTICAL_PRODUCT' | 'DRUG_OPTION' | 'IOL_CATALOGUE';
const visitPath = (visitId: string) => `/opd/visits/${ophthalmologyIdSchema.parse(visitId)}/ophthalmology`;
const taskPath = (taskId: string) => `/ophthalmology/test-tasks/${ophthalmologyIdSchema.parse(taskId)}`;
export const comparisonPageSchema = z.object({ task_id: ophthalmologyIdSchema, result_id: ophthalmologyIdSchema, expected_result_version: version,
  data: z.array(z.object({ result_id: ophthalmologyIdSchema, clinical_version: z.number().int().positive(), performed_at: instant,
    form_type: z.enum(['VISUAL_FIELD', 'OCT']), eye: z.string().nullable(), eligible: z.boolean(), reason: z.string().nullable() })), meta: metaSchema });
export const ophthalmologyApi = {
  clinicalWorkspace: async (visitId: string, signal?: AbortSignal) => clinicalWorkspaceSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/workspace`, { signal })),
  clinicalConfiguration: async (visitId: string, signal?: AbortSignal) => configurationSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/clinical-configuration`, { signal })),
  context: async (visitId: string, signal?: AbortSignal) => contextSchema.nullable().parse(await apiClient.request<unknown>(`${visitPath(visitId)}/context`, { signal })),
  createContext: async (visitId: string, body: z.infer<typeof createContextSchema>) => contextSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/context`, { method: 'POST', body: createContextSchema.parse(body) })),
  updateContext: async (visitId: string, body: UpdateOphthalmologyContext) => contextSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/context`, { method: 'PATCH', body: updateContextSchema.parse(body) })),
  intake: async (visitId: string, signal?: AbortSignal) => intakeViewSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/intake`, { signal })),
  saveIntake: async (visitId: string, body: SaveOphthalmologyIntake) => intakeSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/intake/draft`, { method: 'PUT', body: saveIntakeSchema.parse(body) })),
  completeIntake: async (visitId: string, body: z.infer<typeof completeIntakeSchema>) => z.object({ intake: intakeSchema, alert: alertSchema.nullable() }).parse(await apiClient.request<unknown>(`${visitPath(visitId)}/intake/complete`, { method: 'POST', body: completeIntakeSchema.parse(body) })),
  alert: async (visitId: string, alertId: string, action: 'route' | 'acknowledge', body: AlertAction) => {
    const parsed = alertActionSchema.parse(body);
    const request = action === 'route' ? { expected_version: parsed.expected_version, expected_status: parsed.expected_status } : parsed;
    return alertSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/alerts/${ophthalmologyIdSchema.parse(alertId)}/${action}`, { method: 'POST', body: request }));
  },
  escalateAlert: async (visitId: string, body: EscalateAlertBody) => {
    const request = escalateAlertSchema.parse(body);
    return alertSchema.parse(await apiClient.request<unknown>(`${visitPath(visitId)}/alerts/escalate`, { method: 'POST', body: request }));
  },
  configurations: async (branchId: string, type: ConfigurationType, page: number, signal?: AbortSignal) => pageOf(configurationSchema).parse(await apiClient.request<unknown>(`/ophthalmology/configurations?${new URLSearchParams({ branch_id: ophthalmologyIdSchema.parse(branchId), type, status: 'ACTIVE', page: String(page), limit: '20' })}`, { signal })),
  workflows: async (branchId: string, subtype: z.infer<typeof subtypeSchema>, page: number, signal?: AbortSignal) => pageOf(workflowSchema).parse(await apiClient.request<unknown>(`/ophthalmology/workflow-profiles?${new URLSearchParams({ branch_id: ophthalmologyIdSchema.parse(branchId), visit_subtype: subtypeSchema.parse(subtype), status: 'ACTIVE', page: String(page), limit: '20' })}`, { signal })),
  tasks: async (visitId: string, page: number, signal?: AbortSignal) => pageOf(taskSchema).parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks?${new URLSearchParams({ visit_id: ophthalmologyIdSchema.parse(visitId), page: String(page), limit: '20' })}`, { signal })),
  task: async (taskId: string, signal?: AbortSignal) => taskSchema.parse(await apiClient.request<unknown>(taskPath(taskId), { signal })),
  comparisons: async (taskId: string, expectedVersion: number, page: number, signal?: AbortSignal) => comparisonPageSchema.parse(await apiClient.request<unknown>(`${taskPath(taskId)}/result/comparisons?${new URLSearchParams({ expected_result_version: String(version.parse(expectedVersion)), page: String(z.number().int().positive().parse(page)), limit: '20' })}`, { signal })),
  result: async (taskId: string, signal?: AbortSignal) => resultSchema.nullable().parse(await apiClient.request<unknown>(`${taskPath(taskId)}/result`, { signal })),
  saveResult: async (taskId: string, body: SaveOphthalmologyResult) => resultSchema.parse(await apiClient.request<unknown>(`${taskPath(taskId)}/result/draft`, { method: 'PUT', body: saveResultSchema.parse(body) })),
  completeResult: async (taskId: string, body: CompleteOphthalmologyResult) => resultSchema.parse(await apiClient.request<unknown>(`${taskPath(taskId)}/result/complete`, { method: 'POST', body: completeResultSchema.parse(body) })),
  amendResult: async (taskId: string, body: AmendOphthalmologyResult) => resultSchema.parse(await apiClient.request<unknown>(`${taskPath(taskId)}/result/amendments`, { method: 'POST', body: amendResultSchema.parse(body) })),
  attachments: async (branchId: string, taskId: string, page: number, signal?: AbortSignal) => pageOf(attachmentSchema).parse(await apiClient.request<unknown>(`/ophthalmology/attachments?${new URLSearchParams({ branch_id: ophthalmologyIdSchema.parse(branchId), task_id: ophthalmologyIdSchema.parse(taskId), page: String(page), limit: '20' })}`, { signal })),
  uploadAttachment: async (input: UploadOphthalmologyAttachment) => {
    const parsed = uploadAttachmentSchema.parse({ task_id: input.task_id, result_id: input.result_id, title: input.title, acquired_at: input.acquired_at });
    if (!(input.file instanceof File) || !input.file.size) throw new Error('Choose a nonempty file.');
    const body = new FormData(); body.append('task_id', parsed.task_id); if (parsed.result_id) body.append('result_id', parsed.result_id);
    body.append('title', parsed.title); body.append('acquired_at', parsed.acquired_at); body.append('provenance', 'MANUAL_UPLOAD'); body.append('file', input.file, input.file.name);
    return attachmentSchema.parse(await apiClient.request<unknown>('/ophthalmology/attachments', { method: 'POST', headers: { 'Idempotency-Key': z.string().min(8).max(200).parse(input.key) }, body }));
  },
};
