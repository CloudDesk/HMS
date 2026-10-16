import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useActiveBranch } from '../../context/BranchContext';
import { navigate, useAppLocation } from '../../routing/navigation';
import { ophthalmologyIdSchema } from '../../api/ophthalmology';
import { configurationTypeSchema, type AdminListParams, type AdminRecord, type AdminResource, type AdminSave } from '../../api/ophthalmology-admin';
import { useDepartmentsList } from '../departments/useDepartments';
import { useUsersList } from '../users/useUsers';
import { useBranchesList } from '../branches/useBranches';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { useOphthalmologyAdministrationList, useOphthalmologyAdministrationMutations } from './useOphthalmologyAdministration';

export function useOphthalmologyAdministrationFeature() {
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const rawBranch = params.get('branch_id') ?? activeBranchId;
  const branchId = ophthalmologyIdSchema.safeParse(rawBranch).success ? rawBranch : '';
  const resource: AdminResource = params.get('tab') === 'stations' ? 'stations' : params.get('tab') === 'workflows' ? 'workflows' : 'masters';
  const positive = (key: string) => { const n = Number(params.get(key) ?? 1); return Number.isSafeInteger(n) && n > 0 ? n : 1; };
  const page = positive('page');
  const parsedType = configurationTypeSchema.safeParse(params.get('type'));
  const status = params.get('status');
  const listParams: AdminListParams = { branch_id: branchId, page, ...(resource === 'masters' && parsedType.success ? { type: parsedType.data } : {}), ...(status === 'DRAFT' || status === 'ACTIVE' || status === 'INACTIVE' ? { status } : {}), ...(params.get('search') ? { search: (params.get('search') ?? '').slice(0, 120) } : {}) };
  const permitted = (module: string, screen: string, action: string) => Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module, screen, action });
  const can = (action: string) => permitted('OPD', 'Ophthalmology Configuration', action);
  const branchPage = positive('branch_page');
  const canBranches = permitted('Administration', 'Branches', 'View');
  const branchQuery = useBranchesList({ page: branchPage, limit: 20, status: 'ACTIVE' }, can('View') && canBranches && !user?.branches.length);
  const list = useOphthalmologyAdministrationList(resource, listParams, can('View') && Boolean(branchId));
  const rows = can('View') ? (list.data?.data ?? []).filter((record) => record.branch_id === branchId) : [];
  const editId = params.get('edit_id') ?? '';
  const [selection, setSelection] = useState<{ scope: string; record: AdminRecord } | null>(null);
  const selected = selection?.scope === `${branchId}:${resource}` && selection.record.id === editId ? selection.record : rows.find((record) => record.id === editId) ?? null;
  const modalOpen = Boolean(editId) && (editId === 'new' ? can('Create') : can('View'));
  const departmentId = resource === 'stations' && selected && 'department_id' in selected ? selected.department_id : params.get('department_id') ?? '';
  const departmentPage = positive('department_page'); const memberPage = positive('member_page');
  const canDepartments = permitted('Administration', 'Departments', 'View');
  const canUsers = permitted('Administration', 'Users', 'View');
  const departments = useDepartmentsList({ branch_id: branchId, status: 'ACTIVE', page: departmentPage, limit: 20 }, modalOpen && resource === 'stations' && canDepartments && Boolean(branchId));
  const members = useUsersList({ branchId, departmentId, status: 'active', page: memberPage, limit: 20, search: (params.get('member_search') ?? '').slice(0, 120) }, modalOpen && resource === 'stations' && canUsers && ophthalmologyIdSchema.safeParse(departmentId).success && Boolean(branchId));
  const mutations = useOphthalmologyAdministrationMutations(branchId);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const scope = `${branchId}:${resource}`;
  const lifecycle = useMemo(() => ({ active: true }), [scope]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const setQuery = (updates: Record<string, string | null>) => {
    if ('edit_id' in updates) setFailure(null);
    const next = new URLSearchParams(search); Object.entries(updates).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    navigate(`/opd/ophthalmology/configuration?${next}`);
  };
  return {
    branchId, resource, page, listParams, list, rows, selected, editId, modalOpen, departmentId, departmentPage, memberPage,
    branches: user?.branches.length ? user.branches : canBranches && can('View') ? branchQuery.data?.data ?? [] : [], branchPage, branchQuery,
    canView: can('View'), canCreate: can('Create'), canEdit: can('Edit'), canDeactivate: can('Deactivate'), canDepartments, canUsers,
    departments, members,
    departmentOptions: canDepartments && modalOpen ? (departments.data?.data ?? []).filter((item) => item.status === 'ACTIVE' && item.isClinical && item.branch_ids.includes(branchId) && (item.code.toUpperCase() === 'OPHTHALMOLOGY' || item.name.toUpperCase() === 'OPHTHALMOLOGY')) : [],
    memberOptions: canUsers && modalOpen ? (members.data?.items ?? []).filter((item) => item.status === 'active' && item.branches.some((branch) => branch.id === branchId) && item.departments.some((department) => department.id === departmentId)) : [],
    error: failure?.scope === scope ? failure.message : null,
    busy: mutations.save.isPending || mutations.action.isPending, setQuery,
    openRecord: (record: AdminRecord) => { if (record.branch_id === branchId && can('View')) { setSelection({ scope, record }); setQuery({ edit_id: record.id }); } },
    save: async (command: AdminSave) => {
      if (!can('View') || list.isError || command.branch_id !== branchId || command.resource !== resource || (command.id ? !can('Edit') : !can('Create'))) return undefined;
      setFailure(null);
      try { const saved = await mutations.save.mutateAsync(command); if (lifecycle.active) { toast.success('Ophthalmology configuration saved.'); setQuery({ edit_id: null }); } return saved; }
      catch (error) { if (lifecycle.active) setFailure({ scope, message: getOpdErrorMessage(error) }); return undefined; }
    },
    action: async (record: AdminRecord, action: 'activate' | 'deactivate', reason: string | null) => {
      if (!can('View') || record.branch_id !== branchId || !can(action === 'activate' ? 'Edit' : 'Deactivate') || list.isError) return false;
      if (action === 'deactivate' && !reason?.trim()) { setFailure({ scope, message: 'A deactivation reason is required.' }); return false; }
      setFailure(null);
      try { await mutations.action.mutateAsync({ resource, id: record.id, action, body: { expected_version: record.version, expected_status: record.status, reason } }); if (lifecycle.active) toast.success(action === 'activate' ? 'Version activated.' : 'Record deactivated.'); return true; }
      catch (error) { if (lifecycle.active) setFailure({ scope, message: getOpdErrorMessage(error) }); return false; }
    },
  };
}
export type OphthalmologyAdministrationFeature = ReturnType<typeof useOphthalmologyAdministrationFeature>;
