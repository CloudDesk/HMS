import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDepartmentManagementFeature, type SortColumn, type SortDirection } from '../hooks/departments/useDepartmentManagementFeature';
import { ApiError } from '../api/api-error';
import { type BranchResponse } from '../api/branches';
import {
  type ApiDepartmentStatus,
  type DepartmentResponse,
} from '../api/departments';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
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

  const deptForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      code: '', name: '', branch_ids: [], description: '', status: 'ACTIVE', isClinical: false
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
      });
    } else {
      deptForm.reset({
        code: '', name: '', branch_ids: [], description: '', status: 'ACTIVE', isClinical: false
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
      <div className="um-grid">
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
        <div className="um-body">
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
          <div className="um-right-panel">
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

          </div>
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
            <div className="form-section-title">Basic Information</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Department Code <span className="required">*</span></span>
                <input
                  disabled={submitting}
                  aria-invalid={Boolean(deptForm.formState.errors.code)}
                  {...deptForm.register('code')}
                />
                {deptForm.formState.errors.code ? <small className="field-error">{deptForm.formState.errors.code.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Department Name <span className="required">*</span></span>
                <input
                  disabled={submitting}
                  aria-invalid={Boolean(deptForm.formState.errors.name)}
                  {...deptForm.register('name')}
                />
                {deptForm.formState.errors.name ? <small className="field-error">{deptForm.formState.errors.name.message}</small> : null}
              </label>
            </div>

            <div className="form-section-title">Organisation</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Branch <span className="required">*</span></span>
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
                  <small className="field-error">
                    {deptForm.formState.errors.branch_ids.message}
                  </small>
                ) : null}
              </label>
              {modalMode === 'edit' && (
                <label className="form-field">
                  <span>Status</span>
                  <select
                    disabled={submitting}
                    {...deptForm.register('status')}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              )}
              <label className="form-field um-checkbox-field">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <Controller
                    name="isClinical"
                    control={deptForm.control}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        disabled={submitting}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                    )}
                  />
                  <span>Is Clinical Department?</span>
                </div>
              </label>
            </div>

            <div className="form-section-title">Additional Information</div>
            <div className="form-grid-3">
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea
                  disabled={submitting}
                  rows={3}
                  {...deptForm.register('description')}
                />
              </label>
            </div>
          </form>
        )}

        {modalMode === 'view' && activeDept ? (
          <>
            <div className="form-section-title">Basic Information</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Department Code</span>
                <input readOnly value={activeDept.code} />
              </label>
              <label className="form-field">
                <span>Department Name</span>
                <input readOnly value={activeDept.name} />
              </label>
              <label className="form-field">
                <span>Status</span>
                <input readOnly value={activeDept.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
              </label>
              <label className="form-field">
                <span>Clinical Department</span>
                <input readOnly value={activeDept.isClinical ? 'Yes' : 'No'} />
              </label>
              <label className="form-field">
                <span>Branch</span>
                <input readOnly value={activeDept.branch_ids.map(getBranchName).join(', ')} />
              </label>
              <label className="form-field">
                <span>Created Date</span>
                <input readOnly value={formatDateTime(activeDept.created_at)} />
              </label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea readOnly rows={3} value={activeDept.description || ''} />
              </label>
            </div>
          </>
        ) : null}
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        confirmLabel="Delete Department"
        loading={submitting}
        message={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This will permanently remove the department.`
            : ''
        }
        onCancel={() => {
          if (!submitting) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Delete Department"
      />

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
