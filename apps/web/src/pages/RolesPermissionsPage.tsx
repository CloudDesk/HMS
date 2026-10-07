import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRolesPermissionsFeature } from '../hooks/admin/useRolesPermissionsFeature';
import { useTimezone } from '../api/useSettings';
import { formatRegionalDateTime } from '../utils/localization-utils';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { type PermissionResponse } from '../api/permissions';
import { type UserResponse } from '../api/users';
import { type ApiRoleStatus, type ApiRoleType, type RoleResponse, type RoleAssignedUser } from '../api/roles';
import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import { useAppLocation } from '../routing/navigation';
import { toast } from 'sonner';

type ModalMode = 'create' | 'edit' | 'clone' | 'status' | 'assign-user' | 'remove-user' | 'delete' | 'audit';

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(['system', 'custom']),
  status: z.enum(['active', 'inactive']),
});
type RoleFormData = z.infer<typeof roleSchema>;

const userSchema = z.object({
  userId: z.string().min(1, 'Select a user.'),
});
type UserFormData = z.infer<typeof userSchema>;

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

const roleColors = ['#0f172a', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0d9488', '#0891b2'];

const roleInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const fallbackRoleColor = (name: string) => {
  const index = [...name].reduce((t, c) => t + c.charCodeAt(0), 0);
  return roleColors[index % roleColors.length];
};

const isApiRoleStatus = (val: string): val is ApiRoleStatus => val === 'active' || val === 'inactive';
const roleStatusLabel = (status: ApiRoleStatus) => (status === 'active' ? 'Active' : 'Inactive');

const roleCodeFromName = (name: string) =>
  name.trim().replaceAll(/[^A-Za-z0-9]+/g, '_').replaceAll(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase();

const downloadJson = (filename: string, value: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Human-readable column labels for the permission matrix header
const permActionLabel = (action: string): string => {
  const map: Record<string, string> = {
    AdjustStock: 'Adjust Stock',
    ChangePassword: 'Change Password',
    ConfigureLowStock: 'Configure Low-Stock',
    ConvertToIP: 'Convert to Inpatient',
    EnterReport: 'Enter Imaging Report',
    EnterResult: 'Enter Lab Result',
    MarkNoShow: 'Mark No-Show',
    OverridePriority: 'Override Priority',
    ProvisionLogin: 'Provision Doctor Login',
    'Provision Login': 'Provision Doctor Login',
    RecordMovement: 'Record Stock Movement',
    ResetPassword: 'Reset Password',
    UpdateStatus: 'Update Status',
    VerifyReport: 'Verify Imaging Report',
    VerifyResult: 'Verify Lab Result',
    ViewReceipt: 'View Receipt',
  };
  return map[action] ?? action.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
};

// Human-readable screen labels for the permission matrix rows
const permScreenLabel = (screen: string): string => {
  const map: Record<string, string> = {
    Medicines: 'Medicine Master',
    'Phase 2 Reports': 'Reports',
  };
  return map[screen] ?? screen;
};

export function RolesPermissionsPage() {
  const timezone = useTimezone();
  const { refreshCurrentUser } = useAuth();
  const { search: locationSearch } = useAppLocation();

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const feature = useRolesPermissionsFeature(modalMode);

  const { state, data, status, rbac, actions, mutations } = feature;
  const {
    search, typeFilter, statusFilter, selectedRoleId,
    setSearch, setTypeFilter, setStatusFilter, setSelectedRoleId,
  } = state;
  const {
    roles, roleStats, permissions, selectedRole,
    rolePermissions, roleAuditLogs, usersList, permissionActions, permissionRows,
  } = data;
  const {
    isFetching, isMutating, forbidden, rolesLoading, statsLoading,
    permissionsLoading, roleLoading, auditLoading, loadError, permissionError,
  } = status;
  const { canCreateRole, canEditRole, canAssignRole, canAssignUser, canDeleteRole, canEditPermissions } = rbac;
  const { refreshRolesAndPermissions } = actions;

  const roleForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', color: '#2563eb', type: 'custom', status: 'active', description: '' },
  });
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { userId: '' },
  });

  const [formError, setFormError] = useState('');
  const [targetRole, setTargetRole] = useState<RoleResponse | null>(null);
  const [openFromList, setOpenFromList] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set());
  const [permSearch, setPermSearch] = useState('');
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<string>>(() => new Set());
  const [draftPermissionIds, setDraftPermissionIds] = useState<Set<string>>(() => new Set());

  // Dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!roleDropdownOpen && !actionsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (roleDropdownOpen && roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (actionsMenuOpen && actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleDropdownOpen, actionsMenuOpen]);

  useEffect(() => {
    if (rolePermissions) {
      const ids = new Set(rolePermissions.map((p) => p.id));
      setAssignedPermissionIds(ids);
      setDraftPermissionIds(new Set(ids));
    }
  }, [rolePermissions]);

  useEffect(() => { setPermSearch(''); }, [selectedRoleId]);

  // Close menus when role changes
  useEffect(() => {
    setActionsMenuOpen(false);
    setRoleDropdownOpen(false);
  }, [selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId && roles.length > 0 && !roles.find((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(null);
    }
  }, [roles, selectedRoleId, setSelectedRoleId]);

  const toggleModule = (module: string) => {
    setCollapsedModules((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (assignedPermissionIds.size !== draftPermissionIds.size) return true;
    return [...assignedPermissionIds].some((id) => !draftPermissionIds.has(id));
  }, [assignedPermissionIds, draftPermissionIds]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const handleBackToList = () => {
    if (dirty && !window.confirm('You have unsaved permission changes. Discard unsaved changes and return to the roles list?')) {
      return;
    }
    setSelectedRoleId(null);
  };

  const selectRole = (roleId: string) => {
    if (dirty && !window.confirm('Discard unsaved permission changes and open another role?')) return;
    setSelectedRoleId(roleId);
  };

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          role.name.toLowerCase().includes(q) ||
          role.code.toLowerCase().includes(q) ||
          (role.description?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      if (typeFilter && role.type !== typeFilter) return false;
      if (statusFilter && role.status !== statusFilter) return false;
      return true;
    });
  }, [roles, search, typeFilter, statusFilter]);

  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRoles = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredRoles.slice(startIndex, startIndex + pageSize);
  }, [filteredRoles, safePage, pageSize]);

  const showingLabel =
    filteredRoles.length === 0
      ? 'No roles to display'
      : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredRoles.length)} of ${filteredRoles.length} roles`;

  const refreshWithConfirmation = () => {
    if (dirty && !window.confirm('Discard unsaved permission changes and refresh from the server?')) return;
    void refreshRolesAndPermissions();
  };

  const filteredPermissionRows = useMemo(() => {
    if (!permSearch.trim()) return permissionRows;
    const q = permSearch.trim().toLowerCase();
    return permissionRows.filter(
      (row) =>
        row.screen.toLowerCase().includes(q) ||
        permScreenLabel(row.screen).toLowerCase().includes(q) ||
        row.module.toLowerCase().includes(q) ||
        Object.values(row.permissions).some((permission) =>
          permission.action.toLowerCase().includes(q) ||
          permission.name.toLowerCase().includes(q) ||
          permission.description?.toLowerCase().includes(q),
        ),
    );
  }, [permissionRows, permSearch]);

  const visibleModules = useMemo(
    () => [...new Set(filteredPermissionRows.map((r) => r.module))],
    [filteredPermissionRows],
  );

  // Compute enabled/total permission counts per module for the module-group headers
  const getModuleStats = useCallback(
    (module: string) => {
      const rows = permissionRows.filter((r) => r.module === module);
      let total = 0;
      let enabled = 0;
      for (const row of rows) {
        for (const perm of Object.values(row.permissions)) {
          if (perm.status === 'active') {
            total++;
            if (draftPermissionIds.has(perm.id)) enabled++;
          }
        }
      }
      return { enabled, total };
    },
    [permissionRows, draftPermissionIds],
  );

  const updatePermission = (permission: PermissionResponse, checked: boolean) => {
    if (!canEditPermissions || permission.status !== 'active') return;
    setDraftPermissionIds((current) => {
      const next = new Set(current);
      if (checked) next.add(permission.id);
      else next.delete(permission.id);
      return next;
    });
  };

  const setAllPermissions = (checked: boolean) => {
    if (!canEditPermissions) return;
    setDraftPermissionIds(
      checked
        ? new Set(permissions.filter((p) => p.status === 'active').map((p) => p.id))
        : new Set(),
    );
  };

  const savePermissions = () => {
    if (!selectedRole || !canEditPermissions || !dirty) return;
    const activeIds = new Set(permissions.filter((p) => p.status === 'active').map((p) => p.id));
    const validIds = [...draftPermissionIds].filter((id) => activeIds.has(id));
    mutations.replacePermissions.mutate(
      { roleId: selectedRole.id, permissionIds: validIds, expectedRoleUpdatedAt: selectedRole.updatedAt },
      {
        onSuccess: async () => {
          await refreshCurrentUser();
          toast.success('Role permissions saved successfully.');
        },
      },
    );
  };

  const closeModal = () => {
    if (isMutating) return;
    setModalMode(null);
    setTargetRole(null);
    setFormError('');
    if (openFromList) {
      setOpenFromList(false);
      setSelectedRoleId(null);
    }
  };

  const openRoleModal = (mode: Extract<ModalMode, 'create' | 'edit' | 'clone'>, role?: RoleResponse | null) => {
    const r = role ?? selectedRole;
    setTargetRole(role ?? null);
    setModalMode(mode);
    setFormError('');
    setActionsMenuOpen(false);
    roleForm.reset({
      color: r?.color ?? '#2563eb',
      description: mode === 'create' ? '' : (r?.description ?? ''),
      name:
        mode === 'clone' && r
          ? `${r.name} Copy`
          : mode === 'edit'
          ? (r?.name ?? '')
          : '',
      status: mode === 'create' ? 'active' : (r?.status ?? 'active'),
      type: mode === 'edit' ? (r?.type ?? 'custom') : 'custom',
    });
  };

  const openAuditModal = (role?: RoleResponse | null) => {
    const r = role ?? selectedRole;
    if (!r) return;
    if (role && !selectedRoleId) {
      setOpenFromList(true);
      setSelectedRoleId(role.id);
    }
    setTargetRole(role ?? null);
    setModalMode('audit');
    setFormError('');
    setActionsMenuOpen(false);
  };

  const openStatusModal = (role?: RoleResponse | null) => {
    const r = role ?? selectedRole;
    if (!r) return;
    setTargetRole(role ?? null);
    setFormError('');
    setModalMode('status');
    setActionsMenuOpen(false);
  };

  const openDeleteModal = (role?: RoleResponse | null) => {
    const r = role ?? selectedRole;
    if (!r) return;
    setTargetRole(role ?? null);
    setModalMode('delete');
    setActionsMenuOpen(false);
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode)
      openRoleModal('create');
  }, [locationSearch]);

  const openUserModal = (mode: Extract<ModalMode, 'assign-user' | 'remove-user'>, role?: RoleResponse | null) => {
    const r = role ?? selectedRole;
    if (!r) return;
    if (role && !selectedRoleId) {
      setOpenFromList(true);
      setSelectedRoleId(role.id);
    }
    setTargetRole(role ?? null);
    setModalMode(mode);
    setFormError('');
    setActionsMenuOpen(false);
    userForm.reset({ userId: '' });
  };

  const onSubmitRole = roleForm.handleSubmit((values) => {
    setFormError('');
    if (modalMode === 'create' || modalMode === 'clone') {
      const code = roleCodeFromName(values.name);
      if (!code) { setFormError('Role name must contain letters or numbers.'); return; }
      mutations.createRole.mutate(
        {
          code,
          color: values.color ?? null,
          description: values.description?.trim() || null,
          name: values.name.trim(),
          status: values.status,
          type: 'custom',
        },
        {
          onSuccess: (created) => {
            if (modalMode === 'clone') {
              mutations.replacePermissions.mutate(
                { roleId: created.id, permissionIds: [...assignedPermissionIds], expectedRoleUpdatedAt: created.updatedAt },
                {
                  onSuccess: () => {
                    setSelectedRoleId(created.id);
                    toast.success('Role cloned successfully.');
                    closeModal();
                  },
                },
              );
            } else {
              setSelectedRoleId(created.id);
              toast.success('Role created successfully.');
              closeModal();
            }
          },
        },
      );
    } else if (modalMode === 'edit' && (targetRole ?? selectedRole)) {
      const currentRole = targetRole ?? selectedRole;
      if (!currentRole) return;
      mutations.updateRole.mutate(
        {
          id: currentRole.id,
          payload: {
            color: values.color ?? null,
            description: values.description?.trim() || null,
            name: values.name.trim(),
          },
        },
        { onSuccess: closeModal },
      );
    }
  });

  const onSubmitUser = userForm.handleSubmit((values) => {
    setFormError('');
    const currentRole = targetRole ?? selectedRole;
    if (!currentRole) return;
    if (modalMode === 'assign-user') {
      mutations.assignUser.mutate({ id: currentRole.id, userId: values.userId }, { onSuccess: closeModal });
    } else if (modalMode === 'remove-user') {
      mutations.removeUser.mutate({ id: currentRole.id, userId: values.userId }, { onSuccess: closeModal });
    }
  });

  const handleModalAction = () => {
    if (!modalMode || modalMode === 'audit') return;
    setFormError('');
    const currentRole = targetRole ?? selectedRole;
    if (modalMode !== 'create' && modalMode !== 'clone' && !currentRole) {
      setFormError('Select a role first.');
      return;
    }
    if (modalMode === 'status' && currentRole) {
      mutations.updateRoleStatus.mutate(
        { id: currentRole.id, status: currentRole.status === 'active' ? 'inactive' : 'active' },
        { onSuccess: closeModal },
      );
    } else if (modalMode === 'delete' && currentRole) {
      mutations.deleteRole.mutate(currentRole.id, {
        onSuccess: () => {
          if (selectedRoleId === currentRole.id) {
            setSelectedRoleId(null);
          }
          closeModal();
        },
      });
    }
  };

  const exportPermissionMatrix = () => {
    if (!selectedRole) return;
    downloadJson(`${selectedRole.code.toLowerCase()}-permissions.json`, {
      role: { code: selectedRole.code, id: selectedRole.id, name: selectedRole.name },
      permissions: permissions.map((p) => ({
        action: p.action,
        assigned: draftPermissionIds.has(p.id),
        code: p.code,
        module: p.module,
        screen: p.screen,
        status: p.status,
      })),
    });
    toast.success('Permission matrix exported.');
  };

  const modalTitle =
    modalMode === 'create' ? 'Create Role' :
    modalMode === 'edit' ? 'Edit Role' :
    modalMode === 'clone' ? 'Clone Role' :
    modalMode === 'status' ? 'Change Role Status' :
    modalMode === 'assign-user' ? 'Assign User' :
    modalMode === 'remove-user' ? 'Remove User' :
    modalMode === 'delete' ? 'Delete Role' :
    modalMode === 'audit' ? 'Audit History' :
    'Roles & Permissions';

  const activeRole = targetRole ?? selectedRole;
  const userOptions =
    usersList.filter((u: UserResponse) => !(activeRole?.users ?? []).some((su: RoleAssignedUser) => su.id === u.id)) ?? [];
  const auditItems = roleAuditLogs;
  const submitting = isMutating;
  const isSystemRole = activeRole?.type === 'system';

  return (
    <>
      <div className="rp-page">
        {/* ── Compact stat strip ── */}
        <div className="rp-stat-strip" aria-label="Role statistics">
          <div className="rp-stat-item">
            <i className="ph ph-shield-check rp-stat-icon blue" aria-hidden="true" />
            <span className="rp-stat-label">Total Roles</span>
            <span className="rp-stat-value">{statsLoading ? '—' : roleStats.total}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat-item">
            <i className="ph ph-shield-check rp-stat-icon green" aria-hidden="true" />
            <span className="rp-stat-label">Active</span>
            <span className="rp-stat-value">{statsLoading ? '—' : roleStats.active}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat-item">
            <i className="ph ph-lock-key rp-stat-icon purple" aria-hidden="true" />
            <span className="rp-stat-label">System Roles</span>
            <span className="rp-stat-value">{statsLoading ? '—' : roleStats.system}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat-item">
            <i className="ph ph-pencil-line rp-stat-icon orange" aria-hidden="true" />
            <span className="rp-stat-label">Custom Roles</span>
            <span className="rp-stat-value">{statsLoading ? '—' : roleStats.custom}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat-item">
            <i className="ph ph-key rp-stat-icon teal" aria-hidden="true" />
            <span className="rp-stat-label">Permissions</span>
            <span className="rp-stat-value">{permissionsLoading ? '—' : permissions.length}</span>
          </div>
          <div className="rp-stat-spacer" />
          <button
            className="rp-create-btn"
            disabled={forbidden || !canCreateRole}
            onClick={() => openRoleModal('create')}
            type="button"
          >
            <i className="ph ph-plus" aria-hidden="true" /> Create Role
          </button>
        </div>

        {/* ── Master List or Detail Matrix View ── */}
        {!selectedRoleId ? (
          <div className="um-table-section rp-table-card card">
            {/* Toolbar */}
            <div className="um-toolbar">
              <div className="um-toolbar-row1">
                <div className="um-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by role name, code, description..."
                    type="search"
                    value={search}
                  />
                </div>
                <button
                  className="um-add-btn"
                  disabled={forbidden || !canCreateRole}
                  onClick={() => openRoleModal('create')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" /> Create Role
                </button>
                <button
                  className="btn-secondary admin-table-action"
                  disabled={rolesLoading}
                  onClick={refreshWithConfirmation}
                  type="button"
                >
                  <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
                </button>
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filter by:</span>
                <select
                  aria-label="Role type filter"
                  className="um-filter"
                  onChange={(e) => setTypeFilter(e.target.value as ApiRoleType | '')}
                  value={typeFilter}
                >
                  <option value="">All Types</option>
                  <option value="system">System</option>
                  <option value="custom">Custom</option>
                </select>
                <select
                  aria-label="Role status filter"
                  className="um-filter"
                  onChange={(e) => {
                    const v = e.target.value;
                    setStatusFilter(isApiRoleStatus(v) ? v : '');
                  }}
                  value={statusFilter}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button
                  className="um-clear-btn"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('');
                    setStatusFilter('');
                  }}
                  type="button"
                >
                  <i className="ph ph-x" aria-hidden="true" /> Clear Filters
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Users Assigned</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem 1rem' }}>
                        <MedicalLoader
                          text="Loading roles..."
                          subtext="Retrieving hospital role definitions"
                        />
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                        <button
                          className="btn-secondary admin-table-action"
                          onClick={() => void refreshRolesAndPermissions()}
                          style={{ marginLeft: '1rem' }}
                          type="button"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : filteredRoles.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <i className="ph ph-shield-check" aria-hidden="true" />
                        No roles found matching your search or filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRoles.map((role) => (
                      <tr
                        key={role.id}
                        onClick={() => selectRole(role.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="user-cell">
                            <div
                              className="rp-role-avatar"
                              style={{ background: role.color ?? fallbackRoleColor(role.name) }}
                            >
                              {roleInitials(role.name)}
                            </div>
                            <div className="user-cell-info">
                              <span className="user-cell-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {role.name}
                                {role.type === 'system' && (
                                  <i className="ph ph-lock-simple" style={{ color: '#9333ea', fontSize: '0.85rem' }} title="System role" />
                                )}
                              </span>
                              <span className="emp-id" style={{ fontSize: '0.72rem' }}>{role.code}</span>
                              {role.description ? (
                                <span className="muted-cell" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                  {role.description}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`rp-role-badge ${role.type === 'system' ? 'badge-system' : 'badge-custom'}`}>
                            {role.type === 'system' ? <><i className="ph ph-lock-simple" aria-hidden="true" /> System</> : 'Custom'}
                          </span>
                        </td>
                        <td>
                          <span className={`rp-role-badge ${role.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                            {roleStatusLabel(role.status)}
                          </span>
                        </td>
                        <td>
                          <span className="emp-id" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#475569' }}>
                            <i className="ph ph-users" />
                            {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                          </span>
                        </td>
                        <td>
                          <span className="muted-cell" style={{ fontSize: '0.8rem' }}>
                            {formatRegionalDateTime(role.createdAt, timezone)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="action-icons" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              className="btn-secondary admin-table-action"
                              onClick={() => selectRole(role.id)}
                              style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.78rem', gap: '0.35rem' }}
                              title="Open and manage permissions matrix"
                              type="button"
                            >
                              <i className="ph ph-shield-check" style={{ color: '#2563eb' }} />
                              <span>Manage Permissions</span>
                            </button>
                            <button
                              aria-label={`Edit ${role.name}`}
                              className="action-icon-btn"
                              disabled={forbidden || !canEditRole || role.type === 'system'}
                              onClick={() => openRoleModal('edit', role)}
                              title={role.type === 'system' ? 'System roles cannot be edited' : 'Edit role'}
                              type="button"
                            >
                              <i className="ph ph-pencil" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={role.status === 'active' ? `Deactivate ${role.name}` : `Activate ${role.name}`}
                              className="action-icon-btn"
                              disabled={forbidden || !canEditRole || role.type === 'system'}
                              onClick={() => openStatusModal(role)}
                              title={role.type === 'system' ? 'System roles cannot be deactivated' : role.status === 'active' ? 'Deactivate role' : 'Activate role'}
                              type="button"
                            >
                              <i className={`ph ${role.status === 'active' ? 'ph-toggle-right' : 'ph-toggle-left'}`} aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Assign user to ${role.name}`}
                              className="action-icon-btn"
                              disabled={forbidden || !canAssignUser || role.status !== 'active'}
                              onClick={() => void openUserModal('assign-user', role)}
                              title={role.status !== 'active' ? 'Cannot assign users to inactive roles' : 'Assign user'}
                              type="button"
                            >
                              <i className="ph ph-user-plus" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Clone ${role.name}`}
                              className="action-icon-btn"
                              disabled={forbidden || !canCreateRole}
                              onClick={() => openRoleModal('clone', role)}
                              title="Clone role"
                              type="button"
                            >
                              <i className="ph ph-copy" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Audit history for ${role.name}`}
                              className="action-icon-btn"
                              onClick={() => void openAuditModal(role)}
                              title="Audit history"
                              type="button"
                            >
                              <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Delete ${role.name}`}
                              className="action-icon-btn danger"
                              disabled={role.type === 'system' || forbidden || !canDeleteRole}
                              onClick={() => openDeleteModal(role)}
                              title={role.type === 'system' ? 'System roles cannot be deleted' : 'Delete role'}
                              type="button"
                            >
                              <i className="ph ph-trash" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="um-pagination">
              <div className="um-showing">{showingLabel}</div>
              <div className="um-page-size">
                <span>Rows:</span>
                <select
                  aria-label="Rows per page"
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  value={pageSize}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div className="um-page-controls">
                <button
                  aria-label="Previous page"
                  className="pg-btn"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    aria-label={`Page ${page}`}
                    className={`pg-btn${page === safePage ? ' active' : ''}`}
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}
                <button
                  aria-label="Next page"
                  className="pg-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rp-workspace-full card">
            {/* ── Role Selector & Header Bar ── */}
            <div className="rp-role-header">
              <div className="rp-role-header-row">
                {/* Back to Roles Button */}
                <button
                  className="rp-back-btn"
                  onClick={handleBackToList}
                  title="Back to roles list"
                  type="button"
                >
                  <i className="ph ph-arrow-left" aria-hidden="true" />
                  <span>Back to Roles</span>
                </button>

                {/* Role Dropdown Trigger & Popover */}
              <div className="rp-role-select-wrap" ref={roleDropdownRef}>
                <button
                  className="rp-role-select-btn"
                  onClick={() => setRoleDropdownOpen((o) => !o)}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={roleDropdownOpen}
                >
                  <div
                    className="rp-role-avatar rp-role-avatar--md"
                    style={{ background: selectedRole?.color ?? (selectedRole ? fallbackRoleColor(selectedRole.name) : '#2563eb') }}
                  >
                    {selectedRole ? roleInitials(selectedRole.name) : '—'}
                  </div>
                  <div className="rp-role-select-info">
                    <span className="rp-role-select-label">Role</span>
                    <span className="rp-role-select-name">
                      {selectedRole ? selectedRole.name : 'Select a role'}
                    </span>
                  </div>
                  <i className={`ph ${roleDropdownOpen ? 'ph-caret-up' : 'ph-caret-down'} rp-role-select-caret`} aria-hidden="true" />
                </button>

                {roleDropdownOpen && (
                  <div className="rp-role-popover" role="listbox">
                    <div className="rp-search-wrap">
                      <i className="ph ph-magnifying-glass" aria-hidden="true" />
                      <input
                        autoFocus
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search roles..."
                        value={search}
                      />
                    </div>
                    <div className="rp-filter-row">
                      <select
                        aria-label="Role type filter"
                        onChange={(e) => setTypeFilter(e.target.value as ApiRoleType | '')}
                        value={typeFilter}
                      >
                        <option value="">All Types</option>
                        <option value="system">System</option>
                        <option value="custom">Custom</option>
                      </select>
                      <select
                        aria-label="Role status filter"
                        onChange={(e) => {
                          const v = e.target.value;
                          setStatusFilter(isApiRoleStatus(v) ? v : '');
                        }}
                        value={statusFilter}
                      >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="rp-role-list">
                      {rolesLoading ? (
                        <div style={{ padding: '1.5rem 1rem' }}>
                          <MedicalLoader size="small" text="Loading roles..." />
                        </div>
                      ) : loadError ? (
                        <div className="rp-detail-empty">{loadError}</div>
                      ) : roles.length ? (
                        roles.map((role) => (
                          <button
                            className={`rp-role-item${role.id === selectedRoleId ? ' active' : ''}`}
                            key={role.id}
                            onClick={() => {
                              selectRole(role.id);
                              setRoleDropdownOpen(false);
                            }}
                            type="button"
                            role="option"
                            aria-selected={role.id === selectedRoleId}
                          >
                            <div
                              className="rp-role-avatar"
                              style={{ background: role.color ?? fallbackRoleColor(role.name) }}
                            >
                              {roleInitials(role.name)}
                            </div>
                            <div className="rp-role-body">
                              <div className="rp-role-name">
                                {role.name}
                                {role.type === 'system' && (
                                  <i className="ph ph-lock-simple rp-role-lock" aria-label="System role" />
                                )}
                              </div>
                              <div className="rp-role-meta">
                                {role.userCount} user{role.userCount === 1 ? '' : 's'} · {roleStatusLabel(role.status)}
                              </div>
                            </div>
                            <span
                              className={`rp-role-badge ${role.type === 'system' ? 'badge-system' : 'badge-custom'}`}
                            >
                              {role.type === 'system' ? 'System' : 'Custom'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rp-detail-empty">No roles found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Role Meta Details */}
              {selectedRole && (
                <div className="rp-role-header-body">
                  <div className="rp-role-header-name">
                    <span className={`rp-role-badge ${isSystemRole ? 'badge-system' : 'badge-custom'}`}>
                      {isSystemRole ? <><i className="ph ph-lock-simple" aria-hidden="true" /> System</> : 'Custom'}
                    </span>
                    <span className={`rp-role-badge ${selectedRole.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                      {roleStatusLabel(selectedRole.status)}
                    </span>
                    <span className="rp-meta-dot" />
                    <span className="rp-role-header-stat">{selectedRole.userCount} user{selectedRole.userCount === 1 ? '' : 's'}</span>
                    <span className="rp-meta-dot" />
                    <span className="rp-role-header-stat">{draftPermissionIds.size} / {permissions.length} permissions</span>
                    {isSystemRole && (
                      <>
                        <span className="rp-meta-dot" />
                        <span className="rp-system-notice">
                          <i className="ph ph-lock-simple" aria-hidden="true" /> Role details are platform-managed
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ⋯ Role Actions Overflow Menu */}
              {selectedRole && (
                <div className="rp-actions-menu-wrap" ref={actionsMenuRef}>
                  <button
                    className="rp-more-btn"
                    onClick={() => setActionsMenuOpen((o) => !o)}
                    type="button"
                    aria-label="Role actions"
                    title="Role actions"
                  >
                    <i className="ph ph-dots-three-vertical" aria-hidden="true" />
                  </button>
                  {actionsMenuOpen && (
                    <div className="rp-actions-menu rp-actions-menu--right" role="menu">
                      <button
                        className="rp-actions-menu-item"
                        disabled={forbidden || !canEditRole || isSystemRole}
                        onClick={() => openRoleModal('edit')}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Role
                      </button>
                      <button
                        className="rp-actions-menu-item"
                        disabled={forbidden || !canEditRole || isSystemRole}
                        onClick={() => openStatusModal()}
                        role="menuitem"
                        type="button"
                      >
                        <i
                          className={`ph ${selectedRole.status === 'active' ? 'ph-toggle-right' : 'ph-toggle-left'}`}
                          aria-hidden="true"
                        />
                        {selectedRole.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <div className="rp-actions-menu-sep" />
                      <button
                        className="rp-actions-menu-item"
                        disabled={forbidden || !canAssignUser || selectedRole.status !== 'active'}
                        onClick={() => void openUserModal('assign-user')}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-user-plus" aria-hidden="true" /> Assign User
                      </button>
                      <button
                        className="rp-actions-menu-item"
                        disabled={forbidden || !canAssignRole || !(selectedRole.users?.length)}
                        onClick={() => void openUserModal('remove-user')}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-user-minus" aria-hidden="true" /> Remove User
                      </button>
                      <div className="rp-actions-menu-sep" />
                      <button
                        className="rp-actions-menu-item"
                        disabled={forbidden || !canCreateRole}
                        onClick={() => openRoleModal('clone')}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-copy" aria-hidden="true" /> Clone Role
                      </button>
                      <button
                        className="rp-actions-menu-item"
                        onClick={() => void openAuditModal()}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-clock-counter-clockwise" aria-hidden="true" /> Audit History
                      </button>
                      <div className="rp-actions-menu-sep" />
                      <button
                        className="rp-actions-menu-item danger"
                        disabled={isSystemRole || forbidden || !canDeleteRole}
                        onClick={() => { setModalMode('delete'); setActionsMenuOpen(false); }}
                        role="menuitem"
                        type="button"
                      >
                        <i className="ph ph-trash" aria-hidden="true" /> Delete Role
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Compact Permission Toolbar ── */}
          {selectedRole && (
            <div className="rp-perm-toolbar">
              <div className="rp-perm-search">
                <i className="ph ph-magnifying-glass" aria-hidden="true" />
                <input
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions..."
                  value={permSearch}
                />
                {permSearch && (
                  <button
                    className="rp-perm-search-clear"
                    onClick={() => setPermSearch('')}
                    type="button"
                    aria-label="Clear search"
                  >
                    <i className="ph ph-x" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                className="rp-btn-ghost rp-btn-sm"
                disabled={!canEditPermissions}
                onClick={() => setAllPermissions(true)}
                type="button"
              >
                Select All
              </button>
              <button
                className="rp-btn-ghost rp-btn-sm"
                disabled={!canEditPermissions}
                onClick={() => setAllPermissions(false)}
                type="button"
              >
                Clear All
              </button>
              <div className="rp-toolbar-spacer" />
              <span
                className={`rp-save-dot${dirty ? ' dirty' : ''}`}
                title={dirty ? 'Unsaved changes' : 'All changes saved'}
              >
                {dirty ? '● Unsaved' : '● Saved'}
              </span>
              <button
                className="rp-btn-ghost rp-btn-sm"
                disabled={submitting}
                onClick={exportPermissionMatrix}
                type="button"
              >
                <i className="ph ph-download-simple" aria-hidden="true" /> Export
              </button>
              <button
                className="rp-btn-ghost rp-btn-sm"
                disabled={rolesLoading || permissionsLoading || roleLoading}
                onClick={refreshWithConfirmation}
                type="button"
              >
                <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
              </button>
              <button
                className={`rp-save-btn${dirty ? ' has-changes' : ''}`}
                disabled={!canEditPermissions || !dirty}
                onClick={() => void savePermissions()}
                type="button"
              >
                {submitting ? (
                  <><MedicalSpinner size="sm" /><span>Saving…</span></>
                ) : dirty ? (
                  'Save Changes'
                ) : (
                  'Save'
                )}
              </button>
            </div>
          )}

          {/* ── Full-Width Permission Matrix ── */}
          <div className="rp-matrix-wrap">
            {!selectedRole && !roleLoading ? (
              <div className="rp-matrix-empty">
                <i className="ph ph-shield-check" aria-hidden="true" />
                <p>Select a role from the dropdown to manage its permissions.</p>
              </div>
            ) : roleLoading && !selectedRole ? (
              <div style={{ padding: '3rem 1rem' }}>
                <MedicalLoader text="Loading role..." />
              </div>
            ) : selectedRole ? (
              roleLoading || permissionsLoading ? (
                <div style={{ padding: '3rem 1rem' }}>
                  <MedicalLoader
                    text="Loading permissions..."
                    subtext="Retrieving role-based access control policies"
                  />
                </div>
              ) : permissionError ? (
                <div className="rp-matrix-empty">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  <p>{permissionError}</p>
                </div>
              ) : filteredPermissionRows.length ? (
                <div className="matrix-table-wrap">
                  {permSearch && (
                    <div className="rp-perm-filter-notice">
                      {filteredPermissionRows.length} of {permissionRows.length} screens
                      matching &ldquo;{permSearch}&rdquo;
                    </div>
                  )}
                  <table className="rp-matrix-table">
                    <thead>
                      <tr>
                        <th>Screen</th>
                        {permissionActions.map((action) => (
                          <th key={action} title={permActionLabel(action)}>
                            {permActionLabel(action)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleModules.flatMap((module) => {
                        const rows = filteredPermissionRows.filter((r) => r.module === module);
                        const isCollapsed = collapsedModules.has(module) && !permSearch;
                        const stats = getModuleStats(module);
                        return [
                          <tr
                            key={`module-${module}`}
                            className="module-group-header"
                            onClick={() => { if (!permSearch) toggleModule(module); }}
                            style={{ cursor: permSearch ? 'default' : 'pointer' }}
                          >
                            <td colSpan={permissionActions.length + 1}>
                              <div className="module-cell">
                                {!permSearch && (
                                  <i
                                    className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} module-icon`}
                                    aria-hidden="true"
                                    style={{ fontSize: '0.8rem', width: '12px' }}
                                  />
                                )}
                                <i
                                  className={`ph ${moduleIcons[module] ?? 'ph-shield-check'} module-icon`}
                                  aria-hidden="true"
                                />
                                <span>{module}</span>
                                <span className="rp-module-stats">
                                  {stats.enabled}/{stats.total}
                                </span>
                              </div>
                            </td>
                          </tr>,
                          ...(isCollapsed
                            ? []
                            : rows.map((row) => (
                                <tr key={row.id}>
                                  <td>
                                    <div className="module-cell" style={{ paddingLeft: '2.5rem' }}>
                                      <span>{permScreenLabel(row.screen)}</span>
                                    </div>
                                  </td>
                                  {permissionActions.map((action) => {
                                    const permission = row.permissions[action];
                                    if (!permission || permission.status !== 'active') {
                                      return (
                                        <td
                                          aria-label={`${row.module} ${row.screen} ${action} not available`}
                                          className="permission-unavailable"
                                          key={action}
                                        />
                                      );
                                    }
                                    return (
                                      <td key={action}>
                                        <input
                                          aria-label={permission.name}
                                          checked={draftPermissionIds.has(permission.id)}
                                          className="perm-check"
                                          disabled={!canEditPermissions}
                                          onChange={(e) => updatePermission(permission, e.target.checked)}
                                          title={`${permission.name}${permission.description ? ` — ${permission.description}` : ''}`}
                                          type="checkbox"
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              ) : permSearch ? (
                <div className="rp-matrix-empty">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <p>No permissions match &ldquo;{permSearch}&rdquo;</p>
                  <button className="rp-btn-ghost" onClick={() => setPermSearch('')} type="button">
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="rp-matrix-empty">
                  <i className="ph ph-shield-check" aria-hidden="true" />
                  <p>No permissions are available.</p>
                </div>
              )
            ) : null}
          </div>
        </div>
        )}
      </div>

      {/* ── Modals (all logic unchanged) ── */}
      <Modal
        footer={
          modalMode ? (
            <>
              <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">
                {modalMode === 'audit' ? 'Close' : 'Cancel'}
              </button>
              {modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit' ? (
                <button className="btn-primary" disabled={submitting} form="role-form" type="submit">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              ) : modalMode === 'assign-user' || modalMode === 'remove-user' ? (
                <button className="btn-primary" disabled={submitting} form="user-form" type="submit">
                  {submitting ? 'Saving...' : modalMode === 'assign-user' ? 'Assign' : 'Remove'}
                </button>
              ) : modalMode !== 'audit' ? (
                <button
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => void handleModalAction()}
                  type="button"
                >
                  {submitting ? (
                    <><MedicalSpinner size="sm" /><span>Saving...</span></>
                  ) : modalMode === 'delete' ? (
                    'Delete'
                  ) : (
                    'Save'
                  )}
                </button>
              ) : null}
            </>
          ) : undefined
        }
        className="um-user-modal"
        size="large"
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-shield-check"
        title={modalTitle}
      >
        {formError ? <div className="auth-alert auth-alert--error" role="alert">{formError}</div> : null}

        {(modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit') && (
          <form id="role-form" onSubmit={onSubmitRole}>
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-shield-check" />
                  <span>Role Information</span>
                </div>
                <span className="um-card-badge">Access &amp; Definition</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label" htmlFor="role-name">
                      <span className="um-field-label-text">
                        <i className="ph ph-tag" /> Role Name
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        id="role-name"
                        aria-invalid={Boolean(roleForm.formState.errors.name)}
                        placeholder="e.g. Clinical Coordinator"
                        {...roleForm.register('name')}
                      />
                      <i className="ph ph-tag um-input-prefix-icon" />
                    </div>
                    {roleForm.formState.errors.name && (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {roleForm.formState.errors.name.message}
                      </span>
                    )}
                  </div>

                  <div className="um-field">
                    <label className="um-field-label" htmlFor="role-color">
                      <span className="um-field-label-text">
                        <i className="ph ph-palette" /> Display Color
                      </span>
                    </label>
                    <div className="um-color-picker-wrap">
                      <input id="role-color" type="color" {...roleForm.register('color')} />
                      <span className="um-color-hex-label">{roleForm.watch('color') || '#2563eb'}</span>
                    </div>
                  </div>
                </div>

                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label" htmlFor="role-type">
                      <span className="um-field-label-text">
                        <i className="ph ph-lock-key" /> Role Type
                      </span>
                    </label>
                    <div className="um-input-wrap">
                      <select disabled id="role-type" {...roleForm.register('type')}>
                        <option value="custom">Custom</option>
                        <option value="system">System</option>
                      </select>
                      <i className="ph ph-lock-key um-input-prefix-icon" />
                    </div>
                  </div>

                  <div className="um-field">
                    <label className="um-field-label" htmlFor="role-status">
                      <span className="um-field-label-text">
                        <i className="ph ph-toggle-left" /> Status
                      </span>
                    </label>
                    <div className="um-input-wrap">
                      <select id="role-status" {...roleForm.register('status')}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <i className="ph ph-toggle-left um-input-prefix-icon" />
                    </div>
                  </div>
                </div>

                <div className="um-field" style={{ marginTop: '0.85rem' }}>
                  <label className="um-field-label" htmlFor="role-description">
                    <span className="um-field-label-text">
                      <i className="ph ph-text-align-left" /> Description
                    </span>
                  </label>
                  <textarea
                    className="um-textarea"
                    id="role-description"
                    placeholder="Provide a concise description of responsibilities and permissions for this role..."
                    rows={3}
                    {...roleForm.register('description')}
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {modalMode === 'status' && (
          <p>
            Change <strong>{activeRole?.name}</strong> to{' '}
            <strong>{roleStatusLabel(activeRole?.status === 'active' ? 'inactive' : 'active')}</strong>?
            Inactive roles no longer grant access.
          </p>
        )}

        {modalMode === 'assign-user' && (
          <form id="user-form" onSubmit={onSubmitUser}>
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-user-plus" />
                  <span>Assign User to Role</span>
                </div>
                <span className="um-card-badge">Staff Selection</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-field">
                  <label className="um-field-label" htmlFor="assign-role-user">
                    <span className="um-field-label-text">
                      <i className="ph ph-user" /> Select User
                    </span>
                    <span className="um-required-star">*</span>
                  </label>
                  <div className="um-input-wrap">
                    <select disabled={submitting} id="assign-role-user" {...userForm.register('userId')}>
                      <option value="">{isFetching ? 'Loading users...' : 'Select user'}</option>
                      {userOptions.map((user) => (
                        <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>
                      ))}
                    </select>
                    <i className="ph ph-user um-input-prefix-icon" />
                  </div>
                  {userForm.formState.errors.userId && (
                    <span className="um-field-error">
                      <i className="ph ph-warning-circle" /> {userForm.formState.errors.userId.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}

        {modalMode === 'remove-user' && (
          <form id="user-form" onSubmit={onSubmitUser}>
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-user-minus" />
                  <span>Remove User from Role</span>
                </div>
                <span className="um-card-badge">Staff Assignment</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-field">
                  <label className="um-field-label" htmlFor="remove-role-user">
                    <span className="um-field-label-text">
                      <i className="ph ph-user" /> Select Assigned User
                    </span>
                    <span className="um-required-star">*</span>
                  </label>
                  <div className="um-input-wrap">
                    <select id="remove-role-user" {...userForm.register('userId')}>
                      <option value="">Select user</option>
                      {(activeRole?.users ?? []).map((user: RoleAssignedUser) => (
                        <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>
                      ))}
                    </select>
                    <i className="ph ph-user um-input-prefix-icon" />
                  </div>
                  {userForm.formState.errors.userId && (
                    <span className="um-field-error">
                      <i className="ph ph-warning-circle" /> {userForm.formState.errors.userId.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}

        {modalMode === 'delete' && (
          <p>Delete {activeRole?.name}? The backend will enforce status and assignment restrictions.</p>
        )}

        {modalMode === 'audit' && (
          auditLoading ? (
            <div className="rp-detail-empty">Loading audit history...</div>
          ) : auditItems.length ? (
            <div className="role-audit-list">
              {auditItems.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.actorName}</strong>
                    <span>{item.eventType}</span>
                  </div>
                  <time dateTime={item.createdAt}>{formatRegionalDateTime(item.createdAt, timezone)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="rp-detail-empty">No audit activity found for this role.</div>
          )
        )}
      </Modal>
    </>
  );
}
