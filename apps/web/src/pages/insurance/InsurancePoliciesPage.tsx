import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type InsurancePolicy,
  type InsurancePayer,
  type InsuranceScheme,
  type PolicyStatus,
} from '../../api/insurance';
import { patientsApi, type PatientResponse } from '../../api/patients';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { patientFullName } from '../patient-utils';

const policyFormSchema = z
  .object({
    payerId: z.string().min(1, 'Insurance payer is required'),
    schemeId: z.string().min(1, 'Insurance scheme is required'),
    policyNumber: z.string().trim().min(1, 'Policy number is required'),
    holderPatientId: z.string().min(1, 'Policyholder patient is required'),
    holderType: z.enum(['SELF', 'DEPENDENT', 'OTHER']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED']),
    copayPercentage: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
    annualLimit: z.coerce.number().min(0).optional().or(z.literal('')),
    remarks: z.string().optional(),
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

type PolicyFormInput = z.input<typeof policyFormSchema>;
type PolicyFormData = z.output<typeof policyFormSchema>;

export function InsurancePoliciesPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canCreate = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Create' }, roles);
  const canEdit = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Edit' }, roles);

  // Filters & State
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Reference data
  const [payers, setPayers] = useState<InsurancePayer[]>([]);
  const [schemes, setSchemes] = useState<InsuranceScheme[]>([]);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);

  const form = useForm<PolicyFormInput, unknown, PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      payerId: '',
      schemeId: '',
      policyNumber: '',
      holderPatientId: '',
      holderType: 'SELF',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'ACTIVE',
      copayPercentage: '',
      annualLimit: '',
      remarks: '',
    },
  });

  const selectedFormPayerId = form.watch('payerId');

  // Filter schemes available for selected payer in the form
  const availableFormSchemes = useMemo(() => {
    if (!selectedFormPayerId) return schemes;
    return schemes.filter((s) => s.payerId === selectedFormPayerId);
  }, [schemes, selectedFormPayerId]);

  // Load payers, schemes, and initial patient list
  useEffect(() => {
    insuranceApi.listPayers({ limit: 100 })
      .then((res) => setPayers(res.items))
      .catch(() => {});

    insuranceApi.listSchemes({ limit: 100 })
      .then((res) => setSchemes(res.items))
      .catch(() => {});

    patientsApi.list({ limit: 50 })
      .then((res) => setPatients(res.data))
      .catch(() => {});
  }, []);

  // Patient search for form dropdown
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearchingPatients(true);
    try {
      const res = await patientsApi.list({ search: query.trim(), limit: 20 });
      setPatients((prev) => {
        const map = new Map<string, PatientResponse>();
        prev.forEach((p) => map.set(p.id, p));
        res.data.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      });
    } catch {
      // ignore
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  // Load Policies
  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listPolicies({
        policyNumber: search.trim() || undefined,
        payerId: payerFilter || undefined,
        schemeId: schemeFilter || undefined,
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setPolicies(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load policies.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, payerFilter, schemeFilter, statusFilter, page]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  // Lookup Maps
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

  const patientMap = useMemo(() => {
    const map = new Map<string, PatientResponse>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  // KPIs
  const kpis = useMemo(() => {
    const active = policies.filter((p) => p.status === 'ACTIVE').length;
    const expiredOrSuspended = policies.filter((p) => p.status === 'EXPIRED' || p.status === 'SUSPENDED').length;
    return { total, active, expiredOrSuspended };
  }, [policies, total]);

  const openCreateModal = () => {
    setSelectedPolicy(null);
    form.reset({
      payerId: payerFilter || (payers[0]?._id ?? ''),
      schemeId: schemeFilter || '',
      policyNumber: '',
      holderPatientId: '',
      holderType: 'SELF',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'ACTIVE',
      copayPercentage: '',
      annualLimit: '',
      remarks: '',
    });
    setModalMode('create');
  };

  const openEditModal = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
    form.reset({
      payerId: policy.payerId,
      schemeId: policy.schemeId,
      policyNumber: policy.policyNumber,
      holderPatientId: policy.holderPatientId,
      holderType: policy.holderType ?? 'SELF',
      startDate: policy.startDate ? policy.startDate.slice(0, 10) : '',
      endDate: policy.endDate ? policy.endDate.slice(0, 10) : '',
      status: policy.status,
      copayPercentage: policy.coverageDetails?.copayPercentage ?? '',
      annualLimit: policy.coverageDetails?.annualLimit ?? '',
      remarks: policy.coverageDetails?.remarks ?? '',
    });
    setModalMode('edit');
  };

  const openViewModal = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedPolicy(null);
    form.reset();
  };

  const onSubmit = async (data: PolicyFormData) => {
    setSubmitting(true);
    try {
      const coverageDetails = {
        copayPercentage: typeof data.copayPercentage === 'number' ? data.copayPercentage : null,
        annualLimit: typeof data.annualLimit === 'number' ? data.annualLimit : null,
        remarks: data.remarks?.trim() || null,
      };

      if (modalMode === 'create') {
        await insuranceApi.createPolicy({
          payerId: data.payerId,
          schemeId: data.schemeId,
          policyNumber: data.policyNumber.trim(),
          holderPatientId: data.holderPatientId,
          holderType: data.holderType,
          startDate: data.startDate,
          endDate: data.endDate || null,
          status: data.status,
          coverageDetails,
        });
        toast.success(`Insurance policy "${data.policyNumber}" created successfully.`);
      } else if (modalMode === 'edit' && selectedPolicy) {
        await insuranceApi.updatePolicy(selectedPolicy._id, {
          policyNumber: data.policyNumber.trim(),
          holderType: data.holderType,
          startDate: data.startDate,
          endDate: data.endDate || null,
          status: data.status,
          coverageDetails,
        });
        toast.success(`Insurance policy "${data.policyNumber}" updated successfully.`);
      }

      closeModal();
      await loadPolicies();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Action failed. Please check form inputs.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="insurance-page">
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="Policy Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-file-text" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Policies</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Policies</span>
            <span className="kpi-value">{loading ? '—' : kpis.active}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-warning-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Expired / Suspended</span>
            <span className="kpi-value">{loading ? '—' : kpis.expiredOrSuspended}</span>
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
                placeholder="Search by policy number..."
                type="search"
                value={search}
              />
            </div>
            {canCreate && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Policy
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadPolicies()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>

          <div className="um-toolbar-row2">
            <span className="filter-label">Filter:</span>
            <select
              className="um-filter"
              onChange={(e) => {
                setPayerFilter(e.target.value);
                setSchemeFilter('');
                setPage(1);
              }}
              value={payerFilter}
            >
              <option value="">All Payers</option>
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

            <select
              className="um-filter"
              onChange={(e) => {
                setStatusFilter(e.target.value as PolicyStatus | '');
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            {(search || payerFilter || schemeFilter || statusFilter) && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setSearch('');
                  setPayerFilter('');
                  setSchemeFilter('');
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
              <MedicalLoader size="large" text="Loading insurance policies..." />
            </div>
          ) : policies.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-file-x" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No Policies Found</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {search || payerFilter || schemeFilter || statusFilter
                  ? 'No policies match your filter criteria.'
                  : 'No insurance policies recorded yet.'}
              </p>
              {canCreate && !search && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Add First Policy
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Policy Number</th>
                  <th>Payer & Scheme</th>
                  <th>Policyholder</th>
                  <th>Holder Type</th>
                  <th>Coverage Period</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const payer = payerMap.get(policy.payerId);
                  const scheme = schemeMap.get(policy.schemeId);
                  const patient = patientMap.get(policy.holderPatientId);
                  const patientName = patient ? patientFullName(patient) : `Patient Ref: ${policy.holderPatientId.slice(-6)}`;

                  return (
                    <tr key={policy._id}>
                      <td>
                        <strong className="insurance-table-code">{policy.policyNumber}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{payer?.name ?? 'Unknown Payer'}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{scheme?.name ?? 'Scheme Ref'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{patientName}</div>
                        {patient && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>MRN: {patient.patient_number}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>{policy.holderType ?? 'SELF'}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {policy.startDate ? policy.startDate.slice(0, 10) : '—'} –{' '}
                        {policy.endDate ? policy.endDate.slice(0, 10) : 'Open'}
                      </td>
                      <td>
                        <span className={`insurance-chip ${policy.status.toLowerCase()}`}>
                          {policy.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="doc-btn"
                            onClick={() => openViewModal(policy)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="View Details"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" /> View
                          </button>
                          {canEdit && (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(policy)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Edit Policy"
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
              Showing {policies.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} policies
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
        title={modalMode === 'create' ? 'Create Insurance Policy' : `Edit Policy: ${selectedPolicy?.policyNumber}`}
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

              <div className={`doc-field ${form.formState.errors.schemeId ? 'has-error' : ''}`}>
                <label htmlFor="schemeId">
                  Insurance Scheme <span className="required-asterisk">*</span>
                </label>
                <select
                  id="schemeId"
                  {...form.register('schemeId')}
                  disabled={modalMode === 'edit' || submitting}
                >
                  <option value="">Select Insurance Scheme</option>
                  {availableFormSchemes.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.schemeCode})
                    </option>
                  ))}
                </select>
                {form.formState.errors.schemeId && (
                  <span className="field-error-msg">{form.formState.errors.schemeId.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.policyNumber ? 'has-error' : ''}`}>
                <label htmlFor="policyNumber">
                  Policy Number <span className="required-asterisk">*</span>
                </label>
                <input
                  id="policyNumber"
                  placeholder="e.g. POL-2026-9042"
                  {...form.register('policyNumber')}
                  disabled={submitting}
                />
                {form.formState.errors.policyNumber && (
                  <span className="field-error-msg">{form.formState.errors.policyNumber.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.holderPatientId ? 'has-error' : ''}`}>
                <label htmlFor="holderPatientId">
                  Policyholder Patient <span className="required-asterisk">*</span>
                </label>
                {modalMode === 'edit' ? (
                  <input
                    disabled
                    value={
                      patientMap.get(selectedPolicy?.holderPatientId ?? '')
                        ? patientFullName(patientMap.get(selectedPolicy?.holderPatientId ?? '')!)
                        : selectedPolicy?.holderPatientId ?? ''
                    }
                  />
                ) : (
                  <div>
                    <input
                      placeholder="Type to search patients by name/MRN..."
                      style={{ marginBottom: '4px', fontSize: '0.8rem' }}
                      value={patientSearchQuery}
                      onChange={(e) => {
                        setPatientSearchQuery(e.target.value);
                        void searchPatients(e.target.value);
                      }}
                    />
                    {searchingPatients && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Searching patients...</span>}
                    <select id="holderPatientId" {...form.register('holderPatientId')} disabled={submitting}>
                      <option value="">Select Existing Patient</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {patientFullName(p)} ({p.patient_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {form.formState.errors.holderPatientId && (
                  <span className="field-error-msg">{form.formState.errors.holderPatientId.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="holderType">Holder Relationship</label>
                <select id="holderType" {...form.register('holderType')} disabled={submitting}>
                  <option value="SELF">Self (Principal Member)</option>
                  <option value="DEPENDENT">Dependent</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="status">Policy Status</label>
                <select id="status" {...form.register('status')} disabled={submitting}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className={`doc-field ${form.formState.errors.startDate ? 'has-error' : ''}`}>
                <label htmlFor="startDate">
                  Start Date <span className="required-asterisk">*</span>
                </label>
                <input id="startDate" type="date" {...form.register('startDate')} disabled={submitting} />
                {form.formState.errors.startDate && (
                  <span className="field-error-msg">{form.formState.errors.startDate.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.endDate ? 'has-error' : ''}`}>
                <label htmlFor="endDate">End Date (Optional)</label>
                <input id="endDate" type="date" {...form.register('endDate')} disabled={submitting} />
                {form.formState.errors.endDate && (
                  <span className="field-error-msg">{form.formState.errors.endDate.message}</span>
                )}
              </div>

              <div className="insurance-section-title">Coverage Terms & Limits</div>

              <div className="doc-field">
                <label htmlFor="copayPercentage">Co-pay Percentage (%)</label>
                <input
                  id="copayPercentage"
                  type="number"
                  placeholder="e.g. 10"
                  min="0"
                  max="100"
                  {...form.register('copayPercentage')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="annualLimit">Annual Limit Amount</label>
                <input
                  id="annualLimit"
                  type="number"
                  placeholder="e.g. 500000"
                  min="0"
                  {...form.register('annualLimit')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field full-width" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="remarks">Coverage Remarks</label>
                <input
                  id="remarks"
                  placeholder="Special conditions, exclusions, or notes"
                  {...form.register('remarks')}
                  disabled={submitting}
                />
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
                'Create Policy'
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
        open={modalMode === 'view' && Boolean(selectedPolicy)}
        size="default"
        title={`Policy: ${selectedPolicy?.policyNumber}`}
      >
        {selectedPolicy && (
          <div>
            <div className="modal-body">
              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Policy Number</label>
                  <span className="insurance-table-code">{selectedPolicy.policyNumber}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Status</label>
                  <span>
                    <span className={`insurance-chip ${selectedPolicy.status.toLowerCase()}`}>
                      {selectedPolicy.status}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Payer</label>
                  <span>{payerMap.get(selectedPolicy.payerId)?.name ?? selectedPolicy.payerId}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Scheme</label>
                  <span>{schemeMap.get(selectedPolicy.schemeId)?.name ?? selectedPolicy.schemeId}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Policyholder</label>
                  <span>
                    {patientMap.get(selectedPolicy.holderPatientId)
                      ? patientFullName(patientMap.get(selectedPolicy.holderPatientId)!)
                      : selectedPolicy.holderPatientId}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Holder Type</label>
                  <span>{selectedPolicy.holderType ?? 'SELF'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Valid Start</label>
                  <span>{selectedPolicy.startDate.slice(0, 10)}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Valid End</label>
                  <span>{selectedPolicy.endDate ? selectedPolicy.endDate.slice(0, 10) : 'Open'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Co-Pay (%)</label>
                  <span>
                    {selectedPolicy.coverageDetails?.copayPercentage !== null &&
                    selectedPolicy.coverageDetails?.copayPercentage !== undefined
                      ? `${selectedPolicy.coverageDetails.copayPercentage}%`
                      : 'None specified'}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Annual Limit</label>
                  <span>
                    {selectedPolicy.coverageDetails?.annualLimit
                      ? selectedPolicy.coverageDetails.annualLimit.toLocaleString()
                      : 'Unlimited'}
                  </span>
                </div>
              </div>
              {selectedPolicy.coverageDetails?.remarks && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.84rem', color: '#475569' }}>
                  <strong>Remarks:</strong> {selectedPolicy.coverageDetails.remarks}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="doc-btn" onClick={closeModal} type="button">
                Close
              </button>
              {canEdit && (
                <button
                  className="doc-btn primary"
                  onClick={() => openEditModal(selectedPolicy)}
                  type="button"
                >
                  <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Policy
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
