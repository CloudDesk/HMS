import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';
const id = '111111111111111111111111';
const state = vi.hoisted(() => ({ permissions: [] as AuthPermission[], search: '', calls: new Map<string, unknown[]>(), report: { kind: 'task', page: { data: [{ private: 'cached' }], meta: { total: 1 } } } }));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { roles: [], permissions: state.permissions, branches: [{ id: '111111111111111111111111', name: 'QA' }] } }) }));
vi.mock('../../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: '111111111111111111111111' }) }));
vi.mock('../../routing/navigation', () => ({ useAppLocation: () => ({ search: state.search }), navigate: vi.fn() }));
vi.mock('../branches/useBranches', () => ({ useBranchesList: (...args: unknown[]) => { state.calls.set('branches', args); return {}; } }));
vi.mock('./useOphthalmologyAdministration', () => ({ useOphthalmologyAdministrationList: (...args: unknown[]) => { state.calls.set('stations', args); return { data: { data: [] } }; } }));
vi.mock('./useOphthalmologyReports', () => ({ useOphthalmologyReportExport: () => ({ isPending: false, mutateAsync: vi.fn() }), useOphthalmologyReport: (...args: unknown[]) => { state.calls.set('report', args); return { data: state.report, refetch: vi.fn() }; } }));
import { useOphthalmologyReportsFeature } from './useOphthalmologyReportsFeature';
import { navigate } from '../../routing/navigation';
describe('B6 report request and cached-data gates', () => {
  let root: Root; let element: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyReportsFeature>;
  function Harness() { feature = useOphthalmologyReportsFeature(); return null; }
  const grant = (screen: string) => state.permissions.push({ code: screen, module: 'OPD', screen, action: 'View' });
  beforeEach(() => { state.permissions = []; state.search = ''; state.calls.clear(); vi.mocked(navigate).mockClear(); window.history.replaceState({}, '', '/opd/ophthalmology/reports'); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
  it('does not query or expose cached report data without Reports View', async () => { await act(async () => root.render(<Harness />)); expect(state.calls.get('report')?.[2]).toBe(false); expect(feature.report).toBeUndefined(); expect(state.calls.get('stations')?.[2]).toBe(false); feature.setQuery({ page: '2' }); expect(navigate).not.toHaveBeenCalled(); });
  it('validates URLs and never falls back to fetching a different report for invalid type/filter', async () => { grant('Ophthalmology Reports'); for (const search of ['?report_type=UNKNOWN', '?station_id=bad', '?page=-1', '?date_from=bad']) { state.search = search; await act(async () => root.render(<Harness />)); expect(state.calls.get('report')?.[1]).toBeNull(); expect(feature.report).toBeUndefined(); expect(feature.invalid).toBeTruthy(); } });
  it('fetches only the requested server page and lazily gates station lookup by its own View permission', async () => { grant('Ophthalmology Reports'); state.search = `?report_type=REPEAT_UNABLE&page=3&station_lookup=open`; await act(async () => root.render(<Harness />)); expect(state.calls.get('report')).toEqual(['REPEAT_UNABLE', { branch_id: id, page: 3, limit: 20 }, true]); expect(state.calls.get('stations')?.[2]).toBe(false); grant('Ophthalmology Configuration'); await act(async () => root.render(<Harness />)); expect(state.calls.get('stations')?.[2]).toBe(true); });
  it('uses visit volume by default and retains explicit legacy volume only when selected', async () => { grant('Ophthalmology Reports'); state.search = '?report_type=CLINICAL_VOLUME'; await act(async () => root.render(<Harness />)); expect(feature.isVisitVolume).toBe(true); expect(state.calls.get('report')?.[1]).toMatchObject({ volume_basis: 'VISITS' }); state.search = '?report_type=CLINICAL_VOLUME&volume_basis=ORDERED_ENCOUNTERS'; await act(async () => root.render(<Harness />)); expect(feature.isVisitVolume).toBe(false); expect(state.calls.get('report')?.[1]).toMatchObject({ volume_basis: 'ORDERED_ENCOUNTERS' }); state.search = '?report_type=CLINICAL_VOLUME&station_id=111111111111111111111111'; await act(async () => root.render(<Harness />)); expect(feature.query).toBeNull(); expect(feature.invalid).toBeTruthy(); });
  it('updates filters atomically in the URL and retains unrelated order-date context', async () => { grant('Ophthalmology Reports'); window.history.replaceState({}, '', `/opd/ophthalmology/reports?branch_id=${id}&date_from=2026-10-16T00%3A00%3A00Z&page=4`); await act(async () => root.render(<Harness />)); feature.setQuery({ report_type: 'PENDING_REVIEW', page: '1' }); expect(navigate).toHaveBeenCalledWith(expect.stringContaining('date_from=2026-10-16T00%3A00%3A00Z')); expect(navigate).toHaveBeenCalledWith(expect.stringContaining('page=1&report_type=PENDING_REVIEW')); });
});
