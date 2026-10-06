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
  roleId: z.string(),
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

    if (error.code === 'VALIDATION_ERROR' && error.details) {
      if (Array.isArray(error.details)) {
        const fieldMsgs = error.details
          .map((d: unknown) =>
            typeof d === 'string'
              ? d
              : typeof d === 'object' && d !== null
              ? (d as { message?: string; path?: string; instancePath?: string }).message ||
                `${(d as { path?: string; instancePath?: string }).path || (d as { instancePath?: string }).instancePath || ''} ${(d as { message?: string }).message || ''}`.trim()
              : '',
          )
          .filter(Boolean);
        if (fieldMsgs.length > 0) return fieldMsgs.join('. ');
      } else if (typeof error.details === 'object' && error.details !== null) {
        const fieldErrors = (error.details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object') {
          const msgs: string[] = [];
          Object.entries(fieldErrors).forEach(([field, errs]) => {
            if (Array.isArray(errs) && errs.length > 0) {
              msgs.push(`${field}: ${errs.join(', ')}`);
            }
          });
          if (msgs.length > 0) return msgs.join('; ');
        }
      }
    }

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
    <div className={`um-password-input-wrap ${invalid ? 'has-error' : ''}`}>
      <i className="ph ph-lock um-password-prefix-icon" aria-hidden="true" />
      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        className="um-password-native-input"
        required
        type={visible ? 'text' : 'password'}
        ref={ref}
        {...props}
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="um-password-toggle-btn"
        onClick={onToggle}
        tabIndex={-1}
        title={visible ? 'Hide password' : 'Show password'}
        type="button"
      >
        <i className={`ph ${visible ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
});

function InteractivePasswordPolicy({ password, policy }: { password: string; policy: AuthPasswordPolicy | null }) {
  const minLength = policy?.minLength ?? 8;
  const checks = [
    { label: `${minLength}+ Characters`, valid: password.length >= minLength },
    { label: 'Uppercase Letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'Lowercase Letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'Number (0-9)', valid: /[0-9]/.test(password) },
  ];

  return (
    <div className="um-password-policy-card">
      <div className="um-policy-header">
        <i className="ph ph-shield-check" />
        <span>Password Requirements</span>
      </div>
      <div className="um-policy-tags">
        {checks.map((check, idx) => (
          <span key={idx} className={`um-policy-tag ${check.valid ? 'valid' : ''}`}>
            <i className={`ph ${check.valid ? 'ph-check-circle-fill' : 'ph-circle'}`} />
            {check.label}
          </span>
        ))}
      </div>
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

// function UserStatusChart({ users }: { users: UiUser[] }) {
//   const counts = statuses.map((status) => users.filter((user) => user.status === status).length);
//   const [activeCount = 0, inactiveCount = 0] = counts;
//   const total = Math.max(users.length, 1);
//   const activeDeg = (activeCount / total) * 360;
//   const inactiveDeg = activeDeg + (inactiveCount / total) * 360;

//   return (
//     <div className="um-status-chart-content">
//       <div className="um-donut-wrap">
//         <div
//           aria-label="Users by status"
//           className="um-donut"
//           role="img"
//           style={{
//             background: `conic-gradient(#16a34a 0deg ${activeDeg}deg, #ea580c ${activeDeg}deg ${inactiveDeg}deg, #ef4444 ${inactiveDeg}deg 360deg)`,
//           }}
//         />
//       </div>
//       <div className="chart-legend-list">
//         {statuses.map((status, index) => (
//           <div className="cl-item" key={status}>
//             <div className="cl-left">
//               <div className={`cl-dot cl-dot-${status.toLowerCase()}`} />
//               <span>{status}</span>
//             </div>
//             <span className="cl-count">{counts[index]}</span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// function UsersByRole({ users }: { users: UiUser[] }) {
//   const roleCounts = useMemo(() => {
//     const counts = new Map<string, number>();
//     users.forEach((user) => counts.set(user.role, (counts.get(user.role) ?? 0) + 1));

//     return [...counts.entries()].sort((a, b) => b[1] - a[1]);
//   }, [users]);
//   const maxCount = Math.max(...roleCounts.map(([, count]) => count), 1);

//   return (
//     <div id="role-bar-list">
//       {roleCounts.map(([role, count]) => (
//         <div className="role-bar-item" key={role}>
//           <div className="role-bar-header">
//             <span>{role}</span>
//             <span>{count}</span>
//           </div>
//           <div className="role-bar-track">
//             <div className="role-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

export function UserManagementPage() {
  const feature = useUserManagementFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, roleFilter, departmentFilter, branchFilter, statusFilter, sortColumn, sortDirection, currentPage, pageSize } = state;
  const { setQuery, setRoleFilter, setDepartmentFilter, setBranchFilter, setStatusFilter, setCurrentPage, setPageSize } = state;
  const { users: pageUsers, meta, summary, roleOptions, branchOptions, departmentOptions, departmentFilterOptions, assignmentOptionsLoaded, passwordPolicy } = data;
  const { isFetching: loading, loadError, forbidden, isMutating: submitting } = status;
  const { canCreate, canEdit, canDelete, canChangePassword, canResetPassword } = rbac;
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


  const watchedBranchId = userForm.watch('branchId');
  const watchedDepartmentId = userForm.watch('departmentId');
  const watchedEmail = userForm.watch('email');
  const watchedPassword = userForm.watch('password') || '';
  const watchedStatus = userForm.watch('status') || 'Active';
  const isEditingSuperAdmin = modalMode === 'edit' &&
    Boolean(activeUser?.source.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const activeSuperAdminRoleId = activeUser?.source.roles.find((role) => role.code === 'SUPER_ADMIN')?.id;

  useEffect(() => {
    if (!isEditingSuperAdmin || !activeUser || !assignmentOptionsLoaded) return;

    const currentBranchId = userForm.getValues('branchId');
    const selectedBranchId = branchOptions.some((branch) => branch.id === currentBranchId)
      ? currentBranchId
      : branchOptions[0]?.id ?? '';
    const currentDepartmentId = userForm.getValues('departmentId');
    const selectedDepartmentId = departmentOptions.some(
      (department) => department.id === currentDepartmentId && department.branch_ids.includes(selectedBranchId),
    )
      ? currentDepartmentId
      : departmentOptions.find((department) => department.branch_ids.includes(selectedBranchId))?.id ?? '';

    if (currentBranchId !== selectedBranchId) {
      userForm.setValue('branchId', selectedBranchId, { shouldValidate: true });
    }
    if (currentDepartmentId !== selectedDepartmentId) {
      userForm.setValue('departmentId', selectedDepartmentId, { shouldValidate: true });
    }
  }, [activeUser, assignmentOptionsLoaded, branchOptions, departmentOptions, isEditingSuperAdmin, userForm]);

  useEffect(() => {
    if (modalMode === 'create') {
      const userVal = watchedEmail ? (watchedEmail.includes('@') ? watchedEmail.split('@')[0] : watchedEmail) : '';
      userForm.setValue('username', userVal || '');
    }
  }, [watchedEmail, modalMode, userForm]);

  useEffect(() => {
    if (!assignmentOptionsLoaded) return;
    if (!watchedBranchId) {
      if (isEditingSuperAdmin) return;
      userForm.setValue('departmentId', '');
      userForm.setValue('roleId', '');
    } else {
      const currentDeptId = userForm.getValues('departmentId');
      if (currentDeptId) {
        const belongsToBranch = departmentOptions.some(
          (dept) => dept.id === currentDeptId && dept.branch_ids.includes(watchedBranchId),
        );
        if (!belongsToBranch) {
          userForm.setValue('departmentId', '');
          userForm.setValue('roleId', '');
        }
      }
    }
  }, [assignmentOptionsLoaded, isEditingSuperAdmin, watchedBranchId, departmentOptions, userForm]);

  const availableDepartmentsForBranch = useMemo(() => {
    if (!watchedBranchId) return [];
    return departmentOptions.filter((dept) => dept.branch_ids.includes(watchedBranchId));
  }, [watchedBranchId, departmentOptions]);

  const selectedDepartment = useMemo(() => {
    if (!watchedDepartmentId) return null;
    return departmentOptions.find((dept) => dept.id === watchedDepartmentId) ?? null;
  }, [watchedDepartmentId, departmentOptions]);

  const availableRolesForDepartment = useMemo(() => {
    if (!selectedDepartment) return [];
    const deptCode = (selectedDepartment.code || '').toUpperCase();
    const deptName = (selectedDepartment.name || '').toUpperCase();

    return roleOptions.filter((role) => {
      const rCode = (role.code || '').toUpperCase();
      const rName = (role.name || '').toUpperCase();

      // System-wide roles (Super Admin, Administrator, Patient, Guardian) are excluded from department-specific staff user creation
      if (['SUPER_ADMIN', 'ADMINISTRATOR', 'PATIENT', 'GUARDIAN'].includes(rCode)) {
        return false;
      }

      // Dental
      if (deptCode.includes('DENT') || deptName.includes('DENTAL') || deptName.includes('DENTISTRY')) {
        return rCode.includes('DENTAL') || rCode.includes('DENTIST') || rName.includes('DENTAL') || rName.includes('DENTIST');
      }

      // Imaging / Radiology
      if (deptCode.includes('IMG') || deptCode.includes('RAD') || deptName.includes('IMAGING') || deptName.includes('RADIOLOGY')) {
        return rCode === 'IMAGING_USER';
      }
      // Laboratory / Lab
      if (deptCode.includes('LAB') || deptName.includes('LABORATORY') || deptName.includes('LAB')) {
        return rCode === 'LABORATORY_USER';
      }
      // Pharmacy
      if (deptCode.includes('PHARM') || deptName.includes('PHARMACY')) {
        return rCode === 'PHARMACY_USER';
      }
      // Nursing / Wards / Inpatient / IPD
      if (deptCode.includes('NURS') || deptCode.includes('WARD') || deptCode.includes('IPD') || deptName.includes('NURSING') || deptName.includes('WARD')) {
        return rCode === 'CLINICIAN_NURSE';
      }
      // Reception / Front Desk / OPD / Registration
      if (deptCode.includes('REC') || deptCode.includes('OPD') || deptName.includes('RECEPTION') || deptName.includes('FRONT DESK')) {
        return rCode === 'RECEPTIONIST' || rCode === 'PATIENT' || rCode === 'GUARDIAN';
      }
      // Billing / Finance / Accounts
      if (deptCode.includes('BILL') || deptCode.includes('FIN') || deptCode.includes('ACC') || deptName.includes('BILLING') || deptName.includes('FINANCE')) {
        return rCode === 'BILLING_AUTHORIZED';
      }
      // Doctor / Medical Staff / Consultation
      if (deptCode.includes('DOC') || deptCode.includes('MED') || deptName.includes('DOCTOR') || deptName.includes('CONSULTATION') || deptName.includes('CLINIC')) {
        return rCode === 'DOCTOR' || rCode === 'CLINICIAN_NURSE';
      }
      // Emergency / Casualty
      if (deptCode.includes('EMG') || deptCode.includes('CAS') || deptName.includes('EMERGENCY') || deptName.includes('CASUALTY')) {
        return rCode === 'DOCTOR' || rCode === 'CLINICIAN_NURSE' || rCode === 'RECEPTIONIST';
      }

      // Default fallback: allow custom/unmatched roles if department type is generic
      return true;
    });
  }, [selectedDepartment, roleOptions]);

  useEffect(() => {
    if (isEditingSuperAdmin && userForm.getValues('roleId') === activeSuperAdminRoleId) return;
    if (!watchedDepartmentId) {
      userForm.setValue('roleId', '');
    } else {
      const currentRoleId = userForm.getValues('roleId');
      if (currentRoleId) {
        const isRoleValid = availableRolesForDepartment.some((r) => r.id === currentRoleId);
        if (!isRoleValid) {
          userForm.setValue('roleId', '');
        }
      }
    }
  }, [activeSuperAdminRoleId, activeUser, isEditingSuperAdmin, watchedDepartmentId, availableRolesForDepartment, userForm]);

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
        roleId: user.source.roles.find((role) => role.code === 'SUPER_ADMIN')?.id ?? user.roleId,
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
    const computedEmployeeCode = data.employeeCode?.trim() || `EMP-${Date.now().toString().slice(-6)}`;
    const roleIds = data.roleId ? [data.roleId] : [];
    return {
      branches: branchOptions.filter(b => b.id === data.branchId).map(b => ({ id: b.id, name: b.name, isPrimary: true })),
      departments: departmentOptions.filter(d => d.id === data.departmentId).map(d => ({ id: d.id, name: d.name, isPrimary: true })),
      email: data.email || null,
      employeeCode: computedEmployeeCode,
      fullName: data.fullName,
      jobTitle: data.jobTitle || '',
      phone: data.phone || null,
      ...(roleIds.length > 0 ? { roleIds } : {}),
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

    if (!formData.roleId) {
      userForm.setError('roleId', { message: 'Role assignment is required.' });
      return;
    }

    try {
      const payload = buildSavePayload(formData);

      if (modalMode === 'create') {
        await mutations.createUser.mutateAsync({ ...payload, password: formData.password! });
        showToast('User created successfully.');
      } else if (modalMode === 'edit' && activeUser) {
        await mutations.updateUser.mutateAsync({ id: activeUser.apiId, payload });
        const targetApiStatus = payload.status;
        const currentApiStatus = activeUser.status.toLowerCase();
        if (targetApiStatus && targetApiStatus !== currentApiStatus) {
          await mutations.updateStatus.mutateAsync({ id: activeUser.apiId, status: targetApiStatus });
        }
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


  const executeDelete = async () => {
    if (!deleteTarget || submitting) return;
    if (deleteTarget.status !== 'Inactive') {
      showToast('Active users cannot be deleted. Please set user status to Inactive first.', 'error');
      setDeleteTarget(null);
      return;
    }
    try {
      await mutations.deleteUser.mutateAsync(deleteTarget.apiId);
      showToast(`${deleteTarget.fullName} has been deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!canDelete || submitting || selectedIds.size === 0) return;
    const selectedUsers = pageUsers.filter((u) => selectedIds.has(u.apiId));
    const nonInactiveUsers = selectedUsers.filter((u) => u.status !== 'Inactive');
    if (nonInactiveUsers.length > 0) {
      showToast(`Cannot delete active users (${nonInactiveUsers.length}). Please set status to Inactive first.`, 'error');
      return;
    }
    try {
      await Promise.all(Array.from(selectedIds).map((id) => mutations.deleteUser.mutateAsync(id)));
      showToast(`Deleted ${selectedIds.size} users.`);
      setSelectedIds(new Set());
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
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

  const renderModalHeader = () => {
    let icon = 'ph-user-plus';
    let title = 'Add New Staff User';
    let subtitle = 'Provision employee credentials, contact details, and department roles.';
    const modeClass = modalMode === 'create' ? 'create' : modalMode === 'edit' ? 'edit' : modalMode === 'view' ? 'view' : 'security';

    if (modalMode === 'edit') {
      icon = 'ph-user-gear';
      title = activeUser ? `Edit User — ${activeUser.fullName}` : 'Edit Staff User';
      subtitle = activeUser ? `${activeUser.role} • ${activeUser.department} • ${activeUser.branch}` : 'Update staff details and access configuration.';
    } else if (modalMode === 'view') {
      icon = 'ph-identification-card';
      title = activeUser ? activeUser.fullName : 'Staff Profile';
      subtitle = activeUser ? `${activeUser.role} • ${activeUser.department} (${activeUser.branch})` : 'Employee Directory Profile';
    } else if (modalMode === 'assign-role') {
      icon = 'ph-shield-check';
      title = activeUser ? `Assign Role — ${activeUser.fullName}` : 'Assign Role';
      subtitle = 'Configure administrative and clinical role permissions.';
    } else if (modalMode === 'change-password' || modalMode === 'reset-password') {
      icon = 'ph-lock-key';
      title = modalMode === 'reset-password' ? 'Reset User Password' : 'Change Password';
      subtitle = activeUser ? `Update security access credentials for ${activeUser.fullName}` : 'Update security access credentials.';
    }

    const initials = activeUser?.fullName
      ? activeUser.fullName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
      : 'NU';

    return (
      <div className="um-modal-header-custom">
        <div className="um-modal-header-left">
          <div className={`um-modal-header-icon-box ${modeClass}`}>
            {activeUser && (modalMode === 'edit' || modalMode === 'view') ? (
              <span className="um-modal-avatar-initials">{initials}</span>
            ) : (
              <i className={`ph ${icon}`} />
            )}
          </div>
          <div className="um-modal-header-text">
            <div className="um-modal-header-top-line">
              <h3 className="um-modal-heading">{title}</h3>
              {activeUser && (modalMode === 'edit' || modalMode === 'view') ? (
                <span className={`um-status-badge-inline um-status-badge--${activeUser.status.toLowerCase()}`}>
                  <span className="um-status-dot" />
                  {activeUser.status}
                </span>
              ) : null}
            </div>
            <p className="um-modal-subheading">{subtitle}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="um-grid user-management-page">
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

        {/* <div className="um-charts-row">
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
        </div> */}

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
                  {departmentFilterOptions.map((department) => (
                      <option key={department.key} value={department.value}>
                        {department.name}
                      </option>
                  ))}
                </select>
                <select
                  className="um-filter"
                  onChange={(event) => {
                    setBranchFilter(event.target.value);
                    setDepartmentFilter('');
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
                                  disabled={user.status !== 'Inactive' || submitting}
                                  onClick={() => {
                                    if (user.status !== 'Inactive') {
                                      showToast('Active users cannot be deleted. Please set status to Inactive first.', 'error');
                                      return;
                                    }
                                    setDeleteTarget(user);
                                  }}
                                  title={user.status !== 'Inactive' ? 'Active user cannot be deleted. Deactivate user first.' : 'Delete'}
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
        </div>

      <Modal
        className="um-user-modal"
        size="large"
        footer={
          modalMode === 'view' ? (
            <div className="um-modal-footer">
              <span className="um-modal-footer-hint">
                <i className="ph ph-info" /> Read-only staff directory record
              </span>
              <button className="um-modal-btn-cancel" onClick={closeModal} type="button">
                Close
              </button>
            </div>
          ) : (
            <div className="um-modal-footer">
              <span className="um-modal-footer-hint">
                <i className="ph ph-info" /> Fields marked with <span className="um-required-star">*</span> are mandatory
              </span>
              <div className="um-modal-footer-actions">
                <button className="um-modal-btn-cancel" disabled={submitting} onClick={closeModal} type="button">
                  Cancel
                </button>
                <button className="um-modal-btn-submit" disabled={submitting} form="user-management-modal-form" type="submit">
                  {submitting ? (
                    <>
                      <MedicalSpinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : modalMode === 'reset-password' ? (
                    <>
                      <i className="ph ph-lock-key" />
                      <span>Reset Password</span>
                    </>
                  ) : modalMode === 'change-password' ? (
                    <>
                      <i className="ph ph-keyhole" />
                      <span>Change Password</span>
                    </>
                  ) : modalMode === 'assign-role' ? (
                    <>
                      <i className="ph ph-shield-check" />
                      <span>Assign Role</span>
                    </>
                  ) : modalMode === 'edit' ? (
                    <>
                      <i className="ph ph-check" />
                      <span>Save Changes</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-user-plus" />
                      <span>Create Staff User</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        }
        onClose={closeModal}
        open={Boolean(modalMode)}
        title={renderModalHeader()}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert" style={{ marginBottom: '1rem' }}>
            <i className="ph ph-warning-circle" style={{ marginRight: 6 }} />
            {formError}
          </div>
        ) : null}

        {modalMode === 'create' || modalMode === 'edit' || modalMode === 'assign-role' ? (
          <form className="user-management-edit-form" id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void userForm.handleSubmit(handleSaveUser)(event); }}>
            {modalMode !== 'assign-role' ? (
              <>
                {/* Section 1: Personal Information */}
                <div className="um-modal-card">
                  <div className="um-modal-card-header">
                    <div className="um-card-title-wrap">
                      <i className="ph ph-identification-card" />
                      <span>Staff Personal Information</span>
                    </div>
                    <span className="um-card-badge">Basic Identity</span>
                  </div>
                  <div className="um-modal-card-body">
                    {/* Identity Chips (Employee ID & Username) */}
                    <div className="um-identity-strip">
                      <div className="um-identity-chip">
                        <div className="um-identity-chip-icon">
                          <i className="ph ph-hash" />
                        </div>
                        <div className="um-identity-chip-info">
                          <span className="um-identity-chip-title">Employee ID</span>
                          <span className="um-identity-chip-value">
                            {userForm.watch('employeeCode') || activeUser?.source.employeeCode || 'Auto-generated upon save'}
                          </span>
                        </div>
                        <span className="um-identity-chip-pill">Auto</span>
                      </div>

                      <div className="um-identity-chip">
                        <div className="um-identity-chip-icon">
                          <i className="ph ph-at" />
                        </div>
                        <div className="um-identity-chip-info">
                          <span className="um-identity-chip-title">Username</span>
                          <span className="um-identity-chip-value">
                            {watchedEmail ? (watchedEmail.includes('@') ? watchedEmail.split('@')[0] : watchedEmail) : (activeUser?.username || 'Auto-synced from email')}
                          </span>
                        </div>
                        <span className="um-identity-chip-pill">Synced</span>
                      </div>
                    </div>

                    {/* Hidden inputs to keep values registered in react-hook-form */}
                    <input type="hidden" {...userForm.register('employeeCode')} />
                    <input type="hidden" {...userForm.register('username')} />

                    {/* Row 1: Full Name & Email */}
                    <div className="um-form-row-2">
                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-user" /> Full Name
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <input
                            aria-invalid={Boolean(userForm.formState.errors.fullName)}
                            placeholder="e.g. Dr. Arthur Conan"
                            {...userForm.register('fullName')}
                          />
                          <i className="ph ph-user um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.fullName ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.fullName.message}
                          </span>
                        ) : null}
                      </div>

                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-envelope-simple" /> Email Address
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <input
                            aria-invalid={Boolean(userForm.formState.errors.email)}
                            placeholder="e.g. arthur.conan@hospital.org"
                            type="email"
                            {...userForm.register('email')}
                          />
                          <i className="ph ph-envelope-simple um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.email ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.email.message}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Row 2: Phone & Job Title */}
                    <div className="um-form-row-2">
                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-phone" /> Contact Phone
                          </span>
                        </label>
                        <div className="um-input-wrap">
                          <input
                            placeholder="+1 (555) 000-0000"
                            {...userForm.register('phone')}
                          />
                          <i className="ph ph-phone um-input-prefix-icon" />
                        </div>
                      </div>

                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-briefcase" /> Designation / Job Title
                          </span>
                        </label>
                        <div className="um-input-wrap">
                          <input
                            placeholder="e.g. Senior Consultant / Staff Nurse"
                            {...userForm.register('jobTitle')}
                          />
                          <i className="ph ph-briefcase um-input-prefix-icon" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Hospital Placement & Role Assignment */}
                <div className="um-modal-card">
                  <div className="um-modal-card-header">
                    <div className="um-card-title-wrap">
                      <i className="ph ph-buildings" />
                      <span>Role &amp; Assignment</span>
                    </div>
                    <span className="um-card-badge">Access &amp; Scope</span>
                  </div>
                  <div className="um-modal-card-body">
                    {/* Row 1: Branch, Department, Role */}
                    <div className="um-form-row-3">
                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-map-pin" /> Branch
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <select {...userForm.register('branchId')}>
                            <option value="">Select branch</option>
                            {branchOptions.map((branch) => (
                              <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                          </select>
                          <i className="ph ph-map-pin um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.branchId ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.branchId.message}
                          </span>
                        ) : null}
                      </div>

                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-tree-structure" /> Department
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <select
                            aria-invalid={Boolean(userForm.formState.errors.departmentId)}
                            disabled={!watchedBranchId}
                            {...userForm.register('departmentId')}
                          >
                            <option value="">
                              {!watchedBranchId
                                ? 'Select branch first'
                                : availableDepartmentsForBranch.length === 0
                                ? 'No departments available'
                                : 'Select department'}
                            </option>
                            {availableDepartmentsForBranch.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                          <i className="ph ph-tree-structure um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.departmentId ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.departmentId.message}
                          </span>
                        ) : null}
                      </div>

                      <div className="um-field">
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-shield-check" /> Role
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <select
                            aria-invalid={Boolean(userForm.formState.errors.roleId)}
                            disabled={!watchedDepartmentId}
                            {...userForm.register('roleId')}
                          >
                            <option value="">
                              {!watchedDepartmentId
                                ? 'Select department first'
                                : 'Select role'}
                            </option>
                            {(isEditingSuperAdmin ? roleOptions : availableRolesForDepartment).map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <i className="ph ph-shield-check um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.roleId ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.roleId.message}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Row 2: Status Field (Single Active pill for Create, 3-option Dropdown for Edit) */}
                    {modalMode === 'create' ? (
                      <div className="um-field" style={{ marginTop: '0.85rem' }}>
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-toggle-left" /> Account Access Status
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-default-status-pill" title="New accounts are provisioned with Active status by default">
                          <div className="um-status-card-dot active" />
                          <div className="um-default-status-info">
                            <span className="um-default-status-title">Active</span>
                            <span className="um-default-status-hint">Default for new staff accounts • Full platform access enabled</span>
                          </div>
                          <span className="um-default-status-badge">
                            <i className="ph ph-check" /> Default
                          </span>
                        </div>
                        <input type="hidden" {...userForm.register('status')} />
                      </div>
                    ) : (
                      <div className="um-field" style={{ marginTop: '0.85rem' }}>
                        <label className="um-field-label">
                          <span className="um-field-label-text">
                            <i className="ph ph-toggle-left" /> Account Access Status
                          </span>
                          <span className="um-required-star">*</span>
                        </label>
                        <div className="um-input-wrap">
                          <select
                            aria-invalid={Boolean(userForm.formState.errors.status)}
                            {...userForm.register('status')}
                          >
                            {statuses.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                {statusOption} {statusOption === 'Active' ? '— Full platform access' : statusOption === 'Inactive' ? '— Access suspended' : '— Security lockout'}
                              </option>
                            ))}
                          </select>
                          <i className="ph ph-toggle-left um-input-prefix-icon" />
                        </div>
                        {userForm.formState.errors.status ? (
                          <span className="um-field-error">
                            <i className="ph ph-warning-circle" /> {userForm.formState.errors.status.message}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Security & Credentials (for Create Mode) */}
                {modalMode === 'create' ? (
                  <div className="um-modal-card">
                    <div className="um-modal-card-header">
                      <div className="um-card-title-wrap">
                        <i className="ph ph-lock-key" />
                        <span>Security Credentials</span>
                      </div>
                      <span className="um-card-badge">Password Setup</span>
                    </div>
                    <div className="um-modal-card-body">
                      <div className="um-form-row-2">
                        <div className="um-field">
                          <label className="um-field-label">
                            <span className="um-field-label-text">
                              <i className="ph ph-lock" /> Password
                            </span>
                            <span className="um-required-star">*</span>
                          </label>
                          <PasswordInput
                            autoComplete="new-password"
                            invalid={Boolean(userForm.formState.errors.password)}
                            placeholder="Enter secure password"
                            {...userForm.register('password')}
                            onToggle={() => togglePasswordVisibility('create')}
                            visible={visiblePasswordFields.has('create')}
                          />
                          {userForm.formState.errors.password ? (
                            <span className="um-field-error">
                              <i className="ph ph-warning-circle" /> {userForm.formState.errors.password.message}
                            </span>
                          ) : null}
                        </div>

                        <div className="um-field">
                          <label className="um-field-label">
                            <span className="um-field-label-text">
                              <i className="ph ph-lock" /> Confirm Password
                            </span>
                            <span className="um-required-star">*</span>
                          </label>
                          <PasswordInput
                            autoComplete="new-password"
                            invalid={Boolean(userForm.formState.errors.confirmPassword)}
                            placeholder="Re-enter password"
                            {...userForm.register('confirmPassword')}
                            onToggle={() => togglePasswordVisibility('confirm')}
                            visible={visiblePasswordFields.has('confirm')}
                          />
                          {userForm.formState.errors.confirmPassword ? (
                            <span className="um-field-error">
                              <i className="ph ph-warning-circle" /> {userForm.formState.errors.confirmPassword.message}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <InteractivePasswordPolicy password={watchedPassword} policy={passwordPolicy} />
                    </div>
                  </div>
                ) : (
                  <div className="um-security-callout">
                    <i className="ph ph-shield-check" />
                    <div>
                      <strong>Password Credentials Protected:</strong> Password credentials are encrypted. To update or reset this user's password, use the <em>Reset Password</em> action from the table menu.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="um-modal-card">
                <div className="um-modal-card-header">
                  <div className="um-card-title-wrap">
                    <i className="ph ph-shield-check" />
                    <span>Role Assignment</span>
                  </div>
                  <span className="um-card-badge">Role Only</span>
                </div>
                <div className="um-modal-card-body">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-shield-check" /> Assign Role
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <select {...userForm.register('roleId')}>
                        <option value="">Select role</option>
                        {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                      <i className="ph ph-shield-check um-input-prefix-icon" />
                    </div>
                    {userForm.formState.errors.roleId ? (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {userForm.formState.errors.roleId.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </form>
        ) : null}

        {modalMode === 'change-password' || modalMode === 'reset-password' ? (
          <form id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void passwordForm.handleSubmit(handlePasswordSubmit)(event); }}>
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-lock-key" />
                  <span>{modalMode === 'change-password' ? 'Change Password' : 'Reset Password'}</span>
                </div>
                <span className="um-card-badge">Security Action</span>
              </div>
              <div className="um-modal-card-body">
                {modalMode === 'change-password' ? (
                  <div className="um-field" style={{ marginBottom: '1rem' }}>
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-key" /> Current Password
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <PasswordInput
                      autoComplete="current-password"
                      invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                      placeholder="Enter current password"
                      {...passwordForm.register('currentPassword')}
                      onToggle={() => togglePasswordVisibility('current')}
                      visible={visiblePasswordFields.has('current')}
                    />
                    {passwordForm.formState.errors.currentPassword ? (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {passwordForm.formState.errors.currentPassword.message}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="um-field">
                  <label className="um-field-label">
                    <span className="um-field-label-text">
                      <i className="ph ph-lock" /> New Password
                    </span>
                    <span className="um-required-star">*</span>
                  </label>
                  <PasswordInput
                    autoComplete="new-password"
                    invalid={Boolean(passwordForm.formState.errors.newPassword)}
                    placeholder="Enter new password"
                    {...passwordForm.register('newPassword')}
                    onToggle={() => togglePasswordVisibility('new')}
                    visible={visiblePasswordFields.has('new')}
                  />
                  {passwordForm.formState.errors.newPassword ? (
                    <span className="um-field-error">
                      <i className="ph ph-warning-circle" /> {passwordForm.formState.errors.newPassword.message}
                    </span>
                  ) : null}
                </div>

                <InteractivePasswordPolicy password={passwordForm.watch('newPassword') || ''} policy={passwordPolicy} />
              </div>
            </div>
          </form>
        ) : null}

        {modalMode === 'view' && activeUser ? (
          <div className="um-view-profile-container">
            {/* Hero Card */}
            <div className="um-view-profile-hero">
              <div className="um-view-avatar">
                {activeUser.fullName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="um-view-hero-text">
                <h4>{activeUser.fullName}</h4>
                <div className="um-view-hero-badges">
                  <span className="um-view-role-badge">
                    <i className="ph ph-shield-check" style={{ marginRight: 4 }} />
                    {activeUser.role}
                  </span>
                  <span className={`um-status-badge-inline um-status-badge--${activeUser.status.toLowerCase()}`}>
                    <span className="um-status-dot" />
                    {activeUser.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="um-view-grid">
              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-hash" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Employee ID</span>
                  <span className="um-view-item-value">{activeUser.source.employeeCode || 'Not Assigned'}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-at" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Username</span>
                  <span className="um-view-item-value">{activeUser.username}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-envelope-simple" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Email Address</span>
                  <span className="um-view-item-value">{activeUser.email || 'None'}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-phone" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Contact Phone</span>
                  <span className="um-view-item-value">{activeUser.phone || 'None'}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-map-pin" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Branch</span>
                  <span className="um-view-item-value">{activeUser.branch}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-tree-structure" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Department</span>
                  <span className="um-view-item-value">{activeUser.department}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-clock" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Last Login</span>
                  <span className="um-view-item-value">{activeUser.lastLogin}</span>
                </div>
              </div>

              <div className="um-view-item">
                <div className="um-view-item-icon"><i className="ph ph-briefcase" /></div>
                <div className="um-view-item-content">
                  <span className="um-view-item-label">Job Title</span>
                  <span className="um-view-item-value">{activeUser.source.jobTitle || activeUser.role}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </Modal>

      <ConfirmDialog
        confirmLabel="Delete User"
        loading={submitting}
        message={deleteTarget ? `Are you sure you want to delete inactive user "${deleteTarget.fullName}"? This action cannot be undone.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void executeDelete()}
        open={Boolean(deleteTarget)}
        title="Delete User"
      />
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
