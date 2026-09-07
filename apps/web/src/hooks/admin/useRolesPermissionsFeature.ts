import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { ApiError } from '../../api/api-error';
import {
  type ApiRoleStatus,
  type ApiRoleType,
  type RoleListResponse,
} from '../../api/roles';
import { type PermissionResponse } from '../../api/permissions';
import {
  useRolesList,
  useRoleStats,
  useRoleDetails,
  useRoleAuditLogs,
  useCreateRole,
  useUpdateRole,
  useUpdateRoleStatus,
  useAssignUserToRole,
  useRemoveUserFromRole,
  useDeleteRole,
  getRoleErrorMessage,
} from '../roles/useRoles';
import {
  getPermissionErrorMessage,
  useAllPermissions,
  useRolePermissions,
  useReplaceRolePermissions,
} from '../permissions/usePermissions';
import { useUsersList } from '../users/useUsers';

const rolePageSize = 100;

type RoleStats = {
  total: number;
  active: number;
  system: number;
  custom: number;
};

const emptyRoleMeta: RoleListResponse['meta'] = { limit: rolePageSize, page: 1, total: 0, totalPages: 1 };
const emptyRoleStats: RoleStats = { active: 0, custom: 0, system: 0, total: 0 };

export type PermissionRow = {
  id: string;
  module: string;
  screen: string;
  icon: string;
  permissions: Record<string, PermissionResponse>;
};

const preferredActionOrder = [
  'View',
  'Create',
  'Edit',
  'ChangePassword',
  'ResetPassword',
  'Assign',
  'Approve',
  'Cancel',
  'Print',
  'Export',
  'Delete',
];

const moduleIcons: Record<string, string> = {
  Administration: 'ph-gear',
  Appointments: 'ph-calendar-blank',
  Billing: 'ph-receipt',
  Dashboard: 'ph-house',
  Emergency: 'ph-first-aid',
  Imaging: 'ph-image-square',
  Inventory: 'ph-package',
  Laboratory: 'ph-flask',
  OPD: 'ph-stethoscope',
  Patients: 'ph-users',
  Pharmacy: 'ph-pill',
  Reports: 'ph-chart-bar',
};

export function useRolesPermissionsFeature(modalMode: string | null) {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canRole = useCallback((action: string) => isSuperAdmin || hasPermission(
    user?.permissions ?? [], { module: 'Administration', screen: 'Roles', action },
  ), [isSuperAdmin, user?.permissions]);
  
  const canPermission = useCallback((action: string) => isSuperAdmin || hasPermission(
    user?.permissions ?? [], { module: 'Administration', screen: 'Permissions', action },
  ), [isSuperAdmin, user?.permissions]);
  const canViewUsers = isSuperAdmin || hasPermission(
    user?.permissions ?? [], { module: 'Administration', screen: 'Users', action: 'View' },
  );

  const canCreateRole = canRole('Create');
  const canEditRole = canRole('Edit');
  const canAssignRole = canRole('Assign');
  const canAssignUser = canAssignRole && canViewUsers;
  const canDeleteRole = canRole('Delete');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ApiRoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ApiRoleStatus | ''>('');
  const [rolePage, setRolePage] = useState(1);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const listParams = useMemo(() => ({
    limit: rolePageSize,
    page: rolePage,
    search: search.trim() || undefined,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  }), [rolePage, search, statusFilter, typeFilter]);

  const rolesQuery = useRolesList(listParams);
  const roleStatsQuery = useRoleStats();
  const allPermissionsQuery = useAllPermissions();
  const roleDetailsQuery = useRoleDetails(selectedRoleId);
  const rolePermissionsQuery = useRolePermissions(selectedRoleId);
  const roleAuditLogsQuery = useRoleAuditLogs(modalMode === 'audit' ? selectedRoleId : null);

  const usersListQuery = useUsersList({
    limit: 100,
    page: 1,
    sortBy: 'fullName',
    sortOrder: 'asc',
    status: 'active',
  }, modalMode === 'assign-user' && canAssignUser);

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const updateRoleStatusMutation = useUpdateRoleStatus();
  const assignUserMutation = useAssignUserToRole();
  const removeUserMutation = useRemoveUserFromRole();
  const deleteRoleMutation = useDeleteRole();
  const replacePermissionsMutation = useReplaceRolePermissions();

  const roles = rolesQuery.data?.items ?? [];
  const roleMeta = rolesQuery.data?.meta ?? emptyRoleMeta;
  const roleStats = roleStatsQuery.data ?? emptyRoleStats;
  const permissions = allPermissionsQuery.data?.items ?? [];
  const selectedRole = roleDetailsQuery.data ?? null;

  const permissionActions = useMemo(() => {
    const actions = [...new Set(permissions.map((permission) => permission.action))];
    return actions.sort((left, right) => {
      const leftIndex = preferredActionOrder.indexOf(left);
      const rightIndex = preferredActionOrder.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [permissions]);

  const permissionRows = useMemo(() => {
    const rows = new Map<string, PermissionRow>();

    permissions.forEach((permission) => {
      const id = `${permission.module}::${permission.screen}`;
      const row = rows.get(id) ?? {
        icon: moduleIcons[permission.module] ?? 'ph-shield-check',
        id,
        module: permission.module,
        permissions: {},
        screen: permission.screen,
      };
      row.permissions[permission.action] = permission;
      rows.set(id, row);
    });

    return [...rows.values()].sort((left, right) =>
      `${left.module}:${left.screen}`.localeCompare(`${right.module}:${right.screen}`),
    );
  }, [permissions]);

  const isMutating = 
    createRoleMutation.isPending || 
    updateRoleMutation.isPending || 
    updateRoleStatusMutation.isPending || 
    assignUserMutation.isPending || 
    removeUserMutation.isPending || 
    deleteRoleMutation.isPending;

  const loadError = rolesQuery.error ? getRoleErrorMessage(rolesQuery.error) : '';
  const permissionError = allPermissionsQuery.error ? getPermissionErrorMessage(allPermissionsQuery.error) : roleDetailsQuery.error ? getRoleErrorMessage(roleDetailsQuery.error) : '';
  const forbidden = rolesQuery.error instanceof ApiError && rolesQuery.error.status === 403;

  const canEditPermissions = Boolean(
    canPermission('Assign') && selectedRole && selectedRole.code !== 'SUPER_ADMIN' && !forbidden && !roleDetailsQuery.isFetching && !replacePermissionsMutation.isPending,
  );

  const refreshRolesAndPermissions = useCallback(async () => {
    void rolesQuery.refetch();
    void roleStatsQuery.refetch();
    void allPermissionsQuery.refetch();
    if (selectedRoleId) {
      void roleDetailsQuery.refetch();
      void rolePermissionsQuery.refetch();
    }
  }, [rolesQuery, roleStatsQuery, allPermissionsQuery, roleDetailsQuery, rolePermissionsQuery, selectedRoleId]);

  const isFetching = rolesQuery.isFetching || roleStatsQuery.isFetching || allPermissionsQuery.isFetching || roleDetailsQuery.isFetching || rolePermissionsQuery.isFetching;

  return {
    state: {
      search,
      typeFilter,
      statusFilter,
      rolePage,
      selectedRoleId,
      setSearch,
      setTypeFilter,
      setStatusFilter,
      setRolePage,
      setSelectedRoleId,
    },
    data: {
      roles,
      roleMeta,
      roleStats,
      permissions,
      selectedRole,
      rolePermissions: rolePermissionsQuery.data?.items ?? [],
      roleAuditLogs: roleAuditLogsQuery.data?.items ?? [],
      usersList: usersListQuery.data?.items ?? [],
      permissionActions,
      permissionRows,
    },
    status: {
      isFetching,
      isMutating,
      loadError,
      permissionError,
      forbidden,
      rolesLoading: rolesQuery.isFetching,
      statsLoading: roleStatsQuery.isFetching,
      permissionsLoading: allPermissionsQuery.isFetching,
      roleLoading: roleDetailsQuery.isFetching || rolePermissionsQuery.isFetching,
      auditLoading: roleAuditLogsQuery.isFetching,
    },
    rbac: {
      canCreateRole,
      canEditRole,
      canAssignRole,
      canAssignUser,
      canDeleteRole,
      canEditPermissions,
    },
    actions: {
      refreshRolesAndPermissions,
    },
    mutations: {
      createRole: createRoleMutation,
      updateRole: updateRoleMutation,
      updateRoleStatus: updateRoleStatusMutation,
      assignUser: assignUserMutation,
      removeUser: removeUserMutation,
      deleteRole: deleteRoleMutation,
      replacePermissions: replacePermissionsMutation,
    },
  };
}
