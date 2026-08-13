import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import { branchesApi, type BranchResponse } from '../api/branches';
import {
  departmentsApi,
  type ApiDepartmentStatus,
  type DepartmentListResponse,
  type DepartmentResponse,
  type DepartmentSummary,
  type SaveDepartmentPayload,
} from '../api/departments';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';

type SortColumn = 'code' | 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view';

type DepartmentFormState = {
  code: string;
  name: string;
  branch_id: string;
  description: string;
  status: ApiDepartmentStatus;
};

const emptyForm: DepartmentFormState = {
  code: '',
  name: '',
  branch_id: '',
  description: '',
  status: 'ACTIVE',
};

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
      counts.set(d.branch_id, (counts.get(d.branch_id) ?? 0) + 1)
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
  const { search: locationSearch } = useAppLocation();
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [summary, setSummary] = useState<DepartmentSummary>({ total: 0, active: 0, inactive: 0, addedThisMonth: 0, branchesCovered: 0 });
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiDepartmentStatus | ''>('');

  // Pagination & Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<DepartmentListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeDept, setActiveDept] = useState<DepartmentResponse | null>(null);
  const [form, setForm] = useState<DepartmentFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DepartmentResponse | null>(null);

  // Status
  const [loadError, setLoadError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadBranches = useCallback(async () => {
    try {
      const res = await branchesApi.list({ limit: 100, status: 'ACTIVE' });
      setBranches(res.data);
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [res, totals] = await Promise.all([departmentsApi.list({
        search: search.trim() || undefined,
        branch_id: branchFilter || undefined,
        status: (statusFilter as ApiDepartmentStatus) || undefined,
        page: currentPage,
        limit: pageSize,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      }), departmentsApi.summary()]);

      setDepartments(res.data);
      setMeta(res.meta);
      setSummary(totals);
    } catch (error) {
      setDepartments([]);
      setMeta({ limit: pageSize, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [search, branchFilter, statusFilter, currentPage, pageSize, sortColumn, sortDirection]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  // ── Derived KPI values ─────────────────────────────────────────────────────
  // ── Sort / filter helpers ──────────────────────────────────────────────────
  const handleSort = (column: SortColumn) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = (mode: ModalMode, dept: DepartmentResponse | null = null) => {
    setModalMode(mode);
    setActiveDept(dept);
    setFormError('');
    if (dept) {
      setForm({
        code: dept.code,
        name: dept.name,
        branch_id: dept.branch_id,
        description: dept.description || '',
        status: dept.status,
      });
    } else {
      setForm(emptyForm);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveDept(null);
    setFormError('');
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) openModal('create');
  }, [locationSearch]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.code.trim()) { setFormError('Code is required.'); return; }
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.branch_id) { setFormError('Branch is required.'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      const payload: SaveDepartmentPayload = {
        code: form.code.trim(),
        name: form.name.trim(),
        branch_id: form.branch_id,
        description: form.description.trim() || null,
        status: form.status,
      };

      if (modalMode === 'create') {
        await departmentsApi.create(payload);
        showToast('Department created successfully.');
      } else if (activeDept) {
        await departmentsApi.update(activeDept.id, payload);
        showToast('Department updated successfully.');
      }

      closeModal();
      await loadDepartments();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await departmentsApi.delete(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      await loadDepartments();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (department: DepartmentResponse) => {
    setSubmitting(true);
    try {
      const next = department.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await departmentsApi.updateStatus(department.id, next);
      showToast(`${department.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      await loadDepartments();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const exportDepartments = async () => {
    setSubmitting(true);
    try {
      const blob = await departmentsApi.export({
        branch_id: branchFilter || undefined,
        search: search.trim() || undefined,
        sortBy: sortColumn || undefined,
        sortOrder: sortDirection,
        status: statusFilter || undefined,
      });
      downloadBlob(blob, 'hms-departments.csv');
      showToast('All filtered departments exported.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived pagination ─────────────────────────────────────────────────────
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
                <button className="btn-secondary admin-table-action" disabled={loading} onClick={() => void loadDepartments()} type="button">
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
                      <td className="um-state-cell" colSpan={6}>
                        <span className="loading-spinner" /> Loading departments...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                        <button
                          className="secondary-action"
                          onClick={() => void loadDepartments()}
                          style={{ marginLeft: '1rem' }}
                          type="button"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : departments.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
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
                        <td>{getBranchName(dept.branch_id)}</td>
                        <td>
                          <span
                            className={`status-badge ${dept.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}
                          >
                            {dept.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
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
                <div className="um-panel-loading">Loading chart...</div>
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
                <div className="um-panel-loading">Loading...</div>
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
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  value={form.code}
                />
              </label>
              <label className="form-field">
                <span>Department Name <span className="required">*</span></span>
                <input
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  value={form.name}
                />
              </label>
            </div>

            <div className="form-section-title">Organisation</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Branch <span className="required">*</span></span>
                <select
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  required
                  value={form.branch_id}
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              {modalMode === 'edit' && (
                <label className="form-field">
                  <span>Status</span>
                  <select
                    disabled={submitting}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ApiDepartmentStatus })}
                    value={form.status}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              )}
            </div>

            <div className="form-section-title">Additional Information</div>
            <div className="form-grid-3">
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  value={form.description}
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
                <span>Branch</span>
                <input readOnly value={getBranchName(activeDept.branch_id)} />
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
        confirmLabel={submitting ? 'Deleting...' : 'Delete Department'}
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
