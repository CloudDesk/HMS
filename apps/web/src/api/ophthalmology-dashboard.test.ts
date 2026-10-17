import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { ophthalmologyDashboardApi, ophthalmologyDashboardSnapshotSchema } from './ophthalmology-dashboard';

vi.mock('./client', () => ({ apiClient: { request: vi.fn() } }));
const branchId = '111111111111111111111111';
const instant = '2026-10-17T08:00:00.000Z';
const snapshot = { branchId, generatedAt: instant, metrics: { waiting: 1, in_progress: 2, pending_review: 3, reviewed: 4, repeat_required: 5, unable: 6 }, createdAt: instant, updatedAt: instant };

describe('Ophthalmology dashboard API', () => {
  beforeEach(() => vi.mocked(apiClient.request).mockReset());

  it('uses the branch-scoped read and refresh routes', async () => {
    vi.mocked(apiClient.request).mockResolvedValue(snapshot);
    const signal = new AbortController().signal;
    await ophthalmologyDashboardApi.get({ branch_id: branchId }, signal);
    await ophthalmologyDashboardApi.refresh({ branch_id: branchId });
    expect(apiClient.request).toHaveBeenNthCalledWith(1, `/ophthalmology/dashboard?branch_id=${branchId}`, { signal });
    expect(apiClient.request).toHaveBeenNthCalledWith(2, `/ophthalmology/dashboard/refresh?branch_id=${branchId}`, { method: 'POST' });
  });

  it('rejects invalid input and malformed or negative metrics', async () => {
    await expect(ophthalmologyDashboardApi.get({ branch_id: 'bad' })).rejects.toThrow();
    expect(apiClient.request).not.toHaveBeenCalled();
    expect(ophthalmologyDashboardSnapshotSchema.safeParse({ ...snapshot, metrics: { ...snapshot.metrics, waiting: -1 } }).success).toBe(false);
    expect(ophthalmologyDashboardSnapshotSchema.safeParse({ ...snapshot, metrics: { waiting: 0 } }).success).toBe(false);
  });

  it('preserves real zero values and strips uncontracted database fields', () => {
    const parsed = ophthalmologyDashboardSnapshotSchema.parse({ ...snapshot, metrics: Object.fromEntries(Object.keys(snapshot.metrics).map((key) => [key, 0])), _id: branchId, __v: 0 });
    expect(parsed.metrics.waiting).toBe(0);
    expect(parsed).not.toHaveProperty('_id');
    expect(parsed).not.toHaveProperty('__v');
  });
});
