import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type InsurancePayer,
  type PayerType,
  type PayerStatus,
} from '../../api/insurance';
import { branchesApi, type BranchResponse } from '../../api/branches';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

const payerFormSchema = z.object({
  payerCode: z.string().trim().min(1, 'Payer code is required'),
  name: z.string().trim().min(1, 'Payer name is required'),
  type: z.enum(['SHA', 'PRIVATE', 'TPA', 'OTHER']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  branchId: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

type PayerFormData = z.infer<typeof payerFormSchema>;

export function InsurancePayersPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canCreate = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Create' }, roles);
  const canEdit = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Edit' }, roles);

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayerStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PayerType | ''>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchResponse[]>([]);

  // Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedPayer, setSelectedPayer] = useState<InsurancePayer | null>(null);

  const form = useForm<PayerFormData>({
    resolver: zodResolver(payerFormSchema),
    defaultValues: {
      payerCode: '',
      name: '',
      type: 'SHA',
      status: 'ACTIVE',
      branchId: '',
      effectiveFrom: '',
      effectiveTo: '',
      email: '',
      phone: '',
      address: '',
      website: '',
    },
  });

  // Fetch Branches
  useEffect(() => {
    branchesApi.list({ limit: 100 })
      .then((res) => setBranches(res.data))
      .catch(() => {});
  }, []);

  // Fetch Payers
  const loadPayers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listPayers({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        branchId: branchFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setPayers(res.items);
      setTotal(res.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load payers.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, branchFilter, page]);

  useEffect(() => {
    void loadPayers();
  }, [loadPayers]);

  // KPIs
  const kpis = useMemo(() => {
    const active = payers.filter((p) => p.status === 'ACTIVE').length;
    const sha = payers.filter((p) => p.type === 'SHA').length;
    const priv = payers.filter((p) => p.type === 'PRIVATE').length;
    return { total, active, sha, priv };
  }, [payers, total]);

  const openCreateModal = () => {
    setSelectedPayer(null);
    form.reset({
      payerCode: '',
      name: '',
      type: 'SHA',
      status: 'ACTIVE',
      branchId: '',
      effectiveFrom: '',
      effectiveTo: '',
      email: '',
      phone: '',
      address: '',
      website: '',
    });
    setModalMode('create');
  };

  const openEditModal = (payer: InsurancePayer) => {
    setSelectedPayer(payer);
    form.reset({
      payerCode: payer.payerCode,
      name: payer.name,
      type: payer.type,
      status: payer.status,
      branchId: payer.branchId ?? '',
      effectiveFrom: payer.effectiveFrom ? payer.effectiveFrom.slice(0, 10) : '',
      effectiveTo: payer.effectiveTo ? payer.effectiveTo.slice(0, 10) : '',
      email: payer.contactInfo?.email ?? '',
      phone: payer.contactInfo?.phone ?? '',
      address: payer.contactInfo?.address ?? '',
      website: payer.contactInfo?.website ?? '',
    });
    setModalMode('edit');
  };

  const openViewModal = (payer: InsurancePayer) => {
    setSelectedPayer(payer);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedPayer(null);
    form.reset();
  };

  const onSubmit = async (data: PayerFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        payerCode: data.payerCode.trim().toUpperCase(),
        name: data.name.trim(),
        type: data.type,
        status: data.status,
        branchId: data.branchId ? data.branchId : null,
        effectiveFrom: data.effectiveFrom || null,
        effectiveTo: data.effectiveTo || null,
        contactInfo: {
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          website: data.website?.trim() || null,
        },
      };

      if (modalMode === 'create') {
        await insuranceApi.createPayer(payload);
        toast.success(`Insurance payer "${data.name}" created successfully.`);
      } else if (modalMode === 'edit' && selectedPayer) {
        await insuranceApi.updatePayer(selectedPayer._id, payload);
        toast.success(`Insurance payer "${data.name}" updated successfully.`);
      }

      closeModal();
      await loadPayers();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Action failed. Please verify form details.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="insurance-page">
      {/* ── Top Header Row ──────────────────────────────────────────────── */}
      <div className="insurance-page-head">
        <div>
          <h2>Insurance Payers</h2>
          <p>Configure insurance payers, payer codes, policy types, and branch linkages.</p>
        </div>
        <div className="insurance-head-actions">
          {canCreate && (
            <button className="btn-primary" onClick={openCreateModal} type="button">
              <i className="ph ph-plus" aria-hidden="true" /> Add Payer
            </button>
          )}
        </div>
      </div>
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="Insurance Payer Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-shield-check" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Payers</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Payers</span>
            <span className="kpi-value">{loading ? '—' : kpis.active}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple">
            <i className="ph ph-bank" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">SHA / Public</span>
            <span className="kpi-value">{loading ? '—' : kpis.sha}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-buildings" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Private / TPA</span>
            <span className="kpi-value">{loading ? '—' : kpis.priv}</span>
          </div>
        </div>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
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
                placeholder="Search payers by code or name..."
                type="search"
                value={search}
              />
            </div>
            {canCreate && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Payer
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadPayers()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>

          <div className="um-toolbar-row2">
            <span className="filter-label">Filter:</span>
            <select
              className="um-filter"
              onChange={(e) => {
                setTypeFilter(e.target.value as PayerType | '');
                setPage(1);
              }}
              value={typeFilter}
            >
              <option value="">All Types</option>
              <option value="SHA">SHA</option>
              <option value="PRIVATE">Private</option>
              <option value="TPA">TPA</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              className="um-filter"
              onChange={(e) => {
                setStatusFilter(e.target.value as PayerStatus | '');
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              className="um-filter"
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              value={branchFilter}
            >
              <option value="">All Scopes (Global & Branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {(search || statusFilter || typeFilter || branchFilter) && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setTypeFilter('');
                  setBranchFilter('');
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
              <MedicalLoader size="large" text="Loading insurance payers..." />
            </div>
          ) : payers.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-shield-slash" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No Payers Found</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {search || statusFilter || typeFilter ? 'No insurance payers match your filter criteria.' : 'No insurance payers are currently configured.'}
              </p>
              {canCreate && !search && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add First Payer
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Payer Name</th>
                  <th>Type</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Effective Period</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payers.map((payer) => {
                  const branchName = payer.branchId
                    ? branches.find((b) => b.id === payer.branchId)?.name ?? 'Branch Scoped'
                    : 'Global (All Branches)';
                  return (
                    <tr key={payer._id}>
                      <td>
                        <span className="insurance-table-code">{payer.payerCode}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{payer.name}</strong>
                        {payer.contactInfo?.email && (
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{payer.contactInfo.email}</div>
                        )}
                      </td>
                      <td>
                        <span className={`insurance-chip ${payer.type.toLowerCase()}`}>
                          {payer.type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: payer.branchId ? '#475569' : '#0284c7' }}>
                          <i className={`ph ${payer.branchId ? 'ph-buildings' : 'ph-globe'}`} style={{ marginRight: '4px' }} />
                          {branchName}
                        </span>
                      </td>
                      <td>
                        <span className={`insurance-chip ${payer.status.toLowerCase()}`}>
                          {payer.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {payer.effectiveFrom ? payer.effectiveFrom.slice(0, 10) : 'Any'} –{' '}
                        {payer.effectiveTo ? payer.effectiveTo.slice(0, 10) : 'Open'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="doc-btn"
                            onClick={() => openViewModal(payer)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="View Details"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" /> View
                          </button>
                          {canEdit && (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(payer)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Edit Payer"
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
              Showing {payers.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} payers
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
        title={modalMode === 'create' ? 'Create Insurance Payer' : `Edit Payer: ${selectedPayer?.name}`}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="insurance-form-grid">
              <div className={`doc-field ${form.formState.errors.payerCode ? 'has-error' : ''}`}>
                <label htmlFor="payerCode">
                  Payer Code <span className="required-asterisk">*</span>
                </label>
                <input
                  id="payerCode"
                  placeholder="e.g. SHA-001 or JUBILEE"
                  {...form.register('payerCode')}
                  disabled={modalMode === 'edit' || submitting}
                />
                {form.formState.errors.payerCode && (
                  <span className="field-error-msg">{form.formState.errors.payerCode.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.name ? 'has-error' : ''}`}>
                <label htmlFor="name">
                  Payer Name <span className="required-asterisk">*</span>
                </label>
                <input
                  id="name"
                  placeholder="e.g. Social Health Authority"
                  {...form.register('name')}
                  disabled={submitting}
                />
                {form.formState.errors.name && (
                  <span className="field-error-msg">{form.formState.errors.name.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="type">Payer Type</label>
                <select id="type" {...form.register('type')} disabled={submitting}>
                  <option value="SHA">SHA (Social Health Authority)</option>
                  <option value="PRIVATE">Private Insurance</option>
                  <option value="TPA">Third-Party Administrator (TPA)</option>
                  <option value="OTHER">Other Payer</option>
                </select>
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

              <div className="insurance-section-title">Contact Information</div>

              <div className={`doc-field ${form.formState.errors.email ? 'has-error' : ''}`}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" placeholder="claims@payer.org" {...form.register('email')} disabled={submitting} />
                {form.formState.errors.email && (
                  <span className="field-error-msg">{form.formState.errors.email.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" placeholder="+254..." {...form.register('phone')} disabled={submitting} />
              </div>

              <div className="doc-field">
                <label htmlFor="website">Website</label>
                <input id="website" placeholder="https://..." {...form.register('website')} disabled={submitting} />
              </div>

              <div className="doc-field full-width" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="address">Address</label>
                <input id="address" placeholder="Physical or postal address" {...form.register('address')} disabled={submitting} />
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
                'Create Payer'
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
        open={modalMode === 'view' && Boolean(selectedPayer)}
        size="default"
        title={`Payer: ${selectedPayer?.name}`}
      >
        {selectedPayer && (
          <div>
            <div className="modal-body">
              <div className="coverage-details-grid" style={{ marginBottom: '1rem' }}>
                <div className="coverage-detail-item">
                  <label>Payer Code</label>
                  <span className="insurance-table-code">{selectedPayer.payerCode}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Type</label>
                  <span>
                    <span className={`insurance-chip ${selectedPayer.type.toLowerCase()}`}>
                      {selectedPayer.type}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Status</label>
                  <span>
                    <span className={`insurance-chip ${selectedPayer.status.toLowerCase()}`}>
                      {selectedPayer.status}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Scope</label>
                  <span>
                    {selectedPayer.branchId
                      ? branches.find((b) => b.id === selectedPayer.branchId)?.name ?? 'Branch Scoped'
                      : 'Global (All Branches)'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Effective Period</label>
                  <span>
                    {selectedPayer.effectiveFrom ? selectedPayer.effectiveFrom.slice(0, 10) : 'Indefinite'} –{' '}
                    {selectedPayer.effectiveTo ? selectedPayer.effectiveTo.slice(0, 10) : 'Open'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Record Version</label>
                  <span>v{selectedPayer.version}</span>
                </div>
              </div>

              <div className="insurance-section-title" style={{ marginBottom: '0.75rem' }}>
                Contact & Administration
              </div>
              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Email</label>
                  <span>{selectedPayer.contactInfo?.email || 'Not provided'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Phone</label>
                  <span>{selectedPayer.contactInfo?.phone || 'Not provided'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Website</label>
                  <span>{selectedPayer.contactInfo?.website || 'Not provided'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Address</label>
                  <span>{selectedPayer.contactInfo?.address || 'Not provided'}</span>
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
                  onClick={() => {
                    openEditModal(selectedPayer);
                  }}
                  type="button"
                >
                  <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Payer
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
