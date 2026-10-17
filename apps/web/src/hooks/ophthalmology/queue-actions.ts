import { z } from 'zod';
import { queueCommandSchema, type QueueAction, type QueueTask } from '../../api/ophthalmology-queue';

export const queueActionDefinitions: { action: QueueAction; label: string; screen: string; permission: string; statuses: QueueTask['status'][] }[] = [
  { action: 'assign', label: 'Assign', screen: 'Ophthalmology Test Queue', permission: 'Assign', statuses: ['ORDERED'] },
  { action: 'reassign', label: 'Reassign', screen: 'Ophthalmology Test Queue', permission: 'Reassign', statuses: ['PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT'] },
  { action: 'call', label: 'Call patient', screen: 'Ophthalmology Test Queue', permission: 'Call', statuses: ['PATIENT_WAITING'] },
  { action: 'patient-unavailable', label: 'Patient unavailable', screen: 'Ophthalmology Test Queue', permission: 'Call', statuses: ['PATIENT_CALLED'] },
  { action: 'start', label: 'Start test', screen: 'Ophthalmology Test Queue', permission: 'Start', statuses: ['PATIENT_CALLED'] },
  { action: 'unable', label: 'Unable to perform', screen: 'Ophthalmology Test Queue', permission: 'Cancel', statuses: ['IN_PROGRESS', 'DRAFT'] },
  { action: 'cancel', label: 'Cancel test', screen: 'Ophthalmology Test Queue', permission: 'Cancel', statuses: ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT'] },
  { action: 'submit-for-review', label: 'Submit for review', screen: 'Ophthalmology Test Queue', permission: 'Complete', statuses: ['COMPLETED'] },
  { action: 'request-repeat', label: 'Request repeat', screen: 'Ophthalmology Test Review', permission: 'Request Repeat', statuses: ['COMPLETED', 'SUBMITTED_FOR_REVIEW'] },
  { action: 'route', label: 'Route / handoff', screen: 'Ophthalmology Test Queue', permission: 'Reassign', statuses: ['COMPLETED', 'REVIEWED', 'UNABLE_TO_PERFORM'] },
];
export const queueActionFormSchema = z.object({ station_id: z.string(), assigned_user_id: z.string(), device_code: z.string(), reason: z.string().trim().max(1000), target: z.enum(['NEXT_STATION', 'OPHTHALMOLOGIST']), next_task_id: z.string() });
export type QueueActionForm = z.infer<typeof queueActionFormSchema>;
export function buildQueueCommand(task: QueueTask, action: QueueAction, values: QueueActionForm, key: string) {
  const body = { expected_version: task.version, expected_status: task.status };
  const assignment = { station_id: values.station_id, assigned_user_id: values.assigned_user_id || null };
  const input = action === 'assign' ? { action, task_id: task.id, body: { ...body, ...assignment } }
    : action === 'reassign' ? { action, task_id: task.id, body: { ...body, ...assignment, reason: values.reason } }
      : action === 'request-repeat' ? { action, task_id: task.id, key, body: { ...body, ...assignment, reason: values.reason } }
        : action === 'route' ? { action, task_id: task.id, body: { ...body, target: values.target, reason: values.reason || null, ...(values.target === 'NEXT_STATION' ? { ...assignment, next_task_id: values.next_task_id } : {}) } }
          : action === 'start' ? { action, task_id: task.id, body: { ...body, device_code: values.device_code || null } }
            : action === 'call' || action === 'submit-for-review' ? { action, task_id: task.id, body }
              : { action, task_id: task.id, body: { ...body, reason: values.reason } };
  return queueCommandSchema.parse(input);
}
export function configuredQueueTests(values: Record<string, unknown> | undefined) {
  const entries = z.array(z.union([z.string().trim().min(1), z.object({ code: z.string().trim().min(1), name: z.string().optional(), label: z.string().optional(), active: z.boolean().optional() })])).safeParse(values?.tests);
  return entries.success ? entries.data.flatMap((entry) => typeof entry === 'string' ? [{ code: entry.toUpperCase(), name: entry }] : entry.active === false ? [] : [{ code: entry.code.trim().toUpperCase(), name: entry.name?.trim() || entry.label?.trim() || entry.code.trim() }]) : [];
}
export function queueTime(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not recorded';
  return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}
export function waitingMinutes(value: string | null, now: number) {
  return value && !Number.isNaN(Date.parse(value)) ? `${Math.max(0, Math.floor((now - Date.parse(value)) / 60000))} min` : 'Not waiting';
}
