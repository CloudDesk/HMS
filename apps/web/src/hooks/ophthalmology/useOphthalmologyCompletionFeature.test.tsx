import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';
const state = vi.hoisted(() => ({
  permissions: [] as AuthPermission[], search: '?section=completion', history: null as unknown, historyError: false, contextError: false, readinessReady: false, visitStatus: 'IN_CONSULTATION', mutation: vi.fn(),
  queries: new Map<string, unknown[]>(), query: (name: string, args: unknown[]) => {
    state.queries.set(name, args);
    const scope = { context_id: '555555555555555555555555', visit_id: '111111111111111111111111', patient_id: '222222222222222222222222', branch_id: '333333333333333333333333', department_id: '444444444444444444444444' };
    const data = name === 'history' ? state.history : name === 'readiness' ? { ready: state.readinessReady, context_version: 1, consultation_version: 2, clinical_review_version: 3, optical_prescription_version: null, configuration_version_id: '666666666666666666666666', configuration_revision: 1, requirements: [{ code: 'ALL_RESULTS_RESOLVED', satisfied: state.readinessReady, details: 'Review', resource_ids: state.readinessReady ? [] : ['777777777777777777777777'] }] }
      : name === 'summary' ? { finalization: state.history, summary: { context: { id: scope.context_id, visit_id: scope.visit_id, patient_id: scope.patient_id, branch_id: scope.branch_id, department_id: scope.department_id, workflow_status: 'CLINICAL_REVIEW', version: 1 }, consultation: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: 'COMPLETED', version: 2, assessment: 'Stable', diagnoses: [], treatment_plan: 'Observe', doctor_notes: null, completed_at: null }, clinical_review: { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', status: 'COMPLETED', version: 3, current_clinical_version: 1, current: { clinical_version: 1, clinical_summary: 'Stable', treatment_plans: [], follow_up_decision: 'NO_FOLLOW_UP', patient_instructions: null, created_by: '888888888888888888888888', created_at: '2026-10-17T00:00:00Z' } }, optical_prescription: null, test_tasks: [], test_results: [] } }
      : name === 'tasks' ? { data: [{ ...scope, id: '777777777777777777777777', status: 'DRAFT', test_name: 'QA', laterality: 'OD' }], meta: { totalPages: 1 } }
        : name === 'doctors' ? { data: [{ id: '888888888888888888888888', branch_id: scope.branch_id, department_id: scope.department_id, status: 'ACTIVE', display_name: 'QA doctor' }], meta: { totalPages: 1 } } : null;
    const isError = name === 'history' && state.historyError;
    return { data, isError, isSuccess: !isError, isLoading: false, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [] } }) }));
vi.mock('../../routing/navigation', () => ({ navigate: vi.fn(), useAppLocation: () => ({ search: state.search }) }));
vi.mock('../doctors/useDoctors', () => ({ useDoctorsList: (...args: unknown[]) => state.query('doctors', args) }));
vi.mock('../opd/useOpd', () => ({ useOpdClinicalOrder: (...args: unknown[]) => state.query(`order-${args[1]}`, args) }));
vi.mock('./useOphthalmology', () => ({ useOphthalmologyTasks: (...args: unknown[]) => state.query('tasks', args) }));
vi.mock('./useOphthalmologyCompletion', () => ({ useOphthalmologyReadiness: (...args: unknown[]) => state.query('readiness', args), useOphthalmologyCompletionHistory: (...args: unknown[]) => state.query('history', args), useOphthalmologyCompletionSummary: (...args: unknown[]) => state.query('summary', args), useOphthalmologyCompletionMutations: () => Object.fromEntries(['defer', 'override', 'complete', 'reopen', 'consultation', 'clinical', 'optical', 'approveOptical'].map((key) => [key, { isPending: false, mutateAsync: state.mutation }])) }));
import { useOphthalmologyCompletionFeature, type CompletionWorkspace } from './useOphthalmologyCompletionFeature';
describe('B5 scoped metadata and authorized exception gates', () => {
  let root: Root; let container: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyCompletionFeature>;
  const grant = (module: string, screen: string, action = 'View') => state.permissions.push({ module, screen, action, code: `${screen}.${action}` });
  const workspace = (): CompletionWorkspace => ({ visitId: '111111111111111111111111', visit: { patient_id: '222222222222222222222222', branch_id: '333333333333333333333333', department_id: '444444444444444444444444', status: state.visitStatus as 'IN_CONSULTATION' | 'COMPLETED' }, context: { id: '555555555555555555555555', version: 1, configuration_version_id: '666666666666666666666666', workflow_status: 'CLINICAL_REVIEW' }, canView: true, scopeError: false, visitQuery: { isError: false }, contextQuery: { isError: state.contextError, refetch: vi.fn() } });
  const head = () => ({ id: '999999999999999999999999', context_id: workspace().context?.id, visit_id: workspace().visitId, ...workspace().visit, status: 'OPEN', version: 2, deferrals: [], overrides: [], completions: [], amendment_episodes: [] });
  function Harness() { feature = useOphthalmologyCompletionFeature(workspace()); return null; }
  beforeEach(() => { state.search = '?section=completion'; state.permissions = []; state.history = null; state.historyError = false; state.contextError = false; state.readinessReady = false; state.visitStatus = 'IN_CONSULTATION'; state.mutation.mockReset(); state.queries.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('does not request denied records or modal-only lookups', async () => {
    await act(async () => root.render(<Harness />)); expect(feature.history).toBeNull(); expect(feature.readiness).toBeUndefined(); expect(state.queries.get('history')?.[1]).toBe(false); expect(state.queries.get('doctors')?.[1]).toBe(false);
    grant('OPD', 'Ophthalmology Consultation'); await act(async () => root.render(<Harness />)); expect(state.queries.get('history')?.[1]).toBe(true); expect(state.queries.get('doctors')?.[1]).toBe(false); expect(feature.finalizationVersion).toBe(0);
  });
  it('requires fresh history and context before using the version-zero head', async () => {
    grant('OPD', 'Ophthalmology Consultation'); state.historyError = true; await act(async () => root.render(<Harness />)); expect(feature.writable).toBe(false);
    state.historyError = false; state.contextError = true; await act(async () => root.render(<Harness />)); expect(feature.writable).toBe(false); expect(feature.active).toBe(true); expect(state.queries.get('readiness')?.[1]).toBe(false);
  });
  it('rejects another patient finalization and never enables exception actions on a completed head', async () => {
    grant('OPD', 'Ophthalmology Consultation'); state.history = { ...head(), patient_id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }; await act(async () => root.render(<Harness />)); expect(feature.scopeError).toBe(true); expect(feature.history).toBeNull(); expect(feature.writable).toBe(false);
    state.history = { ...head(), status: 'COMPLETED' }; await act(async () => root.render(<Harness />)); expect(feature.writable).toBe(false);
  });
  it('requires a full unchanged unmet-code set and suppresses duplicate/late override responses', async () => {
    grant('OPD', 'Ophthalmology Consultation'); grant('OPD', 'Ophthalmology Consultation', 'Override'); state.search += '&completion_action=override'; await act(async () => root.render(<Harness />));
    await feature.override({ expected_version: 0, expected_unmet_codes: ['DIAGNOSIS_RECORDED'], reason: 'QA' }); expect(state.mutation).not.toHaveBeenCalled();
    let resolve: (value: unknown) => void = () => {}; state.mutation.mockImplementation(() => new Promise((done) => { resolve = done; })); const body = { expected_version: 0, expected_unmet_codes: ['ALL_RESULTS_RESOLVED' as const], reason: 'QA' };
    let pending: ReturnType<typeof feature.override> | undefined; await act(async () => { pending = feature.override(body); await feature.override(body); }); expect(state.mutation).toHaveBeenCalledTimes(1);
    state.search = '?section=completion'; await act(async () => root.render(<Harness />)); await act(async () => resolve(head())); expect(await pending).toBeUndefined(); expect(feature.error).toBeNull();
  });
  it('allows only actual scoped source/doctor pairs for deferral', async () => {
    grant('OPD', 'Ophthalmology Consultation'); grant('OPD', 'Ophthalmology Consultation', 'Override'); grant('OPD', 'Ophthalmology Test Queue'); grant('Doctors', 'Doctor Directory'); state.search += '&completion_action=defer'; await act(async () => root.render(<Harness />));
    expect(state.queries.get('doctors')?.[1]).toBe(true); const body = { expected_version: 0, source_type: 'TEST_TASK' as const, source_id: '777777777777777777777777', responsible_doctor_id: '888888888888888888888888', reason: 'QA', review_plan: 'Review later' };
    await feature.defer({ ...body, responsible_doctor_id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }); expect(state.mutation).not.toHaveBeenCalled();
    state.mutation.mockRejectedValue(new Error('Conflict: finalization changed')); await act(async () => { await feature.defer(body); }); expect(state.mutation).toHaveBeenCalledWith(body); expect(feature.error).toContain('finalization changed');
  });
  it('allows only a permissioned exact-version completion from the safe summary', async () => {
    grant('OPD', 'Ophthalmology Consultation'); grant('OPD', 'Ophthalmology Consultation', 'Complete'); state.history = head();
    state.readinessReady = true; state.search += '&completion_action=complete'; state.mutation.mockResolvedValue({ ...head(), status: 'COMPLETED', version: 3 });
    await act(async () => root.render(<Harness />)); expect(feature.completionAllowed).toBe(true);
    const body = { expected_version: 2, expected_context_version: 1, expected_consultation_version: 2,
      expected_clinical_review_version: 3, expected_optical_prescription_version: null };
    await act(async () => { await feature.complete(body, 'stable-c4-key'); });
    expect(state.mutation).toHaveBeenCalledWith({ body, key: 'stable-c4-key' });
  });
  it('submits only the open episode and exact authoritative consultation source version', async () => {
    grant('OPD', 'Ophthalmology Consultation'); grant('OPD', 'Ophthalmology Consultation', 'Amend');
    state.visitStatus = 'COMPLETED';
    const episodeId = 'cccccccccccccccccccccccc'; state.history = { ...head(), status: 'AMENDMENT_OPEN',
      amendment_episodes: [{ id: episodeId, source_clinical_version: 1, reason: 'Correction', status: 'OPEN', opened_by: '888888888888888888888888', opened_at: '2026-10-17T00:00:00Z', changes: [] }] };
    state.search += '&completion_action=correct_consultation'; state.mutation.mockResolvedValue({ finalization: state.history, source: {} });
    await act(async () => root.render(<Harness />)); expect(feature.correctionAllowed).toBe(true);
    const body = { expected_version: 2, expected_status: 'AMENDMENT_OPEN' as const, episode_id: episodeId,
      expected_source_version: 2, reason: 'Correct assessment', consultation: { assessment: 'Corrected' } };
    await act(async () => { await feature.correctConsultation(body); }); expect(state.mutation).toHaveBeenCalledWith(body);
  });
});
