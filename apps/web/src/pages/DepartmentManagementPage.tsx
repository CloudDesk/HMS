import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDepartmentDeletePreviewFeature, useDepartmentManagementFeature, type SortColumn, type SortDirection } from '../hooks/departments/useDepartmentManagementFeature';
import { ApiError } from '../api/api-error';
import { type BranchResponse } from '../api/branches';
import {
  departmentModuleOptions,
  type ApiDepartmentStatus,
  type DepartmentResponse,
} from '../api/departments';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast } from '../components/ui/Toast';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';
import { BranchMultiSelect } from '../components/ui/BranchMultiSelect';

type ModalMode = 'create' | 'edit' | 'view';

const departmentSchema = z.object({
  code: z.string().min(1, 'Department code is required.'),
  name: z.string().min(1, 'Department name is required.'),
  branch_ids: z.array(z.string()).min(1, 'At least one branch is required.'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  isClinical: z.boolean(),
  hiddenModules: z.array(z.enum([
    'patients', 'doctors', 'appointments', 'opd', 'emergency', 'admissions', 'surgery',
    'pharmacy', 'laboratory', 'imaging', 'billing', 'reports', 'administration',
  ])),
});
type DepartmentFormData = z.infer<typeof departmentSchema>;

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check your inputs.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage departments.';
    if (error.status === 404) return 'Department not found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) return 'The service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the request.';
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function DeptStatusChart({
  activeCount,
  inactiveCount,
}: {
  activeCount: number;
  inactiveCount: number;
}) {
  const total = Math.max(activeCount + inactiveCount, 1);
  const activeDeg = (activeCount / total) * 360;
  const inactiveDeg = activeDeg + (inactiveCount / total) * 360;

  return (
    <>
      <div className="um-donut-wrap">
        <div
          aria-label="Departments by status"
          className="um-donut"
          role="img"
          style={{
            background: `conic-gradient(#16a34a 0deg ${activeDeg}deg, #ea580c ${activeDeg}deg ${inactiveDeg}deg, #e5e7eb ${inactiveDeg}deg 360deg)`,
          }}
        />
      </div>
      <div className="chart-legend-list">
        <div className="cl-item">
          <div className="cl-left">
            <div className="cl-dot cl-dot-active" />
            <span>Active</span>
          </div>
          <span className="cl-count">{activeCount}</span>
        </div>
        <div className="cl-item">
          <div className="cl-left">
            <div className="cl-dot cl-dot-inactive" />
            <span>Inactive</span>
          </div>
          <span className="cl-count">{inactiveCount}</span>
        </div>
      </div>
    </>
  );
}

function DeptsByBranch({
  departments,
  branches,
}: {
  departments: DepartmentResponse[];
  branches: BranchResponse[];
}) {
  const branchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    departments.forEach((d) =>
      d.branch_ids.forEach((bid) => counts.set(bid, (counts.get(bid) ?? 0) + 1))
    );
    return [...counts.entries()]
      .map(([id, count]) => ({
        name: branches.find((b) => b.id === id)?.name ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [departments, branches]);
  const maxCount = Math.max(...branchCounts.map((b) => b.count), 1);

  return (
    <div id="dept-branch-bar-list">
      {branchCounts.length === 0 ? (
        <p className="dialog-message">No data available.</p>
      ) : (
        branchCounts.map(({ name, count }) => (
          <div className="role-bar-item" key={name}>
            <div className="role-bar-header">
              <span>{name}</span>
              <span>{count}</span>
            </div>
            <div className="role-bar-track">
              <div
                className="role-bar-fill"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DepartmentDeleteDialog({
  department,
  loading,
  onCancel,
  onConfirm,
}: {
  department: DepartmentResponse;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [page, setPage] = useState(1);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string } | null>(null);
  const preview = useDepartmentDeletePreviewFeature(department.id, page);
  const assigned = Boolean(preview.data?.service_meta.total || preview.data?.user_meta.total);
  const servicePages = preview.data ? Math.ceil(preview.data.service_meta.total / preview.data.service_meta.limit) : 1;
  const userPages = preview.data ? Math.ceil(preview.data.user_meta.total / preview.data.user_meta.limit) : 1;
  const pageCount = Math.max(servicePages, userPages);

  const confirmServiceDelete = async () => {
    if (!serviceToDelete || !preview.canDeleteService) return;
    try {
      await preview.deleteService.mutateAsync(serviceToDelete.id);
      setServiceToDelete(null);
      setPage(1);
      await preview.retry();
    } catch (error) {
      console.error('Failed to delete assigned service', error);
    }
  };

  return (
    <>
    <Modal
      open
      size="large"
      title="Delete Department"
      onClose={() => { if (!loading) onCancel(); }}
      footer={(
        <>
          <button className="btn-secondary" disabled={loading} onClick={onCancel} type="button">Cancel</button>
          <button className="btn-danger" disabled={loading || preview.loading || Boolean(preview.error) || assigned} onClick={onConfirm} type="button">
            {loading ? 'Deleting…' : 'Delete Department'}
          </button>
        </>
      )}
    >
      <p className="dialog-message">Delete {department.name}? First delete or reassign its services and reassign its users.</p>
      {preview.loading && <p>Loading assigned services and users…</p>}
      {preview.error && <div role="alert">Could not load department assignments. <button className="btn-secondary" onClick={() => void preview.retry()} type="button">Retry</button></div>}
      {preview.data && (
        <div className="department-delete-preview">
          <section className="department-delete-section">
            <h4>Assigned services ({preview.data.service_meta.total})</h4>
            {preview.data.services.length === 0 ? <p>No services are assigned.</p> : (
              <ul className="department-delete-list department-delete-service-list">
                {preview.data.services.map((service) => (
                  <li className="department-delete-service-row" key={service.id}>
                    <div className="department-delete-service-details">
                      <strong>{service.name}</strong>
                      <span>{service.code} · {service.type.replaceAll('_', ' ')} · {service.status}</span>
                    </div>
                    {preview.canDeleteService && <button className="btn-danger" disabled={preview.deleteService.isPending} onClick={() => setServiceToDelete({ id: service.id, name: service.name })} type="button">Delete service</button>}
                  </li>
                ))}
              </ul>
            )}
            {!preview.canDeleteService && preview.data.service_meta.total > 0 && <p>You do not have permission to delete services. Ask a user with Service Catalogue delete access.</p>}
          </section>
          <section className="department-delete-section">
            <h4>Assigned users ({preview.data.user_meta.total})</h4>
            {preview.data.users.length === 0 ? <p>No users are assigned.</p> : (
              <ul className="department-delete-list department-delete-user-list">
                {preview.data.users.map((user) => <li key={user.id}><strong>{user.name}</strong>{user.employee_code ? ` · ${user.employee_code}` : ''}{user.job_title ? ` · ${user.job_title}` : ''} · {user.status}</li>)}
              </ul>
            )}
          </section>
          {pageCount > 1 && (
            <div className="department-delete-pagination">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
              <span> Page {page} of {pageCount} </span>
              <button className="btn-secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          )}
          {assigned && <p role="status">Reassign these records in Service Catalogue and User Management before deleting this department.</p>}
          {!assigned && <p>No assigned services or users. This department is ready to delete.</p>}
        </div>
      )}
    </Modal>
    {serviceToDelete && (
      <ConfirmDialog
        open
        title="Delete Service"
        message={`Delete ${serviceToDelete.name}? This will soft-delete it so it no longer blocks department deletion.`}
        confirmLabel="Delete Service"
        loading={preview.deleteService.isPending}
        onCancel={() => { if (!preview.deleteService.isPending) setServiceToDelete(null); }}
        onConfirm={() => void confirmServiceDelete()}
      />
    )}
    </>
  );
}


// ─── Main Page Component ───────────────────────────────────────────────────────

export function DepartmentManagementPage() {
  const feature = useDepartmentManagementFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, branchFilter, statusFilter, sortColumn, sortDirection, currentPage, pageSize, setQuery, setBranchFilter, setStatusFilter, setCurrentPage, setPageSize } = state;
  const { departments, meta, summary, branches } = data;
  const { isFetching: loading, isMutating: submitting, loadError } = status;
  const { canCreate } = rbac;
  const { handleSort, resetFilters, handleExport } = actions;

  const search = query;
  const setSearch = setQuery;
  const { search: locationSearch } = useAppLocation();

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeDept, setActiveDept] = useState<DepartmentResponse | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DepartmentResponse | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const deptForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      code: '', name: '', branch_ids: [], description: '', status: 'ACTIVE', isClinical: false, hiddenModules: []
    }
  });

  // Status
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const openModal = (mode: ModalMode, dept: DepartmentResponse | null = null) => {
    setModalMode(mode);
    setActiveDept(dept);
    setFormError('');
    if (dept) {
      deptForm.reset({
        code: dept.code,
        name: dept.name,
        branch_ids: dept.branch_ids,
        description: dept.description || '',
        status: dept.status,
        isClinical: dept.isClinical,
        hiddenModules: dept.hiddenModules ?? [],
      });
    } else {
      deptForm.reset({
        code: '', name: '', branch_ids: [], description: '', status: 'ACTIVE', isClinical: false, hiddenModules: []
      });
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveDept(null);
    setFormError('');
    deptForm.reset();
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode && canCreate) {
      openModal('create');
    }
  }, [locationSearch, canCreate, modalMode]);

  const handleSave = deptForm.handleSubmit(async (values) => {
    setFormError('');
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        branch_ids: values.branch_ids,
        description: values.description?.trim() || null,
        status: values.status,
        isClinical: values.isClinical,
        hiddenModules: values.hiddenModules,
      };

      if (modalMode === 'create') {
        await mutations.createDepartment.mutateAsync(payload);
        showToast('Department created successfully.');
      } else if (activeDept) {
        await mutations.updateDepartment.mutateAsync({ id: activeDept.id, payload });
        showToast('Department updated successfully.');
      }

      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteDepartment.mutateAsync(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (departments.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updateStatus = async (department: DepartmentResponse) => {
    try {
      const next: ApiDepartmentStatus = department.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await mutations.updateDepartmentStatus.mutateAsync({ id: department.id, status: next });
      showToast(`${department.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const exportDepartments = async () => {
    try {
      const blob = await handleExport();
      if (blob) {
        downloadBlob(blob, 'hms-departments.csv');
        showToast('All filtered departments exported.');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const totalPages = Math.max(meta.totalPages, 1);
  const safePage = Math.min(currentPage, totalPages);

  const getBranchName = (id: string) => branches.find((b) => b.id === id)?.name || id;

  const showingLabel =
    loadError || departments.length === 0
      ? 'No departments found'
      : `Showing ${(safePage - 1) * pageSize + 1}–${(safePage - 1) * pageSize + departments.length} of ${meta.total} departments`;

  const modalTitle =
    modalMode === 'create'
      ? 'Add New Department'
      : modalMode === 'edit' && activeDept
        ? `Edit ${activeDept.name}`
        : activeDept
          ? `${activeDept.name} Details`
          : 'Department';

  return (
    <>
      <div className="um-grid department-management-page">
        <div className="um-top-row">
          <div className="um-top-title-area">
            <h2 className="um-page-title">Department Management</h2>
            <p className="um-page-subtitle">Configure clinical and non-clinical departments, module access, and branch linkages.</p>
          </div>
          <div className="um-top-actions">
            {canCreate ? (
              <button className="um-add-btn-top" onClick={() => openModal('create')} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Department
              </button>
            ) : null}
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="um-kpi-row" aria-label="Department KPIs">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-buildings" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Departments</span>
              <span className="kpi-value">{loading ? '-' : summary.total}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-check-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active</span>
              <span className="kpi-value">{loading ? '-' : summary.active}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange">
              <i className="ph ph-minus-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inactive</span>
              <span className="kpi-value">{loading ? '-' : summary.inactive}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon purple">
              <i className="ph ph-git-branch" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Branches Covered</span>
              <span className="kpi-value">{loading ? '-' : summary.branchesCovered}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-calendar-plus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Added This Month</span>
              <span className="kpi-value">{loading ? '-' : summary.addedThisMonth}</span>
            </div>
          </div>
        </div>

        {/* ── Body (Table + Right Panel) ────────────────────────────────────── */}
        <div className={`um-body${showAnalytics ? ' um-body--analytics' : ' um-body--full'}`}>
          {/* Table Section */}
          <div className="um-table-section card">
            {/* Toolbar */}
            <div className="um-toolbar">
              <div className="um-toolbar-row1">
                <div className="um-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Search by code, name, description..."
                    type="search"
                    value={search}
                  />
                </div>
                <button
                  className="um-add-btn"
                  onClick={() => openModal('create')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" /> Add Department
                </button>
                <button className="btn-secondary admin-table-action" disabled={submitting} onClick={() => void exportDepartments()} type="button">
                  <i className="ph ph-download-simple" aria-hidden="true" /> Export CSV
                </button>
                <button className="btn-secondary admin-table-action" disabled={loading} onClick={() => void resetFilters()} /* Refresh */ type="button">
                  <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
                </button>
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filter by:</span>
                <select
                  className="um-filter"
                  id="dept-branch-filter"
                  onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
                  value={branchFilter}
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select
                  className="um-filter"
                  id="dept-status-filter"
                  onChange={(e) => { setStatusFilter(e.target.value as ApiDepartmentStatus); setCurrentPage(1); }}
                  value={statusFilter}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <button className="um-clear-btn" onClick={resetFilters} type="button">
                  <i className="ph ph-x" aria-hidden="true" /> Clear Filters
                </button>
                <button
                  aria-expanded={showAnalytics}
                  className="btn-secondary admin-table-action admin-analytics-toggle"
                  onClick={() => setShowAnalytics((visible) => !visible)}
                  type="button"
                >
                  <i className="ph ph-chart-bar" aria-hidden="true" />
                  {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader
                      column="code"
                      label="Dept Code"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <SortableHeader
                      column="name"
                      label="Department Name"
                      onSort={handleSort}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                    />
                    <th scope="col">Branch</th>
                    <th scope="col">Status</th>
                    <th scope="col">Clinical</th>
                    <SortableHeader
                      column="created_at"
                      label="Created Date"
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
                      <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                        <MedicalLoader
                          text="Loading departments..."
                          subtext="Retrieving hospital clinical & administrative units"
                        />
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={7}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                        <button
                          className="secondary-action"
                          onClick={() => void resetFilters()} /* Refresh */
                          style={{ marginLeft: '1rem' }}
                          type="button"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : departments.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={7}>
                        <i className="ph ph-buildings" aria-hidden="true" />
                        No departments found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => (
                      <tr key={dept.id}>
                        <td>
                          <span className="emp-id">{dept.code}</span>
                        </td>
                        <td>
                          <div className="user-cell">
                            <div className="user-cell-info">
                              <span className="user-cell-name">{dept.name}</span>
                              {dept.description ? (
                                <span className="muted-cell" style={{ fontSize: '0.75rem' }}>
                                  {dept.description}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>{dept.branch_ids.map(getBranchName).join(', ')}</td>
                        <td>
                          <span
                            className={`status-badge ${dept.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}
                          >
                            {dept.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {dept.isClinical ? (
                            <span className="status-badge status-active">
                              <span style={{ marginRight: '4px' }}></span> Clinical
                            </span>
                          ) : (
                            <span className="status-badge" style={{ background: '#f3f4f6', color: '#374151' }}>
                              <span style={{ marginRight: '4px' }}></span> Non Clinical
                            </span>
                          )}
                        </td>
                        <td className="muted-cell">{formatDateTime(dept.created_at)}</td>
                        <td>
                          <div className="action-icons">
                            <button
                              className="action-icon-btn"
                              onClick={() => openModal('view', dept)}
                              title="View"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            <button
                              className="action-icon-btn"
                              onClick={() => openModal('edit', dept)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil" aria-hidden="true" />
                            </button>
                            <button className="action-icon-btn" disabled={submitting} onClick={() => void updateStatus(dept)} title={dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} type="button"><i className={`ph ${dept.status === 'ACTIVE' ? 'ph-pause-circle' : 'ph-play-circle'}`} /></button>
                            <button
                              className="action-icon-btn danger"
                              onClick={() => setDeleteTarget(dept)}
                              title="Delete"
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
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
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
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Analytics Panel ─────────────────────────────────────── */}
          {showAnalytics ? <div className="um-right-panel">
            {/* Status Donut */}
            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Departments by Status</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading status chart..." subtext="Aggregating department metrics" />
                </div>
              ) : (
                <DeptStatusChart activeCount={summary.active} inactiveCount={summary.inactive} />
              )}
            </div>

            {/* By Branch */}
            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Departments by Branch</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading branch chart..." subtext="Aggregating branch distribution" />
                </div>
              ) : (
                <DeptsByBranch departments={departments} branches={branches} />
              )}
            </div>

          </div> : null}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
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
              <button
                className="btn-primary"
                disabled={submitting}
                form="dept-management-form"
                type="submit"
              >
                {submitting ? 'Saving...' : 'Save Department'}
              </button>
            </>
          )
        }
        className="um-user-modal"
        size="large"
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-buildings"
        title={modalTitle}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert">
            {formError}
          </div>
        ) : null}

        {(modalMode === 'create' || modalMode === 'edit') && (
          <form id="dept-management-form" onSubmit={(e) => void handleSave(e)}>
            {/* Section 1: Basic Information */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-buildings" />
                  <span>Basic Information</span>
                </div>
                <span className="um-card-badge">Identification</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-hash" /> Department Code
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        aria-invalid={Boolean(deptForm.formState.errors.code)}
                        placeholder="e.g. CARDIO, PEDIATRICS"
                        {...deptForm.register('code')}
                      />
                      <i className="ph ph-hash um-input-prefix-icon" />
                    </div>
                    {deptForm.formState.errors.code ? (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {deptForm.formState.errors.code.message}
                      </span>
                    ) : null}
                  </div>

                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-first-aid" /> Department Name
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        aria-invalid={Boolean(deptForm.formState.errors.name)}
                        placeholder="e.g. Cardiology & Vascular"
                        {...deptForm.register('name')}
                      />
                      <i className="ph ph-first-aid um-input-prefix-icon" />
                    </div>
                    {deptForm.formState.errors.name ? (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {deptForm.formState.errors.name.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Organisation & Classification */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-git-branch" />
                  <span>Organisation &amp; Classification</span>
                </div>
                <span className="um-card-badge">Scope &amp; Status</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-map-pin" /> Branch
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <BranchMultiSelect
                      branches={branches}
                      selectedIds={deptForm.watch('branch_ids')}
                      onChange={(newIds) => {
                        deptForm.setValue('branch_ids', newIds, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                      disabled={submitting}
                    />
                    {deptForm.formState.errors.branch_ids ? (
                      <span className="um-field-error">
                        <i className="ph ph-warning-circle" /> {deptForm.formState.errors.branch_ids.message}
                      </span>
                    ) : null}
                  </div>

                  {modalMode === 'edit' ? (
                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text">
                          <i className="ph ph-toggle-left" /> Status
                        </span>
                      </label>
                      <div className="um-input-wrap">
                        <select
                          disabled={submitting}
                          {...deptForm.register('status')}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                        <i className="ph ph-toggle-left um-input-prefix-icon" />
                      </div>
                    </div>
                  ) : (
                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text">
                          <i className="ph ph-toggle-left" /> Status
                        </span>
                      </label>
                      <div className="um-default-status-pill" title="New departments are active upon creation">
                        <div className="um-status-card-dot active" />
                        <div className="um-default-status-info">
                          <span className="um-default-status-title">Active</span>
                          <span className="um-default-status-hint">Default for newly created hospital departments</span>
                        </div>
                        <span className="um-default-status-badge">
                          <i className="ph ph-check" /> Default
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="um-field" style={{ marginTop: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
                    <Controller
                      name="isClinical"
                      control={deptForm.control}
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          disabled={submitting}
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                        />
                      )}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>Is Clinical Department?</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Designates departments that directly manage clinical patients and examinations</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 3: Doctor Module Visibility */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-eye-slash" />
                  <span>Doctor Module Visibility</span>
                </div>
                <span className="um-card-badge">Custom Scope</span>
              </div>
              <div className="um-modal-card-body">
                <p className="dialog-message" style={{ marginTop: 0, marginBottom: '0.85rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Selected modules are hidden only from users with the Doctor role assigned to this department.
                  Existing role permissions and API authorization are unchanged.
                </p>
                <div className="um-role-options" aria-label="Modules hidden from department doctors">
                  {departmentModuleOptions.map((module) => {
                    const hiddenModules = deptForm.watch('hiddenModules');
                    const checked = hiddenModules.includes(module.key);
                    return (
                      <label className="um-role-option" key={module.key}>
                        <input
                          checked={checked}
                          disabled={submitting}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...hiddenModules, module.key]
                              : hiddenModules.filter((key) => key !== module.key);
                            deptForm.setValue('hiddenModules', next, { shouldDirty: true, shouldValidate: true });
                          }}
                          type="checkbox"
                        />
                        <span>Hide {module.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 4: Additional Information */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-text-align-left" />
                  <span>Additional Information</span>
                </div>
                <span className="um-card-badge">Notes</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-field">
                  <label className="um-field-label">
                    <span className="um-field-label-text">
                      <i className="ph ph-info" /> Description &amp; Notes
                    </span>
                  </label>
                  <textarea
                    className="um-textarea"
                    disabled={submitting}
                    placeholder="Provide overview, clinical scope, or department location notes..."
                    rows={3}
                    {...deptForm.register('description')}
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {modalMode === 'view' && activeDept ? (
          <div className="um-modal-card">
            <div className="um-modal-card-header">
              <div className="um-card-title-wrap">
                <i className="ph ph-buildings" />
                <span>Department Details</span>
              </div>
              <span className="um-card-badge">Record View</span>
            </div>
            <div className="um-modal-card-body">
              <div className="um-form-row-2">
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-hash" /> Department Code</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeDept.code} /><i className="ph ph-hash um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-first-aid" /> Department Name</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeDept.name} /><i className="ph ph-first-aid um-input-prefix-icon" /></div>
                </div>
              </div>
              <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-toggle-left" /> Status</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeDept.status === 'ACTIVE' ? 'Active' : 'Inactive'} /><i className="ph ph-toggle-left um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-stethoscope" /> Clinical Department</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeDept.isClinical ? 'Yes' : 'No'} /><i className="ph ph-stethoscope um-input-prefix-icon" /></div>
                </div>
              </div>
              <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-map-pin" /> Assigned Branch(es)</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeDept.branch_ids.map(getBranchName).join(', ')} /><i className="ph ph-map-pin um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-calendar" /> Created Date</span></label>
                  <div className="um-input-wrap"><input readOnly value={formatDateTime(activeDept.created_at)} /><i className="ph ph-calendar um-input-prefix-icon" /></div>
                </div>
              </div>
              <div className="um-field" style={{ marginTop: '0.85rem' }}>
                <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-text-align-left" /> Description</span></label>
                <textarea className="um-textarea" readOnly rows={3} value={activeDept.description || '—'} />
              </div>
              <div className="um-field" style={{ marginTop: '0.85rem' }}>
                <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-eye-slash" /> Modules Hidden from Doctors</span></label>
                <textarea
                  className="um-textarea"
                  readOnly
                  rows={2}
                  value={activeDept.hiddenModules.length > 0
                    ? activeDept.hiddenModules.map((key) => departmentModuleOptions.find((option) => option.key === key)?.label ?? key).join(', ')
                    : 'None (all default modules accessible)'}
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      {deleteTarget && <DepartmentDeleteDialog department={deleteTarget} loading={submitting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void handleDelete()} />}

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
