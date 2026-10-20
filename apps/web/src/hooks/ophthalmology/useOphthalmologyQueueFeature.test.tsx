import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';

const state = vi.hoisted(() => ({
  permissions: [] as AuthPermission[], search: '', taskBranch: '333333333333333333333333', version: 2,
  mutation: vi.fn(), queries: new Map<string, unknown[]>(),
  query: (name: string, args: unknown[]) => {
    state.queries.set(name, args);
    const data = name === 'task-workspace' ? { context: { id: '666666666666666666666666' }, visit: { id: '222222222222222222222222', patient_id: '444444444444444444444444', branch_id: '333333333333333333333333', department_id: '555555555555555555555555', status: 'IN_CONSULTATION' } } : name === 'task' ? { id: '111111111111111111111111', visit_id: '222222222222222222222222', patient_id: '444444444444444444444444', branch_id: state.taskBranch, department_id: '555555555555555555555555', context_id: '666666666666666666666666', assigned_user_id: '777777777777777777777777', status: 'PATIENT_WAITING', version: state.version }
      : name === 'visit' ? { id: '222222222222222222222222', patient_id: '444444444444444444444444', branch_id: '333333333333333333333333', department_id: '555555555555555555555555', status: 'IN_CONSULTATION' }
        : { data: [], meta: { totalPages: 0 } };
    return { data, isError: false, isFetching: false, isLoading: false, refetch: vi.fn() };
  },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { id: '777777777777777777777777', roles: [], branches: [], permissions: state.permissions } }) }));
vi.mock('../../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: null }) }));
vi.mock('../../routing/navigation', () => ({ navigate: vi.fn(), useAppLocation: () => ({ search: state.search }) }));
vi.mock('../opd/useOpd', () => ({ useOpdVisit: (...args: unknown[]) => state.query('visit', args), useOpdVisits: (...args: unknown[]) => state.query('visits', args), useOpdClinicalOrder: (...args: unknown[]) => state.query(`order-${args[1]}`, args) }));
vi.mock('../patients/usePatients', () => ({ usePatientDetails: (...args: unknown[]) => state.query('patient', args) }));
vi.mock('../users/useUsers', () => ({ useUsersList: (...args: unknown[]) => state.query('users', args) }));
vi.mock('../branches/useBranches', () => ({ useBranchesList: (...args: unknown[]) => state.query('branches', args) }));
vi.mock('./useOphthalmology', () => ({ useOphthalmologyContext: (...args: unknown[]) => state.query('context', args) }));
vi.mock('./useOphthalmologyAdministration', () => ({ useOphthalmologyAdministrationList: (...args: unknown[]) => state.query(`admin-${args[0]}`, args) }));
vi.mock('./useOphthalmologyQueue', () => ({
  useOphthalmologyTaskWorkspace: (...args: unknown[]) => state.query('task-workspace', args),
  useOphthalmologyQueue: (...args: unknown[]) => state.query('list', args),
  useOphthalmologyQueueTask: (...args: unknown[]) => state.query(args[0] === '111111111111111111111111' ? 'task' : 'next-task', args),
  useOphthalmologyAssignmentStations: (...args: unknown[]) => state.query('assignment-stations', args),
  useOphthalmologyAssignmentMembers: (...args: unknown[]) => state.query('assignment-members', args),
  useOphthalmologyAssignmentStation: (...args: unknown[]) => state.query('station', args),
  useOphthalmologyBoundWorkflow: (...args: unknown[]) => state.query('workflow', args),
  useOphthalmologyQueueMutations: () => ({ create: { mutateAsync: state.mutation, isPending: false }, action: { mutateAsync: state.mutation, isPending: false } }),
}));
import { useOphthalmologyQueueFeature } from './useOphthalmologyQueueFeature';

describe('queue permissions, scope and asynchronous actions', () => {
  let root: Root; let container: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyQueueFeature>;
  function Harness() { feature = useOphthalmologyQueueFeature(); return null; }
  const grant = (screen: string, action = 'View') => state.permissions.push({ module: 'OPD', screen, action, code: `${screen}.${action}` });
  beforeEach(() => { state.search = '?branch_id=333333333333333333333333&task_id=111111111111111111111111'; state.taskBranch = '333333333333333333333333'; state.permissions = []; state.version = 2; state.queries.clear(); state.mutation.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('does not expose cached denied tasks or fetch modal lookups', async () => {
    await act(async () => root.render(<Harness />));
    expect(feature.canView).toBe(false); expect(feature.task).toBeUndefined();
    expect(state.queries.get('task')?.[1]).toBe(false); expect(state.queries.get('assignment-members')?.[2]).toBe(false); expect(state.queries.get('assignment-stations')?.[2]).toBe(false);
  });
  it('loads task-scoped assignment lookups only when the action opens, without Configuration or Users View', async () => {
    grant('Ophthalmology Test Queue'); grant('Ophthalmology Test Queue', 'Reassign');
    await act(async () => root.render(<Harness />)); expect(state.queries.get('assignment-stations')?.[2]).toBe(false);
    state.search += '&action=reassign'; await act(async () => root.render(<Harness />));
    expect(feature.canConfigure).toBe(false); expect(state.queries.get('assignment-stations')?.[2]).toBe(true);
    expect(state.queries.get('users')).toBeUndefined(); expect(state.queries.get('admin-stations')).toBeUndefined();
  });
  it('enables result entry with Queue and OPD Visits View without Intake View', async () => {
    grant('Ophthalmology Test Queue'); grant('OPD Visits'); await act(async () => root.render(<Harness />));
    expect(feature.canReadContext).toBe(false); expect(feature.canEnterResults).toBe(true);
    expect(feature.resultWorkspace.context).toEqual({ id: '666666666666666666666666' });
    expect(state.queries.get('context')?.[1]).toBe(false);
  });
  it('enables result entry from a task-scoped header without generic OPD Visits or Intake permission', async () => { grant('Ophthalmology Test Queue'); await act(async () => root.render(<Harness />)); expect(feature.canVisits).toBe(false); expect(feature.canReadContext).toBe(false); expect(feature.canEnterResults).toBe(true); expect(state.queries.get('visit')?.[1]).toBe(false); expect(state.queries.get('task-workspace')?.[1]).toBe(true); });
  it('rejects another branch before displaying or mutating its task', async () => {
    grant('Ophthalmology Test Queue'); grant('Ophthalmology Test Queue', 'Call'); state.taskBranch = '999999999999999999999999';
    await act(async () => root.render(<Harness />));
    expect(feature.scopeError).toBe(true); expect(feature.task).toBeUndefined(); expect(feature.allowedActions).toEqual([]);
    await feature.actionSubmit({ action: 'call', task_id: '111111111111111111111111', body: { expected_version: 2, expected_status: 'PATIENT_WAITING' } }); expect(state.mutation).not.toHaveBeenCalled();
  });
  it('requires each action grant and blocks malformed filters', async () => {
    grant('Ophthalmology Test Queue'); await act(async () => root.render(<Harness />)); expect(feature.allowedActions).toEqual([]);
    grant('Ophthalmology Test Queue', 'Call'); await act(async () => root.render(<Harness />)); expect(feature.allowedActions.map((action) => action.action)).toEqual(['call']);
    state.search += '&page=-1'; await act(async () => root.render(<Harness />)); expect(feature.invalidFilters).toBe(true); expect(feature.writable).toBe(false); expect(feature.task).toBeUndefined();
  });
  it('suppresses duplicate clicks and discards late success after task navigation', async () => {
    grant('Ophthalmology Test Queue'); grant('Ophthalmology Test Queue', 'Call');
    let resolve: (value: unknown) => void = () => {}; state.mutation.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => root.render(<Harness />));
    const command = { action: 'call' as const, task_id: '111111111111111111111111', body: { expected_version: 2, expected_status: 'PATIENT_WAITING' as const } };
    let pending: ReturnType<typeof feature.actionSubmit>;
    await act(async () => { pending = feature.actionSubmit(command); await feature.actionSubmit(command); }); expect(state.mutation).toHaveBeenCalledTimes(1);
    state.search = '?branch_id=333333333333333333333333'; await act(async () => root.render(<Harness />));
    await act(async () => resolve({ id: command.task_id })); expect(await pending!).toBeUndefined();
  });
});
