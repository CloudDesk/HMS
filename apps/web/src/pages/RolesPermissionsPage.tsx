import { useEffect, useMemo, useState } from 'react';
import { useRolesPermissionsFeature } from '../hooks/admin/useRolesPermissionsFeature';
import { useTimezone } from '../api/useSettings';
import { formatRegionalDateTime } from '../utils/localization-utils';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { type PermissionResponse } from '../api/permissions';
import { type UserResponse } from '../api/users';
import { type ApiRoleStatus, type ApiRoleType, } from '../api/roles';
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



type PermissionRow = {
  id: string;
  module: string;
  screen: string;
  icon: string;
  permissions: Record<string, PermissionResponse>;
};



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

const isApiRoleStatus = (val: string): val is ApiRoleStatus => val === 'active' || val === 'inactive';

const roleStatusLabel = (status: ApiRoleStatus) => (status === 'active' ? 'Active' : 'Inactive');

const roleCodeFromName = (name: string) =>
  name
    .trim()
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

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
  const timezone = useTimezone();
  const { refreshCurrentUser } = useAuth();
  const { search: locationSearch } = useAppLocation();

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const feature = useRolesPermissionsFeature(modalMode);

  const { state, data, status, rbac, actions, mutations } = feature;
  const { search, typeFilter, statusFilter, rolePage, selectedRoleId, setSearch, setTypeFilter, setStatusFilter, setRolePage, setSelectedRoleId } = state;
  const { roles, roleMeta, roleStats, permissions, selectedRole, rolePermissions, roleAuditLogs, usersList, permissionActions, permissionRows } = data;
  const { isFetching, isMutating, forbidden, rolesLoading, statsLoading, permissionsLoading, roleLoading, auditLoading, loadError, permissionError } = status;
  const { canCreateRole, canEditRole, canAssignRole, canDeleteRole, canEditPermissions } = rbac;
  const { refreshRolesAndPermissions } = actions;

  const roleForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', color: '#2563eb', type: 'custom', status: 'active', description: '' }
  });

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { userId: '' }
  });
  const [formError, setFormError] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set());

  // Track draft permissions
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<string>>(() => new Set());
  const [draftPermissionIds, setDraftPermissionIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (rolePermissions) {
      const ids = new Set(rolePermissions.map(p => p.id));
      setAssignedPermissionIds(ids);
      setDraftPermissionIds(new Set(ids));
    }
  }, [rolePermissions]);

  // Set selected role ID to first item if current is invalid
  useEffect(() => {
    if (roles.length > 0 && (!selectedRoleId || !roles.find(r => r.id === selectedRoleId))) {
      setSelectedRoleId(roles[0]?.id ?? null);
    } else if (roles.length === 0 && selectedRoleId) {
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

  const savePermissions = () => {
    if (!selectedRole || !canEditPermissions || !dirty) return;

    const activePermissionIds = new Set(
      permissions.filter((permission) => permission.status === 'active').map((permission) => permission.id),
    );
    const validIds = [...draftPermissionIds].filter((id) => activePermissionIds.has(id));

    mutations.replacePermissions.mutate({ roleId: selectedRole.id, permissionIds: validIds }, {
      onSuccess: async () => {
        await refreshCurrentUser();
        toast.success('Role permissions saved successfully.');
      }
    });
  };

  const closeModal = () => {
    if (isMutating) return;
    setModalMode(null);
    setFormError('');
  };

  const openRoleModal = (mode: Extract<ModalMode, 'create' | 'edit' | 'clone'>) => {
    setModalMode(mode);
    setFormError('');
    roleForm.reset({
      color: selectedRole?.color ?? '#2563eb',
      description: mode === 'create' ? '' : (selectedRole?.description ?? ''),
      name: mode === 'clone' && selectedRole ? `${selectedRole.name} Copy` : mode === 'edit' ? (selectedRole?.name ?? '') : '',
      status: mode === 'create' ? 'active' : (selectedRole?.status ?? 'active'),
      type: mode === 'edit' ? (selectedRole?.type ?? 'custom') : 'custom',
    });
  };

  const openAuditModal = () => {
    if (!selectedRole) return;
    setModalMode('audit');
    setFormError('');
  };

  const openStatusModal = () => {
    if (!selectedRole) return;
    setFormError('');
    setModalMode('status');
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) openRoleModal('create');
  }, [locationSearch]);

  const openUserModal = (mode: Extract<ModalMode, 'assign-user' | 'remove-user'>) => {
    if (!selectedRole) return;
    setModalMode(mode);
    setFormError('');
    userForm.reset({ userId: '' });
  };

  const onSubmitRole = roleForm.handleSubmit((values) => {
    setFormError('');
    if (modalMode === 'create' || modalMode === 'clone') {
      const code = roleCodeFromName(values.name);
      if (!code) {
        setFormError('Role name must contain letters or numbers.');
        return;
      }
      mutations.createRole.mutate({
        code,
        color: values.color ?? null,
        description: values.description?.trim() || null,
        name: values.name.trim(),
        status: values.status,
        type: 'custom',
      }, {
        onSuccess: (created) => {
          if (modalMode === 'clone') {
            mutations.replacePermissions.mutate({ roleId: created.id, permissionIds: [...assignedPermissionIds] }, {
              onSuccess: () => {
                setSelectedRoleId(created.id);
                toast.success('Role cloned successfully.');
                closeModal();
              }
            });
          } else {
            setSelectedRoleId(created.id);
            toast.success('Role created successfully.');
            closeModal();
          }
        }
      });
    } else if (modalMode === 'edit' && selectedRole) {
      mutations.updateRole.mutate({
        id: selectedRole.id,
        payload: {
          color: values.color ?? null,
          description: values.description?.trim() || null,
          name: values.name.trim(),
        }
      }, { onSuccess: closeModal });
    }
  });

  const onSubmitUser = userForm.handleSubmit((values) => {
    setFormError('');
    if (!selectedRole) return;
    if (modalMode === 'assign-user') {
      mutations.assignUser.mutate({
        id: selectedRole.id,
        userId: values.userId,
      }, { onSuccess: closeModal });
    } else if (modalMode === 'remove-user') {
      mutations.removeUser.mutate({
        id: selectedRole.id,
        userId: values.userId,
      }, { onSuccess: closeModal });
    }
  });

  const handleModalAction = () => {
    if (!modalMode || modalMode === 'audit') return;
    setFormError('');

    if (modalMode !== 'create' && modalMode !== 'clone' && !selectedRole) {
      setFormError('Select a role first.');
      return;
    }

    if (modalMode === 'status' && selectedRole) {
      mutations.updateRoleStatus.mutate({
        id: selectedRole.id,
        status: selectedRole.status === 'active' ? 'inactive' : 'active',
      }, { onSuccess: closeModal });
    } else if (modalMode === 'delete' && selectedRole) {
      mutations.deleteRole.mutate(selectedRole.id, {
        onSuccess: () => {
          setSelectedRoleId(null);
          closeModal();
        }
      });
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
    toast.success('Permission matrix exported.');
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



  const userOptions = usersList.filter((u: UserResponse) => !(selectedRole?.users ?? []).some((su) => su.id === u.id)) ?? [];
  const auditItems = roleAuditLogs;
  const submitting = isMutating;

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
              <button className="rp-create-btn" disabled={forbidden || !canCreateRole} onClick={() => openRoleModal('create')} type="button">
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
              <select aria-label="Role status filter" onChange={(event) => { const val = event.target.value; setStatusFilter(isApiRoleStatus(val) ? val : ''); setRolePage(1); }} value={statusFilter}>
                <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="rp-role-list">
              {rolesLoading ? (
                <div style={{ padding: '2rem 1rem' }}>
                  <MedicalLoader size="small" text="Loading roles..." />
                </div>
              ) : loadError ? <div className="rp-detail-empty">{loadError}</div> : roles.length ? roles.map((role) => (
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
                {/* <p className="rp-subtitle">{selectedRole ? (selectedRole.description ?? 'No description provided.') : 'Select a role to view and edit permissions'}</p> */}
              </div>
              {selectedRole ? <div className="rp-mid-actions">
                <span className={`rp-save-state${dirty ? ' dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                <button className="rp-btn-ghost" disabled={submitting} onClick={exportPermissionMatrix} type="button"><i className="ph ph-download-simple" aria-hidden="true" /> Export</button>
                <button className="rp-btn-ghost" disabled={rolesLoading || permissionsLoading || roleLoading} onClick={() => void refreshRolesAndPermissions()} type="button"><i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh</button>
                <button className="rp-btn-ghost" disabled={!canEditPermissions} onClick={() => setAllPermissions(true)} type="button"><i className="ph ph-check-square" aria-hidden="true" /> Select All</button>
                <button className="rp-btn-ghost" disabled={!canEditPermissions} onClick={() => setAllPermissions(false)} type="button"><i className="ph ph-square" aria-hidden="true" /> Clear All</button>
                <button className={`rp-save-btn${dirty ? ' has-changes' : ''}`} disabled={!canEditPermissions || !dirty} onClick={() => void savePermissions()} type="button">
                  {submitting ? (
                    <>
                      <MedicalSpinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-floppy-disk" aria-hidden="true" /> Save
                    </>
                  )}
                </button>
              </div> : null}
            </div>
            <div className="rp-matrix-wrap">
              {roleLoading || permissionsLoading ? (
                <div style={{ padding: '3rem 1rem' }}>
                  <MedicalLoader text="Loading permissions matrix..." subtext="Retrieving role-based access control policies" />
                </div>
              ) : permissionError ? <div className="rp-matrix-empty"><i className="ph ph-warning-circle" aria-hidden="true" /><p>{permissionError}</p></div> : !selectedRole ? <div className="rp-matrix-empty"><i className="ph ph-shield-check" aria-hidden="true" /><p>Select a role from the left panel to view and edit its permissions</p></div> : permissionRows.length ? (
                <div className="matrix-table-wrap">
                  <table className="rp-matrix-table">
                    <thead><tr><th>Module / Screen</th>{permissionActions.map((action) => <th key={action}>{action}</th>)}</tr></thead>
                    <tbody>
                      {Array.from(new Set(permissionRows.map((r) => r.module))).flatMap((module) => {
                        const rows = permissionRows.filter((r) => r.module === module);
                        const isCollapsed = collapsedModules.has(module);
                        return [
                          <tr key={`module-${module}`} className="module-group-header" onClick={() => toggleModule(module)} style={{ cursor: 'pointer' }}>
                            <td style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <div className="module-cell" style={{ fontWeight: 600 }}>
                                <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} module-icon`} aria-hidden="true" style={{ fontSize: '0.85rem', width: '12px' }} />
                                <i className={`ph ${moduleIcons[module] ?? 'ph-shield-check'} module-icon`} aria-hidden="true" />
                                <span>{module}</span>
                              </div>
                            </td>
                            <td colSpan={permissionActions.length} style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }} />
                          </tr>,
                          ...(isCollapsed ? [] : rows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <div className="module-cell" style={{ paddingLeft: '3.2rem' }}>
                                  <span>{row.screen}</span>
                                </div>
                              </td>
                              {permissionActions.map((action) => {
                                const permission = row.permissions[action];
                                if (!permission || permission.status !== 'active') {
                                  return <td aria-label={`${row.module} ${row.screen} ${action} not available`} className="permission-unavailable" key={action} />;
                                }

                                return <td key={action}><input aria-label={`${row.module} ${row.screen} ${action}`} checked={draftPermissionIds.has(permission.id)} className="perm-check" disabled={!canEditPermissions} onChange={(event) => updatePermission(permission, event.target.checked)} type="checkbox" /></td>;
                              })}
                            </tr>
                          )))
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div className="rp-matrix-empty"><i className="ph ph-shield-check" aria-hidden="true" /><p>No permissions are available.</p></div>}
            </div>
          </div>

          <div className="rp-right-panel">
            <div className="card rp-detail-card">
              <div className="rp-panel-header"><h3>Role Details</h3></div>
              {selectedRole ? <div className="role-detail-content">
                <div className="role-detail-top"><div className="role-detail-avatar" style={{ background: selectedRole.color ?? fallbackRoleColor(selectedRole.name) }}>{roleInitials(selectedRole.name)}</div><div><div className="role-detail-name">{selectedRole.name}</div></div></div>
                <div className="role-stat-grid">
                  <div className="role-stat-item"><div className="role-stat-label">Role ID</div><div className="role-stat-value mono-value">{selectedRole.code}</div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Type</div><div className="role-stat-value"><span className={`rp-role-badge ${selectedRole.type === 'system' ? 'badge-system' : 'badge-custom'}`}>{selectedRole.type}</span></div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Status</div><div className="role-stat-value"><span className={`rp-role-badge ${selectedRole.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{roleStatusLabel(selectedRole.status)}</span></div></div>
                  <div className="role-stat-item"><div className="role-stat-label">Users</div><div className="role-stat-value">{selectedRole.userCount}</div></div>
                  <div className="role-stat-item role-stat-wide"><div className="role-stat-label">Total Permissions</div><div className="role-stat-value">{draftPermissionIds.size} / {permissions.length}</div></div>
                </div>
                <div className="rp-user-actions">
                  <button className="rp-btn-ghost" disabled={forbidden || !canEditRole || selectedRole.type === 'system'} onClick={() => openRoleModal('edit')} type="button">Edit Role</button>
                  <button className="rp-btn-ghost" disabled={forbidden || !canEditRole || selectedRole.type === 'system'} onClick={openStatusModal} type="button">{selectedRole.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className="rp-btn-ghost" disabled={forbidden || !canAssignRole || selectedRole.status !== 'active'} onClick={() => void openUserModal('assign-user')} type="button">Assign User</button>
                  <button className="rp-btn-ghost" disabled={forbidden || !canAssignRole || !(selectedRole.users?.length)} onClick={() => void openUserModal('remove-user')} type="button">Remove User</button>
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
                <button className="rp-qa-btn" disabled={!selectedRole || forbidden || !canCreateRole} onClick={() => openRoleModal('clone')} type="button"><i className="ph ph-copy" aria-hidden="true" /><span>Clone Role</span></button>
                <button className="rp-qa-btn" disabled={!selectedRole} onClick={() => void openAuditModal()} type="button"><i className="ph ph-clock-counter-clockwise" aria-hidden="true" /><span>Audit History</span></button>
                <button className="rp-qa-btn danger" disabled={!selectedRole || selectedRole.type === 'system' || forbidden || !canDeleteRole} onClick={() => setModalMode('delete')} type="button"><i className="ph ph-trash" aria-hidden="true" /><span>Delete Role</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        footer={modalMode ? <>
          <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">{modalMode === 'audit' ? 'Close' : 'Cancel'}</button>
          {modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit' ? (
            <button className="btn-primary" disabled={submitting} type="submit" form="role-form">{submitting ? 'Saving...' : 'Save'}</button>
          ) : modalMode === 'assign-user' || modalMode === 'remove-user' ? (
            <button className="btn-primary" disabled={submitting} type="submit" form="user-form">{submitting ? 'Saving...' : modalMode === 'assign-user' ? 'Assign' : 'Remove'}</button>
          ) : modalMode !== 'audit' ? (
            <button className="btn-primary" disabled={submitting} onClick={() => void handleModalAction()} type="button">
              {submitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : modalMode === 'delete' ? (
                'Delete'
              ) : (
                'Save'
              )}
            </button>
          ) : null}
        </> : undefined}
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-shield-check"
        title={modalTitle}
      >
        {formError ? <div className="auth-alert auth-alert--error" role="alert">{formError}</div> : null}
        {modalMode === 'create' || modalMode === 'clone' || modalMode === 'edit' ? <form id="role-form" onSubmit={onSubmitRole}>
          <div className="form-section-title">Role Information</div>
          <div className="form-grid-3">
            <div className="form-field"><label htmlFor="role-name">Role Name <span className="required">*</span></label><input id="role-name" {...roleForm.register('name')} />{roleForm.formState.errors.name ? <span className="field-error">{roleForm.formState.errors.name.message}</span> : null}</div>
            <div className="form-field"><label htmlFor="role-color">Display Color</label><input id="role-color" type="color" {...roleForm.register('color')} /></div>
            <div className="form-field"><label htmlFor="role-type">Role Type</label><select disabled id="role-type" {...roleForm.register('type')}><option value="custom">Custom</option><option value="system">System</option></select></div>
            <div className="form-field"><label htmlFor="role-status">Status</label><select id="role-status" {...roleForm.register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="form-field full-width"><label htmlFor="role-description">Description</label><textarea id="role-description" {...roleForm.register('description')} /></div>
          </div>
        </form> : null}
        {modalMode === 'status' ? <p>Change <strong>{selectedRole?.name}</strong> to <strong>{roleStatusLabel(selectedRole?.status === 'active' ? 'inactive' : 'active')}</strong>? Inactive roles no longer grant access.</p> : null}
        {modalMode === 'assign-user' ? <form id="user-form" onSubmit={onSubmitUser}><div className="form-field"><label htmlFor="assign-role-user">User</label><select disabled={submitting} id="assign-role-user" {...userForm.register('userId')}><option value="">{isFetching ? 'Loading users...' : 'Select user'}</option>{userOptions.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>)}</select>{userForm.formState.errors.userId ? <span className="field-error">{userForm.formState.errors.userId.message}</span> : null}</div></form> : null}
        {modalMode === 'remove-user' ? <form id="user-form" onSubmit={onSubmitUser}><div className="form-field"><label htmlFor="remove-role-user">User</label><select id="remove-role-user" {...userForm.register('userId')}><option value="">Select user</option>{(selectedRole?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.username})</option>)}</select>{userForm.formState.errors.userId ? <span className="field-error">{userForm.formState.errors.userId.message}</span> : null}</div></form> : null}
        {modalMode === 'delete' ? <p>Delete {selectedRole?.name}? The backend will enforce status and assignment restrictions.</p> : null}
        {modalMode === 'audit' ? auditLoading ? <div className="rp-detail-empty">Loading audit history...</div> : auditItems.length ? <div className="role-audit-list">{auditItems.map((item) => <article key={item.id}><div><strong>{item.actorName}</strong><span>{item.eventType}</span></div><time dateTime={item.createdAt}>{formatRegionalDateTime(item.createdAt, timezone)}</time></article>)}</div> : <div className="rp-detail-empty">No audit activity found for this role.</div> : null}
      </Modal>
    </>
  );
}
