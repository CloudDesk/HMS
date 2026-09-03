import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAppLocation } from '../../routing/navigation';
import { usePasswordPolicy } from '../../auth/usePasswordPolicy';
import { ApiError } from '../../api/api-error';
import { useUsersList, useUserSummary, useCreateUser, useUpdateUser, useUpdateUserStatus, useResetPassword } from './useUsers';
import { useRolesList } from '../roles/useRoles';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import {
  type ApiUserStatus,
  type UserAssignment,
  type UserResponse,
} from '../../api/users';

export type UserStatus = 'Active' | 'Inactive' | 'Locked';
export type SortColumn = 'fullName' | 'role' | 'department' | 'status';
export type SortDirection = 'asc' | 'desc';

export type UiUser = {
  apiId: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  roleId: string;
  department: string;
  departmentId: string;
  branch: string;
  branchId: string;
  status: UserStatus;
  lastLogin: string;
  password: string;
  addedThisMonth: boolean;
  source: UserResponse;
};

const apiStatusByUiStatus = {
  Active: 'active',
  Inactive: 'inactive',
  Locked: 'locked',
} satisfies Record<UserStatus, ApiUserStatus>;

const uiStatusByApiStatus = {
  active: 'Active',
  inactive: 'Inactive',
  locked: 'Locked',
} satisfies Record<ApiUserStatus, UserStatus>;

const apiSortByColumn: Partial<
  Record<SortColumn, 'fullName' | 'username' | 'email' | 'employeeCode' | 'status' | 'createdAt' | 'lastLoginAt'>
> = {
  fullName: 'fullName',
  status: 'status',
};

const getPrimaryAssignment = (assignments: UserAssignment[]) =>
  assignments.find((assignment) => assignment.isPrimary) ?? assignments[0] ?? null;

const formatDateTime = (value: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
};

const isAddedThisMonth = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

const mapUser = (user: UserResponse): UiUser => {
  const branch = getPrimaryAssignment(user.branches);
  const department = getPrimaryAssignment(user.departments);
  const role = user.roles[0]?.name || 'Unassigned';

  return {
    apiId: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email ?? '',
    phone: user.phone ?? '',
    role,
    roleId: user.roles[0]?.id ?? '',
    department: department?.name || department?.id || 'Unassigned',
    departmentId: department?.id ?? '',
    branch: branch?.name || branch?.id || 'Unassigned',
    branchId: branch?.id ?? '',
    status: uiStatusByApiStatus[user.status],
    lastLogin: formatDateTime(user.lastLoginAt),
    password: 'Protected',
    addedThisMonth: isAddedThisMonth(user.createdAt),
    source: user,
  };
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'PASSWORD_POLICY_FAILED' && Array.isArray(error.details)) {
      const messages = error.details.filter((detail): detail is string => typeof detail === 'string');
      if (messages.length > 0) return `${messages.join('. ')}.`;
    }
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage users.';
    if (error.status === 404) return 'The selected user could not be found.';
    if (error.status >= 500) return 'The user service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the user request.';
};

export function useUserManagementFeature() {
  const { user: authenticatedUser } = useAuth();
  const { search: locationSearch } = useAppLocation();

  const isSuperAdmin = Boolean(authenticatedUser?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => isSuperAdmin || hasPermission(
    authenticatedUser?.permissions ?? [],
    { module: 'Administration', screen: 'Users', action },
  );

  const canView = can('View');
  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canDelete = can('Delete');
  const canExport = can('Export');
  const canChangePassword = can('ChangePassword');
  const canResetPassword = can('ResetPassword');

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const apiSortBy = sortColumn ? apiSortByColumn[sortColumn] : undefined;

  const usersListQuery = useUsersList({
    branchId: branchFilter || undefined,
    departmentId: departmentFilter || undefined,
    limit: pageSize,
    page: currentPage,
    search: query.trim() || undefined,
    sortBy: apiSortBy,
    sortOrder: apiSortBy ? sortDirection : undefined,
    status: statusFilter ? apiStatusByUiStatus[statusFilter as UserStatus] : undefined,
    roleId: roleFilter || undefined,
  }, canView);

  const usersSummaryQuery = useUserSummary(canView);

  const rolesQuery = useRolesList({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
  const branchesQuery = useBranchesList({ limit: 100, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, canView);
  const departmentsQuery = useDepartmentsList({ limit: 100, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }, canView);
  
  const passwordPolicyQuery = usePasswordPolicy({ enabled: canView });

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const updateStatusMutation = useUpdateUserStatus();
  const resetPasswordMutation = useResetPassword();

  const handleSort = (column: SortColumn) => {
    setSortColumn((currentColumn) => {
      if (currentColumn === column) {
        setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
        return currentColumn;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setQuery('');
    setRoleFilter('');
    setDepartmentFilter('');
    setBranchFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const isFetching = usersListQuery.isFetching || rolesQuery.isFetching || branchesQuery.isFetching || departmentsQuery.isFetching || passwordPolicyQuery.isFetching;
  
  const error = usersListQuery.error || rolesQuery.error || branchesQuery.error || departmentsQuery.error || passwordPolicyQuery.error;
  const loadError = error ? getErrorMessage(error) : '';
  const forbidden = error instanceof ApiError && error.status === 403;

  const users = useMemo(() => usersListQuery.data?.items.map(mapUser) ?? [], [usersListQuery.data]);

  const filteredUsers = useMemo(() => {
    if (!sortColumn || apiSortByColumn[sortColumn]) return users;

    return [...users].sort((a, b) => {
      const left = String(a[sortColumn]).toLowerCase();
      const right = String(b[sortColumn]).toLowerCase();
      if (left < right) return sortDirection === 'asc' ? -1 : 1;
      if (left > right) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortColumn, sortDirection, users]);

  return {
    state: {
      query, setQuery,
      roleFilter, setRoleFilter,
      departmentFilter, setDepartmentFilter,
      branchFilter, setBranchFilter,
      statusFilter, setStatusFilter,
      sortColumn, sortDirection,
      currentPage, setCurrentPage,
      pageSize, setPageSize,
    },
    data: {
      users: filteredUsers,
      meta: usersListQuery.data?.meta ?? { limit: pageSize, page: currentPage, total: 0, totalPages: 1 },
      summary: usersSummaryQuery.data ?? { total: 0, active: 0, inactive: 0, locked: 0, addedThisMonth: 0 },
      roleOptions: (rolesQuery.data?.items ?? []).filter((role) => role.status === 'active'),
      branchOptions: branchesQuery.data?.data ?? [],
      departmentOptions: departmentsQuery.data?.data ?? [],
      passwordPolicy: passwordPolicyQuery.data ?? null,
    },
    status: {
      isFetching,
      loadError,
      forbidden,
      isMutating: createUserMutation.isPending || updateUserMutation.isPending || updateStatusMutation.isPending || resetPasswordMutation.isPending,
    },
    rbac: {
      canCreate, canEdit, canDelete, canExport, canChangePassword, canResetPassword
    },
    actions: {
      handleSort,
      resetFilters,
      locationSearch,
    },
    mutations: {
      createUser: createUserMutation,
      updateUser: updateUserMutation,
      updateStatus: updateStatusMutation,
      resetPassword: resetPasswordMutation,
    }
  };
}
