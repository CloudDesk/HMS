import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type BenefitConfig,
  type CoverageRule,
  type BenefitStatus,
  type InsurancePayer,
  type InsuranceScheme,
  type InsuranceMember,
  type VerifyBenefitResult,
} from '../../api/insurance';
import { servicesApi, type ServiceResponse } from '../../api/services';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

const benefitFormSchema = z
  .object({
    payerId: z.string().min(1, 'Insurance payer is required'),
    schemeId: z.string().optional(),
    serviceId: z.string().optional(),
    category: z.string().optional(),
    coverageRule: z.enum(['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'AUTHORIZATION_REQUIRED']),
    authorizationRequired: z.boolean(),
    maxAmount: z.coerce.number().min(0).optional().or(z.literal('')),
    maxQuantity: z.coerce.number().min(0).optional().or(z.literal('')),
    frequency: z.string().optional(),
    copayType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    copayValue: z.coerce.number().min(0).optional().or(z.literal('')),
    isExcluded: z.boolean(),
    exclusionReason: z.string().optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'End date cannot be earlier than start date',
      path: ['endDate'],
    }
  );

type BenefitFormInput = z.input<typeof benefitFormSchema>;
type BenefitFormData = z.output<typeof benefitFormSchema>;

export function InsuranceBenefitsPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canManage = hasPermission(permissions, { module: 'Insurance', screen: 'Benefits', action: 'Manage' }, roles);
  const canVerify = hasPermission(permissions, { module: 'Insurance', screen: 'Benefits', action: 'Verify' }, roles);

  // Filters & State
  const [payerFilter, setPayerFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<BenefitStatus | ''>('');
  const [ruleFilter, setRuleFilter] = useState<CoverageRule | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [benefits, setBenefits] = useState<BenefitConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // References
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [schemes, setSchemes] = useState<InsuranceScheme[]>([]);
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [members, setMembers] = useState<InsuranceMember[]>([]);

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'verify' | null>(null);
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitConfig | null>(null);

  // Verification State
  const [verifyMemberId, setVerifyMemberId] = useState('');
  const [verifyServiceId, setVerifyServiceId] = useState('');
  const [verifyQuantity, setVerifyQuantity] = useState(1);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyBenefitResult | null>(null);

  const form = useForm<BenefitFormInput, unknown, BenefitFormData>({
    resolver: zodResolver(benefitFormSchema),
    defaultValues: {
      payerId: '',
      schemeId: '',
      serviceId: '',
      category: '',
      coverageRule: 'COVERED',
      authorizationRequired: false,
      maxAmount: '',
      maxQuantity: '',
      frequency: '',
      copayType: 'PERCENTAGE',
      copayValue: '',
      isExcluded: false,
      exclusionReason: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'ACTIVE',
    },
  });

  const selectedFormPayerId = form.watch('payerId');

  // Load Reference Data
  useEffect(() => {
    insuranceApi.listPayers({ limit: 100 })
      .then((res) => setPayers(res.items))
      .catch(() => {});

    insuranceApi.listSchemes({ limit: 100 })
      .then((res) => setSchemes(res.items))
      .catch(() => {});

    servicesApi.list({ limit: 100 })
      .then((res) => setServices(res.data))
      .catch(() => {});

    insuranceApi.listMembers({ limit: 50 })
      .then((res) => setMembers(res.items))
      .catch(() => {});
  }, []);

  // Filter schemes for selected form payer
  const formSchemes = useMemo(() => {
    if (!selectedFormPayerId) return schemes;
    return schemes.filter((s) => s.payerId === selectedFormPayerId);
  }, [schemes, selectedFormPayerId]);

  // Load Benefit Configurations
  const loadBenefits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listBenefitConfigs({
        payerId: payerFilter || undefined,
        schemeId: schemeFilter || undefined,
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setBenefits(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load benefit configurations.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [payerFilter, schemeFilter, statusFilter, page]);

  useEffect(() => {
    void loadBenefits();
  }, [loadBenefits]);

  // Lookup maps
  const payerMap = useMemo(() => {
    const map = new Map<string, InsurancePayer>();
    payers.forEach((p) => map.set(p._id, p));
    return map;
  }, [payers]);

  const schemeMap = useMemo(() => {
    const map = new Map<string, InsuranceScheme>();
    schemes.forEach((s) => map.set(s._id, s));
    return map;
  }, [schemes]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceResponse>();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  // Filtered by coverage rule client-side if selected
  const displayedBenefits = useMemo(() => {
    if (!ruleFilter) return benefits;
    return benefits.filter((b) => b.coverageRule === ruleFilter);
  }, [benefits, ruleFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const covered = benefits.filter((b) => b.coverageRule === 'COVERED').length;
    const authRequired = benefits.filter((b) => b.authorizationRequired || b.coverageRule === 'AUTHORIZATION_REQUIRED').length;
    const excluded = benefits.filter((b) => b.isExcluded || b.coverageRule === 'NOT_COVERED').length;
    return { total, covered, authRequired, excluded };
  }, [benefits, total]);

  const openCreateModal = () => {
    setSelectedBenefit(null);
    form.reset({
      payerId: payerFilter || (payers[0]?._id ?? ''),
      schemeId: schemeFilter || '',
      serviceId: '',
      category: '',
      coverageRule: 'COVERED',
      authorizationRequired: false,
      maxAmount: '',
      maxQuantity: '',
      frequency: '',
      copayType: 'PERCENTAGE',
      copayValue: '',
      isExcluded: false,
      exclusionReason: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'ACTIVE',
    });
    setModalMode('create');
  };

  const openEditModal = (benefit: BenefitConfig) => {
    setSelectedBenefit(benefit);
    form.reset({
      payerId: benefit.payerId,
      schemeId: benefit.schemeId ?? '',
      serviceId: benefit.serviceId ?? '',
      category: benefit.category ?? '',
      coverageRule: benefit.coverageRule,
      authorizationRequired: Boolean(benefit.authorizationRequired),
      maxAmount: benefit.coverageLimit?.maxAmount ?? '',
      maxQuantity: benefit.coverageLimit?.maxQuantity ?? '',
      frequency: benefit.coverageLimit?.frequency ?? '',
      copayType: benefit.copay?.type ?? 'PERCENTAGE',
      copayValue: benefit.copay?.value ?? '',
      isExcluded: Boolean(benefit.isExcluded),
      exclusionReason: benefit.exclusionReason ?? '',
      startDate: benefit.startDate ? benefit.startDate.slice(0, 10) : '',
      endDate: benefit.endDate ? benefit.endDate.slice(0, 10) : '',
      status: benefit.status,
    });
    setModalMode('edit');
  };

  const openViewModal = (benefit: BenefitConfig) => {
    setSelectedBenefit(benefit);
    setModalMode('view');
  };

  const openVerifyModal = (benefit?: BenefitConfig) => {
    setVerifyResult(null);
    setVerifyMemberId(members[0]?._id ?? '');
    setVerifyServiceId(benefit?.serviceId ?? (services[0]?.id ?? ''));
    setVerifyQuantity(1);
    setModalMode('verify');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedBenefit(null);
    setVerifyResult(null);
    form.reset();
  };

  const onSubmit = async (data: BenefitFormData) => {
    setSubmitting(true);
    try {
      const selectedService = data.serviceId ? serviceMap.get(data.serviceId) : null;
      const coverageLimit =
        typeof data.maxAmount === 'number' || typeof data.maxQuantity === 'number' || data.frequency
          ? {
              maxAmount: typeof data.maxAmount === 'number' ? data.maxAmount : null,
              maxQuantity: typeof data.maxQuantity === 'number' ? data.maxQuantity : null,
              frequency: data.frequency?.trim() || null,
            }
          : null;

      const copay =
        typeof data.copayValue === 'number' && data.copayType
          ? {
              type: data.copayType,
              value: data.copayValue,
            }
          : null;

      const payload = {
        payerId: data.payerId,
        schemeId: data.schemeId ? data.schemeId : null,
        serviceId: data.serviceId ? data.serviceId : null,
        serviceCode: selectedService?.code ?? null,
        category: data.category?.trim() || null,
        coverageRule: data.coverageRule,
        authorizationRequired: data.authorizationRequired || data.coverageRule === 'AUTHORIZATION_REQUIRED',
        coverageLimit,
        copay,
        isExcluded: data.isExcluded || data.coverageRule === 'NOT_COVERED',
        exclusionReason: data.exclusionReason?.trim() || null,
        startDate: data.startDate,
        endDate: data.endDate || null,
        status: data.status,
      };

      if (modalMode === 'create') {
        await insuranceApi.createBenefitConfig(payload);
        toast.success('Benefit configuration rule created.');
      } else if (modalMode === 'edit' && selectedBenefit) {
        await insuranceApi.updateBenefitConfig(selectedBenefit._id, payload);
        toast.success('Benefit configuration rule updated.');
      }

      closeModal();
      await loadBenefits();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Action failed. Please check form inputs.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyBenefit = async () => {
    if (!verifyMemberId) {
      toast.error('Please select an insurance member for verification.');
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await insuranceApi.verifyBenefit({
        memberId: verifyMemberId,
        serviceId: verifyServiceId || undefined,
        quantity: verifyQuantity > 0 ? verifyQuantity : 1,
      });
      setVerifyResult(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Benefit verification failed.';
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="insurance-page">
      {/* ── Top Header Row ──────────────────────────────────────────────── */}
      <div className="insurance-page-head">
        <div>
          <h2>Benefit Configuration</h2>
          <p>Define coverage limits, copays, deductibles, and pre-authorization requirements.</p>
        </div>
        <div className="insurance-head-actions">
          {canManage && (
            <button className="btn-primary" onClick={openCreateModal} type="button">
              <i className="ph ph-plus" aria-hidden="true" /> Add Rule
            </button>
          )}
        </div>
      </div>
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="Benefit Configuration Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-sliders" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Configured Rules</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Fully Covered</span>
            <span className="kpi-value">{loading ? '—' : kpis.covered}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-lock-key" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Auth Required</span>
            <span className="kpi-value">{loading ? '—' : kpis.authRequired}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red">
            <i className="ph ph-x-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Exclusions</span>
            <span className="kpi-value">{loading ? '—' : kpis.excluded}</span>
          </div>
        </div>
      </div>

      {/* ── Table Section ───────────────────────────────────────────────────── */}
      <div className="um-table-section card">
        <div className="um-toolbar">
          <div className="um-toolbar-row1">
            <div style={{ display: 'flex', gap: '0.65rem', flex: 1 }}>
              <select
                className="um-filter"
                onChange={(e) => {
                  setPayerFilter(e.target.value);
                  setSchemeFilter('');
                  setPage(1);
                }}
                value={payerFilter}
              >
                <option value="">All Insurance Payers</option>
                {payers.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                className="um-filter"
                onChange={(e) => {
                  setSchemeFilter(e.target.value);
                  setPage(1);
                }}
                value={schemeFilter}
              >
                <option value="">All Schemes</option>
                {(payerFilter ? schemes.filter((s) => s.payerId === payerFilter) : schemes).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {canVerify && (
              <button
                className="doc-btn"
                onClick={() => openVerifyModal()}
                style={{ borderColor: '#3b82f6', color: '#1d4ed8' }}
                type="button"
              >
                <i className="ph ph-check-square-offset" aria-hidden="true" /> Test Benefit Verification
              </button>
            )}
            {canManage && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Benefit Rule
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadBenefits()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>

          <div className="um-toolbar-row2">
            <span className="filter-label">Filter:</span>
            <select
              className="um-filter"
              onChange={(e) => {
                setRuleFilter(e.target.value as CoverageRule | '');
                setPage(1);
              }}
              value={ruleFilter}
            >
              <option value="">All Coverage Rules</option>
              <option value="COVERED">Covered</option>
              <option value="PARTIALLY_COVERED">Partially Covered</option>
              <option value="AUTHORIZATION_REQUIRED">Authorization Required</option>
              <option value="NOT_COVERED">Not Covered</option>
            </select>

            <select
              className="um-filter"
              onChange={(e) => {
                setStatusFilter(e.target.value as BenefitStatus | '');
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {(payerFilter || schemeFilter || ruleFilter || statusFilter) && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setPayerFilter('');
                  setSchemeFilter('');
                  setRuleFilter('');
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
              <MedicalLoader size="large" text="Loading benefit rules..." />
            </div>
          ) : displayedBenefits.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-sliders" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No Benefit Rules Configured</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {payerFilter || schemeFilter || ruleFilter || statusFilter
                  ? 'No rules match your filter criteria.'
                  : 'No insurance benefit configuration rules found.'}
              </p>
              {canManage && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add First Rule
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payer & Scheme</th>
                  <th>Service / Category</th>
                  <th>Coverage Rule</th>
                  <th>Pre-Auth</th>
                  <th>Limits & Co-Pay</th>
                  <th>Validity</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedBenefits.map((benefit) => {
                  const payer = payerMap.get(benefit.payerId);
                  const scheme = benefit.schemeId ? schemeMap.get(benefit.schemeId) : null;
                  const service = benefit.serviceId ? serviceMap.get(benefit.serviceId) : null;

                  return (
                    <tr key={benefit._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{payer?.name ?? 'Payer Ref'}</strong>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {scheme ? scheme.name : 'All Schemes under Payer'}
                        </div>
                      </td>
                      <td>
                        {service ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{service.name}</span>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Code: {service.code}</div>
                          </div>
                        ) : benefit.category ? (
                          <span style={{ fontWeight: 600, color: '#475569' }}>
                            Category: {benefit.category}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>All Services (Default)</span>
                        )}
                      </td>
                      <td>
                        <span className={`insurance-chip ${benefit.coverageRule.toLowerCase()}`}>
                          {benefit.coverageRule.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {benefit.authorizationRequired ? (
                          <span className="insurance-chip authorization_required">
                            <i className="ph ph-lock-key" /> Required
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>None</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                        {benefit.copay && (
                          <div>
                            Co-pay: {benefit.copay.value}
                            {benefit.copay.type === 'PERCENTAGE' ? '%' : ' Fixed'}
                          </div>
                        )}
                        {benefit.coverageLimit?.maxAmount && (
                          <div>Max: {benefit.coverageLimit.maxAmount.toLocaleString()}</div>
                        )}
                        {!benefit.copay && !benefit.coverageLimit?.maxAmount && (
                          <span style={{ color: '#94a3b8' }}>Standard</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {benefit.startDate.slice(0, 10)} – {benefit.endDate ? benefit.endDate.slice(0, 10) : 'Open'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {canVerify && (
                            <button
                              className="doc-btn"
                              onClick={() => openVerifyModal(benefit)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Verify Against Member"
                              type="button"
                            >
                              <i className="ph ph-shield-check" aria-hidden="true" /> Verify
                            </button>
                          )}
                          <button
                            className="doc-btn"
                            onClick={() => openViewModal(benefit)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="View Rule Details"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" /> View
                          </button>
                          {canManage && (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(benefit)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Edit Rule"
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
              Showing {displayedBenefits.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} rules
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
        title={modalMode === 'create' ? 'Create Benefit Rule' : 'Edit Benefit Configuration'}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="insurance-form-grid">
              <div className={`doc-field ${form.formState.errors.payerId ? 'has-error' : ''}`}>
                <label htmlFor="payerId">
                  Insurance Payer <span className="required-asterisk">*</span>
                </label>
                <select id="payerId" {...form.register('payerId')} disabled={submitting}>
                  <option value="">Select Payer</option>
                  {payers.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.payerId && (
                  <span className="field-error-msg">{form.formState.errors.payerId.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="schemeId">Target Scheme (Optional)</label>
                <select id="schemeId" {...form.register('schemeId')} disabled={submitting}>
                  <option value="">Applies to All Schemes under Payer</option>
                  {formSchemes.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="serviceId">HMS Service (Catalogue)</label>
                <select id="serviceId" {...form.register('serviceId')} disabled={submitting}>
                  <option value="">All Services / General</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="category">Service Category (Optional)</label>
                <input id="category" placeholder="e.g. CONSULTATION, PHARMACY" {...form.register('category')} disabled={submitting} />
              </div>

              <div className="doc-field">
                <label htmlFor="coverageRule">Coverage Rule</label>
                <select id="coverageRule" {...form.register('coverageRule')} disabled={submitting}>
                  <option value="COVERED">Covered</option>
                  <option value="PARTIALLY_COVERED">Partially Covered</option>
                  <option value="AUTHORIZATION_REQUIRED">Authorization Required</option>
                  <option value="NOT_COVERED">Not Covered (Excluded)</option>
                </select>
              </div>

              <div className="doc-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.6rem' }}>
                <input
                  id="authorizationRequired"
                  type="checkbox"
                  {...form.register('authorizationRequired')}
                  disabled={submitting}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="authorizationRequired" style={{ margin: 0, cursor: 'pointer' }}>
                  Pre-authorization required before service
                </label>
              </div>

              <div className="insurance-section-title">Limits & Co-Pay</div>

              <div className="doc-field">
                <label htmlFor="copayType">Co-pay Type</label>
                <select id="copayType" {...form.register('copayType')} disabled={submitting}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="copayValue">Co-pay Value</label>
                <input
                  id="copayValue"
                  type="number"
                  placeholder="e.g. 10 (%) or 500 (KES)"
                  min="0"
                  {...form.register('copayValue')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="maxAmount">Max Amount Limit</label>
                <input
                  id="maxAmount"
                  type="number"
                  placeholder="Maximum covered amount"
                  min="0"
                  {...form.register('maxAmount')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="maxQuantity">Max Quantity</label>
                <input
                  id="maxQuantity"
                  type="number"
                  placeholder="Max units per visit/period"
                  min="0"
                  {...form.register('maxQuantity')}
                  disabled={submitting}
                />
              </div>

              <div className={`doc-field ${form.formState.errors.startDate ? 'has-error' : ''}`}>
                <label htmlFor="startDate">
                  Effective Start <span className="required-asterisk">*</span>
                </label>
                <input id="startDate" type="date" {...form.register('startDate')} disabled={submitting} />
                {form.formState.errors.startDate && (
                  <span className="field-error-msg">{form.formState.errors.startDate.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.endDate ? 'has-error' : ''}`}>
                <label htmlFor="endDate">Effective End</label>
                <input id="endDate" type="date" {...form.register('endDate')} disabled={submitting} />
                {form.formState.errors.endDate && (
                  <span className="field-error-msg">{form.formState.errors.endDate.message}</span>
                )}
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
                'Create Rule'
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
        open={modalMode === 'view' && Boolean(selectedBenefit)}
        size="default"
        title="Benefit Configuration Details"
      >
        {selectedBenefit && (
          <div>
            <div className="modal-body">
              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Payer</label>
                  <span>{payerMap.get(selectedBenefit.payerId)?.name ?? selectedBenefit.payerId}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Scheme</label>
                  <span>
                    {selectedBenefit.schemeId
                      ? schemeMap.get(selectedBenefit.schemeId)?.name ?? selectedBenefit.schemeId
                      : 'All Schemes'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Service</label>
                  <span>
                    {selectedBenefit.serviceId
                      ? serviceMap.get(selectedBenefit.serviceId)?.name ?? selectedBenefit.serviceId
                      : 'All Services'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Coverage Rule</label>
                  <span>
                    <span className={`insurance-chip ${selectedBenefit.coverageRule.toLowerCase()}`}>
                      {selectedBenefit.coverageRule}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Pre-Authorization</label>
                  <span>{selectedBenefit.authorizationRequired ? 'Mandatory' : 'Not Required'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Status</label>
                  <span>
                    <span className={`insurance-chip ${selectedBenefit.status.toLowerCase()}`}>
                      {selectedBenefit.status}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Co-Pay</label>
                  <span>
                    {selectedBenefit.copay
                      ? `${selectedBenefit.copay.value} (${selectedBenefit.copay.type})`
                      : 'None'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Max Amount</label>
                  <span>{selectedBenefit.coverageLimit?.maxAmount?.toLocaleString() ?? 'No Limit'}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="doc-btn" onClick={closeModal} type="button">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Test Verification Modal ───────────────────────────────────────── */}
      <Modal
        onClose={closeModal}
        open={modalMode === 'verify'}
        size="default"
        title="Verify Benefit Coverage"
      >
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="doc-field">
            <label htmlFor="verifyMemberId">
              Select Member <span className="required-asterisk">*</span>
            </label>
            <select
              id="verifyMemberId"
              onChange={(e) => setVerifyMemberId(e.target.value)}
              value={verifyMemberId}
            >
              <option value="">Select Member</option>
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.memberNumber} ({m.relationship})
                </option>
              ))}
            </select>
          </div>

          <div className="doc-field">
            <label htmlFor="verifyServiceId">Service to Verify</label>
            <select
              id="verifyServiceId"
              onChange={(e) => setVerifyServiceId(e.target.value)}
              value={verifyServiceId}
            >
              <option value="">Any / General Verification</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.code})
                </option>
              ))}
            </select>
          </div>

          <div className="doc-field">
            <label htmlFor="verifyQuantity">Requested Quantity</label>
            <input
              id="verifyQuantity"
              type="number"
              min="1"
              onChange={(e) => setVerifyQuantity(Number(e.target.value))}
              value={verifyQuantity}
            />
          </div>

          <button
            className="doc-btn primary"
            disabled={verifying || !verifyMemberId}
            onClick={() => void handleVerifyBenefit()}
            style={{ width: '100%', marginTop: '0.5rem' }}
            type="button"
          >
            {verifying ? (
              <>
                <MedicalSpinner size="sm" /> Verifying...
              </>
            ) : (
              'Execute Verification'
            )}
          </button>

          {verifyResult && (
            <div
              className={`coverage-result-banner ${verifyResult.eligible ? 'valid' : 'invalid'}`}
              style={{ marginTop: '0.5rem' }}
            >
              <div className="coverage-header">
                <div className="coverage-title">
                  <i
                    className={`ph ${verifyResult.eligible ? 'ph-check-circle' : 'ph-x-circle'}`}
                    style={{ fontSize: '1.25rem' }}
                  />
                  <span>
                    {verifyResult.eligible ? 'Eligible for Service' : 'Benefit Excluded or Ineligible'}
                  </span>
                </div>
                <span className="insurance-table-code">{verifyResult.reasonCode}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem' }}>{verifyResult.message}</p>
              <div className="coverage-details-grid" style={{ marginTop: '0.5rem' }}>
                <div className="coverage-detail-item">
                  <label>Rule Status</label>
                  <span>{verifyResult.benefitStatus}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Pre-Auth Required</label>
                  <span>{verifyResult.authorizationRequired ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="coverage-disclaimer">
                Verified against configured hospital benefit rules as of{' '}
                {new Date(verifyResult.verifiedAt).toLocaleTimeString()}.
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="doc-btn" onClick={closeModal} type="button">
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
