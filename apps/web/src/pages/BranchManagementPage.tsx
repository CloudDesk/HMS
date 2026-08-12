import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  branchesApi,
  type ApiBranchStatus,
  type BranchListResponse,
  type BranchResponse,
  type SaveBranchPayload,
  type UpdateBranchPayload,
} from '../api/branches';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

type SortColumn = 'code' | 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ModalMode = 'create' | 'edit';

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
    if (error.status === 409) return 'A branch with this code already exists.';
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
  const [branches, setBranches] = useState<BranchResponse[]>([]);
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
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const res = await branchesApi.list({
        search: search.trim() || undefined,
        status: (statusFilter as ApiBranchStatus) || undefined,
        page: currentPage,
        limit: pageSize,
        sortBy: sortColumn || undefined,
        sortOrder: sortColumn ? sortDirection : undefined,
      });

      setBranches(res.data);
      setMeta(res.meta);
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
      showToast(getErrorMessage(error));
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
              </div>

              <div className="um-toolbar-row2">
                <div className="um-filters">
                  <div className="um-filter-group">
                    <label htmlFor="status-filter">Status</label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value as ApiBranchStatus); setCurrentPage(1); }}
                    >
                      <option value="">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  
                  {(search || statusFilter) && (
                    <button className="um-clear-btn" onClick={resetFilters} type="button">
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="um-table">
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
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Loading branches...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-red-500">
                        {loadError}
                        <div>
                          <button className="secondary-action mt-4" onClick={loadBranches}>Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : branches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No branches found.
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
                          <div className="action-buttons">
                            <button
                              aria-label={`Edit ${branch.name}`}
                              className="action-btn edit-btn"
                              disabled={forbidden}
                              onClick={() => openModal('edit', branch)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Delete ${branch.name}`}
                              className="action-btn delete-btn"
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
              <div className="pagination-info">
                Showing {branches.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} branches
              </div>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  disabled={meta.page <= 1 || loading}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" /> Previous
                </button>
                <div className="page-numbers">
                  <span className="page-current">Page {meta.page} of {meta.totalPages || 1}</span>
                </div>
                <button
                  className="page-btn"
                  disabled={meta.page >= meta.totalPages || loading}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  type="button"
                >
                  Next <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalMode && (
        <Modal
          open={!!modalMode}
          onClose={closeModal}
          title={modalMode === 'create' ? 'Add New Branch' : 'Edit Branch'}
        >
          <form className="modal-form" onSubmit={handleSave}>
            {formError && (
              <div className="form-error-banner" role="alert">
                <i className="ph ph-warning-circle" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

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
                  disabled={submitting || modalMode === 'edit'}
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

            <div className="modal-actions">
              <button
                className="secondary-action"
                disabled={submitting}
                onClick={closeModal}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-action"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Saving...' : 'Save Branch'}
              </button>
            </div>
          </form>
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

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
