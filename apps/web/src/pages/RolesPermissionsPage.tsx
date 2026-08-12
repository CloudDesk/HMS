import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api/api-error';
import {
  permissionsApi,
  type PermissionResponse,
} from '../api/permissions';
import {
  rolesApi,
  type ApiRoleStatus,
  type ApiRoleType,
  type RoleListResponse,
  type RoleAuditLogItem,
  type RoleResponse,
} from '../api/roles';
import { usersApi, type UserResponse } from '../api/users';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { useAppLocation } from '../routing/navigation';

type ModalMode = 'create' | 'edit' | 'clone' | 'status' | 'assign-user' | 'remove-user' | 'delete' | 'audit';

type RoleFormState = {
  name: string;
  description: string;
  color: string;
  type: ApiRoleType;
  status: ApiRoleStatus;
};

type RoleStats = {
  total: number;
  active: number;
  system: number;
  custom: number;
};

type PermissionRow = {
  id: string;
  module: string;
  screen: string;
  icon: string;
  permissions: Record<string, PermissionResponse>;
};

const fetchRolePermissionDetails = async (roleId: string) => {
  const [role, rolePermissions] = await Promise.all([
    rolesApi.getById(roleId),
    permissionsApi.getByRole(roleId),
  ]);

  return {
    permissionIds: new Set(rolePermissions.items.map((permission) => permission.id)),
    role,
  };
};

const rolePageSize = 5;
const emptyRoleForm: RoleFormState = { color: '#2563eb', description: '', name: '', status: 'active', type: 'custom' };
const emptyRoleMeta: RoleListResponse['meta'] = { limit: rolePageSize, page: 1, total: 0, totalPages: 1 };
const emptyRoleStats: RoleStats = { active: 0, custom: 0, system: 0, total: 0 };

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

const roleColors = ['#0f172a', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0d9488', '#0891b2'];

const roleInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const fallbackRoleColor = (name: string) => {
  const index = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return roleColors[index % roleColors.length];
};

const roleStatusLabel = (status: ApiRoleStatus) => (status === 'active' ? 'Active' : 'Inactive');

const roleCodeFromName = (name: string) =>
  name
    .trim()
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage roles and permissions.';
    if (error.status === 404) return 'The selected role or permission could not be found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) return 'The roles and permissions service is unavailable. Please try again shortly.';
    return error.message;
  }

  return 'Unable to complete the roles and permissions request.';
};

const downloadJson = (filename: string, value: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

function PermissionSummary({
  actions,
  assignedPermissionIds,
  rows,
}: {
  actions: string[];
  assignedPermissionIds: Set<string>;
  rows: PermissionRow[];
}) {
  const maxRows = Math.max(rows.length, 1);

  return (
    <div className="perm-summary-content">
      <div className="perm-bar-list">
        {actions.map((action) => {
          const count = rows.filter((row) => {
            const permission = row.permissions[action];
            return permission ? assignedPermissionIds.has(permission.id) : false;
          }).length;

          return (
            <div className="perm-bar-item" key={action}>
              <div className="perm-bar-header">
                <span>{action}</span>
                <span>
                  {count}/{rows.length} screens
                </span>
              </div>
              <div className="perm-bar-track">
                <div className="perm-bar-fill" style={{ width: `${(count / maxRows) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RolesPermissionsPage() {
  const { search: locationSearch } = useAppLocation();
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [roleMeta, setRoleMeta] = useState<RoleListResponse['meta']>(emptyRoleMeta);
  const [roleStats, setRoleStats] = useState<RoleStats>(emptyRoleStats);
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleResponse | null>(null);
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<string>>(() => new Set());
  const [draftPermissionIds, setDraftPermissionIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ApiRoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ApiRoleStatus | ''>('');
  const [rolePage, setRolePage] = useState(1);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);
  const [userOptions, setUserOptions] = useState<UserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [formError, setFormError] = useState('');
  const [auditItems, setAuditItems] = useState<RoleAuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    setLoadError('');

    try {
      const response = await rolesApi.list({
        limit: rolePageSize,
        page: rolePage,
        search: search.trim() || undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });

      setRoles(response.items);
      setRoleMeta(response.meta);
      setSelectedRoleId((current) =>
        response.items.some((role) => role.id === current) ? current : (response.items[0]?.id ?? null),
      );

      if (rolePage > response.meta.totalPages) {
        setRolePage(response.meta.totalPages);
      }
    } catch (error) {
      setRoles([]);
      setSelectedRoleId(null);
      setLoadError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
    } finally {
      setRolesLoading(false);
    }
  }, [rolePage, search, statusFilter, typeFilter]);

  const loadRoleStats = useCallback(async () => {
    setStatsLoading(true);

    try {
      const [allRoles, activeRoles, systemRoles, customRoles] = await Promise.all([
        rolesApi.list({ limit: 1, page: 1 }),
        rolesApi.list({ limit: 1, page: 1, status: 'active' }),
        rolesApi.list({ limit: 1, page: 1, type: 'system' }),
        rolesApi.list({ limit: 1, page: 1, type: 'custom' }),
      ]);
      setRoleStats({
        active: activeRoles.meta.total,
        custom: customRoles.meta.total,
        system: systemRoles.meta.total,
        total: allRoles.meta.total,
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    setPermissionError('');

    try {
      const response = await permissionsApi.listAll();
      setPermissions(response.items);
    } catch (error) {
      setPermissionError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadPermissions(), loadRoleStats()]);
  }, [loadPermissions, loadRoleStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRoles(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadRoles, search]);

  useEffect(() => {
    let mounted = true;

    if (!selectedRoleId) {
      setSelectedRole(null);
      setAssignedPermissionIds(new Set());
      setDraftPermissionIds(new Set());
      return () => {
        mounted = false;
      };
    }

    const loadRole = async () => {
      setRoleLoading(true);
      setPermissionError('');

      try {
        const details = await fetchRolePermissionDetails(selectedRoleId);

        if (mounted) {
          setSelectedRole(details.role);
          setAssignedPermissionIds(details.permissionIds);
          setDraftPermissionIds(new Set(details.permissionIds));
        }
      } catch (error) {
        if (mounted) {
          setSelectedRole(null);
          setPermissionError(getErrorMessage(error));
          if (error instanceof ApiError && error.status === 403) setForbidden(true);
        }
      } finally {
        if (mounted) setRoleLoading(false);
      }
    };

    void loadRole();

    return () => {
      mounted = false;
    };
  }, [selectedRoleId]);

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

  const dirty = useMemo(() => {
    if (assignedPermissionIds.size !== draftPermissionIds.size) return true;
    return [...assignedPermissionIds].some((id) => !draftPermissionIds.has(id));
  }, [assignedPermissionIds, draftPermissionIds]);

  const canEditPermissions = Boolean(
    selectedRole && selectedRole.code !== 'SUPER_ADMIN' && !forbidden && !roleLoading && !submitting,
  );
  const totalRolePages = Math.max(roleMeta.totalPages, 1);
  const safeRolePage = Math.min(rolePage, totalRolePages);

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
        ? new Set(permissions.filter((permission) => permission.status === 'active').map((permission) => permission.id))
        : new Set(),
    );
  };

  const savePermissions = async () => {
    if (!selectedRole || !canEditPermissions || !dirty) return;
    setSubmitting(true);

    try {
      const activePermissionIds = new Set(
        permissions.filter((permission) => permission.status === 'active').map((permission) => permission.id),
      );
      const response = await permissionsApi.replaceForRole(
        selectedRole.id,
        [...draftPermissionIds].filter((id) => activePermissionIds.has(id)),
      );
      const savedIds = new Set(response.items.map((permission) => permission.id));
      setAssignedPermissionIds(savedIds);
      setDraftPermissionIds(new Set(savedIds));
      showToast('Role permissions saved successfully.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshRolesAndPermissions = async () => {
    setRoleLoading(true);

    try {
      await Promise.all([loadPermissions(), loadRoleStats(), loadRoles()]);

      if (selectedRoleId) {
        const details = await fetchRolePermissionDetails(selectedRoleId);
        setSelectedRole(details.role);
        setAssignedPermissionIds(details.permissionIds);
        setDraftPermissionIds(new Set(details.permissionIds));
      }

      showToast('Roles and permissions refreshed.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRoleLoading(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setFormError('');
    setSelectedUserId('');
  };

  const openRoleModal = (mode: Extract<ModalMode, 'create' | 'edit' | 'clone'>) => {
    setModalMode(mode);
    setFormError('');
    setRoleForm({
      color: selectedRole?.color ?? '#2563eb',
      description: mode === 'create' ? '' : (selectedRole?.description ?? ''),
      name: mode === 'clone' && selectedRole ? `${selectedRole.name} Copy` : mode === 'edit' ? (selectedRole?.name ?? '') : '',
      status: mode === 'create' ? 'active' : (selectedRole?.status ?? 'active'),
      type: mode === 'edit' ? (selectedRole?.type ?? 'custom') : 'custom',
    });
  };

  const openAuditModal = async () => {
    if (!selectedRole) return;
    setModalMode('audit');
    setAuditLoading(true);
    setFormError('');
    try {
      const result = await rolesApi.auditLogs(selectedRole.id);
      setAuditItems(result.items);
    } catch (error) {
      setAuditItems([]);
      setFormError(getErrorMessage(error));
    } finally {
      setAuditLoading(false);
    }
  };

  const openStatusModal = () => {
    if (!selectedRole) return;
    setRoleForm({ color: selectedRole.color ?? '#2563eb', description: selectedRole.description ?? '', name: selectedRole.name, status: selectedRole.status === 'active' ? 'inactive' : 'active', type: selectedRole.type });
    setFormError('');
    setModalMode('status');
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) openRoleModal('create');
  }, [locationSearch]);

  const openUserModal = async (mode: Extract<ModalMode, 'assign-user' | 'remove-user'>) => {
    if (!selectedRole) return;
    setModalMode(mode);
    setFormError('');
    setSelectedUserId('');

    if (mode === 'assign-user') {
      setSubmitting(true);
      try {
        const response = await usersApi.list({
          limit: 100,
          page: 1,
          sortBy: 'fullName',
          sortOrder: 'asc',
          status: 'active',
        });
        const assignedUserIds = new Set((selectedRole.users ?? []).map((user) => user.id));
        setUserOptions(response.items.filter((user) => !assignedUserIds.has(user.id)));
      } catch (error) {
        setFormError(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const refreshRoles = async () => {
    await Promise.all([loadRoles(), loadRoleStats()]);
  };

  const handleModalAction = async () => {
    if (!modalMode || modalMode === 'audit') return;
    setFormError('');

    if ((modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit') && !roleForm.name.trim()) {
      setFormError('Role name is required.');
      return;
    }

    if ((modalMode === 'assign-user' || modalMode === 'remove-user') && !selectedUserId) {
      setFormError('Select a user.');
      return;
    }

    if (modalMode !== 'create' && modalMode !== 'clone' && !selectedRole) {
      setFormError('Select a role first.');
      return;
    }

    setSubmitting(true);

    try {
      if (modalMode === 'create' || modalMode === 'clone') {
        const code = roleCodeFromName(roleForm.name);
        if (!code) throw new Error('Role name must contain letters or numbers.');

        const created = await rolesApi.create({
          code,
          color: roleForm.color,
          description: roleForm.description.trim() || null,
          name: roleForm.name.trim(),
          status: roleForm.status,
          type: 'custom',
        });

        if (modalMode === 'clone') {
          await permissionsApi.replaceForRole(created.id, [...assignedPermissionIds]);
        }

        setSelectedRoleId(created.id);
        showToast(modalMode === 'clone' ? 'Role cloned successfully.' : 'Role created successfully.');
      } else if (modalMode === 'edit' && selectedRole) {
        const role = await rolesApi.update(selectedRole.id, {
          color: roleForm.color,
          description: roleForm.description.trim() || null,
          name: roleForm.name.trim(),
        });
        setSelectedRole(role);
        showToast('Role updated successfully.');
      } else if (modalMode === 'status' && selectedRole) {
        const role = await rolesApi.updateStatus(selectedRole.id, roleForm.status);
        setSelectedRole(role);
        showToast(`Role ${role.status === 'active' ? 'activated' : 'deactivated'}.`);
      } else if (modalMode === 'assign-user' && selectedRole) {
        const role = await rolesApi.assignUser(selectedRole.id, selectedUserId);
        setSelectedRole(role);
        showToast('User assigned to role successfully.');
      } else if (modalMode === 'remove-user' && selectedRole) {
        const role = await rolesApi.removeUser(selectedRole.id, selectedUserId);
        setSelectedRole(role);
        showToast('User removed from role successfully.');
      } else if (modalMode === 'delete' && selectedRole) {
        await rolesApi.delete(selectedRole.id);
        setSelectedRoleId(null);
        setSelectedRole(null);
        showToast('Role deleted successfully.');
      }

      setModalMode(null);
      setSelectedUserId('');
      await refreshRoles();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const exportPermissionMatrix = () => {
    if (!selectedRole) return;
    downloadJson(`${selectedRole.code.toLowerCase()}-permissions.json`, {
      role: { code: selectedRole.code, id: selectedRole.id, name: selectedRole.name },
      permissions: permissions.map((permission) => ({
        action: permission.action,
        assigned: draftPermissionIds.has(permission.id),
        code: permission.code,
        module: permission.module,
        screen: permission.screen,
        status: permission.status,
      })),
    });
    showToast('Permission matrix exported.');
  };

  const modalTitle =
    modalMode === 'create'
      ? 'Create Role'
      : modalMode === 'edit'
        ? 'Edit Role'
      : modalMode === 'clone'
        ? 'Clone Role'
        : modalMode === 'status'
          ? 'Change Role Status'
        : modalMode === 'assign-user'
          ? 'Assign User'
          : modalMode === 'remove-user'
            ? 'Remove User'
            : modalMode === 'delete'
              ? 'Delete Role'
              : modalMode === 'audit'
                ? 'Audit History'
                : 'Roles & Permissions';

  return (
    <>
      <div className="rp-page">
        <div className="rp-kpi-row" aria-label="Role and permission KPIs">
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon blue"><i className="ph ph-shield-check" aria-hidden="true" /></div>
            <div className="rp-kpi-info"><span className="rp-kpi-label">Total Roles</span><span className="rp-kpi-value">{statsLoading ? '-' : roleStats.total}</span></div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon green"><i className="ph ph-shield-check" aria-hidden="true" /></div>
            <div className="rp-kpi-info"><span className="rp-kpi-label">Active Roles</span><span className="rp-kpi-value">{statsLoading ? '-' : roleStats.active}</span></div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon purple"><i className="ph ph-lock-key" aria-hidden="true" /></div>
            <div className="rp-kpi-info"><span className="rp-kpi-label">System Roles</span><span className="rp-kpi-value">{statsLoading ? '-' : roleStats.system}</span></div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon orange"><i className="ph ph-pencil-line" aria-hidden="true" /></div>
            <div className="rp-kpi-info"><span className="rp-kpi-label">Custom Roles</span><span className="rp-kpi-value">{statsLoading ? '-' : roleStats.custom}</span></div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon teal"><i className="ph ph-key" aria-hidden="true" /></div>
            <div className="rp-kpi-info"><span className="rp-kpi-label">Total Permissions</span><span className="rp-kpi-value">{permissionsLoading ? '-' : permissions.length}</span></div>
          </div>
        </div>

        <div className="rp-panels">
          <div className="rp-left-panel card">
            <div className="rp-panel-header">
              <h3>Roles</h3>
              <button className="rp-create-btn" disabled={forbidden} onClick={() => openRoleModal('create')} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Create Role
              </button>
            </div>
            <div className="rp-search-wrap">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input onChange={(event) => { setSearch(event.target.value); setRolePage(1); }} placeholder="Search roles..." value={search} />
            </div>
            <div className="rp-filter-row">
              <select aria-label="Role type filter" onChange={(event) => { setTypeFilter(event.target.value as ApiRoleType | ''); setRolePage(1); }} value={typeFilter}>
                <option value="">All Types</option><option value="system">System</option><option value="custom">Custom</option>
              </select>
              <select aria-label="Role status filter" onChange={(event) => { setStatusFilter(event.target.value as ApiRoleStatus | ''); setRolePage(1); }} value={statusFilter}>
                <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="rp-role-list">
              {rolesLoading ? <div className="rp-detail-empty">Loading roles...</div> : loadError ? <div className="rp-detail-empty">{loadError}</div> : roles.length ? roles.map((role) => (
                <button className={`rp-role-item${role.id === selectedRoleId ? ' active' : ''}`} key={role.id} onClick={() => setSelectedRoleId(role.id)} type="button">
                  <div className="rp-role-item-left">
                    <div className="rp-role-avatar" style={{ background: role.color ?? fallbackRoleColor(role.name) }}>{roleInitials(role.name)}</div>
                    <div>
                      <div className="rp-role-name">{role.name}</div>
                      <div className="rp-role-meta">{role.userCount} user{role.userCount === 1 ? '' : 's'} - {roleStatusLabel(role.status)}</div>
                    </div>
                  </div>
                  <span className={`rp-role-badge ${role.type === 'system' ? 'badge-system' : 'badge-custom'}`}>{role.type}</span>
                </button>
              )) : <div className="rp-detail-empty">No roles found</div>}
            </div>
            <div className="rp-pagination">
              <span>Page {safeRolePage} of {totalRolePages}</span>
              <div className="um-page-controls">
                <button className="pg-btn" disabled={safeRolePage === 1 || rolesLoading} onClick={() => setRolePage((page) => Math.max(page - 1, 1))} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button>
                <button className="pg-btn" disabled={safeRolePage === totalRolePages || rolesLoading} onClick={() => setRolePage((page) => Math.min(page + 1, totalRolePages))} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button>
              </div>
            </div>
          </div>

          <div className="rp-mid-panel card">
            <div className="rp-panel-header">
              <div>
                <h3>{selectedRole ? `${selectedRole.name} - Permission Matrix` : 'Permission Matrix'}</h3>
                <p className="rp-subtitle">{selectedRole ? (selectedRole.description ?? 'No description provided.') : 'Select a role to view and edit permissions'}</p>
              </div>
              {selectedRole ? <div className="rp-mid-actions">
                <span className={`rp-save-state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                <button className="rp-btn-ghost" disabled={submitting} onClick={exportPermissionMatrix} type="button"><i className="ph ph-download-simple" aria-hidden="true" /> Export</button>
                <button className="rp-btn-ghost" disabled={rolesLoading || permissionsLoading || roleLoading} onClick={() => void refreshRolesAndPermissions()} type="button"><i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh</button>
                <button className="rp-btn-ghost" disabled={!canEditPermissions} onClick={() => setAllPermissions(true)} type="button"><i className="ph ph-check-square" aria-hidden="true" /> Select All</button>
                <button className="rp-btn-ghost" disabled={!canEditPermissions} onClick={() => setAllPermissions(false)} type="button"><i className="ph ph-square" aria-hidden="true" /> Clear All</button>
                <button className={`rp-save-btn${dirty ? ' has-changes' : ''}`} disabled={!canEditPermissions || !dirty} onClick={() => void savePermissions()} type="button"><i className="ph ph-floppy-disk" aria-hidden="true" /> {submitting ? 'Saving...' : 'Save'}</button>
              </div> : null}
            </div>
            <div className="rp-matrix-wrap">
              {roleLoading || permissionsLoading ? <div className="rp-matrix-empty"><i className="ph ph-spinner-gap" aria-hidden="true" /><p>Loading role permissions...</p></div> : permissionError ? <div className="rp-matrix-empty"><i className="ph ph-warning-circle" aria-hidden="true" /><p>{permissionError}</p></div> : !selectedRole ? <div className="rp-matrix-empty"><i className="ph ph-shield-check" aria-hidden="true" /><p>Select a role from the left panel to view and edit its permissions</p></div> : permissionRows.length ? (
                <div className="matrix-table-wrap">
                  <table className="rp-matrix-table">
                    <thead><tr><th>Module / Screen</th>{permissionActions.map((action) => <th key={action}>{action}</th>)}</tr></thead>
                    <tbody>{permissionRows.map((row) => <tr key={row.id}>
                      <td><div className="module-cell"><i className={`ph ${row.icon} module-icon`} aria-hidden="true" /><span>{row.module} / {row.screen}</span></div></td>
                      {permissionActions.map((action) => {
                        const permission = row.permissions[action];
                        if (!permission || permission.status !== 'active') {
                          return <td aria-label={`${row.module} ${row.screen} ${action} not available`} className="permission-unavailable" key={action} />;
                        }

                        return <td key={action}><input aria-label={`${row.module} ${row.screen} ${action}`} checked={draftPermissionIds.has(permission.id)} className="perm-check" disabled={!canEditPermissions} onChange={(event) => updatePermission(permission, event.target.checked)} type="checkbox" /></td>;
                      })}
                    </tr>)}</tbody>
                  </table>
                </div>
              ) : <div className="rp-matrix-empty"><i className="ph ph-shield-check" aria-hidden="true" /><p>No permissions are available.</p></div>}
            </div>
          </div>

          <div className="rp-right-panel">
            <div className="card rp-detail-card">
              <div className="rp-panel-header"><h3>Role Details</h3></div>
              {selectedRole ? <div className="role-detail-content">
                <div className="role-detail-top"><div className="role-detail-avatar" style={{ background: selectedRole.color ?? fallbackRoleColor(selectedRole.name) }}>{roleInitials(selectedRole.name)}</div><div><div className="role-detail-name">{selectedRole.name}</div><div className="role-detail-desc">{selectedRole.description ?? 'No description provided.'}</div></div></div>
                <div className="role-stat-grid">
                  <div className="role-stat-item"><div className="role-stat-label">Role ID</div><div className="role-stat-value mono-value">{selectedRole.code}</div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Type</div><div className="role-stat-value"><span className={`rp-role-badge ${selectedRole.type === 'system' ? 'badge-system' : 'badge-custom'}`}>{selectedRole.type}</span></div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Status</div><div className="role-stat-value"><span className={`rp-role-badge ${selectedRole.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{roleStatusLabel(selectedRole.status)}</span></div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Users</div><div className="role-stat-value">{selectedRole.userCount}</div></div>
                  <div className="role-stat-item role-stat-wide"><div className="role-stat-label">Total Permissions</div><div className="role-stat-value">{draftPermissionIds.size} / {permissions.length}</div></div>
                </div>
                <div className="rp-user-actions">
                  <button className="rp-btn-ghost" disabled={forbidden || selectedRole.type === 'system'} onClick={() => openRoleModal('edit')} type="button">Edit Role</button>
                  <button className="rp-btn-ghost" disabled={forbidden || selectedRole.type === 'system'} onClick={openStatusModal} type="button">{selectedRole.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className="rp-btn-ghost" disabled={forbidden || selectedRole.status !== 'active'} onClick={() => void openUserModal('assign-user')} type="button">Assign User</button>
                  <button className="rp-btn-ghost" disabled={forbidden || !(selectedRole.users?.length)} onClick={() => void openUserModal('remove-user')} type="button">Remove User</button>
                </div>
              </div> : <div className="rp-detail-empty">{roleLoading ? 'Loading role details...' : 'Select a role to view details'}</div>}
            </div>

            <div className="card rp-summary-card">
              <div className="rp-panel-header"><h3>Permission Summary</h3></div>
              {selectedRole ? <PermissionSummary actions={permissionActions} assignedPermissionIds={draftPermissionIds} rows={permissionRows} /> : <div className="rp-detail-empty">No role selected</div>}
            </div>

            <div className="card rp-qa-card">
              <div className="rp-panel-header"><h3>Quick Actions</h3></div>
              <div className="rp-qa-list">
                <button className="rp-qa-btn" disabled={!selectedRole || forbidden} onClick={() => openRoleModal('clone')} type="button"><i className="ph ph-copy" aria-hidden="true" /><span>Clone Role</span></button>
                <button className="rp-qa-btn" disabled={!selectedRole} onClick={() => void openAuditModal()} type="button"><i className="ph ph-clock-counter-clockwise" aria-hidden="true" /><span>Audit History</span></button>
                <button className="rp-qa-btn danger" disabled={!selectedRole || selectedRole.type === 'system' || forbidden} onClick={() => setModalMode('delete')} type="button"><i className="ph ph-trash" aria-hidden="true" /><span>Delete Role</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        footer={modalMode ? <>
          <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">{modalMode === 'audit' ? 'Close' : 'Cancel'}</button>
          {modalMode !== 'audit' ? <button className="btn-primary" disabled={submitting} onClick={() => void handleModalAction()} type="button">{submitting ? 'Saving...' : modalMode === 'delete' ? 'Delete' : modalMode === 'assign-user' ? 'Assign' : modalMode === 'remove-user' ? 'Remove' : 'Save'}</button> : null}
        </> : undefined}
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-shield-check"
        title={modalTitle}
      >
        {formError ? <div className="auth-alert auth-alert--error" role="alert">{formError}</div> : null}
        {modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit' ? <>
          <div className="form-section-title">Role Information</div>
          <div className="form-grid-3">
            <div className="form-field"><label htmlFor="role-name">Role Name <span className="required">*</span></label><input id="role-name" onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} required value={roleForm.name} /></div>
            <div className="form-field"><label htmlFor="role-color">Display Color</label><input id="role-color" onChange={(event) => setRoleForm((current) => ({ ...current, color: event.target.value }))} type="color" value={roleForm.color} /></div>
            <div className="form-field"><label htmlFor="role-type">Role Type</label><select disabled id="role-type" value={roleForm.type}><option value="custom">Custom</option><option value="system">System</option></select></div>
            <div className="form-field"><label htmlFor="role-status">Status</label><select id="role-status" onChange={(event) => setRoleForm((current) => ({ ...current, status: event.target.value as ApiRoleStatus }))} value={roleForm.status}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="form-field full-width"><label htmlFor="role-description">Description</label><textarea id="role-description" onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} value={roleForm.description} /></div>
          </div>
        </> : null}
        {modalMode === 'status' ? <p>Change <strong>{selectedRole?.name}</strong> to <strong>{roleStatusLabel(roleForm.status)}</strong>? Inactive roles no longer grant access.</p> : null}
        {modalMode === 'assign-user' ? <div className="form-field"><label htmlFor="assign-role-user">User</label><select disabled={submitting} id="assign-role-user" onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}><option value="">{submitting ? 'Loading users...' : 'Select user'}</option>{userOptions.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>)}</select></div> : null}
        {modalMode === 'remove-user' ? <div className="form-field"><label htmlFor="remove-role-user">User</label><select id="remove-role-user" onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}><option value="">Select user</option>{(selectedRole?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>)}</select></div> : null}
        {modalMode === 'delete' ? <p>Delete {selectedRole?.name}? The backend will enforce status and assignment restrictions.</p> : null}
        {modalMode === 'audit' ? auditLoading ? <div className="rp-detail-empty">Loading audit history...</div> : auditItems.length ? <div className="role-audit-list">{auditItems.map((item) => <article key={item.id}><div><strong>{item.actorName}</strong><span>{item.eventType}</span></div><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></article>)}</div> : <div className="rp-detail-empty">No audit activity found for this role.</div> : null}
      </Modal>
      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
