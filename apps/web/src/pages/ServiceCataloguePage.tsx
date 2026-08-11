import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import {
  servicesApi,
  type ApiServiceStatus,
  type CreateServicePayload,
  type ServiceListResponse,
  type ServiceResponse,
} from '../api/services';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SortColumn = 'code' | 'name' | 'standard_price' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view';

type ServiceFormState = {
  code: string;
  name: string;
  branch_id: string;
  department_id: string;
  category: string;
  description: string;
  standard_price: string;
  duration_minutes: string;
  status: ApiServiceStatus;
};

const emptyForm: ServiceFormState = {
  code: '',
  name: '',
  branch_id: '',
  department_id: '',
  category: '',
  description: '',
  standard_price: '',
  duration_minutes: '',
  status: 'ACTIVE',
};

type LookupPage<T> = {
  data: T[];
  meta: { totalPages: number };
};

const loadAllLookupPages = async <T,>(loadPage: (page: number) => Promise<LookupPage<T>>) => {
  const firstPage = await loadPage(1);
  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) => loadPage(index + 2)),
  );
  return [firstPage, ...remainingPages].flatMap((response) => response.data);
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check your inputs.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage services.';
    if (error.status === 404) return 'Service not found.';
    if (error.status === 409) return 'A service with this code already exists.';
    if (error.status >= 500) return 'The service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the request.';
};

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

const formatPrice = (value: number): string =>
  new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

const isThisMonth = (value: string): boolean => {
  const d = new Date(value);
  const now = new Date();
  return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

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

function ServiceStatusChart({ services }: { services: ServiceResponse[] }) {
  const activeCount = services.filter((s) => s.status === 'ACTIVE').length;
  const inactiveCount = services.filter((s) => s.status === 'INACTIVE').length;
  const total = Math.max(services.length, 1);
  const activeDeg = (activeCount / total) * 360;
  const inactiveDeg = activeDeg + (inactiveCount / total) * 360;

  return (
    <>
      <div className="um-donut-wrap">
        <div
          aria-label="Services by status"
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

function ServicesByDepartment({
  services,
  departments,
}: {
  services: ServiceResponse[];
  departments: DepartmentResponse[];
}) {
  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach((s) => counts.set(s.department_id, (counts.get(s.department_id) ?? 0) + 1));
    return [...counts.entries()]
      .map(([id, count]) => ({
        name: departments.find((d) => d.id === id)?.name ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [services, departments]);

  const maxCount = Math.max(...deptCounts.map((d) => d.count), 1);

  return (
    <div id="svc-dept-bar-list">
      {deptCounts.length === 0 ? (
        <p className="dialog-message">No data available.</p>
      ) : (
        deptCounts.map(({ name, count }) => (
          <div className="role-bar-item" key={name}>
            <div className="role-bar-header">
              <span>{name}</span>
              <span>{count}</span>
            </div>
            <div className="role-bar-track">
              <div className="role-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────

export function ServiceCataloguePage() {
  // Data
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiServiceStatus | ''>('');

  // Pagination & Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<ServiceListResponse['meta']>({
    limit: 10, page: 1, total: 0, totalPages: 1,
  });

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeSvc, setActiveSvc] = useState<ServiceResponse | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceResponse | null>(null);

  // UI Status
  const [loadError, setLoadError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  // ── Derived: filter departments by selected branch ─────────────────────────
  const formDepartmentOptions = useMemo(
    () => (form.branch_id ? departments.filter((department) => department.branch_id === form.branch_id) : departments),
    [departments, form.branch_id],
  );

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLookupError('');
    try {
      const [availableBranches, availableDepartments] = await Promise.all([
        loadAllLookupPages((page) =>
          branchesApi.list({ limit: 100, page, sortBy: 'name', sortOrder: 'asc' }),
        ),
        loadAllLookupPages((page) =>
          departmentsApi.list({ limit: 100, page, sortBy: 'name', sortOrder: 'asc' }),
        ),
      ]);
      setBranches(availableBranches);
      setDepartments(availableDepartments);
    } catch (error) {
      setBranches([]);
      setDepartments([]);
      setLookupError(getErrorMessage(error));
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const deptId = deptFilter || undefined;

      const res = await servicesApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        department_id: deptId,
        page: currentPage,
        limit: pageSize,
        sortBy: sortColumn ?? undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      });
      setServices(res.data);
      setMeta(res.meta);
      setForbidden(false);

      if (currentPage > res.meta.totalPages) {
        setCurrentPage(res.meta.totalPages);
      }
    } catch (error) {
      setServices([]);
      setMeta({ limit: pageSize, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, deptFilter, currentPage, pageSize, sortColumn, sortDirection]);

  useEffect(() => { void loadLookups(); }, [loadLookups]);
  useEffect(() => { void loadServices(); }, [loadServices]);

  // ── KPI values ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = services.filter((s) => s.status === 'ACTIVE').length;
    const inactive = services.filter((s) => s.status === 'INACTIVE').length;
    const deptIds = new Set(services.map((s) => s.department_id));
    const addedThisMonth = services.filter((s) => isThisMonth(s.created_at)).length;
    return { active, inactive, deptsCovered: deptIds.size, addedThisMonth };
  }, [services]);

  // ── Sort / filter ──────────────────────────────────────────────────────────
  const handleSort = (column: SortColumn) => {
    setSortColumn((cur) => {
      if (cur === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return cur;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setDeptFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  // ── Modals ─────────────────────────────────────────────────────────────────
  const openModal = (mode: ModalMode, svc: ServiceResponse | null = null) => {
    setModalMode(mode);
    setActiveSvc(svc);
    setFormError('');
    if (svc) {
      const department = departments.find((item) => item.id === svc.department_id);
      setForm({
        code: svc.code,
        name: svc.name,
        branch_id: department?.branch_id ?? '',
        department_id: svc.department_id,
        category: svc.category ?? '',
        description: svc.description ?? '',
        standard_price: String(svc.standard_price),
        duration_minutes: String(svc.duration_minutes),
        status: svc.status,
      });
    } else {
      setForm(emptyForm);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveSvc(null);
    setFormError('');
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { setFormError('Service code is required.'); return; }
    if (!form.name.trim()) { setFormError('Service name is required.'); return; }
    if (!form.department_id) { setFormError('Department is required.'); return; }

    const price = parseFloat(form.standard_price);
    const duration = parseInt(form.duration_minutes, 10);
    if (Number.isNaN(price) || price < 0) { setFormError('Standard price must be a non-negative number.'); return; }
    if (Number.isNaN(duration) || duration < 1) { setFormError('Duration must be at least 1 minute.'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const payload: CreateServicePayload = {
          code: form.code.trim(),
          name: form.name.trim(),
          department_id: form.department_id,
          standard_price: price,
          duration_minutes: duration,
          category: form.category.trim() || null,
          description: form.description.trim() || null,
          status: form.status,
        };
        await servicesApi.create(payload);
        showToast('Service created successfully.');
      } else if (activeSvc) {
        await servicesApi.update(activeSvc.id, {
          code: form.code.trim(),
          name: form.name.trim(),
          department_id: form.department_id,
          standard_price: price,
          duration_minutes: duration,
          category: form.category.trim() || null,
          description: form.description.trim() || null,
        });
        showToast('Service updated successfully.');
      }
      closeModal();
      await loadServices();
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
      await servicesApi.delete(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (services.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadServices();
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Lookups ────────────────────────────────────────────────────────────────
  const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const getBranchForDept = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return '—';
    return branches.find((b) => b.id === dept.branch_id)?.name ?? '—';
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(meta.totalPages, 1);
  const safePage = Math.min(currentPage, totalPages);

  const showingLabel =
    loadError || services.length === 0
      ? 'No services found'
      : `Showing ${(safePage - 1) * pageSize + 1}–${(safePage - 1) * pageSize + services.length} of ${meta.total} services`;

  const modalTitle =
    modalMode === 'create'
      ? 'Add New Service'
      : modalMode === 'edit' && activeSvc
        ? `Edit ${activeSvc.name}`
        : activeSvc
          ? `${activeSvc.name} Details`
          : 'Service';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="um-grid">
        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="um-kpi-row" aria-label="Service KPIs">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-stethoscope" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Services</span>
              <span className="kpi-value">{loading ? '—' : meta.total}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-check-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active</span>
              <span className="kpi-value">{loading ? '—' : kpis.active}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange">
              <i className="ph ph-minus-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inactive</span>
              <span className="kpi-value">{loading ? '—' : kpis.inactive}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon purple">
              <i className="ph ph-buildings" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Departments Covered</span>
              <span className="kpi-value">{loading ? '—' : kpis.deptsCovered}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-calendar-plus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Added This Month</span>
              <span className="kpi-value">{loading ? '—' : kpis.addedThisMonth}</span>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="um-body">
          {/* Table section */}
          <div className="um-table-section card">
            {/* Toolbar */}
            <div className="um-toolbar">
              <div className="um-toolbar-row1">
                <div className="um-search">
                  <i className="ph ph-magnifying-glass" aria-hidden="true" />
                  <input
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Search by code or name..."
                    type="search"
                    value={search}
                  />
                </div>
                <button
                  className="um-add-btn"
                  disabled={forbidden || lookupsLoading || departments.length === 0}
                  onClick={() => openModal('create')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" /> Add Service
                </button>
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filter by:</span>

                <select
                  className="um-filter"
                  id="svc-dept-filter"
                  onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                  value={deptFilter}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <select
                  className="um-filter"
                  id="svc-status-filter"
                  onChange={(e) => { setStatusFilter(e.target.value as ApiServiceStatus); setCurrentPage(1); }}
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

            {lookupError ? (
              <div className="auth-alert auth-alert--error" role="alert">{lookupError}</div>
            ) : null}

            {/* Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader column="code" label="Service Code" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <SortableHeader column="name" label="Service Name" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Department</th>
                    <th scope="col">Branch</th>
                    <SortableHeader column="standard_price" label="Price" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Duration</th>
                    <th scope="col">Status</th>
                    <SortableHeader column="created_at" label="Created" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={9}>
                        <span className="loading-spinner" /> Loading services...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={9}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                        <button
                          className="secondary-action"
                          onClick={() => void loadServices()}
                          style={{ marginLeft: '1rem' }}
                          type="button"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : services.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={9}>
                        <i className="ph ph-stethoscope" aria-hidden="true" />
                        No services found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    services.map((svc) => (
                      <tr key={svc.id}>
                        <td><span className="emp-id">{svc.code}</span></td>
                        <td>
                          <div className="user-cell-info">
                            <span className="user-cell-name">{svc.name}</span>
                            {svc.category ? (
                              <span className="muted-cell" style={{ fontSize: '0.75rem' }}>{svc.category}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>{getDeptName(svc.department_id)}</td>
                        <td className="muted-cell">{getBranchForDept(svc.department_id)}</td>
                        <td className="muted-cell">{formatPrice(svc.standard_price)}</td>
                        <td className="muted-cell">{svc.duration_minutes} min</td>
                        <td>
                          <span className={`status-badge ${svc.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                            {svc.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="muted-cell">{formatDate(svc.created_at)}</td>
                        <td>
                          <div className="action-icons">
                            <button
                              aria-label={`View ${svc.name}`}
                              className="action-icon-btn"
                              onClick={() => openModal('view', svc)}
                              title="View"
                              type="button"
                            >
                              <i className="ph ph-eye" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Edit ${svc.name}`}
                              className="action-icon-btn"
                              disabled={forbidden}
                              onClick={() => openModal('edit', svc)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Delete ${svc.name}`}
                              className="action-icon-btn danger"
                              disabled={forbidden}
                              onClick={() => setDeleteTarget(svc)}
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

          {/* ── Right Analytics Panel ────────────────────────────────────── */}
          <div className="um-right-panel">
            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Services by Status</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">Loading chart...</div>
              ) : (
                <ServiceStatusChart services={services} />
              )}
            </div>

            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Services by Department</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">Loading...</div>
              ) : (
                <ServicesByDepartment services={services} departments={departments} />
              )}
            </div>

            <div className="card um-quick-card">
              <div className="card-header">
                <h3>Quick Actions</h3>
              </div>
              <div className="um-quick-list">
                <button
                  className="um-quick-btn"
                  disabled={forbidden || lookupsLoading || departments.length === 0}
                  onClick={() => openModal('create')}
                  type="button"
                >
                  <i className="ph ph-plus-circle" aria-hidden="true" />
                  <div>
                    <strong>Add Service</strong>
                    <span>Create a new service</span>
                  </div>
                </button>
                <button
                  className="um-quick-btn"
                  onClick={() => showToast('Current service view is ready to export.')}
                  type="button"
                >
                  <i className="ph ph-download-simple" aria-hidden="true" />
                  <div>
                    <strong>Export Services</strong>
                    <span>Download as CSV</span>
                  </div>
                </button>
                <button
                  className="um-quick-btn"
                  disabled={loading}
                  onClick={() => void loadServices()}
                  type="button"
                >
                  <i className="ph ph-arrows-clockwise" aria-hidden="true" />
                  <div>
                    <strong>Refresh Data</strong>
                    <span>Reload service list</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        footer={
          modalMode === 'view' ? (
            <button className="btn-secondary" onClick={closeModal} type="button">Close</button>
          ) : (
            <>
              <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">Cancel</button>
              <button className="btn-primary" disabled={submitting} form="svc-management-form" type="submit">
                {submitting ? 'Saving...' : 'Save Service'}
              </button>
            </>
          )
        }
        onClose={closeModal}
        open={Boolean(modalMode)}
        title={modalTitle}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert">{formError}</div>
        ) : null}

        {(modalMode === 'create' || modalMode === 'edit') && (
          <form id="svc-management-form" onSubmit={(e) => void handleSave(e)}>
            <div className="form-section-title">Basic Information</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Service Code *</span>
                <input
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  value={form.code}
                />
              </label>
              <label className="form-field">
                <span>Service Name *</span>
                <input
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  value={form.name}
                />
              </label>
              <label className="form-field">
                <span>Category</span>
                <input
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Diagnostics"
                  value={form.category}
                />
              </label>
            </div>

            <div className="form-section-title">Organisation</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Branch</span>
                <select
                  disabled={submitting}
                  onChange={(e) => {
                    setForm({ ...form, branch_id: e.target.value, department_id: '' });
                  }}
                  value={form.branch_id}
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Department *</span>
                <select
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  required
                  value={form.department_id}
                >
                  <option value="">Select Department</option>
                  {formDepartmentOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  disabled={submitting || modalMode === 'edit'}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ApiServiceStatus })}
                  value={form.status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>

            <div className="form-section-title">Pricing & Duration</div>
            <div className="form-grid-3">
              <label className="form-field">
                <span>Standard Price *</span>
                <input
                  disabled={submitting}
                  min="0"
                  onChange={(e) => setForm({ ...form, standard_price: e.target.value })}
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={form.standard_price}
                />
              </label>
              <label className="form-field">
                <span>Duration (minutes) *</span>
                <input
                  disabled={submitting}
                  min="1"
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  placeholder="30"
                  required
                  step="1"
                  type="number"
                  value={form.duration_minutes}
                />
              </label>
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

        {modalMode === 'view' && activeSvc ? (
          <>
            <div className="form-section-title">Basic Information</div>
            <div className="form-grid-3">
              <label className="form-field"><span>Service Code</span><input readOnly value={activeSvc.code} /></label>
              <label className="form-field"><span>Service Name</span><input readOnly value={activeSvc.name} /></label>
              <label className="form-field"><span>Category</span><input readOnly value={activeSvc.category ?? ''} /></label>
              <label className="form-field"><span>Department</span><input readOnly value={getDeptName(activeSvc.department_id)} /></label>
              <label className="form-field"><span>Branch</span><input readOnly value={getBranchForDept(activeSvc.department_id)} /></label>
              <label className="form-field"><span>Status</span><input readOnly value={activeSvc.status === 'ACTIVE' ? 'Active' : 'Inactive'} /></label>
              <label className="form-field"><span>Standard Price</span><input readOnly value={formatPrice(activeSvc.standard_price)} /></label>
              <label className="form-field"><span>Duration</span><input readOnly value={`${activeSvc.duration_minutes} minutes`} /></label>
              <label className="form-field"><span>Created</span><input readOnly value={formatDate(activeSvc.created_at)} /></label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea readOnly rows={3} value={activeSvc.description ?? ''} />
              </label>
            </div>
          </>
        ) : null}
      </Modal>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        confirmLabel={submitting ? 'Deleting...' : 'Delete Service'}
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This will permanently remove the service and may fail if it has associated records.`
            : ''
        }
        onCancel={() => { if (!submitting) setDeleteTarget(null); }}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Delete Service"
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
