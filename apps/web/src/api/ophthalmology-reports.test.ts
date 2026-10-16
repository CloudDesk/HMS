import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./client', () => ({ apiClient: { request: vi.fn() } }));
import { apiClient } from './client';
import { ophthalmologyReportsApi, parseReport, reportQuerySchema } from './ophthalmology-reports';
const id = '111111111111111111111111'; const meta = { total: 1, page: 1, limit: 20, totalPages: 1 };
describe('B6 exact operational report contract', () => {
  beforeEach(() => vi.mocked(apiClient.request).mockReset());
  it('validates branch/station/date/page inputs without issuing invalid requests', async () => {
    for (const patch of [{ branch_id: 'bad' }, { station_id: 'bad' }, { page: 0 }, { limit: 101 }, { date_from: '2026-10-17T00:00:00Z', date_to: '2026-10-16T00:00:00Z' }, { date_from: 'yesterday' }]) expect(reportQuerySchema.safeParse({ branch_id: id, ...patch }).success).toBe(false);
    await expect(ophthalmologyReportsApi.report('STATION_QUEUE', { branch_id: 'bad', page: 1, limit: 20 })).rejects.toThrow(); expect(apiClient.request).not.toHaveBeenCalled();
  });
  it('preserves null durations and zero counts without manufacturing missing metrics', () => {
    const result = parseReport('TEST_TURNAROUND', { data: [{ task_id: id, test_code: 'OCT', station_id: null, status: 'ORDERED', order_to_start_ms: null, start_to_completion_ms: 0, completion_to_review_ms: null, secret: 'discard' }], meta });
    expect(result.kind).toBe('turnaround'); expect(result.page.data[0]).not.toHaveProperty('secret'); expect(result.page.data[0]).toMatchObject({ order_to_start_ms: null, start_to_completion_ms: 0 });
    expect(() => parseReport('TEST_TURNAROUND', { data: [{ task_id: id }], meta })).toThrow();
  });
  it('parses raw grouped IDs and server pagination for volume/utilization', () => {
    expect(parseReport('CLINICAL_VOLUME', { data: [{ _id: id, visit_id: id, first_ordered_at: '2026-10-16T00:00:00Z', tests: 3 }], meta }).kind).toBe('volume');
    expect(parseReport('DIAGNOSTIC_UTILIZATION', { data: [{ _id: { test_code: 'OCT', station_id: null }, ordered: 2, completed: 0 }], meta }).page.meta.total).toBe(1);
    expect(() => parseReport('CLINICAL_VOLUME', { data: [], meta: { ...meta, total: -1 } })).toThrow();
  });
  it('uses the published route and filter names and forwards cancellation', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: [], meta: { ...meta, total: 0 } }); const signal = new AbortController().signal;
    await ophthalmologyReportsApi.report('PENDING_REVIEW', { branch_id: id, station_id: id, date_from: '2026-10-16T00:00:00Z', page: 2, limit: 20 }, signal);
    const [url, options] = vi.mocked(apiClient.request).mock.calls[0]; expect(url).toContain('/ophthalmology/reports/PENDING_REVIEW?'); expect(url).toContain('page=2'); expect(url).toContain(`station_id=${id}`); expect(options?.signal).toBe(signal);
  });
  it('exposes no invented report export or publication writer', () => { expect(Object.keys(ophthalmologyReportsApi)).toEqual(['report']); });
});
