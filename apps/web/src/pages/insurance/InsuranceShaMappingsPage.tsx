import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type ShaServiceMapping,
} from '../../api/insurance';
import { servicesApi, type ServiceResponse } from '../../api/services';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

const shaMappingFormSchema = z
  .object({
    serviceId: z.string().min(1, 'Service selection is required'),
    interventionCode: z.string().trim().min(1, 'Intervention code is required').max(120),
    effectiveFrom: z.string().min(1, 'Effective from date is required'),
    effectiveTo: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.effectiveFrom && data.effectiveTo) {
        return new Date(data.effectiveFrom) <= new Date(data.effectiveTo);
      }
      return true;
    },
    {
      message: 'Effective to date cannot be earlier than effective from date',
      path: ['effectiveTo'],
    }
  );

type ShaMappingFormData = z.infer<typeof shaMappingFormSchema>;

export function InsuranceShaMappingsPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canManage = hasPermission(permissions, { module: 'Insurance', screen: 'Benefits', action: 'Manage' }, roles);

  // Filters & State
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [mappings, setMappings] = useState<ShaServiceMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // References
  const [services, setServices] = useState<ServiceResponse[]>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ShaServiceMapping | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const form = useForm<ShaMappingFormData>({
    resolver: zodResolver(shaMappingFormSchema),
    defaultValues: {
      serviceId: '',
      interventionCode: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
    },
  });

  // Load Services Catalogue
  useEffect(() => {
    servicesApi.list({ limit: 100 })
      .then((res) => setServices(res.data))
      .catch(() => {});
  }, []);

  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceResponse>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  // Load Mappings
  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listShaServiceMappings({
        serviceId: serviceFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setMappings(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load SHA service mappings.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [serviceFilter, page]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  // KPIs
  const kpis = useMemo(() => {
    const active = mappings.filter((m) => m.status === 'ACTIVE').length;
    const inactive = mappings.filter((m) => m.status === 'INACTIVE').length;
    return { total, active, inactive };
  }, [mappings, total]);

  const openCreateModal = () => {
    form.reset({
      serviceId: serviceFilter || (services[0]?.id ?? ''),
      interventionCode: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
    });
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    form.reset();
  };

  const onSubmit = async (data: ShaMappingFormData) => {
    setSubmitting(true);
    try {
      await insuranceApi.createShaServiceMapping({
        serviceId: data.serviceId,
        interventionCode: data.interventionCode.trim().toUpperCase(),
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || undefined,
      });
      toast.success(`Service mapped to SHA intervention "${data.interventionCode}" successfully.`);
      closeCreateModal();
      await loadMappings();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create SHA mapping.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    if (!deactivateReason.trim()) {
      toast.error('Please specify a reason for deactivation.');
      return;
    }

    setSubmitting(true);
    try {
      await insuranceApi.deactivateShaServiceMapping(deactivateTarget._id, {
        version: deactivateTarget.version,
        reason: deactivateReason.trim(),
      });
      toast.success(`Mapping for "${deactivateTarget.interventionCode}" deactivated.`);
      setDeactivateTarget(null);
      setDeactivateReason('');
      await loadMappings();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to deactivate mapping.';
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
          <h2>SHA Service Mapping</h2>
          <p>Map clinical and procedural services to Social Health Authority standard codes.</p>
        </div>
        <div className="insurance-head-actions">
          {canManage && (
            <button className="btn-primary" onClick={openCreateModal} type="button">
              <i className="ph ph-plus" aria-hidden="true" /> Add Mapping
            </button>
          )}
        </div>
      </div>
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="SHA Mapping Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-git-merge" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Mappings</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Mappings</span>
            <span className="kpi-value">{loading ? '—' : kpis.active}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-prohibit" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Deactivated</span>
            <span className="kpi-value">{loading ? '—' : kpis.inactive}</span>
          </div>
        </div>
      </div>

      {/* ── Table Section ───────────────────────────────────────────────────── */}
      <div className="um-table-section card">
        <div className="um-toolbar">
          <div className="um-toolbar-row1">
            <select
              className="um-filter"
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              style={{ minWidth: '280px' }}
              value={serviceFilter}
            >
              <option value="">All HMS Services</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.code})
                </option>
              ))}
            </select>

            {serviceFilter && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setServiceFilter('');
                  setPage(1);
                }}
                type="button"
              >
                <i className="ph ph-x" aria-hidden="true" /> Clear Filter
              </button>
            )}

            {canManage && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add SHA Mapping
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadMappings()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>
        </div>

        {/* ── Notice Banner ────────────────────────────────────────────────── */}
        <div
          style={{
            margin: '0.5rem 1.25rem',
            padding: '0.65rem 1rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <i className="ph ph-info" style={{ color: '#0284c7', fontSize: '1.1rem' }} />
          <span>
            <strong>Disclaimer:</strong> Mappings associate internal hospital services with Social Health Authority (SHA) tariff/intervention codes. Locally configured mappings are operational definitions and do not imply official validation by the national authority.
          </span>
        </div>

        {/* ── Data Table ──────────────────────────────────────────────────── */}
        <div className="table-responsive">
          {loading ? (
            <div style={{ padding: '3rem 0' }}>
              <MedicalLoader size="large" text="Loading SHA service mappings..." />
            </div>
          ) : mappings.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-git-merge" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No SHA Mappings Found</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {serviceFilter
                  ? 'No mapping configured for the selected service.'
                  : 'No service-to-SHA intervention mappings exist.'}
              </p>
              {canManage && !serviceFilter && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Create First Mapping
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital Service</th>
                  <th>SHA Intervention Code</th>
                  <th>Effective Period</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const service = serviceMap.get(mapping.serviceId);

                  return (
                    <tr key={mapping._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{service?.name ?? 'Service Ref'}</strong>
                        {service && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Code: {service.code}</div>
                        )}
                      </td>
                      <td>
                        <span className="insurance-table-code">{mapping.interventionCode}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {mapping.effectiveFrom.slice(0, 10)} –{' '}
                        {mapping.effectiveTo ? mapping.effectiveTo.slice(0, 10) : 'Active / Open'}
                      </td>
                      <td>
                        <span className={`insurance-chip ${mapping.status.toLowerCase()}`}>
                          {mapping.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>v{mapping.version}</td>
                      <td style={{ textAlign: 'right' }}>
                        {mapping.status === 'ACTIVE' && canManage ? (
                          <button
                            className="doc-btn"
                            onClick={() => {
                              setDeactivateTarget(mapping);
                              setDeactivateReason('');
                            }}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem', borderColor: '#fca5a5', color: '#dc2626' }}
                            title="Deactivate Mapping"
                            type="button"
                          >
                            <i className="ph ph-prohibit" aria-hidden="true" /> Deactivate
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Inactive</span>
                        )}
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
              Showing {mappings.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} mappings
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

      {/* ── Create Mapping Modal ───────────────────────────────────────────── */}
      <Modal
        onClose={closeCreateModal}
        open={createModalOpen}
        size="default"
        title="Map Service to SHA Intervention"
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="serviceId">
                Hospital Service <span className="required-asterisk">*</span>
              </label>
              <select id="serviceId" {...form.register('serviceId')} disabled={submitting}>
                <option value="">Select Service from Catalogue</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name} ({svc.code})
                  </option>
                ))}
              </select>
              {form.formState.errors.serviceId && (
                <span className="field-error-msg">{form.formState.errors.serviceId.message}</span>
              )}
            </div>

            <div className="doc-field">
              <label htmlFor="interventionCode">
                SHA Intervention Code <span className="required-asterisk">*</span>
              </label>
              <input
                id="interventionCode"
                placeholder="e.g. SHA-INT-0492"
                {...form.register('interventionCode')}
                disabled={submitting}
              />
              {form.formState.errors.interventionCode && (
                <span className="field-error-msg">{form.formState.errors.interventionCode.message}</span>
              )}
            </div>

            <div className="doc-field">
              <label htmlFor="effectiveFrom">
                Effective From <span className="required-asterisk">*</span>
              </label>
              <input id="effectiveFrom" type="date" {...form.register('effectiveFrom')} disabled={submitting} />
              {form.formState.errors.effectiveFrom && (
                <span className="field-error-msg">{form.formState.errors.effectiveFrom.message}</span>
              )}
            </div>

            <div className="doc-field">
              <label htmlFor="effectiveTo">Effective To (Optional)</label>
              <input id="effectiveTo" type="date" {...form.register('effectiveTo')} disabled={submitting} />
              {form.formState.errors.effectiveTo && (
                <span className="field-error-msg">{form.formState.errors.effectiveTo.message}</span>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button className="doc-btn" onClick={closeCreateModal} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <MedicalSpinner size="sm" /> Creating...
                </>
              ) : (
                'Create Mapping'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Deactivation Confirmation Modal ────────────────────────────────── */}
      <Modal
        onClose={() => setDeactivateTarget(null)}
        open={Boolean(deactivateTarget)}
        size="default"
        title="Confirm SHA Mapping Deactivation"
      >
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, color: '#334155', fontSize: '0.88rem' }}>
            Are you sure you want to deactivate the mapping for intervention code{' '}
            <strong className="insurance-table-code">{deactivateTarget?.interventionCode}</strong>?
          </p>

          <div className="doc-field">
            <label htmlFor="deactivateReason">
              Deactivation Reason <span className="required-asterisk">*</span>
            </label>
            <textarea
              id="deactivateReason"
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="e.g. Superseded by new national tariff schedule revision"
              rows={3}
              value={deactivateReason}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="doc-btn" onClick={() => setDeactivateTarget(null)} type="button">
            Cancel
          </button>
          <button
            className="doc-btn"
            disabled={submitting || !deactivateReason.trim()}
            onClick={() => void handleDeactivate()}
            style={{ background: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
            type="button"
          >
            {submitting ? <MedicalSpinner size="sm" /> : 'Deactivate Mapping'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
