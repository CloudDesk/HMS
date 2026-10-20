import { z } from 'zod';
import { apiClient } from './client';
import { ophthalmologyIdSchema as id, taskStatusSchema } from './ophthalmology';

export const reportTypeSchema = z.enum(['STATION_QUEUE', 'TEST_TURNAROUND', 'PENDING_REVIEW', 'REPEAT_UNABLE', 'CLINICAL_VOLUME', 'DIAGNOSTIC_UTILIZATION']);
export type OphthalmologyReportType = z.infer<typeof reportTypeSchema>;
const count = z.number().int().nonnegative();
const instant = z.string().datetime({ offset: true });
export const reportQuerySchema = z.object({ branch_id: id, station_id: id.optional(), volume_basis: z.enum(['VISITS', 'ORDERED_ENCOUNTERS']).optional(), date_from: instant.optional(), date_to: instant.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict().refine((q) => !q.date_from || !q.date_to || Date.parse(q.date_from) <= Date.parse(q.date_to), 'Start must be before or equal to end.').refine((q) => q.volume_basis !== 'VISITS' || !q.station_id, 'Clear the station filter for visit-based clinical volume.');
export type OphthalmologyReportQuery = z.infer<typeof reportQuerySchema>;
const task = z.object({ task_id: id, visit_id: id, test_code: z.string(), test_name: z.string(), station_id: id.nullable(), device_code: z.string().nullable().optional(), status: taskStatusSchema, priority: z.string(), reason: z.string().nullable().optional(), ordered_at: instant, waiting_since: instant.nullable().optional(), started_at: instant.nullable().optional(), completed_at: instant.nullable().optional(), reviewed_at: instant.nullable().optional() });
const turnaround = z.object({ task_id: id, test_code: z.string(), station_id: id.nullable(), status: taskStatusSchema, order_to_start_ms: z.number().nullable(), start_to_completion_ms: z.number().nullable(), completion_to_review_ms: z.number().nullable() });
const volume = z.object({ _id: id, visit_id: id, first_ordered_at: instant, tests: count });
const utilization = z.object({ _id: z.object({ test_code: z.string(), station_id: id.nullable().optional() }), ordered: count, completed: count });
const visit = z.object({ scheduling_subtype: z.string().nullable().optional(), sub_speciality_code: z.string().nullable().optional(), sub_speciality_configuration_id: id.nullable().optional(), visit_id: id, branch_id: id, department_id: id, doctor_id: id, doctor_name: z.string(), visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY', 'WALK_IN', 'REVIEW']), visit_date: instant, status: z.enum(['CHECKED_IN', 'WAITING_FOR_VITALS', 'READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'SKIPPED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) });
const meta = z.object({ total: count, page: count.min(1), limit: count.min(1).max(100), totalPages: count.min(1) });
const pages = { visits: z.object({ basis: z.literal('VISITS'), data: z.array(visit), meta }), task: z.object({ data: z.array(task), meta, summary: z.object({ basis: z.literal('CURRENT_TASK_STATUS'), denominator_tasks: count, repeat_required_tasks: count, unable_tasks: count, repeat_required_percent: z.number().min(0).max(100).nullable(), unable_percent: z.number().min(0).max(100).nullable() }).optional() }), turnaround: z.object({ data: z.array(turnaround), meta }), volume: z.object({ data: z.array(volume), meta }), utilization: z.object({ data: z.array(utilization), meta }) };
export type OphthalmologyReport =
  | { kind: 'visits'; page: z.infer<typeof pages.visits> }
  | { kind: 'task'; page: z.infer<typeof pages.task> }
  | { kind: 'turnaround'; page: z.infer<typeof pages.turnaround> }
  | { kind: 'volume'; page: z.infer<typeof pages.volume> }
  | { kind: 'utilization'; page: z.infer<typeof pages.utilization> };
export function parseReport(type: OphthalmologyReportType, value: unknown): OphthalmologyReport {
  if (type === 'TEST_TURNAROUND') return { kind: 'turnaround', page: pages.turnaround.parse(value) };
  if (type === 'CLINICAL_VOLUME' && z.object({ basis: z.literal('VISITS') }).safeParse(value).success) return { kind: 'visits', page: pages.visits.parse(value) };
  if (type === 'CLINICAL_VOLUME') return { kind: 'volume', page: pages.volume.parse(value) };
  if (type === 'DIAGNOSTIC_UTILIZATION') return { kind: 'utilization', page: pages.utilization.parse(value) };
  return { kind: 'task', page: pages.task.parse(value) };
}
export const ophthalmologyReportsApi = {
  exportReport: async (type: OphthalmologyReportType, input: OphthalmologyReportQuery) => {
    const query = reportQuerySchema.parse(input); const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (!['page', 'limit'].includes(key)) params.set(key, String(value));
    return apiClient.download(`/ophthalmology/reports/${reportTypeSchema.parse(type)}/export?${params}`);
  },
  report: async (type: OphthalmologyReportType, input: OphthalmologyReportQuery, signal?: AbortSignal): Promise<OphthalmologyReport> => {
    const query = reportQuerySchema.parse(input); const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) params.set(key, String(value));
    return parseReport(reportTypeSchema.parse(type), await apiClient.request<unknown>(`/ophthalmology/reports/${type}?${params}`, { signal }));
  },
};
