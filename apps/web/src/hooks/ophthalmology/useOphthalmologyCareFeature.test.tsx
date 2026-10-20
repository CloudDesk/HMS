import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';
const state = vi.hoisted(() => ({
  permissions: [] as AuthPermission[], search: '?section=clinical&care_tab=treatment', patient: '222222222222222222222222', resultEye: 'OD', save: vi.fn(),
  queries: new Map<string, unknown[]>(), query: (name: string, args: unknown[]) => {
    state.queries.set(name, args);
    const scope = { id: '555555555555555555555555', visit_id: '111111111111111111111111', context_id: '555555555555555555555555', patient_id: state.patient, branch_id: '333333333333333333333333', department_id: '444444444444444444444444' };
    const data = name === 'clinical' ? { ...scope, status: 'DRAFT', version: 3 }
      : name === 'optical' ? { ...scope, status: 'DRAFT', version: 5 }
        : name === 'consultation' ? { ...scope, diagnoses: [{ code: 'QA', display: 'QA diagnosis', codingSystem: 'QA', type: 'PRIMARY', laterality: 'OS', status: 'SUSPECTED' }] }
          : name === 'configuration' ? { data: [{ id: '666666666666666666666666', branch_id: scope.branch_id, status: 'ACTIVE', name: 'QA configuration', values: { lens_types: ['QA_LENS'] } }] } : name === 'task' ? { ...scope, id: '777777777777777777777777', laterality: 'OD', status: 'COMPLETED', version: 4 } : name === 'result' ? { ...scope, id: '888888888888888888888888', task_id: '777777777777777777777777', current: { laterality: state.resultEye }, current_clinical_version: 2, version: 3, status: 'COMPLETED' } : { data: [], meta: { totalPages: 0 } };
    return { data, isError: false, isFetching: false, isSuccess: true, isLoading: false, refetch: vi.fn() };
  },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [] } }) }));
vi.mock('../../routing/navigation', () => ({ navigate: vi.fn(), useAppLocation: () => ({ search: state.search }) }));
vi.mock('../opd/useOpd', () => ({ useOpdConsultation: (...args: unknown[]) => state.query('consultation', args) }));
vi.mock('./useOphthalmology', () => ({ useOphthalmologyClinicalConfiguration: (...args: unknown[]) => { const query = state.query('configuration', args); const result = state.query('configuration', args).data; return { ...query, data: result && 'data' in result ? result.data?.[0] : undefined }; }, useOphthalmologyTasks: (...args: unknown[]) => state.query('tasks', args), useOphthalmologyResult: (...args: unknown[]) => state.query('result', args) }));
vi.mock('./useOphthalmologyQueue', () => ({ useOphthalmologyQueueTask: (...args: unknown[]) => state.query('task', args) }));
vi.mock('./useOphthalmologyCare', () => ({
  useOphthalmologyClinicalReview: (...args: unknown[]) => state.query('clinical', args), useOphthalmologyOpticalPrescription: (...args: unknown[]) => state.query('optical', args),
  useOphthalmologyCareMutations: () => Object.fromEntries(['clinical', 'optical', 'approve', 'review'].map((key) => [key, { isPending: false, mutateAsync: state.save }])),
}));
import { useOphthalmologyCareFeature, type CareWorkspace } from './useOphthalmologyCareFeature';

describe('B4 independent permissions, scoped queries and actions', () => {
  let root: Root; let container: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyCareFeature>;
  const workspace = (): CareWorkspace => ({ visitId: '111111111111111111111111', visit: { patient_id: '222222222222222222222222', branch_id: '333333333333333333333333', department_id: '444444444444444444444444', status: 'IN_CONSULTATION' }, context: { id: '555555555555555555555555', configuration_version_id: '666666666666666666666666', workflow_status: 'UNDER_CONSULTATION' }, canView: true, scopeError: false, visitQuery: { isError: false }, contextQuery: { isError: false }, configurationPage: 1, setQuery: vi.fn() });
  const grant = (screen: string, action = 'View') => state.permissions.push({ module: 'OPD', screen, action, code: `${screen}.${action}` });
  function Harness() { feature = useOphthalmologyCareFeature(workspace()); return null; }
  beforeEach(() => { state.search = '?section=clinical&care_tab=treatment'; state.permissions = []; state.patient = '222222222222222222222222'; state.resultEye = 'OD'; state.queries.clear(); state.save.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('does not fetch or expose denied cached clinical or optical records', async () => {
    await act(async () => root.render(<Harness />)); expect(feature.clinical).toBeNull(); expect(feature.optical).toBeNull(); expect(feature.canSaveClinical).toBe(false); expect(state.queries.get('clinical')?.[1]).toBe(false); expect(state.queries.get('optical')?.[1]).toBe(false);
  });
  it('keeps optical access independent of consultation permission and approval independent of editing', async () => {
    state.search = '?section=clinical&care_tab=optical'; grant('Ophthalmology Consultation'); grant('Ophthalmology Consultation', 'Diagnose'); await act(async () => root.render(<Harness />)); expect(feature.canOptical).toBe(false); expect(state.queries.get('optical')?.[1]).toBe(false);
    state.permissions = []; grant('Ophthalmology Optical Prescription'); grant('Ophthalmology Optical Prescription', 'Approve'); await act(async () => root.render(<Harness />)); expect(feature.canClinical).toBe(false); expect(feature.canApproveOptical).toBe(true); expect(feature.canSaveOptical).toBe(false); expect(state.queries.get('clinical')?.[1]).toBe(false);
  });
  it('requires configured optical choices before editing and never substitutes a different profile', async () => {
    state.search = '?section=clinical&care_tab=optical'; grant('Ophthalmology Optical Prescription'); grant('Ophthalmology Optical Prescription', 'Edit'); await act(async () => root.render(<Harness />)); expect(feature.canSaveOptical).toBe(true); expect(feature.canConfigure).toBe(false);
    grant('Ophthalmology Configuration'); await act(async () => root.render(<Harness />)); expect(feature.canSaveOptical).toBe(true); expect(feature.lensTypes).toEqual(['QA_LENS']); expect(feature.materials).toBeNull();
  });
  it('rejects another patient’s clinical data and blocks diagnosis-based treatment editing', async () => {
    grant('Ophthalmology Consultation'); grant('Ophthalmology Consultation', 'Diagnose'); grant('OPD Consultation'); state.patient = '999999999999999999999999'; await act(async () => root.render(<Harness />));
    expect(feature.scopeError).toBe(true); expect(feature.clinical).toBeNull(); expect(feature.diagnoses).toEqual([]); expect(feature.canSaveClinical).toBe(false);
  });
  it('requires the task eye to match the selected result and an exact reviewed task response', async () => {
    state.search = '?section=clinical&care_tab=results&review_task_id=777777777777777777777777';
    grant('Ophthalmology Consultation'); grant('Ophthalmology Test Queue'); grant('Ophthalmology Test Review', 'Review');
    await act(async () => root.render(<Harness />)); expect(feature.canReview).toBe(true);
    state.resultEye = 'OS'; await act(async () => root.render(<Harness />)); expect(feature.canReview).toBe(false); expect(feature.scopeError).toBe(true); expect(feature.result).toBeNull();
    state.resultEye = 'OD'; await act(async () => root.render(<Harness />));
    state.save.mockResolvedValue({ id: '999999999999999999999999', context_id: '555555555555555555555555', visit_id: workspace().visitId, patient_id: state.patient, branch_id: workspace().visit?.branch_id, department_id: workspace().visit?.department_id });
    await act(async () => { await feature.reviewResult({ expected_task_version: 4, expected_result_version: 3, expected_clinical_version: 2 }); });
    expect(feature.error).toContain('does not match the selected task');
  });
  it('retains failures and prevents duplicate and late-success actions across care tabs', async () => {
    grant('Ophthalmology Consultation'); grant('Ophthalmology Consultation', 'Diagnose'); grant('OPD Consultation'); await act(async () => root.render(<Harness />));
    expect(feature.canSaveClinical).toBe(true); const body = { expected_version: 3, clinical_summary: 'QA review', treatment_plans: [] };
    state.save.mockRejectedValueOnce(new Error('Clinical review version conflict')); await act(async () => { await feature.saveClinical(body); }); expect(feature.error).toBe('Clinical review version conflict');
    let resolve: (value: unknown) => void = () => {}; state.save.mockImplementation(() => new Promise((done) => { resolve = done; }));
    let pending: ReturnType<typeof feature.saveClinical> | undefined; await act(async () => { pending = feature.saveClinical(body); await feature.saveClinical(body); }); expect(state.save).toHaveBeenCalledTimes(2);
    state.search = '?section=clinical&care_tab=optical'; await act(async () => root.render(<Harness />)); await act(async () => resolve({ id: '555555555555555555555555', context_id: '555555555555555555555555', visit_id: workspace().visitId, patient_id: state.patient, branch_id: workspace().visit?.branch_id, department_id: workspace().visit?.department_id })); expect(await pending).toBeUndefined(); expect(feature.error).toBeNull();
  });
});
