import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';

const branchId = '111111111111111111111111';
const state = vi.hoisted(() => ({
  permissions: [] as AuthPermission[],
  search: '',
  calls: [] as unknown[][],
  mutate: vi.fn(),
  cached: { branchId: '111111111111111111111111', generatedAt: '2026-10-17T08:00:00.000Z', metrics: { waiting: 1, in_progress: 0, pending_review: 0, reviewed: 0, repeat_required: 0, unable: 0 } },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { roles: [], permissions: state.permissions, branches: [{ id: branchId, name: 'QA' }] } }) }));
vi.mock('../../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: branchId }) }));
vi.mock('../../routing/navigation', () => ({ useAppLocation: () => ({ search: state.search }), navigate: vi.fn() }));
vi.mock('../branches/useBranches', () => ({ useBranchesList: () => ({}) }));
vi.mock('./useOphthalmologyDashboard', () => ({ useOphthalmologyDashboard: (...args: unknown[]) => {
  state.calls.push(args);
  return { snapshot: { data: state.cached, isError: false, isLoading: false }, refresh: { isPending: false, mutateAsync: state.mutate } };
} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { navigate } from '../../routing/navigation';
import { toast } from 'sonner';
import { useOphthalmologyDashboardFeature } from './useOphthalmologyDashboardFeature';

describe('C1 Ophthalmology dashboard feature', () => {
  let root: Root; let element: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyDashboardFeature>;
  function Harness() { feature = useOphthalmologyDashboardFeature(); return null; }
  const grant = (action: string) => state.permissions.push({ code: `reports-${action}`, module: 'OPD', screen: 'Ophthalmology Reports', action });
  beforeEach(() => { state.permissions = []; state.search = ''; state.calls = []; state.mutate.mockReset(); vi.mocked(navigate).mockReset(); vi.mocked(toast.success).mockReset(); vi.mocked(toast.error).mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });

  it('gates requests and cached data with Reports View', async () => {
    await act(async () => root.render(<Harness />));
    expect(state.calls.at(-1)).toEqual([{ branch_id: branchId }, false]);
    expect(feature.snapshot).toBeUndefined();
    feature.setBranch(branchId);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('validates branch URL state and keeps the exact branch in the query key input', async () => {
    grant('View'); state.search = '?branch_id=bad';
    await act(async () => root.render(<Harness />));
    expect(state.calls.at(-1)).toEqual([null, true]);
    expect(feature.invalid).toContain('valid branch');
    expect(feature.snapshot).toBeUndefined();
  });

  it('allows viewing independently and refreshes only with Export permission', async () => {
    grant('View');
    await act(async () => root.render(<Harness />));
    expect(feature.snapshot?.metrics.waiting).toBe(1);
    await act(async () => feature.refresh());
    expect(state.mutate).not.toHaveBeenCalled();
    grant('Export'); state.mutate.mockResolvedValue(state.cached);
    await act(async () => root.render(<Harness />));
    await act(async () => feature.refresh());
    expect(state.mutate).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it('updates only branch URL state without issuing a mutation', async () => {
    grant('View'); state.search = '?unrelated=kept';
    await act(async () => root.render(<Harness />));
    feature.setBranch(branchId);
    expect(navigate).toHaveBeenCalledWith(`/opd/ophthalmology/dashboard?unrelated=kept&branch_id=${branchId}`);
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
