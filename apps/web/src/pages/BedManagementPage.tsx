import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import type { Bed, BedStatus } from '../api/admissions-configuration';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useBedManagementFeature } from '../hooks/admissions/useBedManagementFeature';
import { navigate, useAppLocation } from '../routing/navigation';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
const policySchema = z.object({ bed_hold_duration_minutes: z.coerce.number().int().min(5).max(240), admission_consent_required: z.boolean(), admission_advance_deposit_required: z.boolean(), admission_minimum_deposit_amount: z.coerce.number().min(0).max(100000000) }).superRefine((value, context) => { if (!value.admission_advance_deposit_required && value.admission_minimum_deposit_amount !== 0) context.addIssue({ code: 'custom', path: ['admission_minimum_deposit_amount'], message: 'Set the amount to zero when a deposit is not required' }); });
const holdSchema = z.object({ patient_id: objectId, reason: z.string().trim().min(3).max(500) });
const transferSchema = z.object({ destination_branch_id: objectId, destination_ward_id: objectId, destination_bed_id: objectId, reason: z.string().trim().min(3).max(500) });
const statusSchema = z.object({ status: z.enum(['AVAILABLE', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE']), reason: z.string().trim().max(500) }).superRefine((value, context) => { if ((value.status === 'BLOCKED' || value.status === 'UNDER_MAINTENANCE') && !value.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required' }); });

type ModalName = 'policy' | 'hold' | 'transfer' | 'status' | null;
type PolicyFormInput = z.input<typeof policySchema>;
type PolicyForm = z.output<typeof policySchema>;
type HoldForm = z.infer<typeof holdSchema>;
type TransferForm = z.infer<typeof transferSchema>;
type StatusForm = z.infer<typeof statusSchema>;
type ConfirmAction = { type: 'release-hold' | 'cancel-hold'; id: string; label: string } | null;

const statusTone = (status: string) => status === 'AVAILABLE' || status === 'ACTIVE' ? 'green' as const : status === 'OCCUPIED' ? 'red' as const : status === 'RESERVED' ? 'orange' as const : status === 'BLOCKED' ? 'purple' as const : 'gray' as const;
const formatStatus = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (value) => value.toUpperCase());
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'The bed lifecycle request could not be completed.';

export function BedManagementPage() {
  const location = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [patientSearch, setPatientSearch] = useState('');

  const requestedBranchId = searchParams.get('branch') ?? '';
  const search = searchParams.get('search') ?? '';
  const statusValue = searchParams.get('status') ?? '';
  const status = (['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as BedStatus[]).includes(statusValue as BedStatus) ? statusValue as BedStatus : undefined;
  const wardId = searchParams.get('ward') ?? '';
  const page = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const transferDestinationBranchId = transferSchema.shape.destination_branch_id.safeParse(searchParams.get('destination_branch')).success ? searchParams.get('destination_branch') ?? '' : '';

  const feature = useBedManagementFeature({ branchId: requestedBranchId, search, status, wardId, page, limit: 24, patientSearch, patientLookupEnabled: modal === 'hold', transferLookupEnabled: modal === 'transfer', transferDestinationBranchId });
  const { configuration, permissions } = feature;
  const branchId = feature.branchId;
  const wards = configuration.wardsQuery.data?.data ?? [];
  const beds = configuration.bedsQuery.data?.data ?? [];
  const bedMeta = configuration.bedsQuery.data?.meta;
  const summary = configuration.summaryQuery.data ?? { total: 0, available: 0, occupied: 0, reserved: 0, blocked: 0, under_maintenance: 0, inactive: 0 };
  const patients = feature.patientsQuery.data?.data ?? [];
  const transferWards = feature.transferOptions.wardsQuery.data?.data ?? [];
  const transferBeds = feature.transferOptions.bedsQuery.data?.data ?? [];
  const loading = configuration.wardsQuery.isLoading || configuration.bedsQuery.isLoading || configuration.summaryQuery.isLoading;

  const policyForm = useForm<PolicyFormInput, unknown, PolicyForm>({ resolver: zodResolver(policySchema), defaultValues: { bed_hold_duration_minutes: 30, admission_consent_required: false, admission_advance_deposit_required: false, admission_minimum_deposit_amount: 0 } });
  const holdForm = useForm<HoldForm>({ resolver: zodResolver(holdSchema), defaultValues: { patient_id: '', reason: '' } });
  const transferForm = useForm<TransferForm>({ resolver: zodResolver(transferSchema), defaultValues: { destination_branch_id: branchId, destination_ward_id: '', destination_bed_id: '', reason: '' } });
  const statusForm = useForm<StatusForm>({ resolver: zodResolver(statusSchema), defaultValues: { status: 'AVAILABLE', reason: '' } });

  useEffect(() => {
    const policy = configuration.policyQuery.data;
    if (policy) policyForm.reset({ bed_hold_duration_minutes: policy.bed_hold_duration_minutes, admission_consent_required: policy.admission_consent_required, admission_advance_deposit_required: policy.admission_advance_deposit_required, admission_minimum_deposit_amount: policy.admission_minimum_deposit_amount });
  }, [configuration.policyQuery.data, policyForm]);
  useEffect(() => { if (modal === 'transfer') transferForm.reset({ destination_branch_id: branchId, destination_ward_id: '', destination_bed_id: '', reason: '' }); }, [branchId, modal, transferForm]);
  useEffect(() => {
    setSelectedBed((current) => current ? beds.find((bed) => bed.id === current.id) ?? null : null);
  }, [beds]);

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.set('page', '1');
    const suffix = next.toString();
    navigate(`/admissions/beds${suffix ? `?${suffix}` : ''}`, { replace: true });
  };
  const selectedDestinationWard = transferForm.watch('destination_ward_id');
  const availableTransferBeds = useMemo(() => transferBeds.filter((bed) => !selectedDestinationWard || bed.ward_id === selectedDestinationWard), [selectedDestinationWard, transferBeds]);

  const submitPolicy = policyForm.handleSubmit(async (values) => { try { await configuration.savePolicy.mutateAsync({ branch_id: branchId, ...values }); toast.success('Admission policy saved.'); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitHold = holdForm.handleSubmit(async (values) => { if (!selectedBed) return; try { await configuration.createHold.mutateAsync({ bedId: selectedBed.id, body: { branch_id: branchId, patient_id: values.patient_id, reason: values.reason, idempotency_key: crypto.randomUUID() } }); toast.success('Bed held successfully.'); holdForm.reset(); setPatientSearch(''); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitTransfer = transferForm.handleSubmit(async (values) => { if (!selectedBed?.current_admission_id) return; try { const crossBranch = values.destination_branch_id !== branchId; await configuration.transfer.mutateAsync({ admissionId: selectedBed.current_admission_id, body: { branch_id: branchId, ...values }, crossBranch }); toast.success('Bed transfer completed.'); transferForm.reset(); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitStatus = statusForm.handleSubmit(async (values) => { if (!selectedBed) return; try { await configuration.bedStatus.mutateAsync({ id: selectedBed.id, body: { branch_id: branchId, status: values.status, reason: values.reason || null } }); toast.success(`Bed marked ${formatStatus(values.status)}.`); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    try {
      if ((confirmAction.type === 'release-hold' || confirmAction.type === 'cancel-hold') && selectedBed?.current_hold_id) { const mutation = confirmAction.type === 'release-hold' ? configuration.releaseHold : configuration.cancelHold; await mutation.mutateAsync({ holdId: selectedBed.current_hold_id, body: { branch_id: branchId, reason: confirmAction.type === 'release-hold' ? 'Released by bed management user' : 'Cancelled by bed management user' } }); toast.success(confirmAction.type === 'release-hold' ? 'Bed hold released.' : 'Bed hold cancelled.'); }
      setConfirmAction(null);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const [activeSubTab, setActiveSubTab] = useState<'ward-overview' | 'bed-allocation'>('ward-overview');

  if (!branchId && feature.isSuperAdmin && feature.branchQuery.isLoading) return <div className="admin-dashboard-state"><strong>Loading authorized branches</strong><span>Fetching active branches.</span></div>;
  if (!branchId) return <div className="admin-dashboard-state admin-dashboard-state--error"><strong>No authorized branch</strong><span>Assign this user to an active branch before managing beds.</span></div>;

  return <div className="page-shell bed-management-page">
    <header className="bed-management-header" style={{ marginBottom: '1rem' }}>
      <div>
        <h1>Bed Management</h1>
        <p>Ward capacity, room allocation and bed assignment</p>
      </div>
      <div className="bed-management-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select aria-label="Branch" value={branchId} onChange={(event) => updateParam('branch', event.target.value)} style={{ height: '38px', borderRadius: '6px' }}>
          {feature.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button className="btn-secondary" type="button" onClick={() => window.print()}>
          <i className="ph ph-printer" /> Print Bed List
        </button>
        <button className="btn-primary" type="button" onClick={() => setModal('hold')}>
          <i className="ph ph-user-plus" /> Select Patient
        </button>
        {permissions.canViewPolicy && <button className="btn-secondary" type="button" onClick={() => setModal('policy')}><i className="ph ph-sliders-horizontal" /> Policy</button>}
      </div>
    </header>

    {permissions.canViewPolicy && configuration.policyQuery.isError && <div className="bed-policy-alert"><i className="ph ph-warning-circle" /><div><strong>Admission policy required</strong><span>Configure hold duration before beds can be reserved or allotted.</span></div>{permissions.canEditPolicy && <button className="btn-secondary compact" onClick={() => setModal('policy')} type="button">Configure</button>}</div>}

    {/* 4 Modern KPI Cards */}
    <section className="surgery-kpi-grid" style={{ marginBottom: '1.25rem' }}>
      <div className="surgery-kpi-card blue">
        <div className="surgery-kpi-icon"><i className="ph ph-bed" /></div>
        <div className="surgery-kpi-body">
          <span>Total Beds</span>
          <strong>{summary.total}</strong>
          <small style={{ fontSize: '0.72rem', color: '#64748b' }}>Registered capacity</small>
        </div>
      </div>
      <div className="surgery-kpi-card green">
        <div className="surgery-kpi-icon"><i className="ph ph-check-circle" /></div>
        <div className="surgery-kpi-body">
          <span>Available Beds</span>
          <strong>{summary.available}</strong>
          <small style={{ fontSize: '0.72rem', color: '#16a34a' }}>Ready now</small>
        </div>
      </div>
      <div className="surgery-kpi-card orange">
        <div className="surgery-kpi-icon"><i className="ph ph-user" /></div>
        <div className="surgery-kpi-body">
          <span>Occupied Beds</span>
          <strong>{summary.occupied}</strong>
          <small style={{ fontSize: '0.72rem', color: '#ea580c' }}>Active patients</small>
        </div>
      </div>
      <div className="surgery-kpi-card purple">
        <div className="surgery-kpi-icon"><i className="ph ph-bookmark-simple" /></div>
        <div className="surgery-kpi-body">
          <span>Reserved Beds</span>
          <strong>{summary.reserved}</strong>
          <small style={{ fontSize: '0.72rem', color: '#9333ea' }}>Awaiting arrival</small>
        </div>
      </div>
    </section>

    {/* Subtabs: Ward Overview | Bed Allocation */}
    <div className="bed-overview-tabs">
      <button
        className={`bed-overview-tab-btn ${activeSubTab === 'ward-overview' ? 'active' : ''}`}
        onClick={() => setActiveSubTab('ward-overview')}
        type="button"
      >
        Ward Overview
      </button>
      <button
        className={`bed-overview-tab-btn ${activeSubTab === 'bed-allocation' ? 'active' : ''}`}
        onClick={() => setActiveSubTab('bed-allocation')}
        type="button"
      >
        Bed Allocation
      </button>
    </div>

    {/* Comprehensive Filter Bar */}
    <div className="bed-mgmt-filters-bar">
      <div className="bed-mgmt-filter-field">
        <span>Ward</span>
        <select value={wardId} onChange={(event) => updateParam('ward', event.target.value)}>
          <option value="">All</option>
          {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Room</span>
        <select value="" onChange={() => {}}>
          <option value="">All</option>
          {Array.from(new Set(beds.map((b) => b.room_number).filter((r): r is string => Boolean(r)))).map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Room Type</span>
        <select value="" onChange={() => {}}>
          <option value="">All</option>
          {Array.from(new Set(wards.map((w) => w.ward_type).filter((t): t is string => Boolean(t)))).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Bed Type</span>
        <select value="" onChange={() => {}}>
          <option value="">All</option>
          {Array.from(new Set(beds.map((b) => b.bed_category).filter((c): c is string => Boolean(c)))).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Floor</span>
        <select value="" onChange={() => {}}>
          <option value="">All</option>
          {Array.from(new Set(wards.map((w) => w.floor).filter((f): f is string => Boolean(f)))).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Bed Status</span>
        <select value={status ?? ''} onChange={(event) => updateParam('status', event.target.value)}>
          <option value="">All</option>
          {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as BedStatus[]).map((item) => (
            <option key={item} value={item}>{formatStatus(item)}</option>
          ))}
        </select>
      </div>
      <div className="bed-mgmt-filter-field">
        <span>Search Bed</span>
        <input placeholder="Ward, room or bed" value={search} onChange={(event) => updateParam('search', event.target.value)} />
      </div>
    </div>

    {/* 2-Column Main Layout: Visual Bed Grid + Allocation Summary */}
    <div className="bed-mgmt-layout">
      <div className="bed-grid-container">
        <div className="bed-grid-header">
          <h3>Ward Overview</h3>
          <p>Live visual bed state</p>
        </div>

        {configuration.bedsQuery.isError ? (
          <EmptyState icon="ph-warning-circle" title="Unable to load the bed board" message={errorMessage(configuration.bedsQuery.error)} />
        ) : loading ? (
          <div className="bed-board-loading" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading live bed state...</div>
        ) : beds.length === 0 ? (
          <EmptyState icon="ph-bed" title="No beds found" message="Adjust the filters or configure a bed in an active ward." />
        ) : (
          <div className="bed-visual-cards-grid">
            {beds.map((bed) => {
              const isSelected = selectedBed?.id === bed.id;
              return (
                <button
                  className={`bed-visual-card status-${bed.status} ${isSelected ? 'selected' : ''}`}
                  key={bed.id}
                  onClick={() => setSelectedBed(bed)}
                  type="button"
                >
                  <div>
                    <div className="bvc-title">{bed.room_number ? `${bed.room_number} · ${bed.bed_number}` : bed.bed_number}</div>
                    <div className="bvc-subtitle">{bed.ward_name} · {bed.bed_category}</div>
                  </div>
                  <div className="bvc-status">
                    {bed.status === 'OCCUPIED'
                      ? `Occupied · ${bed.patient_name ?? 'Active patient'}`
                      : bed.status === 'RESERVED'
                        ? 'Reserved'
                        : bed.status === 'AVAILABLE'
                          ? 'Available'
                          : bed.status === 'UNDER_MAINTENANCE'
                            ? 'Maintenance'
                            : formatStatus(bed.status)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {bedMeta && bedMeta.totalPages > 1 && (
          <div className="bed-pagination" style={{ marginTop: '1.25rem' }}>
            <span>Showing {(bedMeta.page - 1) * bedMeta.limit + 1}-{Math.min(bedMeta.page * bedMeta.limit, bedMeta.total)} of {bedMeta.total} beds</span>
            <div>
              <button disabled={page <= 1} onClick={() => updateParam('page', String(page - 1), false)} type="button"><i className="ph ph-caret-left" /></button>
              <strong>{page}</strong>
              <button disabled={page >= bedMeta.totalPages} onClick={() => updateParam('page', String(page + 1), false)} type="button"><i className="ph ph-caret-right" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Allocation Summary Right Panel */}
      <aside className="bed-allocation-panel">
        <div className="bed-allocation-header" style={{ marginBottom: '1rem' }}>
          <h3>Allocation Summary</h3>
          <p>Confirm patient and selected bed</p>
        </div>

        {selectedBed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {selectedBed.status === 'OCCUPIED' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                  {(selectedBed.patient_name || 'PT').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.88rem', color: '#0f172a' }}>{selectedBed.patient_name || 'Assigned Patient'}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedBed.patient_number || selectedBed.admission_number}</span>
                </div>
              </div>
            )}

            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Selected Bed:</span>
                <strong style={{ color: '#0f172a' }}>{selectedBed.bed_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Ward:</span>
                <span style={{ color: '#0f172a' }}>{selectedBed.ward_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Room:</span>
                <span style={{ color: '#0f172a' }}>{selectedBed.room_number || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <StatusBadge tone={statusTone(selectedBed.status)}>{formatStatus(selectedBed.status)}</StatusBadge>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {(selectedBed.status === 'AVAILABLE' || selectedBed.status === 'RESERVED') && permissions.canCreateAdmission && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const params = new URLSearchParams({ branch_id: branchId, ward_id: selectedBed.ward_id, bed_id: selectedBed.id });
                    if (selectedBed.current_hold_id) params.set('hold_id', selectedBed.current_hold_id);
                    if (selectedBed.patient_id) params.set('patient_id', selectedBed.patient_id);
                    navigate(`/admissions/inpatients?${params.toString()}`);
                  }}
                  style={{ width: '100%', justifyContent: 'center', height: '40px' }}
                  type="button"
                >
                  <i className="ph ph-check" /> Allocate Bed
                </button>
              )}

              {selectedBed.status === 'AVAILABLE' && permissions.canCreateHold && (
                <button
                  className="btn-secondary"
                  onClick={() => setModal('hold')}
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                >
                  <i className="ph ph-clock" /> Reserve Bed
                </button>
              )}

              {selectedBed.status === 'OCCUPIED' && permissions.canTransfer && (
                <button
                  className="btn-primary"
                  onClick={() => setModal('transfer')}
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                >
                  <i className="ph ph-arrows-left-right" /> Transfer Bed
                </button>
              )}

              {selectedBed.status === 'RESERVED' && permissions.canReleaseHold && (
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmAction({ type: 'release-hold', id: selectedBed.current_hold_id ?? '', label: selectedBed.bed_number })}
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                >
                  Release Hold
                </button>
              )}

              {selectedBed.status === 'RESERVED' && permissions.canCancelHold && (
                <button
                  className="btn-danger"
                  onClick={() => setConfirmAction({ type: 'cancel-hold', id: selectedBed.current_hold_id ?? '', label: selectedBed.bed_number })}
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                >
                  Cancel Hold
                </button>
              )}

              {!['OCCUPIED', 'RESERVED'].includes(selectedBed.status) && permissions.canChangeBedStatus && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    statusForm.reset({ status: selectedBed.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE', reason: '' });
                    setModal('status');
                  }}
                  style={{ width: '100%', justifyContent: 'center' }}
                  type="button"
                >
                  <i className="ph ph-wrench" /> Change Status
                </button>
              )}

              <button
                className="btn-secondary"
                onClick={() => setSelectedBed(null)}
                style={{ width: '100%', justifyContent: 'center' }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <i className="ph ph-bed" style={{ fontSize: '2rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.82rem', margin: 0 }}>Select an available bed from the overview to allocate or hold.</p>
          </div>
        )}
      </aside>
    </div>

    <Modal
      title="Admission Policy & Care-Level Rules"
      open={modal === 'policy'}
      onClose={() => setModal(null)}
      footer={
        <>
          <button className="btn-secondary" onClick={() => setModal(null)} type="button">Close</button>
          {permissions.canEditPolicy && (
            <button className="btn-primary" disabled={configuration.savePolicy.isPending} onClick={() => void submitPolicy()} type="button">
              Save Policy
            </button>
          )}
        </>
      }
    >
      <form className="modal-form-grid" onSubmit={submitPolicy} style={{ gap: '1rem' }}>
        <div className="span-2" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '0.82rem', color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>
            <i className="ph ph-sliders" /> Quick Presets for Care Levels
          </strong>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => {
                policyForm.setValue('bed_hold_duration_minutes', 240);
                policyForm.setValue('admission_minimum_deposit_amount', 0);
                policyForm.setValue('admission_consent_required', true);
                policyForm.setValue('admission_advance_deposit_required', false);
                toast.info('ICU / HDU Preset: $0 Deposit Barrier, Fast-Track Hold.');
              }}
              style={{ fontSize: '0.72rem' }}
            >
              ICU / HDU (Zero Deposit)
            </button>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => {
                policyForm.setValue('bed_hold_duration_minutes', 60);
                policyForm.setValue('admission_minimum_deposit_amount', 50);
                policyForm.setValue('admission_consent_required', true);
                policyForm.setValue('admission_advance_deposit_required', true);
                toast.info('Day Care / Observation Preset: 60m Quick Hold.');
              }}
              style={{ fontSize: '0.72rem' }}
            >
              Day Care (60m Hold)
            </button>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => {
                policyForm.setValue('bed_hold_duration_minutes', 180);
                policyForm.setValue('admission_minimum_deposit_amount', 250);
                policyForm.setValue('admission_consent_required', true);
                policyForm.setValue('admission_advance_deposit_required', true);
                toast.info('Private / Deluxe Ward Preset: Full Deposit & Consent.');
              }}
              style={{ fontSize: '0.72rem' }}
            >
              Private / Deluxe Ward
            </button>
          </div>
        </div>

        <label>
          Hold duration (minutes)
          <input min="5" max="240" type="number" {...policyForm.register('bed_hold_duration_minutes')} />
        </label>
        <label>
          Minimum deposit ($)
          <input min="0" type="number" {...policyForm.register('admission_minimum_deposit_amount')} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" {...policyForm.register('admission_consent_required')} /> Admission consent required
        </label>
        <label className="checkbox-field">
          <input type="checkbox" {...policyForm.register('admission_advance_deposit_required')} /> Advance deposit required
        </label>

        <div className="span-2" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1', marginBottom: '4px' }}>
            <i className="ph ph-shield-check" /> <strong>Insurance & Cashless Pre-Auth:</strong> Advance deposit automatically waived for approved TPAs.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c' }}>
            <i className="ph ph-lightning" /> <strong>Emergency Fast-Track:</strong> Allows 24-hour documentation grace override during life-critical arrivals.
          </div>
        </div>
      </form>
    </Modal>
    <Modal title={`Hold ${selectedBed?.bed_number ?? 'Bed'}`} open={modal === 'hold'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.createHold.isPending} onClick={() => void submitHold()} type="button">Confirm Hold</button></>}><form className="modal-form-grid" onSubmit={submitHold}><label className="span-2">Find patient<input placeholder="Search MRN, name or phone" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} /></label><label className="span-2">Patient<select {...holdForm.register('patient_id')}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.patient_number} - {[patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')}</option>)}</select></label><label className="span-2">Reason<textarea {...holdForm.register('reason')} /></label>{patientSearch.trim().length > 0 && patientSearch.trim().length < 2 && <p className="form-hint span-2">Enter at least two characters to search.</p>}</form></Modal>
    <Modal title={`Transfer from ${selectedBed?.bed_number ?? 'Bed'}`} open={modal === 'transfer'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.transfer.isPending} onClick={() => void submitTransfer()} type="button">Confirm Transfer</button></>}><form className="modal-form-grid" onSubmit={submitTransfer}><label className="span-2">Destination branch<select {...transferForm.register('destination_branch_id')} onChange={(event) => { transferForm.setValue('destination_branch_id', event.target.value); transferForm.setValue('destination_ward_id', ''); transferForm.setValue('destination_bed_id', ''); updateParam('destination_branch', event.target.value, false); }}><option value="">Select branch</option>{feature.branches.map((branch) => <option key={branch.id} value={branch.id} disabled={branch.id !== branchId && !permissions.canCrossBranchTransfer}>{branch.name}</option>)}</select></label><label>Destination ward<select {...transferForm.register('destination_ward_id')}><option value="">Select ward</option>{transferWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label><label>Destination bed<select {...transferForm.register('destination_bed_id')}><option value="">Select available bed</option>{availableTransferBeds.filter((bed) => bed.id !== selectedBed?.id).map((bed) => <option key={bed.id} value={bed.id}>{bed.bed_number}{bed.room_number ? ` / Room ${bed.room_number}` : ''}</option>)}</select></label><label className="span-2">Reason<textarea {...transferForm.register('reason')} /></label></form></Modal>
    <Modal title={`Change ${selectedBed?.bed_number ?? 'Bed'} Status`} open={modal === 'status'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.bedStatus.isPending} onClick={() => void submitStatus()} type="button">Update Status</button></>}><form className="modal-form-grid" onSubmit={submitStatus}><label className="span-2">Status<select {...statusForm.register('status')}><option value="AVAILABLE">Available</option><option value="BLOCKED">Blocked</option><option value="UNDER_MAINTENANCE">Under Maintenance</option><option value="INACTIVE">Inactive</option></select></label><label className="span-2">Reason<textarea {...statusForm.register('reason')} /></label></form></Modal>
    <ConfirmDialog open={Boolean(confirmAction)} title="Confirm hold action" message={confirmAction ? `${confirmAction.type === 'release-hold' ? 'Release the active hold on' : 'Cancel the active hold on'} ${confirmAction.label}?` : ''} confirmLabel="Confirm" onCancel={() => setConfirmAction(null)} onConfirm={() => void runConfirmedAction()} />
  </div>;
}
