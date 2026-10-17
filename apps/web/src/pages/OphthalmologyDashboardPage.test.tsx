import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const branchId = '111111111111111111111111';
const state = vi.hoisted(() => ({ canView: true, canRefresh: false, loading: false, error: null as string | null, snapshot: undefined as undefined | { branchId: string; generatedAt: string; metrics: { waiting: number; in_progress: number; pending_review: number; reviewed: number; repeat_required: number; unable: number } }, refresh: vi.fn(), refetch: vi.fn() }));
vi.mock('../hooks/ophthalmology/useOphthalmologyDashboardFeature', () => ({ useOphthalmologyDashboardFeature: () => ({
  canView: state.canView, canRefresh: state.canRefresh, canReadBranches: false, branchId, query: { branch_id: branchId }, invalid: null,
  branches: [{ id: branchId, name: 'QA' }], branchesQuery: {}, snapshot: state.snapshot,
  total: state.snapshot ? Object.values(state.snapshot.metrics).reduce((sum, value) => sum + value, 0) : null,
  snapshotQuery: { isLoading: state.loading, isError: Boolean(state.error), refetch: state.refetch }, refreshMutation: { isPending: false }, error: state.error,
  setBranch: vi.fn(), refresh: state.refresh,
}) }));
vi.mock('../api/useSettings', () => ({ useTimezone: () => 'UTC', getGlobalDateFormat: () => 'DD/MM/YYYY' }));
import { OphthalmologyDashboardPage } from './OphthalmologyDashboardPage';

describe('C1 Ophthalmology dashboard page', () => {
  let root: Root; let element: HTMLDivElement;
  beforeEach(() => { state.canView = true; state.canRefresh = false; state.loading = false; state.error = null; state.snapshot = undefined; state.refresh.mockReset(); state.refetch.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });

  it('shows a permission state without cached metrics', async () => {
    state.canView = false; state.snapshot = { branchId, generatedAt: '2026-10-17T08:00:00.000Z', metrics: { waiting: 9, in_progress: 0, pending_review: 0, reviewed: 0, repeat_required: 0, unable: 0 } };
    await act(async () => root.render(<OphthalmologyDashboardPage />));
    expect(element.textContent).toContain('View permission is required');
    expect(element.textContent).not.toContain('Waiting');
  });

  it('renders actual zero metrics as a successful empty snapshot', async () => {
    state.snapshot = { branchId, generatedAt: '2026-10-17T08:00:00.000Z', metrics: { waiting: 0, in_progress: 0, pending_review: 0, reviewed: 0, repeat_required: 0, unable: 0 } };
    await act(async () => root.render(<OphthalmologyDashboardPage />));
    expect(element.querySelectorAll('.doc-kpi')).toHaveLength(6);
    expect(element.textContent).toContain('No task activity in this snapshot');
    expect(element.textContent).toContain('not date-filtered or live-streamed');
    expect(element.textContent).not.toContain('Refresh snapshot');
  });

  it('separates read retry from authorized snapshot generation', async () => {
    state.error = 'Snapshot is not ready'; state.canRefresh = true;
    await act(async () => root.render(<OphthalmologyDashboardPage />));
    const retry = [...element.querySelectorAll('button')].find((button) => button.textContent === 'Retry read');
    const generate = [...element.querySelectorAll('button')].find((button) => button.textContent === 'Generate current snapshot');
    await act(async () => retry?.click()); await act(async () => generate?.click());
    expect(state.refetch).toHaveBeenCalledOnce(); expect(state.refresh).toHaveBeenCalledOnce();
  });

  it('labels retained data as possibly stale after a failed refetch', async () => {
    state.error = 'Network unavailable'; state.snapshot = { branchId, generatedAt: '2026-10-17T08:00:00.000Z', metrics: { waiting: 1, in_progress: 2, pending_review: 3, reviewed: 4, repeat_required: 5, unable: 6 } };
    await act(async () => root.render(<OphthalmologyDashboardPage />));
    expect(element.textContent).toContain('displayed snapshot may be stale');
    expect(element.textContent).toContain('21');
  });
});
