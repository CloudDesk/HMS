import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type InsuranceScheme,
  type InsurancePayer,
  type SchemeStatus,
} from '../../api/insurance';
import { branchesApi, type BranchResponse } from '../../api/branches';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

const schemeFormSchema = z.object({
  payerId: z.string().min(1, 'Insurance payer is required'),
  schemeCode: z.string().trim().min(1, 'Scheme code is required'),
  name: z.string().trim().min(1, 'Scheme name is required'),
  planType: z.string().optional(),
  networkType: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  branchId: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

type SchemeFormData = z.infer<typeof schemeFormSchema>;

export function InsuranceSchemesPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canCreate = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Create' }, roles);
  const canEdit = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Edit' }, roles);

  // Filters & State
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SchemeStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [schemes, setSchemes] = useState<InsuranceScheme[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<InsuranceScheme | null>(null);

  const form = useForm<SchemeFormData>({
    resolver: zodResolver(schemeFormSchema),
    defaultValues: {
      payerId: '',
      schemeCode: '',
      name: '',
      planType: '',
      networkType: '',
      status: 'ACTIVE',
      branchId: '',
      effectiveFrom: '',
      effectiveTo: '',
    },
  });

  // Fetch Payers and Branches
  useEffect(() => {
    insuranceApi.listPayers({ limit: 100 })
      .then((res) => setPayers(res.items))
      .catch(() => {});

    branchesApi.list({ limit: 100 })
      .then((res) => setBranches(res.data))
      .catch(() => {});
  }, []);

  // Fetch Schemes
  const loadSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listSchemes({
        search: search.trim() || undefined,
        payerId: payerFilter || undefined,
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setSchemes(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load schemes.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, payerFilter, statusFilter, page]);

  useEffect(() => {
    void loadSchemes();
  }, [loadSchemes]);

  // KPIs
  const kpis = useMemo(() => {
    const active = schemes.filter((s) => s.status === 'ACTIVE').length;
    const inactive = schemes.filter((s) => s.status === 'INACTIVE').length;
    return { total, active, inactive };
  }, [schemes, total]);

  const payerMap = useMemo(() => {
    const map = new Map<string, InsurancePayer>();
    payers.forEach((p) => map.set(p._id, p));
    return map;
  }, [payers]);

  const openCreateModal = () => {
    setSelectedScheme(null);
    form.reset({
      payerId: payerFilter || (payers[0]?._id ?? ''),
      schemeCode: '',
      name: '',
      planType: '',
      networkType: '',
      status: 'ACTIVE',
      branchId: '',
      effectiveFrom: '',
      effectiveTo: '',
    });
    setModalMode('create');
  };

  const openEditModal = (scheme: InsuranceScheme) => {
    setSelectedScheme(scheme);
    form.reset({
      payerId: scheme.payerId,
      schemeCode: scheme.schemeCode,
      name: scheme.name,
      planType: scheme.planType ?? '',
      networkType: scheme.networkType ?? '',
      status: scheme.status,
      branchId: scheme.branchId ?? '',
      effectiveFrom: scheme.effectiveFrom ? scheme.effectiveFrom.slice(0, 10) : '',
      effectiveTo: scheme.effectiveTo ? scheme.effectiveTo.slice(0, 10) : '',
    });
    setModalMode('edit');
  };

  const openViewModal = (scheme: InsuranceScheme) => {
    setSelectedScheme(scheme);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedScheme(null);
    form.reset();
  };

  const onSubmit = async (data: SchemeFormData) => {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await insuranceApi.createScheme({
          payerId: data.payerId,
          schemeCode: data.schemeCode.trim().toUpperCase(),
          name: data.name.trim(),
          planType: data.planType?.trim() || null,
          networkType: data.networkType?.trim() || null,
          status: data.status,
          branchId: data.branchId ? data.branchId : null,
          effectiveFrom: data.effectiveFrom || null,
          effectiveTo: data.effectiveTo || null,
        });
        toast.success(`Insurance scheme "${data.name}" created successfully.`);
      } else if (modalMode === 'edit' && selectedScheme) {
        await insuranceApi.updateScheme(selectedScheme._id, {
          schemeCode: data.schemeCode.trim().toUpperCase(),
          name: data.name.trim(),
          planType: data.planType?.trim() || null,
          networkType: data.networkType?.trim() || null,
          status: data.status,
          branchId: data.branchId ? data.branchId : null,
          effectiveFrom: data.effectiveFrom || null,
          effectiveTo: data.effectiveTo || null,
        });
        toast.success(`Insurance scheme "${data.name}" updated successfully.`);
      }

      closeModal();
      await loadSchemes();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Action failed. Please verify required fields.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="insurance-page">
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="Scheme Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-folder-notch" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Schemes</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Schemes</span>
            <span className="kpi-value">{loading ? '—' : kpis.active}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-pause-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Inactive Schemes</span>
            <span className="kpi-value">{loading ? '—' : kpis.inactive}</span>
          </div>
        </div>
      </div>

      {/* ── Table Section ───────────────────────────────────────────────────── */}
      <div className="um-table-section card">
        <div className="um-toolbar">
          <div className="um-toolbar-row1">
            <div className="um-search">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search schemes by code or name..."
                type="search"
                value={search}
              />
            </div>
            {canCreate && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Scheme
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadSchemes()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>

          <div className="um-toolbar-row2">
            <span className="filter-label">Filter:</span>
            <select
              className="um-filter"
              onChange={(e) => {
                setPayerFilter(e.target.value);
                setPage(1);
              }}
              value={payerFilter}
            >
              <option value="">All Insurance Payers</option>
              {payers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.payerCode})
                </option>
              ))}
            </select>

            <select
              className="um-filter"
              onChange={(e) => {
                setStatusFilter(e.target.value as SchemeStatus | '');
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {(search || payerFilter || statusFilter) && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setSearch('');
                  setPayerFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
                type="button"
              >
                <i className="ph ph-x" aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Data Table ──────────────────────────────────────────────────── */}
        <div className="table-responsive">
          {loading ? (
            <div style={{ padding: '3rem 0' }}>
              <MedicalLoader size="large" text="Loading insurance schemes..." />
            </div>
          ) : schemes.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-folder-open" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No Schemes Found</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {search || payerFilter || statusFilter
                  ? 'No schemes match your filter criteria.'
                  : 'No insurance schemes are configured yet.'}
              </p>
              {canCreate && !search && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add First Scheme
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Scheme Name</th>
                  <th>Linked Payer</th>
                  <th>Plan / Network</th>
                  <th>Status</th>
                  <th>Effective Period</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => {
                  const payer = payerMap.get(scheme.payerId);
                  return (
                    <tr key={scheme._id}>
                      <td>
                        <span className="insurance-table-code">{scheme.schemeCode}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{scheme.name}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            {payer ? payer.name : 'Unknown Payer'}
                          </span>
                          {payer && (
                            <span className={`insurance-chip ${payer.type.toLowerCase()}`}>
                              {payer.type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {[scheme.planType, scheme.networkType].filter(Boolean).join(' • ') || 'Standard'}
                      </td>
                      <td>
                        <span className={`insurance-chip ${scheme.status.toLowerCase()}`}>
                          {scheme.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {scheme.effectiveFrom ? scheme.effectiveFrom.slice(0, 10) : 'Any'} –{' '}
                        {scheme.effectiveTo ? scheme.effectiveTo.slice(0, 10) : 'Open'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="doc-btn"
                            onClick={() => openViewModal(scheme)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="View Details"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" /> View
                          </button>
                          {canEdit && (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(scheme)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Edit Scheme"
                              type="button"
                            >
                              <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {total > limit && (
          <div className="um-pagination" style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <span>
              Showing {schemes.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} schemes
            </span>
            <div className="um-page-controls">
              <button
                className="pg-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                <i className="ph ph-caret-left" />
              </button>
              <span className="pg-btn active">{page}</span>
              <button
                className="pg-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                <i className="ph ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ────────────────────────────────────────────── */}
      <Modal
        onClose={closeModal}
        open={modalMode === 'create' || modalMode === 'edit'}
        size="large"
        title={modalMode === 'create' ? 'Create Insurance Scheme' : `Edit Scheme: ${selectedScheme?.name}`}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="insurance-form-grid">
              <div className={`doc-field ${form.formState.errors.payerId ? 'has-error' : ''}`}>
                <label htmlFor="payerId">
                  Insurance Payer <span className="required-asterisk">*</span>
                </label>
                <select
                  id="payerId"
                  {...form.register('payerId')}
                  disabled={modalMode === 'edit' || submitting}
                >
                  <option value="">Select Insurance Payer</option>
                  {payers.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.payerCode})
                    </option>
                  ))}
                </select>
                {form.formState.errors.payerId && (
                  <span className="field-error-msg">{form.formState.errors.payerId.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.schemeCode ? 'has-error' : ''}`}>
                <label htmlFor="schemeCode">
                  Scheme Code <span className="required-asterisk">*</span>
                </label>
                <input
                  id="schemeCode"
                  placeholder="e.g. SHA-CORE or PREMIER-GOLD"
                  {...form.register('schemeCode')}
                  disabled={submitting}
                />
                {form.formState.errors.schemeCode && (
                  <span className="field-error-msg">{form.formState.errors.schemeCode.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.name ? 'has-error' : ''}`} style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="name">
                  Scheme Name <span className="required-asterisk">*</span>
                </label>
                <input
                  id="name"
                  placeholder="e.g. Universal Health Coverage Essential Package"
                  {...form.register('name')}
                  disabled={submitting}
                />
                {form.formState.errors.name && (
                  <span className="field-error-msg">{form.formState.errors.name.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="planType">Plan Type</label>
                <input
                  id="planType"
                  placeholder="e.g. Comprehensive, Inpatient Only"
                  {...form.register('planType')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="networkType">Network Type</label>
                <input
                  id="networkType"
                  placeholder="e.g. Tier 1 Hospitals, Nationwide"
                  {...form.register('networkType')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="status">Status</label>
                <select id="status" {...form.register('status')} disabled={submitting}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="branchId">Branch Scope</label>
                <select id="branchId" {...form.register('branchId')} disabled={submitting}>
                  <option value="">Global (All Branches)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="effectiveFrom">Effective From</label>
                <input id="effectiveFrom" type="date" {...form.register('effectiveFrom')} disabled={submitting} />
              </div>

              <div className="doc-field">
                <label htmlFor="effectiveTo">Effective To</label>
                <input id="effectiveTo" type="date" {...form.register('effectiveTo')} disabled={submitting} />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="doc-btn" onClick={closeModal} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <MedicalSpinner size="sm" /> Saving...
                </>
              ) : modalMode === 'create' ? (
                'Create Scheme'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Details Modal ────────────────────────────────────────────── */}
      <Modal
        onClose={closeModal}
        open={modalMode === 'view' && Boolean(selectedScheme)}
        size="default"
        title={`Scheme: ${selectedScheme?.name}`}
      >
        {selectedScheme && (
          <div>
            <div className="modal-body">
              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Scheme Code</label>
                  <span className="insurance-table-code">{selectedScheme.schemeCode}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Status</label>
                  <span>
                    <span className={`insurance-chip ${selectedScheme.status.toLowerCase()}`}>
                      {selectedScheme.status}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Linked Payer</label>
                  <span>{payerMap.get(selectedScheme.payerId)?.name ?? 'Unknown Payer'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Plan Type</label>
                  <span>{selectedScheme.planType || 'Standard Plan'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Network Type</label>
                  <span>{selectedScheme.networkType || 'General Network'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Effective Period</label>
                  <span>
                    {selectedScheme.effectiveFrom ? selectedScheme.effectiveFrom.slice(0, 10) : 'Indefinite'} –{' '}
                    {selectedScheme.effectiveTo ? selectedScheme.effectiveTo.slice(0, 10) : 'Open'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Record Version</label>
                  <span>v{selectedScheme.version}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="doc-btn" onClick={closeModal} type="button">
                Close
              </button>
              {canEdit && (
                <button
                  className="doc-btn primary"
                  onClick={() => openEditModal(selectedScheme)}
                  type="button"
                >
                  <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Scheme
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
