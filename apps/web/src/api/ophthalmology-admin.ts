import { z } from 'zod';
import { apiClient } from './client';
import { configurationSchema, ophthalmologyIdSchema as id, subtypeSchema } from './ophthalmology';

const version = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true }).nullable();
const text = (max: number) => z.string().trim().min(1).max(max);
const codes = z.array(text(80)).max(100).refine((items) => new Set(items.map((item) => item.toUpperCase())).size === items.length, 'Codes must be unique.');
export const configurationTypeSchema = z.enum(['SUB_SPECIALITY', 'COMPLAINT', 'TEST_CATALOGUE', 'VISUAL_ACUITY_SCALE', 'DIAGNOSIS_REFERENCE', 'DRUG_OPTION', 'OPTICAL_PRODUCT', 'IOL_CATALOGUE', 'CLINICAL_THRESHOLD', 'GRADE', 'REASON', 'FORM_PROFILE', 'COMPLETION_PROFILE']);
export const adminConfigurationSchema = configurationSchema.extend({ type: configurationTypeSchema, description: z.string().nullable(), effective_from: instant, effective_to: instant });
export const deviceSchema = z.object({ code: text(80), name: text(160), status: z.enum(['ACTIVE', 'INACTIVE']), calibration_status: z.enum(['CURRENT', 'DUE', 'EXPIRED', 'NOT_REQUIRED']), calibrated_at: instant, calibration_due_at: instant }).strict();
export const stationWriteSchema = z.object({ name: text(160), description: z.string().max(1000).nullable(), supported_test_types: codes, devices: z.array(deviceSchema).max(100), member_user_ids: z.array(id).max(200).refine((items) => new Set(items).size === items.length, 'Members must be unique.') }).strict();
export const stationSchema = stationWriteSchema.extend({ id, branch_id: id, department_id: id, code: text(80), status: z.enum(['ACTIVE', 'INACTIVE']), version }).strip();
export const stageSchema = z.object({ code: text(80), name: text(160), mode: z.enum(['SEQUENTIAL', 'PARALLEL']), test_codes: codes, bypass_allowed: z.boolean() }).strict();
export const workflowWriteSchema = z.object({ name: text(160), effective_from: instant, stages: z.array(stageSchema).min(1).max(50).refine((items) => new Set(items.map((item) => item.code.toUpperCase())).size === items.length, 'Stage codes must be unique.') }).strict();
export const adminWorkflowSchema = workflowWriteSchema.extend({ id, branch_id: id, visit_subtype: subtypeSchema, revision: version, status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']), version }).strip();
export const configurationWriteSchema = z.object({ name: text(160), description: z.string().max(1000).nullable(), effective_from: instant, values: z.record(z.string(), z.unknown()) }).strict();
export const versionActionSchema = z.object({ expected_version: version, expected_status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']), reason: z.string().trim().min(1).max(1000).nullable() }).strict();
export type AdminConfiguration = z.infer<typeof adminConfigurationSchema>;
export type OphthalmologyStation = z.infer<typeof stationSchema>;
export type AdminWorkflow = z.infer<typeof adminWorkflowSchema>;
export type ConfigurationWrite = z.infer<typeof configurationWriteSchema>;
export type StationWrite = z.infer<typeof stationWriteSchema>;
export type WorkflowWrite = z.infer<typeof workflowWriteSchema>;
export type AdminResource = 'masters' | 'stations' | 'workflows';
export type AdminRecord = AdminConfiguration | OphthalmologyStation | AdminWorkflow;
export type AdminListParams = { branch_id: string; page: number; type?: z.infer<typeof configurationTypeSchema>; status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE'; search?: string };
const page = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: z.object({ page: version, limit: version, total: version, totalPages: version }) });
const routes = { masters: 'configurations', stations: 'stations', workflows: 'workflow-profiles' } as const;
export type AdminSave =
  | { resource: 'masters'; id: string | null; expected_version: number | null; branch_id: string; type: z.infer<typeof configurationTypeSchema>; code: string; body: ConfigurationWrite }
  | { resource: 'stations'; id: string | null; expected_version: number | null; branch_id: string; department_id: string; code: string; body: StationWrite }
  | { resource: 'workflows'; id: string | null; expected_version: number | null; branch_id: string; visit_subtype: z.infer<typeof subtypeSchema>; body: WorkflowWrite };
export const ophthalmologyAdminApi = {
  list: async (resource: AdminResource, params: AdminListParams, signal?: AbortSignal) => {
    const query = new URLSearchParams({ branch_id: id.parse(params.branch_id), page: String(z.number().int().positive().parse(params.page)), limit: '20' });
    if (params.type && resource === 'masters') query.set('type', configurationTypeSchema.parse(params.type));
    if (params.status && (resource !== 'stations' || params.status !== 'DRAFT')) query.set('status', params.status);
    if (params.search && resource !== 'workflows') query.set('search', z.string().max(120).parse(params.search));
    const response = await apiClient.request<unknown>(`/ophthalmology/${routes[resource]}?${query}`, { signal });
    if (resource === 'masters') return page(adminConfigurationSchema).parse(response);
    if (resource === 'stations') return page(stationSchema).parse(response);
    return page(adminWorkflowSchema).parse(response);
  },
  save: async (command: AdminSave): Promise<AdminRecord> => {
    const updating = command.id !== null;
    const metadata = updating ? { expected_version: version.parse(command.expected_version) } : { branch_id: id.parse(command.branch_id) };
    const body = command.resource === 'masters' ? { ...metadata, ...configurationWriteSchema.parse(command.body), ...(!updating ? { type: configurationTypeSchema.parse(command.type), code: text(80).parse(command.code) } : {}) }
      : command.resource === 'stations' ? { ...metadata, ...stationWriteSchema.parse(command.body), ...(!updating ? { department_id: id.parse(command.department_id), code: text(80).parse(command.code) } : {}) }
        : { ...metadata, ...workflowWriteSchema.parse(command.body), ...(!updating ? { visit_subtype: subtypeSchema.parse(command.visit_subtype) } : {}) };
    const response = await apiClient.request<unknown>(`/ophthalmology/${routes[command.resource]}${updating ? `/${id.parse(command.id)}` : ''}`, { method: updating ? 'PATCH' : 'POST', body });
    return command.resource === 'masters' ? adminConfigurationSchema.parse(response) : command.resource === 'stations' ? stationSchema.parse(response) : adminWorkflowSchema.parse(response);
  },
  action: async (resource: AdminResource, recordId: string, action: 'activate' | 'deactivate', body: z.infer<typeof versionActionSchema>) => {
    if (resource === 'stations' && action === 'activate') throw new Error('Station activation is not supported by the API.');
    const parsed = versionActionSchema.parse(body);
    if (action === 'deactivate' && !parsed.reason) throw new Error('A deactivation reason is required.');
    const response = await apiClient.request<unknown>(`/ophthalmology/${routes[resource]}/${id.parse(recordId)}/${action}`, { method: 'POST', body: parsed });
    return resource === 'masters' ? adminConfigurationSchema.parse(response) : resource === 'stations' ? stationSchema.parse(response) : adminWorkflowSchema.parse(response);
  },
};
