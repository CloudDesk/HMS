import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { request } }));
import { ophthalmologyAdminApi, stationWriteSchema, workflowWriteSchema } from './ophthalmology-admin';
const id = '111111111111111111111111';
const body = { name: 'QA master', description: null, effective_from: null, values: { options: [{ code: 'QA', label: 'QA option', active: true }] } };
const record = { ...body, id, branch_id: id, code: 'QA', type: 'COMPLAINT', status: 'DRAFT', version: 4, revision: 1, effective_to: null };
describe('ophthalmology administration contracts', () => {
  beforeEach(() => request.mockReset());
  it('uses branch-scoped pagination and explicit master filters', async () => {
    request.mockResolvedValue({ data: [record], meta: { page: 2, limit: 20, total: 21, totalPages: 2 } });
    await ophthalmologyAdminApi.list('masters', { branch_id: id, page: 2, type: 'COMPLAINT', status: 'DRAFT', search: 'QA' });
    expect(request.mock.calls[0]?.[0]).toBe(`/ophthalmology/configurations?branch_id=${id}&page=2&limit=20&type=COMPLAINT&status=DRAFT&search=QA`);
  });
  it('keeps immutable scope and master identity out of an update and sends the editing version', async () => {
    request.mockResolvedValue(record);
    await ophthalmologyAdminApi.save({ resource: 'masters', id, branch_id: id, type: 'COMPLAINT', code: 'QA', expected_version: 3, body });
    expect(request).toHaveBeenCalledWith(`/ophthalmology/configurations/${id}`, { method: 'PATCH', body: { ...body, expected_version: 3 } });
  });
  it('rejects unsupported station activation and unreasoned deactivation before calling the server', async () => {
    await expect(ophthalmologyAdminApi.action('stations', id, 'activate', { expected_version: 1, expected_status: 'DRAFT', reason: null })).rejects.toThrow('not supported');
    await expect(ophthalmologyAdminApi.action('masters', id, 'deactivate', { expected_version: 1, expected_status: 'ACTIVE', reason: null })).rejects.toThrow('reason');
    expect(request).not.toHaveBeenCalled();
  });
  it('sends explicit status, version and reason for deactivation', async () => {
    request.mockResolvedValue(record);
    await ophthalmologyAdminApi.action('masters', id, 'deactivate', { expected_version: 4, expected_status: 'ACTIVE', reason: 'Approved replacement' });
    expect(request).toHaveBeenCalledWith(`/ophthalmology/configurations/${id}/deactivate`, { method: 'POST', body: { expected_version: 4, expected_status: 'ACTIVE', reason: 'Approved replacement' } });
  });
  it('rejects duplicate workflow stages and memberships without substituting defaults', () => {
    const stage = { code: 'QA', name: 'QA', mode: 'SEQUENTIAL', test_codes: ['QA'], bypass_allowed: false };
    expect(workflowWriteSchema.safeParse({ name: 'QA', effective_from: null, stages: [stage, stage] }).success).toBe(false);
    expect(stationWriteSchema.safeParse({ name: 'QA', description: null, supported_test_types: ['QA'], devices: [], member_user_ids: [id, id] }).success).toBe(false);
  });
});
