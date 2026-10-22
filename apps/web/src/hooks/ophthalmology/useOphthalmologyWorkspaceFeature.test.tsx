import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';

const state = vi.hoisted(() => ({
  save: vi.fn(), update: vi.fn(), escalate: vi.fn(),
  permissions: [] as AuthPermission[], search: '?visit_id=111111111111111111111111',
  queries: new Map<string, unknown[]>(), contextPatient: '222222222222222222222222',
  query: (name: string, args: unknown[]) => {
    state.queries.set(name, args);
    if (name === 'clinical-workspace') return { data: { visit: { id: '111111111111111111111111', patient_id: '222222222222222222222222', branch_id: '333333333333333333333333', department_id: '444444444444444444444444', status: 'IN_CONSULTATION', visit_type: 'NEW_CONSULTATION' }, context: { id: '555555555555555555555555', visit_id: '111111111111111111111111', patient_id: state.contextPatient, branch_id: '333333333333333333333333', department_id: '444444444444444444444444' } }, isError: false, isPending: false, refetch: vi.fn() };
    const data = name === 'visit' ? { id: '111111111111111111111111', patient_id: '222222222222222222222222', branch_id: '333333333333333333333333', department_id: '444444444444444444444444', status: 'IN_CONSULTATION' }
      : name === 'context' ? { id: '555555555555555555555555', visit_id: '111111111111111111111111', patient_id: state.contextPatient, branch_id: '333333333333333333333333', department_id: '444444444444444444444444', doctor_id: '666666666666666666666666', visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OS', workflow_status: 'CHECKED_IN', configuration_version_id: '777777777777777777777777', workflow_profile_version_id: '888888888888888888888888', version: 0 }
      : name === 'intake' ? { intake: null, alerts: [], shared_history: { allergies: 'cached confidential data' } } : { data: [], meta: { page: 1, totalPages: 0 } };
    return { data, isError: false, isLoading: false, isPending: false, refetch: vi.fn() };
  },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [] } }) }));
vi.mock('../../routing/navigation', () => ({ navigate: vi.fn(), useAppLocation: () => ({ pathname: '/opd/ophthalmology', search: state.search }) }));
vi.mock('../opd/useOpd', () => ({ useOpdVisit: (...args: unknown[]) => state.query('visit', args) }));
vi.mock('../patients/usePatients', () => ({ usePatientDocuments: (...args: unknown[]) => state.query('reports', args) }));
vi.mock('./useOphthalmology', () => ({
  useOphthalmologyClinicalWorkspace: (...args: unknown[]) => state.query('clinical-workspace', args),
  useOphthalmologyContext: (...args: unknown[]) => state.query('context', args),
  useOphthalmologyIntake: (...args: unknown[]) => state.query('intake', args),
  useOphthalmologyConfigurations: (...args: unknown[]) => state.query(`configuration-${args[1]}`, args),
  useOphthalmologyWorkflows: (...args: unknown[]) => state.query('workflows', args),
  useOphthalmologyIntakeMutations: () => Object.fromEntries(['create', 'update', 'save', 'complete', 'alert', 'escalate'].map((key) => [key, { isPending: false, mutateAsync: key === 'save' ? state.save : key === 'update' ? state.update : key === 'escalate' ? state.escalate : vi.fn() }])),
}));
import { useOphthalmologyWorkspaceFeature } from './useOphthalmologyWorkspaceFeature';
import { initialIntake } from './intake-form';
import { navigate } from '../../routing/navigation';
describe('ophthalmology workspace permission and scope gates', () => {
  let root: Root;
  let container: HTMLDivElement;
  let feature: ReturnType<typeof useOphthalmologyWorkspaceFeature> | undefined;
  function Harness() { feature = useOphthalmologyWorkspaceFeature(); return null; }
  const grant = (module: string, screen: string, action = 'View') => state.permissions.push({ code: `${module}.${screen}.${action}`, module, screen, action });
  beforeEach(() => { state.save.mockReset(); state.update.mockReset(); vi.mocked(navigate).mockClear(); state.permissions = []; state.queries.clear(); state.contextPatient = '222222222222222222222222'; state.search = '?visit_id=111111111111111111111111'; container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('does not fetch denied records or expose their cached contents', async () => {
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('visit')?.[1]).toBe(false); expect(state.queries.get('context')?.[1]).toBe(false);
    expect(state.queries.get('intake')?.[1]).toBe(false); expect(feature?.intakeView).toBeUndefined(); expect(feature?.context).toBeUndefined();
  });
  it('uses a dedicated clinical header/context without fetching intake or requiring generic Visits View', async () => {
    grant('OPD', 'Ophthalmology Consultation'); await act(async () => root.render(<Harness />));
    expect(feature?.canView).toBe(true); expect(feature?.visit?.id).toBe('111111111111111111111111');
    expect(state.queries.get('clinical-workspace')?.[1]).toBe(true); expect(state.queries.get('visit')?.[1]).toBe(false);
    expect(state.queries.get('intake')?.[1]).toBe(false); expect(feature?.intakeView).toBeUndefined(); expect(feature?.scopeError).toBe(false);
  });
  it('exposes only authorised consultation areas and retains patient/visit scope in area navigation', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake');
    state.search += '&section=intake'; await act(async () => root.render(<Harness />));
    expect(feature?.areas.map((area) => area.id)).toEqual(['patient', 'complaint', 'history']);
    feature?.openArea('acuity'); expect(navigate).not.toHaveBeenCalled();
    grant('OPD', 'Ophthalmology Test Queue'); await act(async () => root.render(<Harness />));
    feature?.openArea('acuity'); expect(navigate).toHaveBeenCalledWith(expect.stringContaining('section=tests&area=acuity'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('visit_id=111111111111111111111111'));
  });
  it('opens specialty treatment directly and resets a previous optical tab', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Consultation');
    state.search += '&care_tab=optical'; await act(async () => root.render(<Harness />));
    feature?.openArea('treatment'); expect(navigate).toHaveBeenCalledWith(expect.stringContaining('care_tab=treatment'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('section=clinical'));
  });
  it('opens specialty readiness from the summary area without retaining an old exception dialog', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Consultation');
    state.search += '&completion_action=override'; await act(async () => root.render(<Harness />));
    feature?.openArea('summary'); expect(navigate).toHaveBeenCalledWith(expect.stringContaining('section=completion'));
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('completion_action'));
  });
  it('does not treat intake editing permission as configuration permission', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Intake', 'Edit');
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('intake')?.[1]).toBe(true); expect(state.queries.get('configuration-COMPLAINT')?.[3]).toBe(false);
    expect(feature?.canConfigure).toBe(false);
  });
  it('gates context editing and loads workflows only when its modal opens', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Configuration');
    await act(async () => root.render(<Harness />)); await feature?.updateContext({ expected_version: 0, affected_eye: 'OD' }); expect(state.update).not.toHaveBeenCalled();
    grant('OPD', 'Ophthalmology Intake', 'Edit'); await act(async () => root.render(<Harness />)); expect(state.queries.get('workflows')?.[3]).toBe(false);
    state.search += '&edit_context=open'; await act(async () => root.render(<Harness />)); expect(state.queries.get('workflows')?.[3]).toBe(true);
    await act(async () => { await feature?.updateContext({ expected_version: 0, affected_eye: 'OD' }); }); expect(state.update).toHaveBeenCalledWith({ expected_version: 0, affected_eye: 'OD' });
  });
  it('rejects another patient context before intake or master requests', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); state.contextPatient = '999999999999999999999999';
    await act(async () => root.render(<Harness />));
    expect(feature?.scopeError).toBe(true); expect(feature?.context).toBeUndefined(); expect(state.queries.get('intake')?.[1]).toBe(false);
  });
  it('fetches reports only when opened with separate patient-document permission', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('Patients', 'Patient Documents');
    await act(async () => root.render(<Harness />)); expect(state.queries.get('reports')?.[2]).toBe(false);
    state.search += '&reports=open&report_page=2'; await act(async () => root.render(<Harness />));
    expect(state.queries.get('reports')).toEqual(['222222222222222222222222', { page: 2, limit: 20 }, true]);
  });
  it('blocks malformed URL identifiers instead of making clinical requests', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); state.search = '?visit_id=invalid&configuration_page=-1';
    await act(async () => root.render(<Harness />)); expect(feature?.visitId).toBe(''); expect(feature?.configurationPage).toBe(1); expect(state.queries.get('visit')).toEqual([null, true]); expect(state.queries.get('context')?.[1]).toBe(false);
  });
  it('retains submitted draft values and exposes a failed save without reporting success', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Intake', 'Edit');
    await act(async () => root.render(<Harness />));
    if (!feature?.context) throw new Error('Expected a scoped context');
    const body = { ...initialIntake(feature.context, null), description: 'Unsaved QA entry' };
    state.save.mockRejectedValueOnce(new Error('The record changed after it was loaded'));
    await act(async () => { await feature?.save(body); });
    expect(feature?.actionError).toBe('The record changed after it was loaded'); expect(body.description).toBe('Unsaved QA entry');
  });
  it('does not apply a late save failure to a different encounter', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Intake', 'Edit');
    await act(async () => root.render(<Harness />));
    if (!feature?.context) throw new Error('Expected a scoped context');
    const body = initialIntake(feature.context, null);
    let rejectSave: (reason: Error) => void = () => { throw new Error('Save has not started'); };
    state.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    let pending: Promise<unknown> | undefined;
    await act(async () => { pending = feature?.save(body); });
    state.search = '?visit_id=999999999999999999999999'; await act(async () => root.render(<Harness />));
    await act(async () => { rejectSave(new Error('Late conflict')); await pending; });
    expect(feature?.actionError).toBeNull(); expect(feature?.context).toBeUndefined(); expect(feature?.intakeView).toBeUndefined();
  });
  it('suppresses a successful context update response after the encounter changes', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Intake', 'Edit');
    await act(async () => root.render(<Harness />));
    let resolveUpdate: (value: unknown) => void = () => { throw new Error('Update not started'); };
    state.update.mockImplementationOnce(() => new Promise((resolve) => { resolveUpdate = resolve; }));
    let pending: Promise<unknown> | undefined;
    await act(async () => { pending = feature?.updateContext({ expected_version: 0, affected_eye: 'OS' }); });
    state.search = '?visit_id=999999999999999999999999'; await act(async () => root.render(<Harness />));
    let returned: unknown;
    await act(async () => { resolveUpdate({ id: '555555555555555555555555' }); returned = await pending; });
    expect(returned).toBeUndefined();
  });
  it('triggers emergency escalation with escalate grant and passes urgency and red-flags', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'Ophthalmology Intake'); grant('OPD', 'Ophthalmology Intake', 'Escalate');
    await act(async () => root.render(<Harness />));
    expect(feature?.canEscalate).toBe(true);
    state.escalate.mockResolvedValueOnce({ id: 'alert-123' });
    let result: unknown;
    await act(async () => {
      result = await feature?.escalate('Suspected acute angle-closure glaucoma', ['CRIT-01'], 'EMERGENCY');
    });
    expect(state.escalate).toHaveBeenCalledWith({
      reason: 'Suspected acute angle-closure glaucoma',
      trigger_findings: ['CRIT-01'],
      urgency: 'EMERGENCY',
    });
    expect(result).toEqual({ id: 'alert-123' });
  });
});
