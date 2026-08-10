import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import {
  permissionActions,
  permissionModules,
  rolesPermissionsMockRoles,
  type MockRole,
  type PermissionAction,
  type PermissionMatrix,
  type RoleStatus,
  type RoleType,
} from '../data/roles-permissions-mock';

const roleInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const countRolePermissions = (role: MockRole) =>
  Object.values(role.permissions).reduce(
    (total, modulePermissions) => total + Object.values(modulePermissions).filter(Boolean).length,
    0,
  );

function PermissionSummary({ role }: { role: MockRole }) {
  const maxModules = permissionModules.length;

  return (
    <div className="perm-summary-content">
      <div className="perm-bar-list">
        {permissionActions.map((action) => {
          const count = permissionModules.filter((module) => role.permissions[module.id]?.[action]).length;

          return (
            <div className="perm-bar-item" key={action}>
              <div className="perm-bar-header">
                <span>{action}</span>
                <span>
                  {count}/{maxModules} modules
                </span>
              </div>
              <div className="perm-bar-track">
                <div className="perm-bar-fill" style={{ width: `${(count / maxModules) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RolesPermissionsPage() {
  const [roles, setRoles] = useState<MockRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rolePage, setRolePage] = useState(1);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoles(rolesPermissionsMockRoles);
      setSelectedRoleId(rolesPermissionsMockRoles[0]?.id ?? null);
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2600);
  };

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const rolePageSize = 5;
  const filteredRoles = useMemo(() => {
    const query = search.toLowerCase().trim();

    return roles.filter((role) => {
      const matchesSearch = !query || [role.name, role.description, role.id].some((value) => value.toLowerCase().includes(query));
      const matchesType = !typeFilter || role.type === typeFilter;
      const matchesStatus = !statusFilter || role.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [roles, search, statusFilter, typeFilter]);
  const totalRolePages = Math.max(Math.ceil(filteredRoles.length / rolePageSize), 1);
  const safeRolePage = Math.min(rolePage, totalRolePages);
  const visibleRoles = filteredRoles.slice((safeRolePage - 1) * rolePageSize, safeRolePage * rolePageSize);

  const totalPermissions = roles.reduce((sum, role) => sum + countRolePermissions(role), 0);
  const totalPermissionSlots = permissionModules.length * permissionActions.length;

  const updatePermission = (moduleId: string, action: PermissionAction, checked: boolean) => {
    if (!selectedRole || (selectedRole.type === 'system' && selectedRole.name === 'Super Admin')) {
      return;
    }

    setRoles((current) =>
      current.map((role) => {
        if (role.id !== selectedRole.id) return role;

        const currentModulePermissions = role.permissions[moduleId];
        const nextModulePermissions = Object.fromEntries(
          permissionActions.map((permissionAction) => [
            permissionAction,
            permissionAction === action ? checked : Boolean(currentModulePermissions?.[permissionAction]),
          ]),
        ) as Record<PermissionAction, boolean>;

        const nextPermissions: PermissionMatrix = {
          ...role.permissions,
          [moduleId]: nextModulePermissions,
        };

        return { ...role, permissions: nextPermissions };
      }),
    );
    setDirty(true);
  };

  const setAllPermissions = (checked: boolean) => {
    if (!selectedRole || (selectedRole.type === 'system' && selectedRole.name === 'Super Admin')) {
      return;
    }

    setRoles((current) =>
      current.map((role) => {
        if (role.id !== selectedRole.id) return role;

        const permissions = Object.fromEntries(
          permissionModules.map((module) => [
            module.id,
            Object.fromEntries(permissionActions.map((action) => [action, checked])),
          ]),
        ) as PermissionMatrix;

        return { ...role, permissions };
      }),
    );
    setDirty(true);
    showToast(checked ? 'All permissions selected for this mock role.' : 'All permissions cleared for this mock role.');
  };

  const adjustAssignedUsers = (delta: number) => {
    if (!selectedRole) return;

    setRoles((current) =>
      current.map((role) => (role.id === selectedRole.id ? { ...role, users: Math.max(role.users + delta, 0) } : role)),
    );
    showToast(delta > 0 ? 'Mock user assigned to role.' : 'Mock user removed from role.');
  };

  return (
    <>
      <div className="rp-page">
        <div className="rp-kpi-row" aria-label="Role and permission KPIs">
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon blue">
              <i className="ph ph-shield-check" aria-hidden="true" />
            </div>
            <div className="rp-kpi-info">
              <span className="rp-kpi-label">Total Roles</span>
              <span className="rp-kpi-value">{loading ? '-' : roles.length}</span>
            </div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon green">
              <i className="ph ph-shield-check" aria-hidden="true" />
            </div>
            <div className="rp-kpi-info">
              <span className="rp-kpi-label">Active Roles</span>
              <span className="rp-kpi-value">{loading ? '-' : roles.filter((role) => role.status === 'Active').length}</span>
            </div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon purple">
              <i className="ph ph-lock-key" aria-hidden="true" />
            </div>
            <div className="rp-kpi-info">
              <span className="rp-kpi-label">System Roles</span>
              <span className="rp-kpi-value">{loading ? '-' : roles.filter((role) => role.type === 'system').length}</span>
            </div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon orange">
              <i className="ph ph-pencil-line" aria-hidden="true" />
            </div>
            <div className="rp-kpi-info">
              <span className="rp-kpi-label">Custom Roles</span>
              <span className="rp-kpi-value">{loading ? '-' : roles.filter((role) => role.type === 'custom').length}</span>
            </div>
          </div>
          <div className="rp-kpi-card">
            <div className="rp-kpi-icon teal">
              <i className="ph ph-key" aria-hidden="true" />
            </div>
            <div className="rp-kpi-info">
              <span className="rp-kpi-label">Total Permissions</span>
              <span className="rp-kpi-value">{loading ? '-' : totalPermissions}</span>
            </div>
          </div>
        </div>

        <div className="rp-panels">
          <div className="rp-left-panel card">
            <div className="rp-panel-header">
              <h3>Roles</h3>
              <button className="rp-create-btn" onClick={() => setModalTitle('Create Role')} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Create Role
              </button>
            </div>
            <div className="rp-search-wrap">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                onChange={(event) => {
                  setSearch(event.target.value);
                  setRolePage(1);
                }}
                placeholder="Search roles..."
                value={search}
              />
            </div>
            <div className="rp-filter-row">
              <select
                aria-label="Role type filter"
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setRolePage(1);
                }}
                value={typeFilter}
              >
                <option value="">All Types</option>
                <option value="system">System</option>
                <option value="custom">Custom</option>
              </select>
              <select
                aria-label="Role status filter"
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setRolePage(1);
                }}
                value={statusFilter}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="rp-role-list">
              {loading ? (
                <div className="rp-detail-empty">Loading roles...</div>
              ) : visibleRoles.length ? (
                visibleRoles.map((role) => (
                  <button
                    className={`rp-role-item${role.id === selectedRoleId ? ' active' : ''}`}
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    type="button"
                  >
                    <div className="rp-role-item-left">
                      <div className="rp-role-avatar" style={{ background: role.color }}>
                        {roleInitials(role.name)}
                      </div>
                      <div>
                        <div className="rp-role-name">{role.name}</div>
                        <div className="rp-role-meta">
                          {countRolePermissions(role)} permissions - {role.users} user{role.users === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                    <span className={`rp-role-badge ${role.type === 'system' ? 'badge-system' : 'badge-custom'}`}>
                      {role.type}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rp-detail-empty">No roles found</div>
              )}
            </div>
            <div className="rp-pagination">
              <span>
                Page {safeRolePage} of {totalRolePages}
              </span>
              <div className="um-page-controls">
                <button
                  className="pg-btn"
                  disabled={safeRolePage === 1}
                  onClick={() => setRolePage((page) => Math.max(page - 1, 1))}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                <button
                  className="pg-btn"
                  disabled={safeRolePage === totalRolePages}
                  onClick={() => setRolePage((page) => Math.min(page + 1, totalRolePages))}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="rp-mid-panel card">
            <div className="rp-panel-header">
              <div>
                <h3>{selectedRole ? `${selectedRole.name} - Permission Matrix` : 'Permission Matrix'}</h3>
                <p className="rp-subtitle">
                  {selectedRole ? selectedRole.description : 'Select a role to view and edit permissions'}
                </p>
              </div>
              {selectedRole ? (
                <div className="rp-mid-actions">
                  <span className={`rp-save-state${dirty ? ' dirty' : ''}`}>
                    {dirty ? 'Unsaved changes' : 'All changes saved'}
                  </span>
                  <button className="rp-btn-ghost" onClick={() => setAllPermissions(true)} type="button">
                    <i className="ph ph-check-square" aria-hidden="true" /> Select All
                  </button>
                  <button className="rp-btn-ghost" onClick={() => setAllPermissions(false)} type="button">
                    <i className="ph ph-square" aria-hidden="true" /> Clear All
                  </button>
                  <button
                    className={`rp-save-btn${dirty ? ' has-changes' : ''}`}
                    onClick={() => {
                      setDirty(false);
                      showToast('Mock permissions saved locally in component state.');
                    }}
                    type="button"
                  >
                    <i className="ph ph-floppy-disk" aria-hidden="true" /> Save
                  </button>
                </div>
              ) : null}
            </div>
            <div className="rp-matrix-wrap">
              {!selectedRole ? (
                <div className="rp-matrix-empty">
                  <i className="ph ph-shield-check" aria-hidden="true" />
                  <p>Select a role from the left panel to view and edit its permissions</p>
                </div>
              ) : (
                <div className="matrix-table-wrap">
                  <table className="rp-matrix-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        {permissionActions.map((action) => (
                          <th key={action}>{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {permissionModules.map((module) => (
                        <tr key={module.id}>
                          <td>
                            <div className="module-cell">
                              <i className={`ph ${module.icon} module-icon`} aria-hidden="true" />
                              <span>{module.label}</span>
                            </div>
                          </td>
                          {permissionActions.map((action) => (
                            <td key={action}>
                              <input
                                checked={Boolean(selectedRole.permissions[module.id]?.[action])}
                                className="perm-check"
                                disabled={selectedRole.type === 'system' && selectedRole.name === 'Super Admin'}
                                onChange={(event) => updatePermission(module.id, action, event.target.checked)}
                                type="checkbox"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rp-right-panel">
            <div className="card rp-detail-card">
              <div className="rp-panel-header">
                <h3>Role Details</h3>
              </div>
              {selectedRole ? (
                <div className="role-detail-content">
                  <div className="role-detail-top">
                    <div className="role-detail-avatar" style={{ background: selectedRole.color }}>
                      {roleInitials(selectedRole.name)}
                    </div>
                    <div>
                      <div className="role-detail-name">{selectedRole.name}</div>
                      <div className="role-detail-desc">{selectedRole.description}</div>
                    </div>
                  </div>
                  <div className="role-stat-grid">
                    <div className="role-stat-item">
                      <div className="role-stat-label">Role ID</div>
                      <div className="role-stat-value mono-value">{selectedRole.id}</div>
                    </div>
                    <div className="role-stat-item">
                      <div className="role-stat-label">Type</div>
                      <div className="role-stat-value">
                        <span className={`rp-role-badge ${selectedRole.type === 'system' ? 'badge-system' : 'badge-custom'}`}>
                          {selectedRole.type}
                        </span>
                      </div>
                    </div>
                    <div className="role-stat-item">
                      <div className="role-stat-label">Status</div>
                      <div className="role-stat-value">
                        <span className={`rp-role-badge ${selectedRole.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                          {selectedRole.status}
                        </span>
                      </div>
                    </div>
                    <div className="role-stat-item">
                      <div className="role-stat-label">Users</div>
                      <div className="role-stat-value">{selectedRole.users}</div>
                    </div>
                    <div className="role-stat-item role-stat-wide">
                      <div className="role-stat-label">Total Permissions</div>
                      <div className="role-stat-value">
                        {countRolePermissions(selectedRole)} / {totalPermissionSlots}
                      </div>
                    </div>
                  </div>
                  <div className="rp-user-actions">
                    <button className="rp-btn-ghost" onClick={() => adjustAssignedUsers(1)} type="button">
                      Assign User
                    </button>
                    <button className="rp-btn-ghost" onClick={() => adjustAssignedUsers(-1)} type="button">
                      Remove User
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rp-detail-empty">Select a role to view details</div>
              )}
            </div>

            <div className="card rp-summary-card">
              <div className="rp-panel-header">
                <h3>Permission Summary</h3>
              </div>
              {selectedRole ? <PermissionSummary role={selectedRole} /> : <div className="rp-detail-empty">No role selected</div>}
            </div>

            <div className="card rp-qa-card">
              <div className="rp-panel-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="rp-qa-list">
                <button className="rp-qa-btn" onClick={() => setModalTitle('Clone Role')} type="button">
                  <i className="ph ph-copy" aria-hidden="true" />
                  <span>Clone Role</span>
                </button>
                <button className="rp-qa-btn" onClick={() => showToast('Mock matrix export prepared.')} type="button">
                  <i className="ph ph-download-simple" aria-hidden="true" />
                  <span>Export Matrix</span>
                </button>
                <button className="rp-qa-btn" onClick={() => showToast('Mock roles JSON export prepared.')} type="button">
                  <i className="ph ph-file-code" aria-hidden="true" />
                  <span>Export Roles JSON</span>
                </button>
                <button className="rp-qa-btn" onClick={() => setModalTitle('Audit History')} type="button">
                  <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
                  <span>Audit History</span>
                </button>
                <button className="rp-qa-btn danger" onClick={() => setModalTitle('Delete Role')} type="button">
                  <i className="ph ph-trash" aria-hidden="true" />
                  <span>Delete Role</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalTitle(null)} type="button">
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setModalTitle(null);
                showToast('Mock role action completed.');
              }}
              type="button"
            >
              Save
            </button>
          </>
        }
        onClose={() => setModalTitle(null)}
        open={Boolean(modalTitle)}
        title={modalTitle ?? 'Roles & Permissions'}
      >
        <div className="form-field">
          <label>Role Name</label>
          <input defaultValue={selectedRole?.name ?? ''} />
        </div>
        <div className="form-field modal-field-gap">
          <label>Role Type</label>
          <select defaultValue={(selectedRole?.type ?? 'custom') satisfies RoleType}>
            <option value="custom">Custom</option>
            <option value="system">System</option>
          </select>
        </div>
        <div className="form-field modal-field-gap">
          <label>Status</label>
          <select defaultValue={(selectedRole?.status ?? 'Active') satisfies RoleStatus}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </Modal>
      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
