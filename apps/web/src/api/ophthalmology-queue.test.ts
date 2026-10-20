import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { request } }));
import { createQueueTaskSchema, ophthalmologyQueueApi, queueCommandSchema, queueQuerySchema } from './ophthalmology-queue';
import { buildQueueCommand, configuredQueueTests, queueActionDefinitions, queueTime, waitingMinutes } from '../hooks/ophthalmology/queue-actions';
import type { QueueTask } from './ophthalmology-queue';

const id = '111111111111111111111111';
const form = { station_id: id, assigned_user_id: '', device_code: '', reason: 'Patient requested another acquisition', target: 'OPHTHALMOLOGIST' as const, next_task_id: '' };
const creation = { expected_context_version: 3, test_catalogue_version_id: id, test_code: 'LENS', laterality: 'OD', priority: 'ROUTINE', source_type: 'WORKFLOW' } as const;
describe('ophthalmology queue contracts and transitions', () => {
  beforeEach(() => { request.mockReset(); });
  it('validates scope and paging before any request', async () => {
    expect(queueQuerySchema.safeParse({ branch_id: 'bad' }).success).toBe(false);
    expect(queueQuerySchema.safeParse({ branch_id: id, page: -1 }).success).toBe(false);
    expect(queueQuerySchema.safeParse({ branch_id: id, search: 'x'.repeat(121) }).success).toBe(false);
    request.mockResolvedValue({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } });
    await ophthalmologyQueueApi.list(queueQuerySchema.parse({ branch_id: id, visit_id: id, page: 2, status: 'PATIENT_WAITING' }));
    const url = new URL(String(request.mock.calls[0]?.[0]), 'https://hms.test');
    expect(url.pathname).toBe('/ophthalmology/test-tasks');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ branch_id: id, visit_id: id, page: '2', limit: '20', status: 'PATIENT_WAITING' });
  });
  it('requires a real clinical order/item and disallows order references on workflow tasks', () => {
    expect(createQueueTaskSchema.safeParse({ ...creation, source_type: 'CLINICAL_ORDER_ITEM' }).success).toBe(false);
    expect(createQueueTaskSchema.safeParse({ ...creation, source_order_id: id, source_order_item_id: id }).success).toBe(false);
    expect(createQueueTaskSchema.safeParse({ ...creation, source_type: 'CLINICAL_ORDER_ITEM', source_order_id: id, source_order_item_id: id }).success).toBe(true);
  });
  it('rejects invalid state actions and blank required reasons before network writes', async () => {
    await expect(ophthalmologyQueueApi.action({ action: 'call', task_id: id, body: { expected_version: 2, expected_status: 'COMPLETED' } } as never)).rejects.toThrow();
    expect(queueCommandSchema.safeParse({ action: 'cancel', task_id: id, body: { expected_version: 2, expected_status: 'DRAFT', reason: '   ' } }).success).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it('requires the implemented submission contract rather than an empty enum action', () => {
    expect(queueCommandSchema.safeParse({ action: 'submit-for-review', task_id: id, body: {} }).success).toBe(false);
    expect(queueActionDefinitions.map((action) => action.action)).toContain('submit-for-review');
    expect(queueCommandSchema.safeParse({ action: 'submit-for-review', task_id: id, body: { expected_version: 2, expected_status: 'COMPLETED' } }).success).toBe(true);
  });
  it('requires existing next task/station and does not advance unable tasks to a next station', () => {
    const command = { action: 'route', task_id: id, body: { expected_status: 'COMPLETED', expected_version: 7, target: 'NEXT_STATION' } };
    expect(queueCommandSchema.safeParse(command).success).toBe(false);
    expect(queueCommandSchema.safeParse({ ...command, body: { ...command.body, next_task_id: id, station_id: id } }).success).toBe(true);
    expect(queueCommandSchema.safeParse({ ...command, body: { ...command.body, expected_status: 'UNABLE_TO_PERFORM', next_task_id: id, station_id: id } }).success).toBe(false);
  });
  it('builds a reasoned repeat with the original editing version and stable supplied key', async () => {
    const command = buildQueueCommand({ id, version: 7, status: 'COMPLETED' } as QueueTask, 'request-repeat', form, 'retry-same-key');
    expect(command).toMatchObject({ action: 'request-repeat', key: 'retry-same-key', body: { expected_version: 7, expected_status: 'COMPLETED', reason: form.reason } });
    request.mockRejectedValue(new Error('network timeout'));
    expect(await ophthalmologyQueueApi.action(command).then(() => 'unexpected success', (error: unknown) => error instanceof Error ? error.message : 'unknown')).toBe('network timeout');
    expect(await ophthalmologyQueueApi.action(command).then(() => 'unexpected success', (error: unknown) => error instanceof Error ? error.message : 'unknown')).toBe('network timeout');
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({ 'Idempotency-Key': 'retry-same-key' });
  });
  it('sends the exact context version and creation key without synthetic patient fields', async () => {
    request.mockRejectedValue(new Error('timeout'));
    expect(await ophthalmologyQueueApi.create(id, creation, 'create-same-key').then(() => 'unexpected success', (error: unknown) => error instanceof Error ? error.message : 'unknown')).toBe('timeout');
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/test-tasks`, { method: 'POST', headers: { 'Idempotency-Key': 'create-same-key' }, body: creation });
  });
  it('matches configured catalogue labels/active flags and never fabricates tests', () => {
    expect(configuredQueueTests({ tests: [' lens ', { code: ' va ', label: 'Visual acuity' }, { code: 'OLD', active: false }] })).toEqual([{ code: 'LENS', name: 'lens' }, { code: 'VA', name: 'Visual acuity' }]);
    expect(configuredQueueTests({})).toEqual([]);
  });
  it('labels timezone and unknown/future waiting values honestly', () => {
    expect(queueTime('2026-10-16T10:30:00+05:30')).toBe('2026-10-16 05:00:00 UTC');
    expect(queueTime(null)).toBe('Not recorded');
    expect(waitingMinutes('2026-10-16T05:00:00Z', Date.parse('2026-10-16T05:03:30Z'))).toBe('3 min');
    expect(waitingMinutes(null, Date.now())).toBe('Not waiting');
    expect(waitingMinutes('2099-01-01T00:00:00Z', Date.now())).toBe('0 min');
  });
});
