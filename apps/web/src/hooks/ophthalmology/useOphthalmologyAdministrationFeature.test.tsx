import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';
const state = vi.hoisted(() => ({ permissions: [] as AuthPermission[], search: '', queries: new Map<string, unknown[]>(), save: vi.fn(), action: vi.fn() }));
const id = '111111111111111111111111';
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [], branches: [] } }) }));
vi.mock('../../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: '111111111111111111111111' }) }));
vi.mock('../../routing/navigation', () => ({ navigate: vi.fn(), useAppLocation: () => ({ pathname: '/opd/ophthalmology/configuration', search: state.search }) }));
vi.mock('../departments/useDepartments', () => ({ useDepartmentsList: (...args: unknown[]) => { state.queries.set('departments', args); return { data: { data: [] } }; } }));
vi.mock('../users/useUsers', () => ({ useUsersList: (...args: unknown[]) => { state.queries.set('members', args); return { data: { items: [] } }; } }));
vi.mock('../branches/useBranches', () => ({ useBranchesList: (...args: unknown[]) => { state.queries.set('branches', args); return { data: { data: [] } }; } }));
vi.mock('./useOphthalmologyAdministration', () => ({
  useOphthalmologyAdministrationList: (...args: unknown[]) => { state.queries.set('list', args); return { data: { data: [{ id: '222222222222222222222222', branch_id: '999999999999999999999999' }] }, isError: false }; },
  useOphthalmologyAdministrationMutations: () => ({ save: { isPending: false, mutateAsync: state.save }, action: { isPending: false, mutateAsync: state.action } }),
}));
import { useOphthalmologyAdministrationFeature } from './useOphthalmologyAdministrationFeature';
describe('ophthalmology configuration permission and lookup gates', () => {
  let root: Root; let container: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyAdministrationFeature> | undefined;
  function Harness() { feature = useOphthalmologyAdministrationFeature(); return null; }
  const grant = (module: string, screen: string, action = 'View') => state.permissions.push({ code: `${module}.${screen}.${action}`, module, screen, action });
  beforeEach(() => { state.permissions = []; state.search = ''; state.queries.clear(); state.save.mockReset(); state.action.mockReset(); container = document.createElement('div'); root = createRoot(container); document.body.append(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('hides cached administration data and disables requests without Configuration View', async () => {
    await act(async () => root.render(<Harness />)); expect(state.queries.get('list')?.[2]).toBe(false); expect(feature?.rows).toEqual([]);
    expect(state.queries.get('branches')?.[1]).toBe(false); expect(state.queries.get('members')?.[1]).toBe(false);
  });
  it('never assumes Configuration permission includes Users or Departments permission', async () => {
    grant('OPD', 'Ophthalmology Configuration'); grant('OPD', 'Ophthalmology Configuration', 'Create'); state.search = `?tab=stations&edit_id=new&department_id=${id}`;
    await act(async () => root.render(<Harness />)); expect(feature?.modalOpen).toBe(true); expect(feature?.rows).toEqual([]);
    expect(state.queries.get('departments')?.[1]).toBe(false); expect(state.queries.get('members')?.[1]).toBe(false);
  });
  it('loads member lookups only in an open station editor with exact grants and context', async () => {
    grant('OPD', 'Ophthalmology Configuration'); grant('OPD', 'Ophthalmology Configuration', 'Create'); grant('Administration', 'Users'); grant('Administration', 'Departments');
    state.search = '?tab=stations'; await act(async () => root.render(<Harness />)); expect(state.queries.get('members')?.[1]).toBe(false);
    state.search += `&edit_id=new&department_id=${id}`; await act(async () => root.render(<Harness />)); expect(state.queries.get('departments')?.[1]).toBe(true); expect(state.queries.get('members')?.[1]).toBe(true);
  });
  it('requires a separate Branches View grant for the administrator branch lookup', async () => {
    grant('OPD', 'Ophthalmology Configuration'); await act(async () => root.render(<Harness />)); expect(state.queries.get('branches')?.[1]).toBe(false);
    grant('Administration', 'Branches'); await act(async () => root.render(<Harness />)); expect(state.queries.get('branches')?.[1]).toBe(true);
  });
});
