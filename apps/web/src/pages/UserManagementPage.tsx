import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUserManagementFeature } from '../hooks/users/useUserManagementFeature';
import { ApiError } from '../api/api-error';
import {
  type ApiUserStatus,
  type SaveUserPayload,
  type UserResponse,
} from '../api/users';
import type { AuthPasswordPolicy } from '../auth/auth-types';

import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';

type UserStatus = 'Active' | 'Inactive' | 'Locked';
type SortColumn = 'fullName' | 'role' | 'department' | 'status';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view' | 'assign-role' | 'change-password' | 'reset-password';


const baseUserSchema = z.object({
  employeeCode: z.string().optional(),
  username: z.string().optional(),
  email: z.string().email('Valid email is required.').min(1, 'Email is required.'),
  fullName: z.string().min(1, 'Full name is required.'),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  roleId: z.string().min(1, 'Role assignment is required.'),
  branchId: z.string().min(1, 'Branch assignment is required.'),
  departmentId: z.string().min(1, 'Department assignment is required.'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Locked'])
});

export type UserFormData = z.infer<typeof baseUserSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(1, 'New password is required.'),
});
export type PasswordFormData = z.infer<typeof passwordSchema>;

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


const getPasswordPolicyErrors = (password: string, policy: AuthPasswordPolicy) => {
  const errors: string[] = [];
  if (password.length < policy.minLength) errors.push(`be at least ${policy.minLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password)) errors.push('contain uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(password)) errors.push('contain lowercase');
  if (policy.requireNumber && !/[0-9]/.test(password)) errors.push('contain a number');
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push('contain a special character');
  return errors;
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


const initials = (name: string) =>
  name
    .split(' ')
    .filter((part) => !part.endsWith('.'))
    .map((part) => part[0])
    .join('')
    .slice(0, 2);








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

const PasswordInput = React.forwardRef<HTMLInputElement, {
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  onToggle: () => void;
  visible: boolean;
} & Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'> & { onChange?: React.ChangeEventHandler<HTMLInputElement> }>(({
  autoComplete,
  invalid = false,
  onToggle,
  visible,
  ...props
}, ref) => {
  return (
    <div className="password-input">
      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        required
        type={visible ? 'text' : 'password'}
        ref={ref}
        {...props}
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
});

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
  const feature = useUserManagementFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, roleFilter, departmentFilter, branchFilter, statusFilter, sortColumn, sortDirection, currentPage, pageSize } = state;
  const { setQuery, setRoleFilter, setDepartmentFilter, setBranchFilter, setStatusFilter, setCurrentPage, setPageSize } = state;
  const { users: pageUsers, meta, summary, roleOptions, branchOptions, departmentOptions, passwordPolicy } = data;
  const { isFetching: loading, loadError, forbidden, isMutating: submitting } = status;
  const { canCreate, canEdit, canDelete, canExport, canChangePassword, canResetPassword } = rbac;
  const { handleSort, resetFilters, locationSearch } = actions;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeUser, setActiveUser] = useState<UiUser | null>(null);
  const [visiblePasswordFields, setVisiblePasswordFields] = useState<Set<PasswordFieldKey>>(() => new Set());
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UiUser | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(baseUserSchema),
    defaultValues: {
      employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: '',
      roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active'
    }
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' }
  });

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };


  const watchedEmail = userForm.watch('email');
  useEffect(() => {
    if (modalMode === 'create') {
      const userVal = watchedEmail ? (watchedEmail.includes('@') ? watchedEmail.split('@')[0] : watchedEmail) : '';
      userForm.setValue('username', userVal || '');
    }
  }, [watchedEmail, modalMode, userForm]);

  useEffect(() => {
    if (canCreate && new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) {
      openModal('create');
    }
  }, [canCreate, locationSearch, modalMode]);

  const totalPages = Math.max(meta.totalPages, 1);
  const safePage = Math.min(currentPage, totalPages);
  const selectedCount = selectedIds.size;
  const pageIds = pageUsers.map((user) => user.apiId);
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const canSelectRows = !forbidden && !loading && (canEdit || canDelete);

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


    if (user) {
      userForm.reset({
        employeeCode: user.source.employeeCode ?? '',
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? '',
        jobTitle: user.source.jobTitle ?? user.role ?? '',
        roleId: user.roleId,
        branchId: user.branchId,
        departmentId: user.departmentId,
        status: user.status as UserFormData['status'],
        password: '',
        confirmPassword: '',
      });
    } else {
      userForm.reset({ employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: '', roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active' });
    }

    if (mode === 'change-password' || mode === 'reset-password') {
      passwordForm.reset();
      setVisiblePasswordFields(new Set());
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveUser(null);
    setFormError('');

  };



  const buildSavePayload = (data: UserFormData): SaveUserPayload => {
    const computedUsername = data.username || (data.email ? data.email.split('@')[0] : '') || data.fullName.toLowerCase().replace(/\s+/g, '.');
    return {
      branches: branchOptions.filter(b => b.id === data.branchId).map(b => ({ id: b.id, name: b.name, isPrimary: true })),
      departments: departmentOptions.filter(d => d.id === data.departmentId).map(d => ({ id: d.id, name: d.name, isPrimary: true })),
      email: data.email || null,
      employeeCode: data.employeeCode || '',
      fullName: data.fullName,
      jobTitle: data.jobTitle || '',
      phone: data.phone || null,
      roleIds: [data.roleId],
      status: data.status.toLowerCase() as ApiUserStatus,
      username: computedUsername,
    };
  };

  const handleSaveUser = async (formData: UserFormData) => {
    if (submitting) return;
    setFormError('');

    if (modalMode === 'create') {
      if (!formData.password) {
        userForm.setError('password', { message: 'Password is required for new users.' });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        userForm.setError('confirmPassword', { message: 'Passwords must match.' });
        return;
      }
      if (passwordPolicy) {
        const policyErrors = getPasswordPolicyErrors(formData.password, passwordPolicy);
        if (policyErrors.length > 0) {
          userForm.setError('password', { message: `Password must ${policyErrors.join(' and ')}.` });
          return;
        }
      }
    }

    try {
      const payload = buildSavePayload(formData);

      if (modalMode === 'create') {
        await mutations.createUser.mutateAsync({ ...payload, password: formData.password! });
        showToast('User created successfully.');
      } else if (modalMode === 'edit' && activeUser) {
        await mutations.updateUser.mutateAsync({ id: activeUser.apiId, payload });
        showToast('User updated successfully.');
      } else if (modalMode === 'assign-role' && activeUser) {
        await mutations.updateUser.mutateAsync({ id: activeUser.apiId, payload });
        showToast('Role updated successfully.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const handlePasswordSubmit = async (formData: PasswordFormData) => {
    if (!activeUser || submitting) return;
    setFormError('');
    if (passwordPolicy) {
      const policyErrors = getPasswordPolicyErrors(formData.newPassword, passwordPolicy);
      if (policyErrors.length > 0) {
        passwordForm.setError('newPassword', { message: `Password must ${policyErrors.join(' and ')}.` });
        return;
      }
    }
    try {
      if (modalMode === 'reset-password') {
        await mutations.resetPassword.mutateAsync({ id: activeUser.apiId, newPassword: formData.newPassword });
        showToast('Password reset successfully.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const updateSelectedStatuses = async (status: 'active' | 'inactive' | 'locked') => {
    if (!canEdit || submitting || selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => mutations.updateStatus.mutateAsync({ id, status })));
      setSelectedIds(new Set());
    } catch {
      // Handled
    }
  };


  const executeDelete = () => {
    if (!deleteTarget) return;
    showToast(`${deleteTarget.fullName} has been deleted.`);
    setDeleteTarget(null);
  };

  const handleBulkDelete = () => {
    if (!canDelete || submitting || selectedIds.size === 0) return;
    showToast(`Deleted ${selectedIds.size} users.`);
    setSelectedIds(new Set());
  };

  const togglePasswordVisibility = (field: PasswordFieldKey) => {
    setVisiblePasswordFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const showingLabel =
    loadError || pageUsers.length === 0
      ? 'No users found'
      : `Showing ${(safePage - 1) * pageSize + 1}-${(safePage - 1) * pageSize + pageUsers.length} of ${
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
        <div className="um-top-row">
          <div className="um-top-title-area">
            <h2 className="um-page-title">User Management</h2>
            <p className="um-page-subtitle">Manage hospital staff accounts, access credentials, and departmental role assignments.</p>
          </div>
          <div className="um-top-actions">
            {canCreate && !forbidden ? (
              <button className="um-add-btn-top" onClick={() => openModal('create')} type="button">
                <i className="ph ph-user-plus" aria-hidden="true" /> Add New User
              </button>
            ) : null}
          </div>
        </div>

        <div className="um-kpi-row" aria-label="User KPIs">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-users" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Users</span>
              <span className="kpi-value">{loading ? '-' : summary.total}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-user-check" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active Users</span>
              <span className="kpi-value">{loading ? '-' : summary.active}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange">
              <i className="ph ph-user-minus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inactive Users</span>
              <span className="kpi-value">{loading ? '-' : summary.inactive}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red">
              <i className="ph ph-lock" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Locked Users</span>
              <span className="kpi-value">{loading ? '-' : summary.locked}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon purple">
              <i className="ph ph-user-plus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Added This Month</span>
              <span className="kpi-value">{loading ? '-' : summary.addedThisMonth}</span>
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
                  {departmentOptions
                    .filter((department) => !branchFilter || department.branch_ids.includes(branchFilter))
                    .map((department) => (
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
              {canEdit || canDelete ? (
                <div className="bulk-actions">
                  {canEdit ? <button
                    className="bulk-btn green"
                    disabled={submitting}
                    onClick={() => void updateSelectedStatuses('active')}
                    type="button"
                  >
                    <i className="ph ph-check-circle" aria-hidden="true" /> Activate
                  </button> : null}
                  {canEdit ? <button
                    className="bulk-btn orange"
                    disabled={submitting}
                    onClick={() => void updateSelectedStatuses('inactive')}
                    type="button"
                  >
                    <i className="ph ph-minus-circle" aria-hidden="true" /> Deactivate
                  </button> : null}
                  {canDelete ? <button className="bulk-btn red" disabled={submitting} onClick={() => void handleBulkDelete()} type="button">
                    <i className="ph ph-trash" aria-hidden="true" /> Delete
                  </button> : null}
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
                        disabled={!canSelectRows}
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
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '2.5rem 1rem' }}>
                        <MedicalLoader text="Loading hospital staff records..." subtext="Retrieving access & credentials data" />
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
                      <tr className={selectedIds.has(user.apiId) ? 'selected' : ''} key={user.apiId} onClick={() => openModal('view', user)} style={{ cursor: 'pointer' }}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            aria-label={`Select ${user.fullName}`}
                            checked={selectedIds.has(user.apiId)}
                            disabled={!canSelectRows}
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
                          <span className={`role-badge ${roleToneClass[user.role] ?? 'role-gray'}`}>{user.role}</span>
                        </td>
                        <td>{user.department}</td>
                        <td>{user.branch}</td>
                        <td>
                          <span className={`status-badge ${statusClass[user.status]}`}>{user.status}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="action-icons">
                            {canEdit || canDelete || canChangePassword || canResetPassword ? (
                              <>
                                 {canEdit ? <button
                                   className="action-icon-btn"
                                   onClick={() => openModal('edit', user)}
                                  title="Edit"
                                  type="button"
                                >
                                   <i className="ph ph-pencil" aria-hidden="true" />
                                 </button> : null}
                                {canEdit ? <button
                                  className="action-icon-btn success"
                                  disabled={submitting}
                                  onClick={() =>
                                    void mutations.updateStatus.mutateAsync({ id: user.apiId, status: user.status === 'Active' ? 'inactive' : 'active' })
                                  }
                                  title={user.status === 'Locked' ? 'Unlock' : user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                  type="button"
                                >
                                  <i className={`ph ${user.status === 'Active' ? 'ph-user-minus' : 'ph-user-check'}`} />
                                </button> : null}
                                {/* {canEdit ? <button
                                  className="action-icon-btn"
                                  disabled={submitting}
                                  onClick={() => void mutations.updateStatus.mutateAsync({ id: user.apiId, status: user.status === 'Active' ? 'inactive' : 'active' })}
                                  title={user.status === 'Locked' ? 'Unlock' : 'Lock'}
                                  type="button"
                                >
                                  <i className={`ph ${user.status === 'Locked' ? 'ph-lock-open' : 'ph-lock'}`} />
                                </button> : null} */}
                                {/* {canChangePassword ? <button
                                  className="action-icon-btn"
                                  onClick={() => openModal('change-password', user)}
                                  title="Change Password"
                                  type="button"
                                >
                                  <i className="ph ph-keyhole" aria-hidden="true" />
                                </button> : null} */}
                                {canDelete ? <button
                                  className="action-icon-btn danger"
                                  onClick={() => setDeleteTarget(user)}
                                  title="Delete"
                                  type="button"
                                >
                                  <i className="ph ph-trash" aria-hidden="true" />
                                </button> : null}
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
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading user status..." subtext="Analyzing account states" />
                </div>
              ) : (
                <UserStatusChart users={pageUsers} />
              )}
            </div>

            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Users by Role</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading role distribution..." subtext="Aggregating assignments" />
                </div>
              ) : (
                <UsersByRole users={pageUsers} />
              )}
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
                {submitting ? (
                  <>
                    <MedicalSpinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : modalMode === 'reset-password' ? (
                  'Reset Password'
                ) : modalMode === 'change-password' ? (
                  'Change Password'
                ) : modalMode === 'assign-role' ? (
                  'Assign Role'
                ) : (
                  'Save User'
                )}
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
          <form id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void userForm.handleSubmit(handleSaveUser)(event); }}>
            {modalMode !== 'assign-role' ? <>
            <div className="form-section-title">Personal Information</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>
                  Employee ID
                  <span className="form-field-badge">Auto-generated</span>
                </span>
                <input
                  aria-invalid={Boolean(userForm.formState.errors.employeeCode)}
                  placeholder="Auto-generated from Dept & Role"
                  readOnly
                  style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                  tabIndex={-1}
                  {...userForm.register('employeeCode')}
                />
                {userForm.formState.errors.employeeCode ? <small className="field-error">{userForm.formState.errors.employeeCode.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Full Name <span className="required">*</span></span>
                <input  {...userForm.register('fullName')} />
                {userForm.formState.errors.fullName ? <small className="field-error">{userForm.formState.errors.fullName.message}</small> : null}
              </label>
              <label className="form-field">
                <span>
                  Username
                  <span className="form-field-badge">Auto-filled</span>
                </span>
                <input
                  aria-invalid={Boolean(userForm.formState.errors.username)}
                  placeholder="Auto-filled from email"
                  readOnly
                  style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                  tabIndex={-1}
                  {...userForm.register('username')}
                />
                {userForm.formState.errors.username ? <small className="field-error">{userForm.formState.errors.username.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Email <span className="required">*</span></span>
                <input
                  aria-invalid={Boolean(userForm.formState.errors.email)}
                  type="email"
                  {...userForm.register('email')}
                />
                {userForm.formState.errors.email ? <small className="field-error">{userForm.formState.errors.email.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input {...userForm.register('phone')} />
              </label>
            </div>
            <div className="form-section-title">Role &amp; Assignment</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Branch <span className="required">*</span></span>
                <select  {...userForm.register('branchId')}>
                  <option value="">Select branch</option>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {userForm.formState.errors.branchId ? <small className="field-error">{userForm.formState.errors.branchId.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Department <span className="required">*</span></span>
                <select
                  aria-invalid={Boolean(userForm.formState.errors.departmentId)}
                  {...userForm.register('departmentId')}
                >
                  <option value="">Select department</option>
                  {departmentOptions
                    .filter((department) => !userForm.watch('branchId') || department.branch_ids.includes( userForm.watch('branchId')))
                    .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                {userForm.formState.errors.departmentId ? <small className="field-error">{userForm.formState.errors.departmentId.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Role <span className="required">*</span></span>
                <select
                  aria-invalid={Boolean(userForm.formState.errors.roleId)}
                  {...userForm.register('roleId')}
                >
                  <option value="">Select role</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                {userForm.formState.errors.roleId ? <small className="field-error">{userForm.formState.errors.roleId.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Status <span className="required">*</span></span>
                <select {...userForm.register('status')}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              {modalMode === 'create' ? <>
                <label className="form-field">
                  <span>Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="new-password"
                    invalid={Boolean(userForm.formState.errors.password)}
                    {...userForm.register('password')}
                      onToggle={() => togglePasswordVisibility('create')}

                    visible={visiblePasswordFields.has('create')}
                  />
                  {userForm.formState.errors.password ? <small className="field-error">{userForm.formState.errors.password.message}</small> : null}
                </label>
                <label className="form-field">
                  <span>Confirm Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="new-password"
                    invalid={Boolean(userForm.formState.errors.confirmPassword)}
                    {...userForm.register('confirmPassword')}
                      onToggle={() => togglePasswordVisibility('confirm')}

                    visible={visiblePasswordFields.has('confirm')}
                  />
                  {userForm.formState.errors.confirmPassword ? <small className="field-error">{userForm.formState.errors.confirmPassword.message}</small> : null}
                </label>
                <PasswordPolicyNote policy={passwordPolicy} />
              </> : null}
            </div>
            </> : <>
              <div className="form-section-title">Role Assignment</div>
              <div className="form-grid-3">
              <label className="form-field">
                <span>Role <span className="required">*</span></span>
                <select  {...userForm.register('roleId')}>
                  <option value="">Select role</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                {userForm.formState.errors.roleId ? <small className="field-error">{userForm.formState.errors.roleId.message}</small> : null}
              </label>
              </div>
            </>}
          </form>
        ) : null}

        {modalMode === 'change-password' || modalMode === 'reset-password' ? (
          <form id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void passwordForm.handleSubmit(handlePasswordSubmit)(event); }}>
            <div className="form-section-title">Password Action</div>
            <div className="form-grid-3">
              {modalMode === 'change-password' ? (
                <label className="form-field">
                  <span>Current Password <span className="required">*</span></span>
                  <PasswordInput
                    autoComplete="current-password"
                    invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                    {...passwordForm.register('currentPassword')}
                      onToggle={() => togglePasswordVisibility('current')}

                    visible={visiblePasswordFields.has('current')}
                  />
                  {passwordForm.formState.errors.currentPassword ? <small className="field-error">{passwordForm.formState.errors.currentPassword?.message}</small> : null}
                </label>
              ) : null}
              <label className="form-field">
                <span>New Password <span className="required">*</span></span>
                <PasswordInput
                  autoComplete="new-password"
                  invalid={Boolean(passwordForm.formState.errors.newPassword)}
                  {...passwordForm.register('newPassword')}
                      onToggle={() => togglePasswordVisibility('new')}

                  visible={visiblePasswordFields.has('new')}
                />
                {passwordForm.formState.errors.newPassword ? <small className="field-error">{passwordForm.formState.errors.newPassword?.message}</small> : null}
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
        loading={submitting}
        message={deleteTarget ? `Delete ${deleteTarget.fullName}? This will remove the user from active user lists.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => executeDelete()}
        open={Boolean(deleteTarget)}
        title="Delete User"
      />
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
