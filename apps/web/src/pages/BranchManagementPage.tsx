import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  branchesApi,
  type ApiBranchStatus,
  type BranchListResponse,
  type BranchResponse,
  type BranchSummary,
  type SaveBranchPayload,
  type UpdateBranchPayload,
} from '../api/branches';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';

type SortColumn = 'code' | 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view';

type BranchFormState = {
  code: string;
  name: string;
  shortName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  status: ApiBranchStatus;
};

const emptyForm: BranchFormState = {
  code: '',
  name: '',
  shortName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  status: 'ACTIVE',
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check your inputs.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage branches.';
    if (error.status === 404) return 'Branch not found.';
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

export function BranchManagementPage() {
  const { search: locationSearch } = useAppLocation();
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [summary, setSummary] = useState<BranchSummary>({ total: 0, active: 0, inactive: 0, assignedUsers: 0, cities: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiBranchStatus | ''>('');

  // Pagination & Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [meta, setMeta] = useState<BranchListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchResponse | null>(null);
  const [form, setForm] = useState<BranchFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BranchResponse | null>(null);

  // Status
  const [loadError, setLoadError] = useState('');
  const [forbidden, setForbidden] = useState(false);
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
    setLoading(true);
    setLoadError('');

    try {
      const [res, totals] = await Promise.all([branchesApi.list({
        search: search.trim() || undefined,
        status: (statusFilter as ApiBranchStatus) || undefined,
        page: currentPage,
        limit: pageSize,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      }), branchesApi.summary()]);

      setBranches(res.data);
      setMeta(res.meta);
      setSummary(totals);
      setForbidden(false);

      if (currentPage > res.meta.totalPages) {
        setCurrentPage(res.meta.totalPages);
      }
    } catch (error) {
      setBranches([]);
      setMeta({ limit: pageSize, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getErrorMessage(error));
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, currentPage, pageSize, sortColumn, sortDirection]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

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
    setStatusFilter('');
    setCurrentPage(1);
  };

  const openModal = (mode: ModalMode, branch: BranchResponse | null = null) => {
    setModalMode(mode);
    setActiveBranch(branch);
    setFormError('');
    if (branch) {
      setForm({
        code: branch.code,
        name: branch.name,
        shortName: branch.short_name || '',
        email: branch.email || '',
        phone: branch.phone || '',
        address: branch.address || '',
        city: branch.city || '',
        state: branch.state || '',
        country: branch.country || '',
        postalCode: branch.postal_code || '',
        status: branch.status,
      });
    } else {
      setForm(emptyForm);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveBranch(null);
    setFormError('');
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode) openModal('create');
  }, [locationSearch]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.code.trim()) { setFormError('Code is required'); return; }
    if (!form.name.trim()) { setFormError('Name is required'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      const payload: UpdateBranchPayload = {
        address: form.address.trim() || null,
        code: form.code.trim(),
        country: form.country.trim() || null,
        email: form.email.trim() || null,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        postal_code: form.postalCode.trim() || null,
        short_name: form.shortName.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        status: form.status,
      };

      if (modalMode === 'create') {
        await branchesApi.create({ ...payload, status: form.status } as SaveBranchPayload);
        showToast('Branch created successfully.');
      } else if (activeBranch) {
        await branchesApi.update(activeBranch.id, payload);
        showToast('Branch updated successfully.');
      }

      closeModal();
      await loadBranches();
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
      await branchesApi.delete(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (branches.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadBranches();
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (branch: BranchResponse) => {
    setSubmitting(true);
    try {
      const next = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await branchesApi.updateStatus(branch.id, next);
      showToast(`${branch.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      await loadBranches();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const exportBranches = async () => {
    setSubmitting(true);
    try {
      const blob = await branchesApi.export({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        sortBy: sortColumn || undefined,
        sortOrder: sortDirection,
      });
      downloadBlob(blob, 'hms-branches.csv');
      showToast('All filtered branches exported.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <i className="ph ph-arrows-down-up sort-icon" aria-hidden="true" />;
    return sortDirection === 'asc' 
      ? <i className="ph ph-arrow-up sort-icon active" aria-hidden="true" />
      : <i className="ph ph-arrow-down sort-icon active" aria-hidden="true" />;
  };

  return (
    <>
      <div className="um-kpi-row">
        {[
          ['ph-buildings', 'blue', 'Total Branches', summary.total],
          ['ph-check-circle', 'green', 'Active Branches', summary.active],
          ['ph-pause-circle', 'orange', 'Inactive Branches', summary.inactive],
          ['ph-users', 'purple', 'Assigned Users', summary.assignedUsers],
          ['ph-map-pin', 'red', 'Cities Covered', summary.cities],
        ].map(([icon, tone, label, value]) => <div className="kpi-card" key={String(label)}><div className={`kpi-icon ${tone}`}><i className={`ph ${icon}`} /></div><div className="kpi-info"><span className="kpi-label">{label}</span><span className="kpi-value">{loading ? '-' : value}</span></div></div>)}
      </div>
      <div className="um-grid">
        <div className="um-body">
          <div className="um-table-section card">
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
                <button className="um-add-btn" disabled={forbidden} onClick={() => openModal('create')} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add Branch
                </button>
                <button className="btn-secondary admin-table-action" disabled={forbidden || submitting} onClick={() => void exportBranches()} type="button"><i className="ph ph-download-simple" /> Export CSV</button>
                <button className="btn-secondary admin-table-action" disabled={loading} onClick={() => void loadBranches()} type="button"><i className="ph ph-arrows-clockwise" /> Refresh</button>
              </div>

              <div className="um-toolbar-row2">
                <span className="filter-label">Filter by:</span>
                <select
                  className="um-filter"
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as ApiBranchStatus); setCurrentPage(1); }}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                {(search || statusFilter) && (
                  <button className="um-clear-btn" onClick={resetFilters} type="button">
                    <i className="ph ph-x" aria-hidden="true" /> Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table branch-data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('code')}>
                      Code {renderSortIcon('code')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('name')}>
                      Name {renderSortIcon('name')}
                    </th>
                    <th>City</th>
                    <th>Status</th>
                    <th className="sortable" onClick={() => handleSort('created_at')}>
                      Created Date {renderSortIcon('created_at')}
                    </th>
                    <th className="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <span className="loading-spinner" /> Loading branches...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <i className="ph ph-warning" aria-hidden="true" />
                        {loadError}
                        <div>
                          <button className="secondary-action mt-4" onClick={loadBranches}>Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : branches.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        <i className="ph ph-buildings" aria-hidden="true" /> No branches found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    branches.map((branch) => (
                      <tr key={branch.id}>
                        <td>{branch.code}</td>
                        <td className="font-medium text-slate-900">{branch.name}</td>
                        <td>{branch.city || '-'}</td>
                        <td>
                          <span className={`status-badge ${branch.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                            {branch.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{formatDateTime(branch.created_at)}</td>
                        <td className="actions-cell">
                          <div className="action-icons">
                            <button aria-label={`View ${branch.name}`} className="action-icon-btn" onClick={() => openModal('view', branch)} title="View" type="button"><i className="ph ph-eye" /></button>
                            <button
                              aria-label={`Edit ${branch.name}`}
                              className="action-icon-btn"
                              disabled={forbidden}
                              onClick={() => openModal('edit', branch)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" />
                            </button>
                            <button aria-label={`${branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${branch.name}`} className="action-icon-btn success" disabled={forbidden || submitting} onClick={() => void updateStatus(branch)} title={branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} type="button"><i className={`ph ${branch.status === 'ACTIVE' ? 'ph-pause-circle' : 'ph-play-circle'}`} /></button>
                            <button
                              aria-label={`Delete ${branch.name}`}
                              className="action-icon-btn danger"
                              disabled={forbidden}
                              onClick={() => setDeleteTarget(branch)}
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

            <div className="um-pagination">
              <div className="um-showing">
                Showing {branches.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} branches
              </div>
              <div className="um-page-controls">
                <button
                  className="pg-btn"
                  disabled={meta.page <= 1 || loading}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                <button className="pg-btn active" type="button">{meta.page}</button>
                <button
                  className="pg-btn"
                  disabled={meta.page >= meta.totalPages || loading}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <aside className="um-right-panel" aria-label="Branch analytics">
            <div className="card um-chart-card">
              <div className="card-header"><h3>Branches by Status</h3></div>
              {loading ? <div className="um-panel-loading">Loading status...</div> : (
                <div className="admin-metric-list">
                  <div className="admin-metric"><div><span>Active</span><strong>{summary.active}</strong></div><span className="admin-metric__track"><span style={{ width: `${summary.total ? (summary.active / summary.total) * 100 : 0}%` }} /></span></div>
                  <div className="admin-metric"><div><span>Inactive</span><strong>{summary.inactive}</strong></div><span className="admin-metric__track"><span style={{ width: `${summary.total ? (summary.inactive / summary.total) * 100 : 0}%` }} /></span></div>
                </div>
              )}
            </div>
            <div className="card um-chart-card">
              <div className="card-header"><h3>Coverage Analytics</h3></div>
              <div className="branch-analytics-list">
                <div><span><i className="ph ph-users" /> Assigned Users</span><strong>{loading ? '-' : summary.assignedUsers}</strong></div>
                <div><span><i className="ph ph-map-pin" /> Cities Covered</span><strong>{loading ? '-' : summary.cities}</strong></div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {modalMode && (
        <Modal
          footer={modalMode === 'view' ? (
            <button className="btn-secondary" onClick={closeModal} type="button">Close</button>
          ) : (
            <>
              <button className="btn-secondary" disabled={submitting} onClick={closeModal} type="button">Cancel</button>
              <button className="btn-primary" disabled={submitting} form="branch-management-form" type="submit">
                {submitting ? 'Saving...' : 'Save Branch'}
              </button>
            </>
          )}
          icon="ph-buildings"
          open={!!modalMode}
          onClose={closeModal}
          title={modalMode === 'create' ? 'Add New Branch' : modalMode === 'view' ? 'Branch Details' : 'Edit Branch'}
        >
          {modalMode === 'view' && activeBranch ? (
            <div className="form-grid-3">
              {[
                ['Branch Code', activeBranch.code], ['Branch Name', activeBranch.name], ['Short Name', activeBranch.short_name || '-'],
                ['Email', activeBranch.email || '-'], ['Phone', activeBranch.phone || '-'], ['City', activeBranch.city || '-'],
                ['Country', activeBranch.country || '-'], ['Status', activeBranch.status === 'ACTIVE' ? 'Active' : 'Inactive'],
              ].map(([label, value]) => <label className="form-field" key={label}><span>{label}</span><input readOnly value={value} /></label>)}
              <label className="form-field full-width"><span>Address</span><input readOnly value={activeBranch.address || '-'} /></label>
            </div>
          ) : (
          <form className="modal-form" id="branch-management-form" onSubmit={handleSave}>
            {formError && (
              <div className="form-error-banner" role="alert">
                <i className="ph ph-warning-circle" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="form-section-title">Branch Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="branch-code">Branch Code <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="branch-code"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  type="text"
                  value={form.code}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-name">Branch Name <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="branch-name"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  type="text"
                  value={form.name}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-short-name">Short Name</label>
                <input
                  id="branch-short-name"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                  type="text"
                  value={form.shortName}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-email">Email</label>
                <input
                  id="branch-email"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                  value={form.email}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-phone">Phone</label>
                <input
                  id="branch-phone"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  type="tel"
                  value={form.phone}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-city">City</label>
                <input
                  id="branch-city"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  type="text"
                  value={form.city}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-state">State</label>
                <input
                  id="branch-state"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  type="text"
                  value={form.state}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-postal-code">Postal Code</label>
                <input
                  id="branch-postal-code"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  type="text"
                  value={form.postalCode}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-country">Country</label>
                <input
                  id="branch-country"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  type="text"
                  value={form.country}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-status">Status <span className="required" aria-hidden="true">*</span></label>
                <select
                  id="branch-status"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ApiBranchStatus })}
                  required
                  value={form.status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label htmlFor="branch-address">Address</label>
                <input
                  id="branch-address"
                  disabled={submitting}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  type="text"
                  value={form.address}
                />
              </div>
            </div>

          </form>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          confirmLabel={submitting ? 'Deleting...' : 'Delete Branch'}
          message={`Are you sure you want to delete ${deleteTarget.name}? This action cannot be undone.`}
          onCancel={() => {
            if (!submitting) setDeleteTarget(null);
          }}
          onConfirm={handleDelete}
          title="Delete Branch"
        />
      )}

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
