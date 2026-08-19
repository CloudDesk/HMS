import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import {
  type ApiBranchStatus,
  type BranchResponse,
  type SaveBranchPayload,
  type UpdateBranchPayload,
} from '../api/branches';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';

import { useBranchManagementFeature, type SortColumn } from '../hooks/branches/useBranchManagementFeature';

type ModalMode = 'create' | 'edit' | 'view';


const branchSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  shortName: z.string().optional(),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived'])
});
type BranchFormData = z.infer<typeof branchSchema>;



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
  const feature = useBranchManagementFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, statusFilter, sortColumn, sortDirection, currentPage, setQuery, setStatusFilter, setCurrentPage } = state;
  const { branches, meta, summary } = data;
  const { isFetching: loading, isMutating: submitting, loadError, forbidden } = status;
  const { canCreate, canEdit, canDelete, canExport } = rbac;
  const { handleSort, resetFilters, handleExport } = actions;

  const search = query;
  const setSearch = setQuery;
  const { search: locationSearch } = useAppLocation();

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchResponse | null>(null);
  const branchForm = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: '', name: '', shortName: '', email: '', phone: '', address: '',
      city: '', state: '', country: '', postalCode: '', status: 'active'
    }
  });
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BranchResponse | null>(null);

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

  const openModal = (mode: ModalMode, branch: BranchResponse | null = null) => {
    setModalMode(mode);
    setActiveBranch(branch);
    setFormError('');
    branchForm.reset({
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      shortName: branch?.short_name ?? '',
      email: branch?.email ?? '',
      phone: branch?.phone ?? '',
      address: branch?.address ?? '',
      city: branch?.city ?? '',
      state: branch?.state ?? '',
      country: branch?.country ?? '',
      postalCode: branch?.postal_code ?? '',
      status: (branch?.status?.toLowerCase() as BranchFormData['status']) ?? 'active',
    });
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

  const handleSave = async (data: BranchFormData) => {
    setFormError('');

    try {
      const payload: UpdateBranchPayload = {
        code: data.code,
        name: data.name,
        short_name: data.shortName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        postal_code: data.postalCode || undefined,
        status: data.status.toUpperCase() as ApiBranchStatus,
      };

      if (modalMode === 'create') {
        await mutations.createBranch.mutateAsync(payload as SaveBranchPayload);
        showToast('Branch created successfully.');
      } else if (activeBranch) {
        await mutations.updateBranch.mutateAsync({ id: activeBranch.id, payload });
        showToast('Branch updated successfully.');
      }

      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteBranch.mutateAsync(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (branches.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updateStatus = async (branch: BranchResponse) => {
    try {
      const next = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await mutations.updateBranchStatus.mutateAsync({ id: branch.id, status: next });
      showToast(`${branch.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleExportClick = async () => {
    try {
      const blob = await handleExport();
      if (blob) {
        downloadBlob(blob, 'hms-branches.csv');
        showToast('All filtered branches exported.');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
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
                <button className="um-add-btn" disabled={forbidden || !canCreate} onClick={() => openModal('create')} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add Branch
                </button>
                <button className="btn-secondary admin-table-action" disabled={forbidden || !canExport || submitting} onClick={() => void handleExportClick()} type="button"><i className="ph ph-download-simple" /> Export CSV</button>
                <button className="btn-secondary admin-table-action" disabled={loading} onClick={() => void resetFilters()} type="button"><i className="ph ph-arrows-clockwise" /> Refresh</button>
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
                          <button className="secondary-action mt-4" onClick={() => void resetFilters()}>Retry</button>
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
                              disabled={forbidden || !canEdit}
                              onClick={() => openModal('edit', branch)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" />
                            </button>
                            <button aria-label={`${branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${branch.name}`} className="action-icon-btn success" disabled={forbidden || !canEdit || submitting} onClick={() => void updateStatus(branch)} title={branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} type="button"><i className={`ph ${branch.status === 'ACTIVE' ? 'ph-pause-circle' : 'ph-play-circle'}`} /></button>
                            <button
                              aria-label={`Delete ${branch.name}`}
                              className="action-icon-btn danger"
                              disabled={forbidden || !canDelete}
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
          <form className="modal-form" id="branch-management-form" onSubmit={(e) => { e.stopPropagation(); void branchForm.handleSubmit(handleSave)(e); }}>
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
                    {...branchForm.register('code')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-name">Branch Name <span className="required" aria-hidden="true">*</span></label>
                <input
                  id="branch-name"
                  disabled={submitting}
                    {...branchForm.register('name')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-short-name">Short Name</label>
                <input
                  id="branch-short-name"
                  disabled={submitting}
                    {...branchForm.register('shortName')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-email">Email</label>
                <input
                  id="branch-email"
                  disabled={submitting}
                    {...branchForm.register('email')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-phone">Phone</label>
                <input
                  id="branch-phone"
                  disabled={submitting}
                    {...branchForm.register('phone')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-city">City</label>
                <input
                  id="branch-city"
                  disabled={submitting}
                    {...branchForm.register('city')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-state">State</label>
                <input
                  id="branch-state"
                  disabled={submitting}
                    {...branchForm.register('state')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-postal-code">Postal Code</label>
                <input
                  id="branch-postal-code"
                  disabled={submitting}
                    {...branchForm.register('postalCode')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-country">Country</label>
                <input
                  id="branch-country"
                  disabled={submitting}
                    {...branchForm.register('country')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="branch-status">Status <span className="required" aria-hidden="true">*</span></label>
                <select
                  id="branch-status"
                  disabled={submitting}
                    {...branchForm.register('status')}
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
                    {...branchForm.register('address')}
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
