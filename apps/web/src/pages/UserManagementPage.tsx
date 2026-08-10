import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  usersApi,
  type ApiUserStatus,
  type SaveUserPayload,
  type UserAssignment,
  type UserListResponse,
  type UserResponse,
} from '../api/users';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

type UserStatus = 'Active' | 'Inactive' | 'Locked';
type SortColumn = 'id' | 'fullName' | 'role' | 'department' | 'status';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view' | 'change-password' | 'reset-password' | 'import' | 'bulk-update';

type UiUser = {
  id: string;
  apiId: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: string;
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

type UserFormState = {
  employeeCode: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  employeeType: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  password: string;
  status: UserStatus;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
};

const statusClass = {
  Active: 'status-active',
  Inactive: 'status-inactive',
  Locked: 'status-locked',
} satisfies Record<UserStatus, string>;

const roleToneClass: Record<string, string> = {
  Doctor: 'role-blue',
  Nurse: 'role-green',
  Receptionist: 'role-purple',
  'Lab Technician': 'role-purple',
  Pharmacist: 'role-orange',
  Radiographer: 'role-purple',
  'Billing Officer': 'role-orange',
  Accountant: 'role-blue',
  Administrator: 'role-orange',
  'Super Admin': 'role-gray',
  Unassigned: 'role-gray',
};

const jobTitleOptions = [
  'Doctor',
  'Nurse',
  'Receptionist',
  'Lab Technician',
  'Pharmacist',
  'Radiographer',
  'Billing Officer',
  'Accountant',
  'Administrator',
  'Super Admin',
];

const statuses: UserStatus[] = ['Active', 'Inactive', 'Locked'];

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
  id: 'employeeCode',
  status: 'status',
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter((part) => !part.endsWith('.'))
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

const getPrimaryAssignment = (assignments: UserAssignment[]) =>
  assignments.find((assignment) => assignment.isPrimary) ?? assignments[0] ?? null;

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
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
  const role = user.jobTitle?.trim() || user.employeeType?.trim() || 'Unassigned';

  return {
    id: user.employeeCode ?? user.id,
    apiId: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email ?? '',
    phone: user.phone ?? '',
    role,
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

const emptyUserForm: UserFormState = {
  employeeCode: '',
  username: '',
  email: '',
  fullName: '',
  phone: '',
  jobTitle: 'Doctor',
  employeeType: '',
  branchId: '',
  branchName: '',
  departmentId: '',
  departmentName: '',
  password: '',
  status: 'Active',
};

const getUserForm = (user: UiUser | null): UserFormState => {
  if (!user) {
    return emptyUserForm;
  }

  return {
    employeeCode: user.source.employeeCode ?? '',
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    jobTitle: user.source.jobTitle ?? user.role,
    employeeType: user.source.employeeType ?? '',
    branchId: user.branchId,
    branchName: user.branch === 'Unassigned' ? '' : user.branch,
    departmentId: user.departmentId,
    departmentName: user.department === 'Unassigned' ? '' : user.department,
    password: '',
    status: user.status,
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      return 'You do not have permission to manage users.';
    }

    if (error.status === 404) {
      return 'The selected user could not be found.';
    }

    if (error.status >= 500) {
      return 'The user service is unavailable. Please try again shortly.';
    }

    return error.message;
  }

  return 'Unable to complete the user request.';
};

function SortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const sorted = sortColumn === column;

  return (
    <th
      className={`sortable${sorted ? ` sorted-${sortDirection}` : ''}`}
      onClick={() => onSort(column)}
      scope="col"
    >
      {label} <i className="ph ph-arrows-down-up sort-icon" aria-hidden="true" />
    </th>
  );
}

function UserStatusChart({ users }: { users: UiUser[] }) {
  const counts = statuses.map((status) => users.filter((user) => user.status === status).length);
  const [activeCount = 0, inactiveCount = 0] = counts;
  const total = Math.max(users.length, 1);
  const activeDeg = (activeCount / total) * 360;
  const inactiveDeg = activeDeg + (inactiveCount / total) * 360;

  return (
    <>
      <div className="um-donut-wrap">
        <div
          aria-label="Users by status"
          className="um-donut"
          role="img"
          style={{
            background: `conic-gradient(#16a34a 0deg ${activeDeg}deg, #ea580c ${activeDeg}deg ${inactiveDeg}deg, #ef4444 ${inactiveDeg}deg 360deg)`,
          }}
        />
      </div>
      <div className="chart-legend-list">
        {statuses.map((status, index) => (
          <div className="cl-item" key={status}>
            <div className="cl-left">
              <div className={`cl-dot cl-dot-${status.toLowerCase()}`} />
              <span>{status}</span>
            </div>
            <span className="cl-count">{counts[index]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function UsersByRole({ users }: { users: UiUser[] }) {
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((user) => counts.set(user.role, (counts.get(user.role) ?? 0) + 1));

    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [users]);
  const maxCount = Math.max(...roleCounts.map(([, count]) => count), 1);

  return (
    <div id="role-bar-list">
      {roleCounts.map(([role, count]) => (
        <div className="role-bar-item" key={role}>
          <div className="role-bar-header">
            <span>{role}</span>
            <span>{count}</span>
          </div>
          <div className="role-bar-track">
            <div className="role-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserManagementPage() {
  const [users, setUsers] = useState<UiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeUser, setActiveUser] = useState<UiUser | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({ currentPassword: '', newPassword: '' });
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [meta, setMeta] = useState<UserListResponse['meta']>({
    limit: pageSize,
    page: currentPage,
    total: 0,
    totalPages: 1,
  });
  const [deleteTarget, setDeleteTarget] = useState<UiUser | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setForbidden(false);

    const apiSortBy = sortColumn ? apiSortByColumn[sortColumn] : undefined;

    try {
      const response = await usersApi.list({
        branchId: branchFilter || undefined,
        departmentId: departmentFilter || undefined,
        limit: pageSize,
        page: currentPage,
        search: query.trim() || undefined,
        sortBy: apiSortBy,
        sortOrder: apiSortBy ? sortDirection : undefined,
        status: statusFilter ? apiStatusByUiStatus[statusFilter as UserStatus] : undefined,
      });

      setUsers(response.items.map(mapUser));
      setMeta(response.meta);
      setSelectedIds(new Set());
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true);
      }

      setUsers([]);
      setMeta({ limit: pageSize, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, currentPage, departmentFilter, pageSize, query, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const departments = useMemo(() => {
    const options = new Map<string, string>();
    users.forEach((user) => {
      if (user.departmentId) {
        options.set(user.departmentId, user.department);
      }
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const branches = useMemo(() => {
    const options = new Map<string, string>();
    users.forEach((user) => {
      if (user.branchId) {
        options.set(user.branchId, user.branch);
      }
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const roleOptions = useMemo(() => {
    const options = new Set([...jobTitleOptions, ...users.map((user) => user.role)]);
    return [...options].filter(Boolean).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const rows = roleFilter ? users.filter((user) => user.role === roleFilter) : users;

    if (!sortColumn || apiSortByColumn[sortColumn]) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const left = String(a[sortColumn]).toLowerCase();
      const right = String(b[sortColumn]).toLowerCase();

      if (left < right) return sortDirection === 'asc' ? -1 : 1;
      if (left > right) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [roleFilter, sortColumn, sortDirection, users]);

  const totalPages = Math.max(meta.totalPages, 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageUsers = filteredUsers;
  const selectedCount = selectedIds.size;
  const pageIds = pageUsers.map((user) => user.apiId);
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const canManage = !forbidden && !loading;

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

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      pageIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const toggleUserSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openModal = (mode: ModalMode, user: UiUser | null = null) => {
    setModalMode(mode);
    setActiveUser(user);
    setFormError('');
    setUserForm(getUserForm(user));
    setPasswordForm({ currentPassword: '', newPassword: '' });
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setModalMode(null);
    setActiveUser(null);
    setFormError('');
  };

  const updateForm = (field: keyof UserFormState, value: string) => {
    setUserForm((current) => ({ ...current, [field]: value }));
  };

  const updatePasswordForm = (field: keyof PasswordFormState, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const assignmentFromForm = (id: string, name: string): UserAssignment[] => [
    {
      id: id.trim(),
      isPrimary: true,
      name: name.trim() || id.trim(),
    },
  ];

  const buildSavePayload = (includePassword: boolean): SaveUserPayload & { password?: string } => ({
    branches: assignmentFromForm(userForm.branchId, userForm.branchName),
    departments: assignmentFromForm(userForm.departmentId, userForm.departmentName),
    email: userForm.email.trim() || null,
    employeeCode: userForm.employeeCode.trim(),
    employeeType: userForm.employeeType.trim() || null,
    fullName: userForm.fullName.trim(),
    jobTitle: userForm.jobTitle.trim() || null,
    password: includePassword ? userForm.password : undefined,
    phone: userForm.phone.trim() || null,
    profilePhotoUrl: null,
    status: apiStatusByUiStatus[userForm.status],
    username: userForm.username.trim(),
  });

  const validateUserForm = (includePassword: boolean) => {
    if (!userForm.employeeCode.trim()) return 'Employee code is required.';
    if (!userForm.username.trim()) return 'Username is required.';
    if (!userForm.fullName.trim()) return 'Full name is required.';
    if (!userForm.branchId.trim()) return 'Branch assignment is required.';
    if (!userForm.departmentId.trim()) return 'Department assignment is required.';
    if (includePassword && !userForm.password) return 'Password is required.';
    return '';
  };

  const handleSaveUser = async (event: FormEvent) => {
    event.preventDefault();
    const creating = modalMode === 'create';
    const validationError = validateUserForm(creating);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!creating && !activeUser) {
      setFormError('Select a user before saving.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (creating) {
        await usersApi.create(buildSavePayload(true) as SaveUserPayload & { password: string });
        showToast('User created successfully.');
      } else if (activeUser) {
        await usersApi.update(activeUser.apiId, buildSavePayload(false));
        showToast('User updated successfully.');
      }

      closeModal();
      await loadUsers();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const updateUserStatus = async (user: UiUser, status: UserStatus) => {
    setSubmitting(true);

    try {
      await usersApi.updateStatus(user.apiId, apiStatusByUiStatus[status]);
      showToast(`${user.fullName} marked ${status}.`);
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const updateSelectedStatuses = async (status: UserStatus) => {
    const targets = users.filter((user) => selectedIds.has(user.apiId));

    if (targets.length === 0) {
      return;
    }

    setSubmitting(true);

    try {
      await Promise.all(targets.map((user) => usersApi.updateStatus(user.apiId, apiStatusByUiStatus[status])));
      setSelectedIds(new Set());
      showToast(`Selected users marked ${status}.`);
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeUser) {
      setFormError('Select a user first.');
      return;
    }

    if (!passwordForm.newPassword) {
      setFormError('New password is required.');
      return;
    }

    if (modalMode === 'change-password' && !passwordForm.currentPassword) {
      setFormError('Current password is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'change-password') {
        await usersApi.changePassword(activeUser.apiId, passwordForm.currentPassword, passwordForm.newPassword);
        showToast('Password changed successfully.');
      } else {
        await usersApi.resetPassword(activeUser.apiId, passwordForm.newPassword);
        showToast('Password reset successfully.');
      }

      closeModal();
      await loadUsers();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);

    try {
      await usersApi.delete(deleteTarget.apiId);
      showToast(`${deleteTarget.fullName} deleted successfully.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    const targets = users.filter((user) => selectedIds.has(user.apiId));

    setSubmitting(true);

    try {
      await Promise.all(targets.map((user) => usersApi.delete(user.apiId)));
      setSelectedIds(new Set());
      showToast('Selected users deleted successfully.');
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const kpis = {
    total: meta.total,
    active: users.filter((user) => user.status === 'Active').length,
    inactive: users.filter((user) => user.status === 'Inactive').length,
    locked: users.filter((user) => user.status === 'Locked').length,
    addedThisMonth: users.filter((user) => user.addedThisMonth).length,
  };

  const showingLabel =
    loadError || filteredUsers.length === 0
      ? 'No users found'
      : `Showing ${(safePage - 1) * pageSize + 1}-${(safePage - 1) * pageSize + filteredUsers.length} of ${
          roleFilter ? filteredUsers.length : meta.total
        } users`;

  const modalTitle = (() => {
    if (modalMode === 'create') return 'Add New User';
    if (modalMode === 'edit') return activeUser ? `Edit ${activeUser.fullName}` : 'Edit User';
    if (modalMode === 'view') return activeUser ? `${activeUser.fullName} Profile` : 'User Profile';
    if (modalMode === 'change-password') return activeUser ? `Change Password - ${activeUser.fullName}` : 'Change Password';
    if (modalMode === 'reset-password') return activeUser ? `Reset Password - ${activeUser.fullName}` : 'Reset Password';
    if (modalMode === 'import') return 'Import Users';
    if (modalMode === 'bulk-update') return 'Bulk Update';
    return 'User Management';
  })();

  return (
    <>
      <div className="um-grid">
        <div className="um-kpi-row" aria-label="User KPIs">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-users" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Users</span>
              <span className="kpi-value">{loading ? '-' : kpis.total}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-user-check" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active Users</span>
              <span className="kpi-value">{loading ? '-' : kpis.active}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange">
              <i className="ph ph-user-minus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inactive Users</span>
              <span className="kpi-value">{loading ? '-' : kpis.inactive}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red">
              <i className="ph ph-lock" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Locked Users</span>
              <span className="kpi-value">{loading ? '-' : kpis.locked}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon purple">
              <i className="ph ph-user-plus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Added This Month</span>
              <span className="kpi-value">{loading ? '-' : kpis.addedThisMonth}</span>
            </div>
          </div>
        </div>

        <div className="um-body">
          <div className="um-table-section card">
            <div className="um-toolbar">
              <div className="um-toolbar-row1">
                <div className="um-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by name, username, role, employee ID..."
                    type="search"
                    value={query}
                  />
                </div>
                {canManage ? (
                  <button className="um-add-btn" onClick={() => openModal('create')} type="button">
                    <i className="ph ph-user-plus" aria-hidden="true" /> Add New User
                  </button>
                ) : null}
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filter by:</span>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setRoleFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={roleFilter}
                >
                  <option value="">All Roles</option>
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setDepartmentFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={departmentFilter}
                >
                  <option value="">All Departments</option>
                  {departments.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setBranchFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={branchFilter}
                >
                  <option value="">All Branches</option>
                  {branches.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  value={statusFilter}
                >
                  <option value="">All Status</option>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button className="um-clear-btn" onClick={resetFilters} type="button">
                  <i className="ph ph-x" aria-hidden="true" /> Clear Filters
                </button>
              </div>
            </div>

            <div className={`bulk-bar${selectedCount ? ' visible' : ''}`}>
              <span>{selectedCount} selected</span>
              {canManage ? (
                <div className="bulk-actions">
                  <button
                    className="bulk-btn green"
                    disabled={submitting}
                    onClick={() => void updateSelectedStatuses('Active')}
                    type="button"
                  >
                    <i className="ph ph-check-circle" aria-hidden="true" /> Activate
                  </button>
                  <button
                    className="bulk-btn orange"
                    disabled={submitting}
                    onClick={() => void updateSelectedStatuses('Inactive')}
                    type="button"
                  >
                    <i className="ph ph-minus-circle" aria-hidden="true" /> Deactivate
                  </button>
                  <button className="bulk-btn red" disabled={submitting} onClick={() => void handleBulkDelete()} type="button">
                    <i className="ph ph-trash" aria-hidden="true" /> Delete
                  </button>
                </div>
              ) : null}
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        aria-label="Select all visible users"
                        checked={pageSelected}
                        disabled={!canManage}
                        onChange={(event) => togglePageSelection(event.target.checked)}
                        type="checkbox"
                      />
                    </th>
                    <SortableHeader
                      column="id"
                      label="Employee ID"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <SortableHeader
                      column="fullName"
                      label="Name"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <th scope="col">Username</th>
                    <th scope="col">Password</th>
                    <SortableHeader
                      column="role"
                      label="Role"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <SortableHeader
                      column="department"
                      label="Department"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <th scope="col">Branch</th>
                    <SortableHeader
                      column="status"
                      label="Status"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <th scope="col">Last Login</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={11}>
                        <span className="loading-spinner" /> Loading users...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={11}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                      </td>
                    </tr>
                  ) : pageUsers.length ? (
                    pageUsers.map((user) => (
                      <tr className={selectedIds.has(user.apiId) ? 'selected' : undefined} key={user.apiId}>
                        <td>
                          <input
                            aria-label={`Select ${user.fullName}`}
                            checked={selectedIds.has(user.apiId)}
                            disabled={!canManage}
                            onChange={(event) => toggleUserSelection(user.apiId, event.target.checked)}
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <span className="emp-id">{user.id}</span>
                        </td>
                        <td>
                          <div className="user-cell">
                            <span className="table-avatar table-avatar-initials">{initials(user.fullName)}</span>
                            <div className="user-cell-info">
                              <span className="user-cell-name">{user.fullName}</span>
                            </div>
                          </div>
                        </td>
                        <td className="muted-cell">{user.username}</td>
                        <td>
                          <span className="password-pill">{user.password}</span>
                        </td>
                        <td>
                          <span className={`role-badge ${roleToneClass[user.role] ?? 'role-gray'}`}>{user.role}</span>
                        </td>
                        <td>{user.department}</td>
                        <td>{user.branch}</td>
                        <td>
                          <span className={`status-badge ${statusClass[user.status]}`}>{user.status}</span>
                        </td>
                        <td className="muted-cell">{user.lastLogin}</td>
                        <td>
                          <div className="action-icons">
                            <button
                              className="action-icon-btn"
                              onClick={() => openModal('view', user)}
                              title="View"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            {canManage ? (
                              <>
                                <button
                                  className="action-icon-btn"
                                  onClick={() => openModal('edit', user)}
                                  title="Edit"
                                  type="button"
                                >
                                  <i className="ph ph-pencil" aria-hidden="true" />
                                </button>
                                <button
                                  className="action-icon-btn success"
                                  disabled={submitting}
                                  onClick={() =>
                                    void updateUserStatus(
                                      user,
                                      user.status === 'Active' ? 'Inactive' : 'Active',
                                    )
                                  }
                                  title={user.status === 'Locked' ? 'Unlock' : user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                  type="button"
                                >
                                  <i className={`ph ${user.status === 'Active' ? 'ph-user-minus' : 'ph-user-check'}`} />
                                </button>
                                <button
                                  className="action-icon-btn"
                                  disabled={submitting}
                                  onClick={() => void updateUserStatus(user, user.status === 'Locked' ? 'Active' : 'Locked')}
                                  title={user.status === 'Locked' ? 'Unlock' : 'Lock'}
                                  type="button"
                                >
                                  <i className={`ph ${user.status === 'Locked' ? 'ph-lock-open' : 'ph-lock'}`} />
                                </button>
                                <button
                                  className="action-icon-btn"
                                  onClick={() => openModal('change-password', user)}
                                  title="Change Password"
                                  type="button"
                                >
                                  <i className="ph ph-keyhole" aria-hidden="true" />
                                </button>
                                <button
                                  className="action-icon-btn"
                                  onClick={() => openModal('reset-password', user)}
                                  title="Reset Password"
                                  type="button"
                                >
                                  <i className="ph ph-key" aria-hidden="true" />
                                </button>
                                <button
                                  className="action-icon-btn danger"
                                  onClick={() => setDeleteTarget(user)}
                                  title="Delete"
                                  type="button"
                                >
                                  <i className="ph ph-trash" aria-hidden="true" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="um-state-cell" colSpan={11}>
                        <i className="ph ph-users" aria-hidden="true" />
                        No users found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="um-pagination">
              <div className="um-showing">{showingLabel}</div>
              <div className="um-page-size">
                <span>Rows:</span>
                <select
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  value={pageSize}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <div className="um-page-controls">
                <button
                  className="pg-btn"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    className={`pg-btn${page === safePage ? ' active' : ''}`}
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="pg-btn"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="um-right-panel">
            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Users by Status</h3>
              </div>
              {loading ? <div className="um-panel-loading">Loading chart...</div> : <UserStatusChart users={users} />}
            </div>

            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Users by Role</h3>
              </div>
              {loading ? <div className="um-panel-loading">Loading roles...</div> : <UsersByRole users={users} />}
            </div>

            <div className="card um-quick-card">
              <div className="card-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="um-quick-list">
                <button className="um-quick-btn" disabled={!canManage} onClick={() => openModal('import')} type="button">
                  <i className="ph ph-upload-simple" aria-hidden="true" />
                  <div>
                    <strong>Import Users</strong>
                    <span>Upload CSV file</span>
                  </div>
                </button>
                <button className="um-quick-btn" onClick={() => showToast('Current users view is ready to export.')} type="button">
                  <i className="ph ph-download-simple" aria-hidden="true" />
                  <div>
                    <strong>Export Users</strong>
                    <span>Download as CSV</span>
                  </div>
                </button>
                <button
                  className="um-quick-btn"
                  disabled={!canManage || selectedCount === 0}
                  onClick={() => showToast('Choose a user row to reset a password.')}
                  type="button"
                >
                  <i className="ph ph-key" aria-hidden="true" />
                  <div>
                    <strong>Reset Password</strong>
                    <span>Bulk password reset</span>
                  </div>
                </button>
                <button
                  className="um-quick-btn"
                  disabled={!canManage}
                  onClick={() => openModal('bulk-update')}
                  type="button"
                >
                  <i className="ph ph-pencil-line" aria-hidden="true" />
                  <div>
                    <strong>Bulk Update</strong>
                    <span>Update selected users</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        footer={
          modalMode === 'view' || modalMode === 'import' || modalMode === 'bulk-update' ? (
            <button className="btn-secondary" onClick={closeModal} type="button">
              Close
            </button>
          ) : (
            <>
              <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">
                Cancel
              </button>
              <button className="btn-primary" disabled={submitting} form="user-management-modal-form" type="submit">
                {submitting ? 'Saving...' : modalMode === 'reset-password' ? 'Reset Password' : modalMode === 'change-password' ? 'Change Password' : 'Save User'}
              </button>
            </>
          )
        }
        onClose={closeModal}
        open={Boolean(modalMode)}
        title={modalTitle}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert">
            {formError}
          </div>
        ) : null}

        {modalMode === 'create' || modalMode === 'edit' ? (
          <form id="user-management-modal-form" onSubmit={(event) => void handleSaveUser(event)}>
            <div className="form-section-title">User Profile</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Employee ID</span>
                <input onChange={(event) => updateForm('employeeCode', event.target.value)} value={userForm.employeeCode} />
              </label>
              <label className="form-field">
                <span>Full Name</span>
                <input onChange={(event) => updateForm('fullName', event.target.value)} value={userForm.fullName} />
              </label>
              <label className="form-field">
                <span>Username</span>
                <input onChange={(event) => updateForm('username', event.target.value)} value={userForm.username} />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input onChange={(event) => updateForm('email', event.target.value)} type="email" value={userForm.email} />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input onChange={(event) => updateForm('phone', event.target.value)} value={userForm.phone} />
              </label>
              <label className="form-field">
                <span>Role</span>
                <select onChange={(event) => updateForm('jobTitle', event.target.value)} value={userForm.jobTitle}>
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Branch ID</span>
                <input onChange={(event) => updateForm('branchId', event.target.value)} value={userForm.branchId} />
              </label>
              <label className="form-field">
                <span>Branch</span>
                <input onChange={(event) => updateForm('branchName', event.target.value)} value={userForm.branchName} />
              </label>
              <label className="form-field">
                <span>Department ID</span>
                <input onChange={(event) => updateForm('departmentId', event.target.value)} value={userForm.departmentId} />
              </label>
              <label className="form-field">
                <span>Department</span>
                <input onChange={(event) => updateForm('departmentName', event.target.value)} value={userForm.departmentName} />
              </label>
              <label className="form-field">
                <span>Employee Type</span>
                <input onChange={(event) => updateForm('employeeType', event.target.value)} value={userForm.employeeType} />
              </label>
              {modalMode === 'create' ? (
                <label className="form-field">
                  <span>Password</span>
                  <input onChange={(event) => updateForm('password', event.target.value)} type="password" value={userForm.password} />
                </label>
              ) : null}
            </div>
          </form>
        ) : null}

        {modalMode === 'change-password' || modalMode === 'reset-password' ? (
          <form id="user-management-modal-form" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <div className="form-section-title">Password Action</div>
            <div className="form-grid-3">
              {modalMode === 'change-password' ? (
                <label className="form-field">
                  <span>Current Password</span>
                  <input
                    onChange={(event) => updatePasswordForm('currentPassword', event.target.value)}
                    type="password"
                    value={passwordForm.currentPassword}
                  />
                </label>
              ) : null}
              <label className="form-field">
                <span>New Password</span>
                <input
                  onChange={(event) => updatePasswordForm('newPassword', event.target.value)}
                  type="password"
                  value={passwordForm.newPassword}
                />
              </label>
            </div>
          </form>
        ) : null}

        {modalMode === 'view' && activeUser ? (
          <>
            <div className="form-section-title">User Profile</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Full Name</span>
                <input readOnly value={activeUser.fullName} />
              </label>
              <label className="form-field">
                <span>Username</span>
                <input readOnly value={activeUser.username} />
              </label>
              <label className="form-field">
                <span>Status</span>
                <input readOnly value={activeUser.status} />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input readOnly value={activeUser.email} />
              </label>
              <label className="form-field">
                <span>Branch</span>
                <input readOnly value={activeUser.branch} />
              </label>
              <label className="form-field">
                <span>Department</span>
                <input readOnly value={activeUser.department} />
              </label>
            </div>
          </>
        ) : null}

        {modalMode === 'import' || modalMode === 'bulk-update' ? (
          <p className="dialog-message">This action requires a dedicated backend workflow and is not part of the User API integration phase.</p>
        ) : null}
      </Modal>

      <ConfirmDialog
        confirmLabel="Delete User"
        message={deleteTarget ? `Delete ${deleteTarget.fullName}? This will remove the user from active user lists.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteUser()}
        open={Boolean(deleteTarget)}
        title="Delete User"
      />
      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
