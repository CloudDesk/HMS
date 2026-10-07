import { useEffect, useMemo, useState } from 'react';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { type DepartmentResponse } from '../api/departments';
import {
  type ApiServiceStatus,
  type ApiServiceType,
  type ServiceResponse,
} from '../api/services';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import { downloadBlob } from '../utils/download';
import { useAppLocation } from '../routing/navigation';
import { useServiceCatalogueFeature, type SortColumn, type SortDirection } from '../hooks/services/useServiceCatalogueFeature';

import { useCurrencyFormatter } from '../api/useSettings';

type ModalMode = 'create' | 'edit' | 'view';

const serviceSchema = z.object({
  code: z.string().min(1, 'Service code is required.'),
  name: z.string().min(1, 'Service name is required.'),
  service_type: z.enum(['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE', 'PROCEDURE']),
  // branch_id is UI-only (filters dept options); not sent to API
  branch_id: z.string().optional(),
  department_id: z.string().min(1, 'Department is required.'),
  category: z.string().optional(),
  sample_type: z.string().optional(),
  description: z.string().optional(),
  reference_video_url: z.string().refine(
    (value) => !value || /^https?:\/\//i.test(value),
    { message: 'Enter a valid http or https video URL.' },
  ),
  reference_video_title: z.string().max(200, 'Reference title cannot exceed 200 characters.'),
  standard_price: z.string().refine(
    (val) => val !== '' && !Number.isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    { message: 'Standard price must be a non-negative number.' }
  ),
  default_duration_minutes: z.string(),
  booking_capacity: z.string(),
  requires_bed: z.boolean(),
  requires_consent: z.boolean(),
  requires_advance_deposit: z.boolean(),
  minimum_advance_deposit_amount: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
type ServiceFormData = z.infer<typeof serviceSchema>;

const serviceTypeLabels: Record<ApiServiceType, string> = {
  GENERAL: 'General Service',
  LAB_TEST: 'Lab Test',
  IMAGING_SERVICE: 'Imaging / Scan',
  PROCEDURE: 'Surgery / Procedure',
};


const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check your inputs.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage services.';
    if (error.status === 404) return 'Service not found.';
    if (error.status === 409) return error.message;
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

function ServiceStatusChart({ activeCount, inactiveCount }: { activeCount: number; inactiveCount: number }) {
  const total = Math.max(activeCount + inactiveCount, 1);
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

import { BranchMultiSelect } from '../components/ui/BranchMultiSelect';

// ─── Main Page Component ────────────────────────────────────────────────────────

export function ServiceCataloguePage() {
  const formatPrice = useCurrencyFormatter();
  const feature = useServiceCatalogueFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, deptFilter, statusFilter, typeFilter, sortColumn, sortDirection, currentPage, pageSize, setQuery, setDeptFilter, setStatusFilter, setTypeFilter, setCurrentPage, setPageSize } = state;
  const { services, meta, summary, branches, departments } = data;
  const { isFetching: loading, isMutating: submitting, loadError, forbidden } = status;
  const { canCreate, canEdit, canDelete, canExport } = rbac;
  const { handleSort, resetFilters, handleExport } = actions;

  const search = query;
  const setSearch = setQuery;
  const { search: locationSearch } = useAppLocation();

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeSvc, setActiveSvc] = useState<ServiceResponse | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceResponse | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const svcForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      code: '', name: '', service_type: 'GENERAL', branch_id: '',
      department_id: '', category: '', description: '', reference_video_url: '', reference_video_title: '', standard_price: '', status: 'ACTIVE', default_duration_minutes: '', booking_capacity: '', requires_bed: false, requires_consent: false, requires_advance_deposit: false, minimum_advance_deposit_amount: ''
    }
  });

  

  const [modalBranchIds, setModalBranchIds] = useState<string[]>([]);

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

  // ── Derived: filter departments by selected branches ──────────────────────
  const uniqueDepartments = useMemo(() => {
    const seen = new Set<string>();
    return departments.filter((d) => {
      const key = d.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [departments]);

  const formDepartmentOptions = useMemo(() => {
    let list = departments;
    if (modalBranchIds.length > 0) {
      list = departments.filter((department) =>
        modalBranchIds.some((bId) => department.branch_ids.includes(bId))
      );
    }
    const seen = new Set<string>();
    return list.filter((d) => {
      const key = d.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [departments, modalBranchIds]);

  const getDeptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const getBranchForDept = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return '—';
    const branchNames = dept.branch_ids.map(id => branches.find(b => b.id === id)?.name).filter(Boolean); return branchNames.length ? branchNames.join(', ') : '-';
  };

  const openModal = (mode: ModalMode, svc: ServiceResponse | null = null) => {
    setModalMode(mode);
    setActiveSvc(svc);
    setFormError('');
    if (svc) {
      const dept = departments.find((d) => d.id === svc.department_id);
      setModalBranchIds(dept?.branch_ids || []);
      svcForm.reset({
        code: svc.code,
        name: svc.name,
        service_type: svc.service_type,
        branch_id: dept?.branch_ids?.[0] || '',
        department_id: svc.department_id,
        category: svc.category || '',
        sample_type: svc.sample_type || '',
        description: svc.description || '',
        reference_video_url: svc.reference_video_url || '',
        reference_video_title: svc.reference_video_title || '',
        standard_price: svc.standard_price !== null ? String(svc.standard_price) : '',
        default_duration_minutes: svc.default_duration_minutes == null ? '' : String(svc.default_duration_minutes),
        booking_capacity: svc.booking_capacity == null ? '' : String(svc.booking_capacity),
        requires_bed: svc.requires_bed,
        requires_consent: svc.requires_consent,
        requires_advance_deposit: svc.requires_advance_deposit,
        minimum_advance_deposit_amount: svc.minimum_advance_deposit_amount == null ? '' : String(svc.minimum_advance_deposit_amount),
        status: svc.status,
      });
    } else {
      setModalBranchIds([]);
      svcForm.reset({
        code: '', name: '', service_type: 'GENERAL', branch_id: '',
        department_id: '', category: '', sample_type: '', description: '', reference_video_url: '', reference_video_title: '', standard_price: '', status: 'ACTIVE', default_duration_minutes: '', booking_capacity: '', requires_bed: false, requires_consent: false, requires_advance_deposit: false, minimum_advance_deposit_amount: ''
      });
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveSvc(null);
    setFormError('');
    svcForm.reset();
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode && canCreate) {
      openModal('create');
    }
  }, [locationSearch, canCreate, modalMode]);

  const handleSave = svcForm.handleSubmit(async (values) => {
    setFormError('');
    try {
      const price = parseFloat(values.standard_price);
      if (values.service_type === 'PROCEDURE' && (!values.default_duration_minutes || !values.booking_capacity)) {
        setFormError('Procedure duration and booking capacity are required.');
        return;
      }
      if (values.service_type === 'PROCEDURE' && values.requires_advance_deposit && values.minimum_advance_deposit_amount === '') {
        setFormError('Minimum advance deposit is required for this procedure.');
        return;
      }
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        service_type: values.service_type,
        department_id: values.department_id,
        category: values.category?.trim() || null,
        sample_type: values.service_type === 'LAB_TEST' ? (values.sample_type?.trim() || null) : null,
        description: values.description?.trim() || null,
        reference_video_url: values.service_type === 'PROCEDURE' ? (values.reference_video_url.trim() || null) : null,
        reference_video_title: values.service_type === 'PROCEDURE' ? (values.reference_video_title.trim() || null) : null,
        standard_price: price,
        default_duration_minutes: values.service_type === 'PROCEDURE' ? Number(values.default_duration_minutes) : null,
        booking_capacity: values.service_type === 'PROCEDURE' ? Number(values.booking_capacity) : null,
        requires_bed: values.service_type === 'PROCEDURE' && values.requires_bed,
        requires_consent: values.service_type === 'PROCEDURE' && values.requires_consent,
        requires_advance_deposit: values.service_type === 'PROCEDURE' && values.requires_advance_deposit,
        minimum_advance_deposit_amount: values.service_type === 'PROCEDURE' && values.requires_advance_deposit ? Number(values.minimum_advance_deposit_amount) : null,
        status: values.status,
      };

      if (modalMode === 'create') {
        await mutations.createService.mutateAsync(payload);
        showToast('Service created successfully.');
      } else if (activeSvc) {
        await mutations.updateService.mutateAsync({ id: activeSvc.id, payload });
        showToast('Service updated successfully.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteService.mutateAsync(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (services.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updateStatus = async (service: ServiceResponse) => {
    try {
      const next: ApiServiceStatus = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await mutations.updateServiceStatus.mutateAsync({ id: service.id, status: next });
      showToast(`${service.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const exportServices = async () => {
    try {
      const blob = await handleExport();
      if (blob) {
        downloadBlob(blob, 'hms-services.csv');
        showToast('All filtered services exported.');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

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

  return (
    <>
      <div className="um-grid service-catalogue-page">
        <div className="um-top-row">
          <div className="um-top-title-area">
            <h2 className="um-page-title">Service Catalogue</h2>
            <p className="um-page-subtitle">Manage clinical services, pricing, department mappings, and billing codes.</p>
          </div>
          <div className="um-top-actions">
            {canCreate && !forbidden ? (
              <button className="um-add-btn-top" onClick={() => openModal('create')} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Service
              </button>
            ) : null}
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="um-kpi-row" aria-label="Service KPIs">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-stethoscope" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Services</span>
              <span className="kpi-value">{loading ? '—' : summary.total}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green">
              <i className="ph ph-check-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Active</span>
              <span className="kpi-value">{loading ? '—' : summary.active}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange">
              <i className="ph ph-minus-circle" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inactive</span>
              <span className="kpi-value">{loading ? '—' : summary.inactive}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon purple">
              <i className="ph ph-buildings" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Departments Covered</span>
              <span className="kpi-value">{loading ? '—' : summary.departmentsCovered}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <i className="ph ph-calendar-plus" aria-hidden="true" />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Added This Month</span>
              <span className="kpi-value">{loading ? '—' : summary.addedThisMonth}</span>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className={`um-body${showAnalytics ? ' um-body--analytics' : ' um-body--full'}`}>
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
                  disabled={forbidden || !canCreate || loading}
                  onClick={() => openModal('create')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" /> Add Service
                </button>
                <button className="btn-secondary admin-table-action" disabled={forbidden || !canExport || submitting} onClick={() => void exportServices()} type="button">
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
                  id="svc-type-filter"
                  onChange={(e) => { setTypeFilter(e.target.value as ApiServiceType | ''); setCurrentPage(1); }}
                  value={typeFilter}
                >
                  <option value="">All Service Types</option>
                  {Object.entries(serviceTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <select
                  className="um-filter"
                  id="svc-dept-filter"
                  onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                  value={deptFilter}
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map((d) => (
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

            {loadError ? (
              <div className="auth-alert auth-alert--error" role="alert">{loadError}</div>
            ) : null}

            {/* Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader column="code" label="Service Code" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <SortableHeader column="name" label="Service Name" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Service Type</th>
                    <th scope="col">Department</th>
                    <th scope="col">Branch</th>
                    <SortableHeader column="standard_price" label="Price" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Status</th>
                    <SortableHeader column="created_at" label="Created" onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDirection} />
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '2.5rem 1rem' }}>
                        <MedicalLoader
                          text="Loading services..."
                          subtext="Retrieving hospital clinical procedures & catalogue"
                        />
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td className="um-state-cell" colSpan={10}>
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
                  ) : services.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={10}>
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
                        <td><span className="status-badge status-active">{serviceTypeLabels[svc.service_type]}</span></td>
                        <td>{getDeptName(svc.department_id)}</td>
                        <td className="muted-cell">{getBranchForDept(svc.department_id)}</td>
                        <td className="muted-cell">{formatPrice(svc.standard_price)}</td>
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
                              disabled={forbidden || !canEdit}
                              onClick={() => openModal('edit', svc)}
                              title="Edit"
                              type="button"
                            >
                              <i className="ph ph-pencil" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Delete ${svc.name}`}
                              className="action-icon-btn danger"
                              disabled={forbidden || !canDelete}
                              onClick={() => setDeleteTarget(svc)}
                              title="Delete"
                              type="button"
                            >
                              <i className="ph ph-trash" aria-hidden="true" />
                            </button>
                            <button aria-label={`${svc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${svc.name}`} className="action-icon-btn" disabled={forbidden || !canEdit || submitting} onClick={() => void updateStatus(svc)} title={svc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} type="button"><i className={`ph ${svc.status === 'ACTIVE' ? 'ph-pause-circle' : 'ph-play-circle'}`} /></button>
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
          {showAnalytics ? <div className="um-right-panel">
            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Services by Status</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading status chart..." subtext="Aggregating service availability" />
                </div>
              ) : (
                <ServiceStatusChart activeCount={summary.active} inactiveCount={summary.inactive} />
              )}
            </div>

            <div className="card um-chart-card">
              <div className="card-header">
                <h3>Services by Department</h3>
              </div>
              {loading ? (
                <div className="um-panel-loading">
                  <MedicalLoader size="small" text="Loading department chart..." subtext="Aggregating department breakdown" />
                </div>
              ) : (
                <ServicesByDepartment services={services} departments={departments} />
              )}
            </div>

          </div> : null}
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
              <button className="btn-primary" disabled={submitting || departments.length === 0} form="svc-management-form" type="submit">
                {submitting ? (
                  <>
                    <MedicalSpinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Service'
                )}
              </button>
            </>
          )
        }
        className="um-user-modal"
        size="large"
        onClose={closeModal}
        open={Boolean(modalMode)}
        icon="ph-first-aid-kit"
        title={modalTitle}
      >
        {formError ? (
          <div className="auth-alert auth-alert--error" role="alert">{formError}</div>
        ) : null}

        {(modalMode === 'create' || modalMode === 'edit') && (
          <form id="svc-management-form" onSubmit={(e) => void handleSave(e)}>
            {departments.length === 0 ? (
              <div className="admin-dependency-notice" role="alert" style={{ marginBottom: '1rem' }}>
                <i className="ph ph-info" aria-hidden="true" />
                <span>Create an active branch and department before saving a service.</span>
              </div>
            ) : null}

            {/* Section 1: Service Identification & Type */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-first-aid-kit" />
                  <span>Basic Information</span>
                </div>
                <span className="um-card-badge">Catalog Identification</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-hash" /> Service Code
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        aria-invalid={Boolean(svcForm.formState.errors.code)}
                        placeholder="e.g. LAB-CBC, DENT-EXT"
                        {...svcForm.register('code')}
                      />
                      <i className="ph ph-hash um-input-prefix-icon" />
                    </div>
                    {svcForm.formState.errors.code ? <span className="um-field-error"><i className="ph ph-warning-circle" /> {svcForm.formState.errors.code.message}</span> : null}
                  </div>

                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-first-aid" /> Service Name
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        aria-invalid={Boolean(svcForm.formState.errors.name)}
                        placeholder="e.g. Complete Blood Count"
                        {...svcForm.register('name')}
                      />
                      <i className="ph ph-first-aid um-input-prefix-icon" />
                    </div>
                    {svcForm.formState.errors.name ? <span className="um-field-error"><i className="ph ph-warning-circle" /> {svcForm.formState.errors.name.message}</span> : null}
                  </div>
                </div>

                <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-tag" /> Category
                      </span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        list="category-options-list"
                        placeholder={
                          svcForm.watch('service_type') === 'LAB_TEST'
                            ? 'e.g. Hematology, Biochemistry'
                            : svcForm.watch('service_type') === 'IMAGING_SERVICE'
                              ? 'e.g. X-Ray, CT Scan, MRI'
                              : 'e.g. Diagnostics'
                        }
                        {...svcForm.register('category')}
                      />
                      <i className="ph ph-tag um-input-prefix-icon" />
                    </div>
                    <datalist id="category-options-list">
                      {svcForm.watch('service_type') === 'LAB_TEST' ? (
                        <>
                          <option value="Hematology" />
                          <option value="Biochemistry" />
                          <option value="Microbiology" />
                          <option value="Immunology" />
                          <option value="Clinical Pathology" />
                          <option value="Serology" />
                          <option value="Urinalysis" />
                          <option value="Molecular Diagnostics" />
                        </>
                      ) : svcForm.watch('service_type') === 'IMAGING_SERVICE' ? (
                        <>
                          <option value="X-Ray" />
                          <option value="Ultrasound" />
                          <option value="CT Scan" />
                          <option value="MRI" />
                          <option value="Mammography" />
                          <option value="ECG" />
                          <option value="Echo" />
                          <option value="Fluoroscopy" />
                          <option value="DEXA Scan" />
                        </>
                      ) : (
                        <>
                          <option value="Consultation" />
                          <option value="Diagnostics" />
                          <option value="Emergency" />
                          <option value="Procedure" />
                          <option value="General" />
                        </>
                      )}
                    </datalist>
                  </div>

                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-stethoscope" /> Service Type
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <select
                        disabled={submitting}
                        {...svcForm.register('service_type')}
                      >
                        {Object.entries(serviceTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <i className="ph ph-stethoscope um-input-prefix-icon" />
                    </div>
                  </div>
                </div>

                {svcForm.watch('service_type') === 'LAB_TEST' ? (
                  <div className="um-field" style={{ marginTop: '0.85rem' }}>
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-flask" /> Sample / Specimen Type
                      </span>
                    </label>
                    <div className="um-input-wrap">
                      <select disabled={submitting} {...svcForm.register('sample_type')}>
                        <option value="">Select Sample Type</option>
                        <option value="Blood">Blood</option>
                        <option value="Serum">Serum</option>
                        <option value="Plasma">Plasma</option>
                        <option value="Urine">Urine</option>
                        <option value="Stool">Stool</option>
                        <option value="Sputum">Sputum</option>
                        <option value="Throat Swab">Throat Swab</option>
                        <option value="CSF (Cerebrospinal Fluid)">CSF (Cerebrospinal Fluid)</option>
                        <option value="Tissue / Biopsy">Tissue / Biopsy</option>
                        <option value="Synovial Fluid">Synovial Fluid</option>
                      </select>
                      <i className="ph ph-flask um-input-prefix-icon" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Section 2: Organisation & Assignment */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-buildings" />
                  <span>Organisation &amp; Status</span>
                </div>
                <span className="um-card-badge">Routing &amp; Availability</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-3">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-map-pin" /> Branch
                      </span>
                    </label>
                    <BranchMultiSelect
                      branches={branches}
                      disabled={submitting}
                      onChange={(newIds) => {
                        setModalBranchIds(newIds);
                        if (newIds.length > 0) {
                          const currentDeptId = svcForm.getValues('department_id');
                          const currentDept = departments.find((d) => d.id === currentDeptId);
                          if (currentDept && !newIds.some((bId) => currentDept.branch_ids.includes(bId))) {
                            svcForm.setValue('department_id', '');
                          }
                        }
                      }}
                      selectedIds={modalBranchIds}
                    />
                  </div>

                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-tree-structure" /> Department
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <select
                        disabled={submitting}
                        aria-invalid={Boolean(svcForm.formState.errors.department_id)}
                        className={svcForm.watch('department_id') ? undefined : 'svc-form-placeholder'}
                        {...svcForm.register('department_id')}
                      >
                        <option value="">Select Department</option>
                        {formDepartmentOptions.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <i className="ph ph-tree-structure um-input-prefix-icon" />
                    </div>
                    {svcForm.formState.errors.department_id ? <span className="um-field-error"><i className="ph ph-warning-circle" /> {svcForm.formState.errors.department_id.message}</span> : null}
                  </div>

                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-toggle-left" /> Status
                      </span>
                    </label>
                    <div className="um-input-wrap">
                      <select
                        disabled={submitting}
                        {...svcForm.register('status')}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                      <i className="ph ph-toggle-left um-input-prefix-icon" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Pricing */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-currency-dollar" />
                  <span>Pricing</span>
                </div>
                <span className="um-card-badge">Financial</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-form-row-2">
                  <div className="um-field">
                    <label className="um-field-label">
                      <span className="um-field-label-text">
                        <i className="ph ph-currency-dollar" /> Standard Price ($)
                      </span>
                      <span className="um-required-star">*</span>
                    </label>
                    <div className="um-input-wrap">
                      <input
                        disabled={submitting}
                        min="0"
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        aria-invalid={Boolean(svcForm.formState.errors.standard_price)}
                        {...svcForm.register('standard_price')}
                      />
                      <i className="ph ph-currency-dollar um-input-prefix-icon" />
                    </div>
                    {svcForm.formState.errors.standard_price ? <span className="um-field-error"><i className="ph ph-warning-circle" /> {svcForm.formState.errors.standard_price.message}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Procedure Rules (if PROCEDURE) */}
            {svcForm.watch('service_type') === 'PROCEDURE' ? (
              <div className="um-modal-card">
                <div className="um-modal-card-header">
                  <div className="um-card-title-wrap">
                    <i className="ph ph-calendar-check" />
                    <span>Procedure Booking Rules &amp; Requirements</span>
                  </div>
                  <span className="um-card-badge">Clinical Scheduling</span>
                </div>
                <div className="um-modal-card-body">
                  <div className="um-form-row-3" style={{ marginBottom: '0.85rem' }}>
                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text"><i className="ph ph-clock" /> Default Duration (min)</span>
                        <span className="um-required-star">*</span>
                      </label>
                      <div className="um-input-wrap">
                        <input type="number" min="5" max="720" placeholder="e.g. 60" {...svcForm.register('default_duration_minutes')} />
                        <i className="ph ph-clock um-input-prefix-icon" />
                      </div>
                    </div>

                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text"><i className="ph ph-users" /> Booking Capacity</span>
                        <span className="um-required-star">*</span>
                      </label>
                      <div className="um-input-wrap">
                        <input type="number" min="1" max="100" placeholder="e.g. 1" {...svcForm.register('booking_capacity')} />
                        <i className="ph ph-users um-input-prefix-icon" />
                      </div>
                    </div>

                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text"><i className="ph ph-credit-card" /> Advance Deposit ($)</span>
                      </label>
                      <div className="um-input-wrap">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!svcForm.watch('requires_advance_deposit')}
                          {...svcForm.register('minimum_advance_deposit_amount')}
                        />
                        <i className="ph ph-credit-card um-input-prefix-icon" />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, color: '#334155' }}>
                      <input
                        type="checkbox"
                        style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                        {...svcForm.register('requires_bed')}
                      />
                      <span>Requires Bed Hold</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, color: '#334155' }}>
                      <input
                        type="checkbox"
                        style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                        {...svcForm.register('requires_consent')}
                      />
                      <span>Requires Signed Consent</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, color: '#334155' }}>
                      <input
                        type="checkbox"
                        style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                        {...svcForm.register('requires_advance_deposit')}
                      />
                      <span>Requires Advance Deposit</span>
                    </label>
                  </div>

                  <div className="um-form-row-2">
                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text"><i className="ph ph-video" /> Video Reference URL</span>
                      </label>
                      <div className="um-input-wrap">
                        <input
                          type="url"
                          disabled={submitting}
                          placeholder="https://www.youtube.com/watch?v=… or video link"
                          aria-invalid={Boolean(svcForm.formState.errors.reference_video_url)}
                          {...svcForm.register('reference_video_url')}
                        />
                        <i className="ph ph-video um-input-prefix-icon" />
                      </div>
                      {svcForm.formState.errors.reference_video_url ? (
                        <span className="um-field-error"><i className="ph ph-warning-circle" /> {svcForm.formState.errors.reference_video_url.message}</span>
                      ) : (
                        <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Displayed in treatment planning views.</small>
                      )}
                    </div>

                    <div className="um-field">
                      <label className="um-field-label">
                        <span className="um-field-label-text"><i className="ph ph-text-t" /> Reference Title</span>
                      </label>
                      <div className="um-input-wrap">
                        <input
                          type="text"
                          disabled={submitting}
                          maxLength={200}
                          placeholder="e.g. Composite restoration overview"
                          {...svcForm.register('reference_video_title')}
                        />
                        <i className="ph ph-text-t um-input-prefix-icon" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Section 5: Additional Information */}
            <div className="um-modal-card">
              <div className="um-modal-card-header">
                <div className="um-card-title-wrap">
                  <i className="ph ph-text-align-left" />
                  <span>Additional Information</span>
                </div>
                <span className="um-card-badge">Clinical Scope</span>
              </div>
              <div className="um-modal-card-body">
                <div className="um-field">
                  <label className="um-field-label">
                    <span className="um-field-label-text">
                      <i className="ph ph-info" /> Description &amp; Clinical Notes
                    </span>
                  </label>
                  <textarea
                    className="um-textarea"
                    disabled={submitting}
                    placeholder="Enter procedure details, preparation requirements, or catalog notes..."
                    rows={3}
                    {...svcForm.register('description')}
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {modalMode === 'view' && activeSvc ? (
          <div className="um-modal-card">
            <div className="um-modal-card-header">
              <div className="um-card-title-wrap">
                <i className="ph ph-first-aid-kit" />
                <span>Service Information</span>
              </div>
              <span className="um-card-badge">Record View</span>
            </div>
            <div className="um-modal-card-body">
              <div className="um-form-row-2">
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-hash" /> Service Code</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeSvc.code} /><i className="ph ph-hash um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-first-aid" /> Service Name</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeSvc.name} /><i className="ph ph-first-aid um-input-prefix-icon" /></div>
                </div>
              </div>
              <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-stethoscope" /> Service Type</span></label>
                  <div className="um-input-wrap"><input readOnly value={serviceTypeLabels[activeSvc.service_type]} /><i className="ph ph-stethoscope um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-tag" /> Category</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeSvc.category ?? '—'} /><i className="ph ph-tag um-input-prefix-icon" /></div>
                </div>
              </div>
              {activeSvc.service_type === 'LAB_TEST' ? (
                <div className="um-field" style={{ marginTop: '0.85rem' }}>
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-flask" /> Sample Type</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeSvc.sample_type ?? '—'} /><i className="ph ph-flask um-input-prefix-icon" /></div>
                </div>
              ) : null}
              <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-tree-structure" /> Department</span></label>
                  <div className="um-input-wrap"><input readOnly value={getDeptName(activeSvc.department_id)} /><i className="ph ph-tree-structure um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-map-pin" /> Branch</span></label>
                  <div className="um-input-wrap"><input readOnly value={getBranchForDept(activeSvc.department_id)} /><i className="ph ph-map-pin um-input-prefix-icon" /></div>
                </div>
              </div>
              <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-toggle-left" /> Status</span></label>
                  <div className="um-input-wrap"><input readOnly value={activeSvc.status === 'ACTIVE' ? 'Active' : 'Inactive'} /><i className="ph ph-toggle-left um-input-prefix-icon" /></div>
                </div>
                <div className="um-field">
                  <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-currency-dollar" /> Standard Price</span></label>
                  <div className="um-input-wrap"><input readOnly value={formatPrice(activeSvc.standard_price)} /><i className="ph ph-currency-dollar um-input-prefix-icon" /></div>
                </div>
              </div>
              {activeSvc.service_type === 'PROCEDURE' ? (
                <div className="um-form-row-2" style={{ marginTop: '0.85rem' }}>
                  <div className="um-field">
                    <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-video" /> Video Reference URL</span></label>
                    <div className="um-input-wrap"><input readOnly value={activeSvc.reference_video_url ?? '—'} /><i className="ph ph-video um-input-prefix-icon" /></div>
                  </div>
                  <div className="um-field">
                    <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-text-t" /> Reference Title</span></label>
                    <div className="um-input-wrap"><input readOnly value={activeSvc.reference_video_title ?? '—'} /><i className="ph ph-text-t um-input-prefix-icon" /></div>
                  </div>
                </div>
              ) : null}
              <div className="um-field" style={{ marginTop: '0.85rem' }}>
                <label className="um-field-label"><span className="um-field-label-text"><i className="ph ph-text-align-left" /> Description</span></label>
                <textarea className="um-textarea" readOnly rows={3} value={activeSvc.description ?? '—'} />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        confirmLabel="Delete Service"
        loading={submitting}
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

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
