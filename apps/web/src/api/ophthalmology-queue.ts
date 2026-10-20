import { clinicalWorkspaceSchema, configurationSchema } from './ophthalmology';
import { z } from 'zod';
import { apiClient } from './client';
import { eyeSchema, ophthalmologyIdSchema as id, taskSchema, taskStatusSchema } from './ophthalmology';
import { adminWorkflowSchema, stationSchema } from './ophthalmology-admin';

const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
const nullableId = id.nullable();
const reason = z.string().trim().min(1, 'Record a reason.').max(1000);
const expected = { expected_version: version, expected_status: taskStatusSchema };
export const queueTaskSchema = taskSchema.extend({
  test_catalogue_version_id: id, workflow_profile_version_id: id, workflow_stage_code: z.string().nullable(),
  source_type: z.enum(['WORKFLOW', 'CLINICAL_ORDER_ITEM']), source_order_id: nullableId, source_order_item_id: nullableId, source_order_type: z.enum(['LABORATORY', 'IMAGING']).nullable(),
  doctor_review_required: z.boolean(), repeat_of_task_id: nullableId, repeat_task_id: nullableId, repeat_root_task_id: nullableId,
  ordered_at: instant, assigned_at: instant.nullable(), waiting_since: instant.nullable(), called_at: instant.nullable(), unable_at: instant.nullable(), cancelled_at: instant.nullable(),
  reviewed_by: nullableId, reviewed_at: instant.nullable(), reviewed_clinical_version: version.nullable(), review_comment: z.string().nullable(),
  assignment_history: z.array(z.object({ action: z.enum(['ASSIGNED', 'REASSIGNED']), from_station_id: nullableId, to_station_id: id, from_user_id: nullableId, to_user_id: nullableId, reason: z.string().nullable(), actor_user_id: id, occurred_at: instant })),
  transition_history: z.array(z.object({ action: z.enum(['SUBMITTED_FOR_REVIEW', 'CALLED', 'PATIENT_UNAVAILABLE', 'STARTED', 'DRAFT_SAVED', 'COMPLETED', 'AMENDED', 'UNABLE_TO_PERFORM', 'CANCELLED', 'REPEAT_REQUESTED', 'REVIEWED']), from_status: taskStatusSchema, to_status: taskStatusSchema, reason: z.string().nullable(), actor_user_id: id, occurred_at: instant })),
  routing_history: z.array(z.object({ target: z.enum(['NEXT_STATION', 'OPHTHALMOLOGIST']), target_task_id: nullableId, target_station_id: nullableId, reason: z.string().nullable(), actor_user_id: id, occurred_at: instant })),
  created_at: instant, updated_at: instant,
});
export type QueueTask = z.infer<typeof queueTaskSchema>;
export const queueQuerySchema = z.object({
  branch_id: id, station_id: id.optional(), assigned_user_id: id.optional(), visit_id: id.optional(), patient_id: id.optional(),
  status: taskStatusSchema.optional(), test_code: z.string().trim().max(80).optional(), priority: z.enum(['ROUTINE', 'PRIORITY', 'EMERGENCY']).optional(), source_type: z.enum(['WORKFLOW', 'CLINICAL_ORDER_ITEM']).optional(),
  search: z.string().trim().max(120).optional(), sort: z.enum(['assigned_at', 'waiting_since', 'priority', 'updated_at']).default('updated_at'), direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1), limit: z.literal(20).default(20),
}).strict();
export type QueueQuery = z.infer<typeof queueQuerySchema>;
const key = z.string().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/);
export const createQueueTaskSchema = z.object({
  expected_context_version: version, test_catalogue_version_id: id, test_code: z.string().trim().min(1).max(80), workflow_stage_code: z.string().trim().max(80).nullable().optional(),
  laterality: eyeSchema, priority: z.enum(['ROUTINE', 'PRIORITY', 'EMERGENCY']), special_instructions: z.string().max(2000).nullable().optional(),
  source_type: z.enum(['WORKFLOW', 'CLINICAL_ORDER_ITEM']), source_order_id: nullableId.optional(), source_order_item_id: nullableId.optional(),
}).strict().superRefine((body, ctx) => {
  if (body.source_type === 'CLINICAL_ORDER_ITEM' && (!body.source_order_id || !body.source_order_item_id)) ctx.addIssue({ code: 'custom', message: 'Select an existing submitted order and item.', path: ['source_order_item_id'] });
  if (body.source_type === 'WORKFLOW' && (body.source_order_id || body.source_order_item_id)) ctx.addIssue({ code: 'custom', message: 'Workflow tasks cannot reference an order.', path: ['source_type'] });
});
export type CreateQueueTask = z.infer<typeof createQueueTaskSchema>;
const routeBody = z.object({ ...expected, expected_status: z.enum(['COMPLETED', 'REVIEWED', 'UNABLE_TO_PERFORM']), target: z.enum(['NEXT_STATION', 'OPHTHALMOLOGIST']), next_task_id: nullableId.optional(), station_id: nullableId.optional(), assigned_user_id: nullableId.optional(), reason: z.string().max(1000).nullable().optional() }).strict().superRefine((body, ctx) => {
  if (body.target === 'NEXT_STATION' && (body.expected_status === 'UNABLE_TO_PERFORM' || !body.next_task_id || !body.station_id)) ctx.addIssue({ code: 'custom', message: 'Select an existing ordered task and compatible station.', path: ['next_task_id'] });
});
export const queueCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit-for-review'), task_id: id, body: z.object({ expected_version: version, expected_status: z.literal('COMPLETED') }).strict() }).strict(),
  z.object({ action: z.literal('assign'), task_id: id, body: z.object({ expected_version: version, expected_status: z.literal('ORDERED'), station_id: id, assigned_user_id: nullableId.optional() }).strict() }).strict(),
  z.object({ action: z.literal('reassign'), task_id: id, body: z.object({ ...expected, expected_status: z.enum(['PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT']), station_id: id, assigned_user_id: nullableId.optional(), reason }).strict() }).strict(),
  z.object({ action: z.literal('call'), task_id: id, body: z.object({ expected_version: version, expected_status: z.literal('PATIENT_WAITING') }).strict() }).strict(),
  z.object({ action: z.literal('patient-unavailable'), task_id: id, body: z.object({ expected_version: version, expected_status: z.literal('PATIENT_CALLED'), reason }).strict() }).strict(),
  z.object({ action: z.literal('start'), task_id: id, body: z.object({ expected_version: version, expected_status: z.literal('PATIENT_CALLED'), device_code: z.string().trim().max(80).nullable().optional() }).strict() }).strict(),
  z.object({ action: z.literal('unable'), task_id: id, body: z.object({ ...expected, expected_status: z.enum(['IN_PROGRESS', 'DRAFT']), reason }).strict() }).strict(),
  z.object({ action: z.literal('cancel'), task_id: id, body: z.object({ ...expected, expected_status: z.enum(['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT']), reason }).strict() }).strict(),
  z.object({ action: z.literal('request-repeat'), task_id: id, key, body: z.object({ ...expected, expected_status: z.enum(['COMPLETED', 'SUBMITTED_FOR_REVIEW']), station_id: id, assigned_user_id: nullableId.optional(), reason }).strict() }).strict(),
  z.object({ action: z.literal('route'), task_id: id, body: routeBody }).strict(),
]);
export type QueueCommand = z.infer<typeof queueCommandSchema>;
export type QueueAction = QueueCommand['action'];
const pageSchema = z.object({ data: z.array(queueTaskSchema), meta: z.object({ page: version, limit: version, total: version, totalPages: version }) });
export const assignmentLookupSchema = z.object({ target_task_id: id.optional(), station_id: id.optional(), search: z.string().max(120).optional(), page: z.number().int().positive().default(1), limit: z.number().int().min(1).max(100).default(20) }).strict();
export type AssignmentLookup = z.infer<typeof assignmentLookupSchema>;
export const queueStationSchema = stationSchema.pick({ id: true, branch_id: true, department_id: true, code: true, name: true, status: true, supported_test_types: true, devices: true, version: true }).extend({ actor_eligible: z.boolean() });
const lookupMeta = z.object({ page: z.number().int().positive(), limit: z.number().int().positive().max(100), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() });
const lookupPath = (taskId: string, tail: string, input: AssignmentLookup) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(assignmentLookupSchema.parse(input))) params.set(key, String(value)); return `/ophthalmology/test-tasks/${id.parse(taskId)}/${tail}?${params}`; };
export const ophthalmologyQueueApi = {
  workspace: async (taskId: string, signal?: AbortSignal) => clinicalWorkspaceSchema.parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks/${id.parse(taskId)}/workspace`, { signal })),
  clinicalConfigurations: async (taskId: string, type: 'FORM_PROFILE' | 'OPTICAL_PRODUCT' | 'DRUG_OPTION', page: number, signal?: AbortSignal) => { const query = z.object({ type: z.enum(['FORM_PROFILE', 'OPTICAL_PRODUCT', 'DRUG_OPTION']), page: z.number().int().positive(), limit: z.literal(20) }).parse({ type, page, limit: 20 }); return z.object({ data: z.array(configurationSchema), meta: lookupMeta }).parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks/${id.parse(taskId)}/clinical-configurations?${new URLSearchParams({ type: query.type, page: String(query.page), limit: '20' })}`, { signal })); },
  assignmentStations: async (taskId: string, query: AssignmentLookup, signal?: AbortSignal) => z.object({ data: z.array(queueStationSchema), meta: lookupMeta }).parse(await apiClient.request<unknown>(lookupPath(taskId, 'stations', query), { signal })),
  assignmentStation: async (taskId: string, stationId: string, query: AssignmentLookup, signal?: AbortSignal) => queueStationSchema.parse(await apiClient.request<unknown>(lookupPath(taskId, `stations/${id.parse(stationId)}`, query), { signal })),
  assignmentMembers: async (taskId: string, query: AssignmentLookup, signal?: AbortSignal) => z.object({ data: z.array(z.object({ id, full_name: z.string() })), meta: lookupMeta }).parse(await apiClient.request<unknown>(lookupPath(taskId, 'assignees', query), { signal })),
  list: async (params: QueueQuery, signal?: AbortSignal) => {
    const query = queueQuerySchema.parse(params); const search = new URLSearchParams();
    Object.entries(query).forEach(([name, value]) => { if (value !== undefined) search.set(name, String(value)); });
    return pageSchema.parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks?${search}`, { signal }));
  },
  detail: async (taskId: string, signal?: AbortSignal) => queueTaskSchema.parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks/${id.parse(taskId)}`, { signal })),
  station: async (stationId: string, signal?: AbortSignal) => stationSchema.parse(await apiClient.request<unknown>(`/ophthalmology/stations/${id.parse(stationId)}`, { signal })),
  workflow: async (workflowId: string, signal?: AbortSignal) => adminWorkflowSchema.parse(await apiClient.request<unknown>(`/ophthalmology/workflow-profiles/${id.parse(workflowId)}`, { signal })),
  create: async (visitId: string, body: CreateQueueTask, idempotencyKey: string) => queueTaskSchema.parse(await apiClient.request<unknown>(`/opd/visits/${id.parse(visitId)}/ophthalmology/test-tasks`, { method: 'POST', headers: { 'Idempotency-Key': key.parse(idempotencyKey) }, body: createQueueTaskSchema.parse(body) })),
  action: async (command: QueueCommand) => {
    const parsed = queueCommandSchema.parse(command);
    return queueTaskSchema.parse(await apiClient.request<unknown>(`/ophthalmology/test-tasks/${parsed.task_id}/${parsed.action}`, { method: 'POST', body: parsed.body, ...(parsed.action === 'request-repeat' ? { headers: { 'Idempotency-Key': parsed.key } } : {}) }));
  },
};
