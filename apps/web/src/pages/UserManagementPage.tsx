import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  usersApi,
  type ApiUserStatus,
  type SaveUserPayload,
  type UserAssignment,
  type UserListResponse,
  type UserResponse,
  type UserSummary,
} from '../api/users';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { rolesApi, type RoleResponse } from '../api/roles';
import { authApi } from '../auth/auth-api';
import type { AuthPasswordPolicy } from '../auth/auth-types';

import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';

type UserStatus = 'Active' | 'Inactive' | 'Locked';
type SortColumn = 'fullName' | 'role' | 'department' | 'status';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view' | 'assign-role' | 'change-password' | 'reset-password';

type UiUser = {
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

type UserFormState = {
  employeeCode: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  employeeType: string;
  roleId: string;
  branchId: string;
  departmentId: string;
  password: string;
  confirmPassword: string;
  status: UserStatus;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
};

type PasswordFieldKey = 'create' | 'confirm' | 'current' | 'new';

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

const getPasswordPolicyErrors = (password: string, policy: AuthPasswordPolicy) => {
  const errors: string[] = [];

  if (password.length < policy.minLength) errors.push(`Use at least ${policy.minLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password)) errors.push('include an uppercase letter');
  if (policy.requireLowercase && !/[a-z]/.test(password)) errors.push('include a lowercase letter');
  if (policy.requireNumber && !/[0-9]/.test(password)) errors.push('include a number');
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push('include a symbol');

  return errors;
};

const getPasswordPolicyText = (policy: AuthPasswordPolicy) => {
  const requirements = [`at least ${policy.minLength} characters`];

  if (policy.requireUppercase) requirements.push('one uppercase letter');
  if (policy.requireLowercase) requirements.push('one lowercase letter');
  if (policy.requireNumber) requirements.push('one number');
  if (policy.requireSymbol) requirements.push('one symbol');

  return `${requirements.join(', ')}.${policy.requireSymbol ? '' : ' Symbols are optional.'}`;
};

const getPasswordPolicyApiMessage = (error: ApiError) => {
  if (error.code !== 'PASSWORD_POLICY_FAILED' || !Array.isArray(error.details)) return null;

  const messages = error.details.filter((detail): detail is string => typeof detail === 'string');
  return messages.length > 0 ? `${messages.join('. ')}.` : null;
};

const apiSortByColumn: Partial<
  Record<SortColumn, 'fullName' | 'username' | 'email' | 'employeeCode' | 'status' | 'createdAt' | 'lastLoginAt'>
> = {
  fullName: 'fullName',
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

const emptyUserForm: UserFormState = {
  employeeCode: '',
  username: '',
  email: '',
  fullName: '',
  phone: '',
  jobTitle: 'Doctor',
  employeeType: '',
  roleId: '',
  branchId: '',
  departmentId: '',
  password: '',
  confirmPassword: '',
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
    roleId: user.roleId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    password: '',
    confirmPassword: '',
    status: user.status,
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    const passwordPolicyMessage = getPasswordPolicyApiMessage(error);
    if (passwordPolicyMessage) return passwordPolicyMessage;

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

function PasswordInput({
  autoComplete,
  invalid = false,
  onChange,
  onToggle,
  value,
  visible,
}: {
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  value: string;
  visible: boolean;
}) {
  return (
    <div className="password-input">
      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="password-input__toggle"
        onClick={onToggle}
        title={visible ? 'Hide password' : 'Show password'}
        type="button"
      >
        <i className={`ph ${visible ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
}

function PasswordPolicyNote({ policy }: { policy: AuthPasswordPolicy | null }) {
  if (!policy) return null;

  return (
    <p className="password-policy-note" role="note">
      <strong>Password policy:</strong> {getPasswordPolicyText(policy)}
    </p>
  );
}

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
  const { search: locationSearch } = useAppLocation();
  const [users, setUsers] = useState<UiUser[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleResponse[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentResponse[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchResponse[]>([]);
  const [summary, setSummary] = useState<UserSummary>({ total: 0, active: 0, inactive: 0, locked: 0, addedThisMonth: 0 });
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
  const [passwordPolicy, setPasswordPolicy] = useState<AuthPasswordPolicy | null>(null);
  const [visiblePasswordFields, setVisiblePasswordFields] = useState<Set<PasswordFieldKey>>(() => new Set());
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setForbidden(false);

    const apiSortBy = sortColumn ? apiSortByColumn[sortColumn] : undefined;

    try {
      const [response, totals] = await Promise.all([usersApi.list({
        branchId: branchFilter || undefined,
        departmentId: departmentFilter || undefined,
        limit: pageSize,
        page: currentPage,
        search: query.trim() || undefined,
        sortBy: apiSortBy,
        sortOrder: apiSortBy ? sortDirection : undefined,
        status: statusFilter ? apiStatusByUiStatus[statusFilter as UserStatus] : undefined,
        roleId: roleFilter || undefined,
      }), usersApi.summary()]);

      setUsers(response.items.map(mapUser));
      setMeta(response.meta);
      setSummary(totals);
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
  }, [branchFilter, currentPage, departmentFilter, pageSize, query, roleFilter, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void Promise.all([
      rolesApi.listAll(),
      branchesApi.list({ limit: 100, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }),
      departmentsApi.list({ limit: 100, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' }),
      authApi.passwordPolicy(),
    ]).then(([roles, branches, departments, policy]) => {
      setRoleOptions(roles.items.filter((role) => role.status === 'active'));
      setBranchOptions(branches.data);
      setDepartmentOptions(departments.data);
      setPasswordPolicy(policy);
    }).catch((error: unknown) => setLoadError(getErrorMessage(error)));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) {
      openModal('create');
    }
  }, [locationSearch]);

  const filteredUsers = useMemo(() => {
    const rows = users;

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
  }, [sortColumn, sortDirection, users]);

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
    setFieldErrors({});
    setUserForm(getUserForm(user));
    setPasswordForm({ currentPassword: '', newPassword: '' });
    setVisiblePasswordFields(new Set());
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setModalMode(null);
    setActiveUser(null);
    setFormError('');
    setFieldErrors({});
    setVisiblePasswordFields(new Set());
  };

  const togglePasswordVisibility = (field: PasswordFieldKey) => {
    setVisiblePasswordFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const updateForm = (field: keyof UserFormState, value: string) => {
    setUserForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (field === 'password' || field === 'confirmPassword') setFormError('');
  };

  const updatePasswordForm = (field: keyof PasswordFormState, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const assignmentFromForm = (id: string, name: string): UserAssignment[] => [
    {
      id: id.trim(),
      isPrimary: true,
      name: name.trim() || id.trim(),
    },
  ];

  const buildSavePayload = (includePassword: boolean): SaveUserPayload & { password?: string } => ({
    branches: assignmentFromForm(userForm.branchId, branchOptions.find((branch) => branch.id === userForm.branchId)?.name ?? ''),
    departments: assignmentFromForm(userForm.departmentId, departmentOptions.find((department) => department.id === userForm.departmentId)?.name ?? ''),
    email: userForm.email.trim() || null,
    employeeCode: userForm.employeeCode.trim(),
    employeeType: userForm.employeeType.trim() || null,
    fullName: userForm.fullName.trim(),
    jobTitle: userForm.jobTitle.trim() || null,
    password: includePassword ? userForm.password : undefined,
    phone: userForm.phone.trim() || null,
    profilePhotoUrl: null,
    roleIds: [userForm.roleId],
    status: apiStatusByUiStatus[userForm.status],
    username: userForm.username.trim(),
  });

  const validateUserForm = (includePassword: boolean) => {
    const errors: Record<string, string> = {};
    if (!userForm.employeeCode.trim()) errors.employeeCode = 'Employee code is required.';
    if (!userForm.username.trim()) errors.username = 'Username is required.';
    if (!userForm.fullName.trim()) errors.fullName = 'Full name is required.';
    if (!userForm.email.trim()) errors.email = 'Email is required.';
    if (!userForm.roleId) errors.roleId = 'Role assignment is required.';
    if (!userForm.branchId) errors.branchId = 'Branch assignment is required.';
    if (!userForm.departmentId) errors.departmentId = 'Department assignment is required.';
    if (includePassword && !userForm.password) errors.password = 'Password is required.';
    if (includePassword && userForm.password && passwordPolicy) {
      const passwordErrors = getPasswordPolicyErrors(userForm.password, passwordPolicy);
      if (passwordErrors.length > 0) errors.password = `${passwordErrors.join(', ')}.`;
    }
    if (includePassword && userForm.password !== userForm.confirmPassword) errors.confirmPassword = 'Passwords must match.';
    setFieldErrors(errors);
    return Object.values(errors)[0] ?? '';
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
      if (error instanceof ApiError) {
        const field = error.code === 'DUPLICATE_USERNAME' ? 'username' : error.code === 'DUPLICATE_EMAIL' ? 'email' : error.code === 'DUPLICATE_EMPLOYEE_CODE' ? 'employeeCode' : null;
        if (field) setFieldErrors({ [field]: error.message });
        const passwordPolicyMessage = getPasswordPolicyApiMessage(error);
        if (passwordPolicyMessage) setFieldErrors({ password: passwordPolicyMessage });
      }
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
      showToast(getErrorMessage(error), 'error');
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
      showToast(getErrorMessage(error), 'error');
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
      setFieldErrors({ newPassword: 'New password is required.' });
      return;
    }

    if (passwordPolicy) {
      const passwordErrors = getPasswordPolicyErrors(passwordForm.newPassword, passwordPolicy);
      if (passwordErrors.length > 0) {
        const message = `${passwordErrors.join(', ')}.`;
        setFieldErrors({ newPassword: message });
        setFormError(message);
        return;
      }
    }

    if (modalMode === 'change-password' && !passwordForm.currentPassword) {
      setFormError('Current password is required.');
      setFieldErrors({ currentPassword: 'Current password is required.' });
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
      if (error instanceof ApiError) {
        const passwordPolicyMessage = getPasswordPolicyApiMessage(error);
        if (passwordPolicyMessage) setFieldErrors({ newPassword: passwordPolicyMessage });
      }
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
      showToast(getErrorMessage(error), 'error');
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
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const exportUsers = async () => {
    setSubmitting(true);
    try {
      const blob = await usersApi.export({
        branchId: branchFilter || undefined,
        departmentId: departmentFilter || undefined,
        roleId: roleFilter || undefined,
        search: query.trim() || undefined,
        status: statusFilter ? apiStatusByUiStatus[statusFilter as UserStatus] : undefined,
        sortBy: sortColumn ? apiSortByColumn[sortColumn] : undefined,
        sortOrder: sortDirection,
      });
      downloadBlob(blob, 'hms-users.csv');
      showToast('All filtered users exported.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const kpis = summary;

  const showingLabel =
    loadError || filteredUsers.length === 0
      ? 'No users found'
      : `Showing ${(safePage - 1) * pageSize + 1}-${(safePage - 1) * pageSize + filteredUsers.length} of ${
          meta.total
        } users`;

  const modalTitle = (() => {
    if (modalMode === 'create') return 'Add New User';
    if (modalMode === 'edit') return activeUser ? `Edit ${activeUser.fullName}` : 'Edit User';
    if (modalMode === 'view') return activeUser ? `${activeUser.fullName} Profile` : 'User Profile';
    if (modalMode === 'assign-role') return activeUser ? `Assign Role - ${activeUser.fullName}` : 'Assign Role';
    if (modalMode === 'change-password') return activeUser ? `Change Password - ${activeUser.fullName}` : 'Change Password';
    if (modalMode === 'reset-password') return activeUser ? `Reset Password - ${activeUser.fullName}` : 'Reset Password';
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
                <button className="btn-secondary admin-table-action" disabled={!canManage || submitting} onClick={() => void exportUsers()} type="button">
                  <i className="ph ph-download-simple" aria-hidden="true" /> Export CSV
                </button>
                <button className="btn-secondary admin-table-action" disabled={loading} onClick={() => void loadUsers()} type="button">
                  <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
                </button>
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
                    <option key={role.id} value={role.id}>{role.name}</option>
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
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
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
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
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
                      <td className="um-state-cell" colSpan={10}>
                        <span className="loading-spinner" /> Loading users...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={10}>
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
                                   className="action-icon-btn"
                                   onClick={() => openModal('assign-role', user)}
                                   title="Assign Role"
                                   type="button"
                                 >
                                   <i className="ph ph-shield-check" aria-hidden="true" />
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
                      <td className="um-state-cell" colSpan={10}>
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

          </div>
        </div>
      </div>

      <Modal
        footer={
          modalMode === 'view' ? (
            <button className="btn-secondary" onClick={closeModal} type="button">
              Close
            </button>
          ) : (
            <>
              <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">
                Cancel
              </button>
              <button className="btn-primary" disabled={submitting} form="user-management-modal-form" type="submit">
                {submitting ? 'Saving...' : modalMode === 'reset-password' ? 'Reset Password' : modalMode === 'change-password' ? 'Change Password' : modalMode === 'assign-role' ? 'Assign Role' : 'Save User'}
              </button>
            </>
          )
        }
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-user-plus"
        title={modalTitle}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert">
            {formError}
          </div>
        ) : null}

        {modalMode === 'create' || modalMode === 'edit' || modalMode === 'assign-role' ? (
          <form id="user-management-modal-form" onSubmit={(event) => void handleSaveUser(event)}>
            {modalMode !== 'assign-role' ? <>
            <div className="form-section-title">Personal Information</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Employee ID <span className="required">*</span></span>
                <input aria-invalid={Boolean(fieldErrors.employeeCode)} onChange={(event) => updateForm('employeeCode', event.target.value)} required value={userForm.employeeCode} />
                {fieldErrors.employeeCode ? <small className="field-error">{fieldErrors.employeeCode}</small> : null}
              </label>
              <label className="form-field">
                <span>Full Name <span className="required">*</span></span>
                <input aria-invalid={Boolean(fieldErrors.fullName)} onChange={(event) => updateForm('fullName', event.target.value)} required value={userForm.fullName} />
                {fieldErrors.fullName ? <small className="field-error">{fieldErrors.fullName}</small> : null}
              </label>
              <label className="form-field">
                <span>Username <span className="required">*</span></span>
                <input aria-invalid={Boolean(fieldErrors.username)} onChange={(event) => updateForm('username', event.target.value)} required value={userForm.username} />
                {fieldErrors.username ? <small className="field-error">{fieldErrors.username}</small> : null}
              </label>
              <label className="form-field">
                <span>Email <span className="required">*</span></span>
                <input aria-invalid={Boolean(fieldErrors.email)} onChange={(event) => updateForm('email', event.target.value)} required type="email" value={userForm.email} />
                {fieldErrors.email ? <small className="field-error">{fieldErrors.email}</small> : null}
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input onChange={(event) => updateForm('phone', event.target.value)} value={userForm.phone} />
              </label>
              <label className="form-field">
                <span>Employee Type</span>
                <input onChange={(event) => updateForm('employeeType', event.target.value)} value={userForm.employeeType} />
              </label>
            </div>
            <div className="form-section-title">Role &amp; Assignment</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Branch <span className="required">*</span></span>
                <select aria-invalid={Boolean(fieldErrors.branchId)} onChange={(event) => updateForm('branchId', event.target.value)} required value={userForm.branchId}>
                  <option value="">Select branch</option>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {fieldErrors.branchId ? <small className="field-error">{fieldErrors.branchId}</small> : null}
              </label>
              <label className="form-field">
                <span>Department <span className="required">*</span></span>
                <select aria-invalid={Boolean(fieldErrors.departmentId)} onChange={(event) => updateForm('departmentId', event.target.value)} required value={userForm.departmentId}>
                  <option value="">Select department</option>
                  {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                {fieldErrors.departmentId ? <small className="field-error">{fieldErrors.departmentId}</small> : null}
              </label>
              <label className="form-field">
                <span>Role <span className="required">*</span></span>
                <select aria-invalid={Boolean(fieldErrors.roleId)} onChange={(event) => updateForm('roleId', event.target.value)} required value={userForm.roleId}>
                  <option value="">Select role</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                {fieldErrors.roleId ? <small className="field-error">{fieldErrors.roleId}</small> : null}
              </label>
              <label className="form-field">
                <span>Status <span className="required">*</span></span>
                <select onChange={(event) => updateForm('status', event.target.value)} required value={userForm.status}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              {modalMode === 'create' ? <>
                <label className="form-field">
                  <span>Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="new-password"
                    invalid={Boolean(fieldErrors.password)}
                    onChange={(value) => updateForm('password', value)}
                    onToggle={() => togglePasswordVisibility('create')}
                    value={userForm.password}
                    visible={visiblePasswordFields.has('create')}
                  />
                  {fieldErrors.password ? <small className="field-error">{fieldErrors.password}</small> : null}
                </label>
                <label className="form-field">
                  <span>Confirm Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="new-password"
                    invalid={Boolean(fieldErrors.confirmPassword)}
                    onChange={(value) => updateForm('confirmPassword', value)}
                    onToggle={() => togglePasswordVisibility('confirm')}
                    value={userForm.confirmPassword}
                    visible={visiblePasswordFields.has('confirm')}
                  />
                  {fieldErrors.confirmPassword ? <small className="field-error">{fieldErrors.confirmPassword}</small> : null}
                </label>
                <PasswordPolicyNote policy={passwordPolicy} />
              </> : null}
            </div>
            </> : <>
              <div className="form-section-title">Role Assignment</div>
              <div className="form-grid-3">
              <label className="form-field">
                <span>Role <span className="required">*</span></span>
                <select aria-invalid={Boolean(fieldErrors.roleId)} onChange={(event) => updateForm('roleId', event.target.value)} required value={userForm.roleId}>
                  <option value="">Select role</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                {fieldErrors.roleId ? <small className="field-error">{fieldErrors.roleId}</small> : null}
              </label>
              </div>
            </>}
          </form>
        ) : null}

        {modalMode === 'change-password' || modalMode === 'reset-password' ? (
          <form id="user-management-modal-form" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <div className="form-section-title">Password Action</div>
            <div className="form-grid-3">
              {modalMode === 'change-password' ? (
                <label className="form-field">
                  <span>Current Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="current-password"
                    invalid={Boolean(fieldErrors.currentPassword)}
                    onChange={(value) => updatePasswordForm('currentPassword', value)}
                    onToggle={() => togglePasswordVisibility('current')}
                    value={passwordForm.currentPassword}
                    visible={visiblePasswordFields.has('current')}
                  />
                  {fieldErrors.currentPassword ? <small className="field-error">{fieldErrors.currentPassword}</small> : null}
                </label>
              ) : null}
              <label className="form-field">
                <span>New Password <span className="required">*</span></span>
                <PasswordInput
                  autoComplete="new-password"
                  invalid={Boolean(fieldErrors.newPassword)}
                  onChange={(value) => updatePasswordForm('newPassword', value)}
                  onToggle={() => togglePasswordVisibility('new')}
                  value={passwordForm.newPassword}
                  visible={visiblePasswordFields.has('new')}
                />
                {fieldErrors.newPassword ? <small className="field-error">{fieldErrors.newPassword}</small> : null}
              </label>
              <PasswordPolicyNote policy={passwordPolicy} />
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

      </Modal>

      <ConfirmDialog
        confirmLabel="Delete User"
        message={deleteTarget ? `Delete ${deleteTarget.fullName}? This will remove the user from active user lists.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteUser()}
        open={Boolean(deleteTarget)}
        title="Delete User"
      />
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
