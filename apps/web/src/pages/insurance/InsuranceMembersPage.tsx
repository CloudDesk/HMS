import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  insuranceApi,
  type InsuranceMember,
  type InsurancePolicy,
  type MemberStatus,
  type CoverageCheckResult,
} from '../../api/insurance';
import { patientsApi, type PatientResponse } from '../../api/patients';
import { branchesApi, type BranchResponse } from '../../api/branches';
import { ApiError } from '../../api/api-error';
import { Modal } from '../../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../../components/ui/MedicalLoader';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { patientFullName } from '../patient-utils';

const memberFormSchema = z
  .object({
    policyId: z.string().min(1, 'Policy selection is required'),
    patientId: z.string().min(1, 'Patient selection is required'),
    memberNumber: z.string().trim().min(1, 'Member number is required'),
    subscriberId: z.string().optional(),
    relationship: z.enum(['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER']),
    coverageStart: z.string().min(1, 'Coverage start date is required'),
    coverageEnd: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
    branchId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.coverageStart && data.coverageEnd) {
        return new Date(data.coverageStart) <= new Date(data.coverageEnd);
      }
      return true;
    },
    {
      message: 'Coverage end date cannot be earlier than start date',
      path: ['coverageEnd'],
    }
  );

type MemberFormData = z.infer<typeof memberFormSchema>;

export function InsuranceMembersPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canCreate = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Create' }, roles);
  const canEdit = hasPermission(permissions, { module: 'Insurance', screen: 'Configuration', action: 'Edit' }, roles);

  // Filters & State
  const [search, setSearch] = useState('');
  const [policyFilter, setPolicyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [members, setMembers] = useState<InsuranceMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // References
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'coverage' | null>(null);
  const [selectedMember, setSelectedMember] = useState<InsuranceMember | null>(null);
  const [coverageCheckResult, setCoverageCheckResult] = useState<CoverageCheckResult | null>(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      policyId: '',
      patientId: '',
      memberNumber: '',
      subscriberId: '',
      relationship: 'SELF',
      coverageStart: new Date().toISOString().slice(0, 10),
      coverageEnd: '',
      status: 'ACTIVE',
      branchId: '',
    },
  });

  // Load Policies, Patients, Branches
  useEffect(() => {
    insuranceApi.listPolicies({ limit: 100 })
      .then((res) => setPolicies(res.items))
      .catch(() => {});

    patientsApi.list({ limit: 50 })
      .then((res) => setPatients(res.data))
      .catch(() => {});

    branchesApi.list({ limit: 100 })
      .then((res) => setBranches(res.data))
      .catch(() => {});
  }, []);

  // Patient search for form
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) return;
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
    }
  }, []);

  // Load Members
  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await insuranceApi.listMembers({
        memberNumber: search.trim() || undefined,
        policyId: policyFilter || undefined,
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setMembers(res.items);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load members.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, policyFilter, statusFilter, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Lookup maps
  const policyMap = useMemo(() => {
    const map = new Map<string, InsurancePolicy>();
    policies.forEach((p) => map.set(p._id, p));
    return map;
  }, [policies]);

  const patientMap = useMemo(() => {
    const map = new Map<string, PatientResponse>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  // KPIs
  const kpis = useMemo(() => {
    const active = members.filter((m) => m.status === 'ACTIVE').length;
    const inactive = members.filter((m) => m.status !== 'ACTIVE').length;
    return { total, active, inactive };
  }, [members, total]);

  const openCreateModal = () => {
    setSelectedMember(null);
    form.reset({
      policyId: policyFilter || (policies[0]?._id ?? ''),
      patientId: '',
      memberNumber: '',
      subscriberId: '',
      relationship: 'SELF',
      coverageStart: new Date().toISOString().slice(0, 10),
      coverageEnd: '',
      status: 'ACTIVE',
      branchId: '',
    });
    setModalMode('create');
  };

  const openEditModal = (member: InsuranceMember) => {
    setSelectedMember(member);
    form.reset({
      policyId: member.policyId,
      patientId: member.patientId,
      memberNumber: member.memberNumber,
      subscriberId: member.subscriberId ?? '',
      relationship: member.relationship,
      coverageStart: member.coverageStart ? member.coverageStart.slice(0, 10) : '',
      coverageEnd: member.coverageEnd ? member.coverageEnd.slice(0, 10) : '',
      status: member.status,
      branchId: member.branchId ?? '',
    });
    setModalMode('edit');
  };

  const openViewModal = (member: InsuranceMember) => {
    setSelectedMember(member);
    setModalMode('view');
  };

  const openCoverageCheckModal = async (member: InsuranceMember) => {
    setSelectedMember(member);
    setCoverageCheckResult(null);
    setCheckingCoverage(true);
    setModalMode('coverage');
    try {
      const res = await insuranceApi.getMemberCoverageStatus(member._id);
      setCoverageCheckResult(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coverage check failed.';
      toast.error(msg);
    } finally {
      setCheckingCoverage(false);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedMember(null);
    setCoverageCheckResult(null);
    form.reset();
  };

  const onSubmit = async (data: MemberFormData) => {
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await insuranceApi.createMember({
          policyId: data.policyId,
          patientId: data.patientId,
          memberNumber: data.memberNumber.trim(),
          subscriberId: data.subscriberId?.trim() || null,
          relationship: data.relationship,
          coverageStart: data.coverageStart,
          coverageEnd: data.coverageEnd || null,
          status: data.status,
          branchId: data.branchId ? data.branchId : null,
        });
        toast.success(`Insurance member "${data.memberNumber}" registered successfully.`);
      } else if (modalMode === 'edit' && selectedMember) {
        await insuranceApi.updateMember(selectedMember._id, {
          memberNumber: data.memberNumber.trim(),
          subscriberId: data.subscriberId?.trim() || null,
          relationship: data.relationship,
          coverageStart: data.coverageStart,
          coverageEnd: data.coverageEnd || null,
          status: data.status,
          branchId: data.branchId ? data.branchId : null,
        });
        toast.success(`Insurance member "${data.memberNumber}" updated successfully.`);
      }

      closeModal();
      await loadMembers();
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
      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="um-kpi-row" aria-label="Insurance Member Statistics">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <i className="ph ph-identification-card" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Members</span>
            <span className="kpi-value">{loading ? '—' : kpis.total}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green">
            <i className="ph ph-check-circle" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Coverage</span>
            <span className="kpi-value">{loading ? '—' : kpis.active}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange">
            <i className="ph ph-prohibit" aria-hidden="true" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Suspended / Inactive</span>
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
                placeholder="Search by member number..."
                type="search"
                value={search}
              />
            </div>
            {canCreate && (
              <button className="doc-btn primary" onClick={openCreateModal} type="button">
                <i className="ph ph-plus" aria-hidden="true" /> Add Member
              </button>
            )}
            <button className="doc-btn" onClick={() => void loadMembers()} type="button">
              <i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh
            </button>
          </div>

          <div className="um-toolbar-row2">
            <span className="filter-label">Filter:</span>
            <select
              className="um-filter"
              onChange={(e) => {
                setPolicyFilter(e.target.value);
                setPage(1);
              }}
              value={policyFilter}
            >
              <option value="">All Policies</option>
              {policies.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.policyNumber}
                </option>
              ))}
            </select>

            <select
              className="um-filter"
              onChange={(e) => {
                setStatusFilter(e.target.value as MemberStatus | '');
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            {(search || policyFilter || statusFilter) && (
              <button
                className="um-clear-btn"
                onClick={() => {
                  setSearch('');
                  setPolicyFilter('');
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
              <MedicalLoader size="large" text="Loading insurance members..." />
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <i className="ph ph-users" style={{ fontSize: '2.5rem', color: '#94a3b8' }} />
              <h4 style={{ margin: '0.75rem 0 0.25rem', color: '#1e293b' }}>No Members Found</h4>
              <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
                {search || policyFilter || statusFilter
                  ? 'No members match your filter criteria.'
                  : 'No insurance memberships registered yet.'}
              </p>
              {canCreate && !search && (
                <button className="doc-btn primary" onClick={openCreateModal} style={{ marginTop: '1rem' }} type="button">
                  <i className="ph ph-plus" aria-hidden="true" /> Register Member
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member Number</th>
                  <th>Patient Name (MRN)</th>
                  <th>Linked Policy</th>
                  <th>Relationship</th>
                  <th>Coverage Validity</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const patient = patientMap.get(member.patientId);
                  const policy = policyMap.get(member.policyId);
                  const patientName = patient ? patientFullName(patient) : `Patient: ${member.patientId.slice(-6)}`;

                  return (
                    <tr key={member._id}>
                      <td>
                        <strong className="insurance-table-code">{member.memberNumber}</strong>
                        {member.subscriberId && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Sub: {member.subscriberId}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{patientName}</div>
                        {patient && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>MRN: {patient.patient_number}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {policy ? policy.policyNumber : 'Policy Ref'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>{member.relationship}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {member.coverageStart ? member.coverageStart.slice(0, 10) : '—'} –{' '}
                        {member.coverageEnd ? member.coverageEnd.slice(0, 10) : 'Open'}
                      </td>
                      <td>
                        <span className={`insurance-chip ${member.status.toLowerCase()}`}>
                          {member.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="doc-btn primary"
                            onClick={() => openCoverageCheckModal(member)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="Check Local Coverage"
                            type="button"
                          >
                            <i className="ph ph-shield-check" aria-hidden="true" /> Check
                          </button>
                          <button
                            className="doc-btn"
                            onClick={() => openViewModal(member)}
                            style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                            title="View Details"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" /> View
                          </button>
                          {canEdit && (
                            <button
                              className="doc-btn"
                              onClick={() => openEditModal(member)}
                              style={{ height: '32px', minHeight: '32px', padding: '0 0.65rem' }}
                              title="Edit Member"
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
              Showing {members.length === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total} members
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
        title={modalMode === 'create' ? 'Register Insurance Member' : `Edit Member: ${selectedMember?.memberNumber}`}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="insurance-form-grid">
              <div className={`doc-field ${form.formState.errors.policyId ? 'has-error' : ''}`}>
                <label htmlFor="policyId">
                  Linked Policy <span className="required-asterisk">*</span>
                </label>
                <select
                  id="policyId"
                  {...form.register('policyId')}
                  disabled={modalMode === 'edit' || submitting}
                >
                  <option value="">Select Insurance Policy</option>
                  {policies.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.policyNumber}
                    </option>
                  ))}
                </select>
                {form.formState.errors.policyId && (
                  <span className="field-error-msg">{form.formState.errors.policyId.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.patientId ? 'has-error' : ''}`}>
                <label htmlFor="patientId">
                  Patient Member <span className="required-asterisk">*</span>
                </label>
                {modalMode === 'edit' ? (
                  <input
                    disabled
                    value={
                      patientMap.get(selectedMember?.patientId ?? '')
                        ? patientFullName(patientMap.get(selectedMember?.patientId ?? '')!)
                        : selectedMember?.patientId ?? ''
                    }
                  />
                ) : (
                  <div>
                    <input
                      placeholder="Search patient by name/MRN..."
                      style={{ marginBottom: '4px', fontSize: '0.8rem' }}
                      value={patientSearchQuery}
                      onChange={(e) => {
                        setPatientSearchQuery(e.target.value);
                        void searchPatients(e.target.value);
                      }}
                    />
                    <select id="patientId" {...form.register('patientId')} disabled={submitting}>
                      <option value="">Select Existing Patient</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {patientFullName(p)} ({p.patient_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {form.formState.errors.patientId && (
                  <span className="field-error-msg">{form.formState.errors.patientId.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.memberNumber ? 'has-error' : ''}`}>
                <label htmlFor="memberNumber">
                  Member Number <span className="required-asterisk">*</span>
                </label>
                <input
                  id="memberNumber"
                  placeholder="e.g. MEM-982341"
                  {...form.register('memberNumber')}
                  disabled={submitting}
                />
                {form.formState.errors.memberNumber && (
                  <span className="field-error-msg">{form.formState.errors.memberNumber.message}</span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="subscriberId">Subscriber / Principal ID (Optional)</label>
                <input
                  id="subscriberId"
                  placeholder="Principal member ID if dependent"
                  {...form.register('subscriberId')}
                  disabled={submitting}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="relationship">Relationship to Principal</label>
                <select id="relationship" {...form.register('relationship')} disabled={submitting}>
                  <option value="SELF">Self (Principal)</option>
                  <option value="SPOUSE">Spouse</option>
                  <option value="CHILD">Child</option>
                  <option value="PARENT">Parent</option>
                  <option value="OTHER">Other Dependent</option>
                </select>
              </div>

              <div className="doc-field">
                <label htmlFor="status">Coverage Status</label>
                <select id="status" {...form.register('status')} disabled={submitting}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className={`doc-field ${form.formState.errors.coverageStart ? 'has-error' : ''}`}>
                <label htmlFor="coverageStart">
                  Coverage Start <span className="required-asterisk">*</span>
                </label>
                <input id="coverageStart" type="date" {...form.register('coverageStart')} disabled={submitting} />
                {form.formState.errors.coverageStart && (
                  <span className="field-error-msg">{form.formState.errors.coverageStart.message}</span>
                )}
              </div>

              <div className={`doc-field ${form.formState.errors.coverageEnd ? 'has-error' : ''}`}>
                <label htmlFor="coverageEnd">Coverage End (Optional)</label>
                <input id="coverageEnd" type="date" {...form.register('coverageEnd')} disabled={submitting} />
                {form.formState.errors.coverageEnd && (
                  <span className="field-error-msg">{form.formState.errors.coverageEnd.message}</span>
                )}
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
                'Register Member'
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
        open={modalMode === 'view' && Boolean(selectedMember)}
        size="default"
        title={`Member: ${selectedMember?.memberNumber}`}
      >
        {selectedMember && (
          <div>
            <div className="modal-body">
              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Member Number</label>
                  <span className="insurance-table-code">{selectedMember.memberNumber}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Status</label>
                  <span>
                    <span className={`insurance-chip ${selectedMember.status.toLowerCase()}`}>
                      {selectedMember.status}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Patient</label>
                  <span>
                    {patientMap.get(selectedMember.patientId)
                      ? patientFullName(patientMap.get(selectedMember.patientId)!)
                      : selectedMember.patientId}
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Relationship</label>
                  <span>{selectedMember.relationship}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Linked Policy</label>
                  <span>{policyMap.get(selectedMember.policyId)?.policyNumber ?? selectedMember.policyId}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Subscriber ID</label>
                  <span>{selectedMember.subscriberId || 'None'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Coverage Start</label>
                  <span>{selectedMember.coverageStart.slice(0, 10)}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Coverage End</label>
                  <span>{selectedMember.coverageEnd ? selectedMember.coverageEnd.slice(0, 10) : 'Open'}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="doc-btn" onClick={closeModal} type="button">
                Close
              </button>
              <button
                className="doc-btn primary"
                onClick={() => {
                  void openCoverageCheckModal(selectedMember);
                }}
                type="button"
              >
                <i className="ph ph-shield-check" aria-hidden="true" /> Check Coverage
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Coverage Check Modal ──────────────────────────────────────────── */}
      <Modal
        onClose={closeModal}
        open={modalMode === 'coverage' && Boolean(selectedMember)}
        size="default"
        title="Local Insurance Coverage Status"
      >
        <div className="modal-body">
          {checkingCoverage ? (
            <div style={{ padding: '2.5rem 0' }}>
              <MedicalLoader size="medium" text="Verifying local coverage status..." />
            </div>
          ) : coverageCheckResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={`coverage-result-banner ${coverageCheckResult.valid ? 'valid' : 'invalid'}`}>
                <div className="coverage-header">
                  <div className="coverage-title">
                    <i
                      className={`ph ${coverageCheckResult.valid ? 'ph-check-circle' : 'ph-x-circle'}`}
                      style={{ fontSize: '1.25rem' }}
                    />
                    <span>
                      {coverageCheckResult.valid ? 'Local Coverage Valid' : 'Coverage Inactive or Invalid'}
                    </span>
                  </div>
                  <span className="insurance-table-code">{coverageCheckResult.reasonCode}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: coverageCheckResult.valid ? '#166534' : '#991b1b' }}>
                  {coverageCheckResult.message}
                </p>

                <div className="coverage-disclaimer">
                  <strong>Notice:</strong> This verification represents local hospital policy records only.
                  It does <em>not</em> constitute confirmed National SHA eligibility.
                </div>
              </div>

              <div className="coverage-details-grid">
                <div className="coverage-detail-item">
                  <label>Member Number</label>
                  <span>{coverageCheckResult.memberNumber || selectedMember?.memberNumber}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>National SHA Eligibility</label>
                  <span>
                    <span className="insurance-chip other">
                      {coverageCheckResult.shaEligibilityStatus === 'NOT_VERIFIED'
                        ? 'Not Verified with SHA'
                        : coverageCheckResult.shaEligibilityStatus}
                    </span>
                  </span>
                </div>
                <div className="coverage-detail-item">
                  <label>Policy Number</label>
                  <span>{coverageCheckResult.policyNumber || '—'}</span>
                </div>
                <div className="coverage-detail-item">
                  <label>Verified At</label>
                  <span>{new Date(coverageCheckResult.checkedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="dialog-message">No verification data available.</p>
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
