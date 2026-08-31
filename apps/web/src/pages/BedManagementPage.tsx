import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import type { Bed, BedStatus, WardStatus } from '../api/admissions-configuration';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useBedManagementFeature } from '../hooks/admissions/useBedManagementFeature';
import { navigate, useAppLocation } from '../routing/navigation';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select a valid record');
const wardSchema = z.object({ name: z.string().trim().min(1).max(100), ward_type: z.string().trim().min(1).max(100), floor: z.string().trim().min(1).max(50), description: z.string().trim().max(500) });
const bedSchema = z.object({ ward_id: objectId, bed_number: z.string().trim().min(1).max(50), bed_category: z.string().trim().min(1).max(100), room_number: z.string().trim().max(50) });
const policySchema = z.object({ bed_hold_duration_minutes: z.coerce.number().int().min(5).max(240), admission_consent_required: z.boolean(), admission_advance_deposit_required: z.boolean(), admission_minimum_deposit_amount: z.coerce.number().min(0).max(100000000) }).superRefine((value, context) => { if (!value.admission_advance_deposit_required && value.admission_minimum_deposit_amount !== 0) context.addIssue({ code: 'custom', path: ['admission_minimum_deposit_amount'], message: 'Set the amount to zero when a deposit is not required' }); });
const holdSchema = z.object({ patient_id: objectId, reason: z.string().trim().min(3).max(500) });
const transferSchema = z.object({ destination_branch_id: objectId, destination_ward_id: objectId, destination_bed_id: objectId, reason: z.string().trim().min(3).max(500) });
const statusSchema = z.object({ status: z.enum(['AVAILABLE', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE']), reason: z.string().trim().max(500) }).superRefine((value, context) => { if ((value.status === 'BLOCKED' || value.status === 'UNDER_MAINTENANCE') && !value.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required' }); });

type ModalName = 'ward' | 'bed' | 'policy' | 'hold' | 'transfer' | 'status' | null;
type WardForm = z.infer<typeof wardSchema>;
type BedForm = z.infer<typeof bedSchema>;
type PolicyFormInput = z.input<typeof policySchema>;
type PolicyForm = z.output<typeof policySchema>;
type HoldForm = z.infer<typeof holdSchema>;
type TransferForm = z.infer<typeof transferSchema>;
type StatusForm = z.infer<typeof statusSchema>;
type ConfirmAction = { type: 'release-hold' | 'cancel-hold' | 'ward-status'; id: string; label: string; status?: WardStatus } | null;

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

  const wardForm = useForm<WardForm>({ resolver: zodResolver(wardSchema), defaultValues: { name: '', ward_type: '', floor: '', description: '' } });
  const bedForm = useForm<BedForm>({ resolver: zodResolver(bedSchema), defaultValues: { ward_id: '', bed_number: '', bed_category: '', room_number: '' } });
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

  const submitWard = wardForm.handleSubmit(async (values) => { try { await configuration.createWard.mutateAsync({ branch_id: branchId, ...values, description: values.description || null }); toast.success('Ward created successfully.'); wardForm.reset(); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitBed = bedForm.handleSubmit(async (values) => { try { await configuration.createBed.mutateAsync({ branch_id: branchId, ...values, room_number: values.room_number || null }); toast.success('Bed created successfully.'); bedForm.reset(); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitPolicy = policyForm.handleSubmit(async (values) => { try { await configuration.savePolicy.mutateAsync({ branch_id: branchId, ...values }); toast.success('Admission policy saved.'); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitHold = holdForm.handleSubmit(async (values) => { if (!selectedBed) return; try { await configuration.createHold.mutateAsync({ bedId: selectedBed.id, body: { branch_id: branchId, patient_id: values.patient_id, reason: values.reason, idempotency_key: crypto.randomUUID() } }); toast.success('Bed held successfully.'); holdForm.reset(); setPatientSearch(''); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitTransfer = transferForm.handleSubmit(async (values) => { if (!selectedBed?.current_admission_id) return; try { const crossBranch = values.destination_branch_id !== branchId; await configuration.transfer.mutateAsync({ admissionId: selectedBed.current_admission_id, body: { branch_id: branchId, ...values }, crossBranch }); toast.success('Bed transfer completed.'); transferForm.reset(); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });
  const submitStatus = statusForm.handleSubmit(async (values) => { if (!selectedBed) return; try { await configuration.bedStatus.mutateAsync({ id: selectedBed.id, body: { branch_id: branchId, status: values.status, reason: values.reason || null } }); toast.success(`Bed marked ${formatStatus(values.status)}.`); setModal(null); } catch (error) { toast.error(errorMessage(error)); } });

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === 'ward-status') { const next = confirmAction.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'; await configuration.wardStatus.mutateAsync({ id: confirmAction.id, body: { branch_id: branchId, status: next } }); toast.success(`Ward ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`); }
      if ((confirmAction.type === 'release-hold' || confirmAction.type === 'cancel-hold') && selectedBed?.current_hold_id) { const mutation = confirmAction.type === 'release-hold' ? configuration.releaseHold : configuration.cancelHold; await mutation.mutateAsync({ holdId: selectedBed.current_hold_id, body: { branch_id: branchId, reason: confirmAction.type === 'release-hold' ? 'Released by bed management user' : 'Cancelled by bed management user' } }); toast.success(confirmAction.type === 'release-hold' ? 'Bed hold released.' : 'Bed hold cancelled.'); }
      setConfirmAction(null);
    } catch (error) { toast.error(errorMessage(error)); }
  };

  if (!branchId && feature.isSuperAdmin && feature.branchQuery.isLoading) return <div className="admin-dashboard-state"><strong>Loading authorized branches</strong><span>Fetching active branches.</span></div>;
  if (!branchId) return <div className="admin-dashboard-state admin-dashboard-state--error"><strong>No authorized branch</strong><span>Assign this user to an active branch before managing beds.</span></div>;

  return <div className="page-shell bed-management-page">
    <header className="bed-management-header">
      <div><h1>Bed Management</h1><p>Live ward capacity, holds, allotments and transfers</p></div>
      <div className="bed-management-actions">
        <select aria-label="Branch" value={branchId} onChange={(event) => updateParam('branch', event.target.value)}>{feature.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        {permissions.canViewPolicy && <button className="btn-secondary" type="button" onClick={() => setModal('policy')}><i className="ph ph-sliders-horizontal" /> Policy</button>}
        {permissions.canCreateWard && <button className="btn-secondary" type="button" onClick={() => setModal('ward')}><i className="ph ph-buildings" /> Add Ward</button>}
        {permissions.canCreateBed && <button className="btn-primary" type="button" onClick={() => setModal('bed')}><i className="ph ph-bed" /> Add Bed</button>}
      </div>
    </header>

    {permissions.canViewPolicy && configuration.policyQuery.isError && <div className="bed-policy-alert"><i className="ph ph-warning-circle" /><div><strong>Admission policy required</strong><span>Configure hold duration before beds can be reserved or allotted.</span></div>{permissions.canEditPolicy && <button className="btn-secondary compact" onClick={() => setModal('policy')} type="button">Configure</button>}</div>}

    <section className="bed-kpi-grid">
      {[['ph-bed', 'Total Beds', summary.total, 'blue'], ['ph-check-circle', 'Available', summary.available, 'green'], ['ph-user', 'Occupied', summary.occupied, 'red'], ['ph-clock', 'Reserved', summary.reserved, 'orange'], ['ph-prohibit', 'Blocked', summary.blocked + summary.under_maintenance, 'gray']].map(([icon, label, value, tone]) => <div className={`bed-kpi bed-kpi--${tone}`} key={String(label)}><i className={`ph ${icon}`} /><div><span>{label}</span><strong>{value}</strong></div></div>)}
    </section>

    <section className="content-card bed-board-panel">
      <div className="bed-board-toolbar">
        <div><h2>Live Bed Board</h2><p>Owner-aware bed state across the selected branch</p></div>
        <div className="bed-board-filters">
          <select aria-label="Ward filter" value={wardId} onChange={(event) => updateParam('ward', event.target.value)}><option value="">All wards</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select>
          <select aria-label="Status filter" value={status ?? ''} onChange={(event) => updateParam('status', event.target.value)}><option value="">All statuses</option>{(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as BedStatus[]).map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select>
          <label className="bed-search"><i className="ph ph-magnifying-glass" /><input aria-label="Search beds" placeholder="Search bed or room" value={search} onChange={(event) => updateParam('search', event.target.value)} /></label>
        </div>
      </div>

      {configuration.bedsQuery.isError ? <EmptyState icon="ph-warning-circle" title="Unable to load the bed board" message={errorMessage(configuration.bedsQuery.error)} /> : loading ? <div className="bed-board-loading">Loading live bed availability...</div> : beds.length === 0 ? <EmptyState icon="ph-bed" title="No beds found" message="Adjust the filters or configure a bed in an active ward." /> : <div className="bed-workspace">
        <div className="bed-grid bed-grid--live">
          {beds.map((bed) => <button className={`bed-card status-${bed.status}${selectedBed?.id === bed.id ? ' selected' : ''}`} key={bed.id} onClick={() => setSelectedBed(bed)} type="button">
            <div className="bed-card-top"><strong>{bed.bed_number}</strong><StatusBadge tone={statusTone(bed.status)}>{formatStatus(bed.status)}</StatusBadge></div>
            <span>{bed.ward_name}{bed.room_number ? ` / Room ${bed.room_number}` : ''}</span>
            <span>{bed.bed_category}</span>
            {bed.status === 'OCCUPIED' && <div className="bed-owner"><i className="ph ph-user" /><div><strong>{bed.patient_name ?? 'Assigned patient'}</strong><span>{bed.patient_number ?? bed.admission_number}</span></div></div>}
            {bed.status === 'RESERVED' && <div className="bed-owner"><i className="ph ph-clock" /><div><strong>{bed.hold_number}</strong><span>{bed.hold_expires_at ? `Expires ${new Date(bed.hold_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Active hold'}</span></div></div>}
            {(bed.status === 'BLOCKED' || bed.status === 'UNDER_MAINTENANCE') && <div className="bed-owner"><i className="ph ph-warning" /><span>{bed.block_reason_code ?? 'Operational restriction'}</span></div>}
          </button>)}
        </div>
        <aside className="bed-detail-panel">
          {!selectedBed ? <EmptyState icon="ph-cursor-click" title="Select a bed" message="Choose a bed to view its current owner and permitted actions." /> : <>
            <div className="bed-detail-heading"><div><span>Selected bed</span><h3>{selectedBed.bed_number}</h3></div><StatusBadge tone={statusTone(selectedBed.status)}>{formatStatus(selectedBed.status)}</StatusBadge></div>
            <dl><div><dt>Ward</dt><dd>{selectedBed.ward_name}</dd></div><div><dt>Room</dt><dd>{selectedBed.room_number || 'Not assigned'}</dd></div><div><dt>Category</dt><dd>{selectedBed.bed_category}</dd></div></dl>
            {selectedBed.status === 'OCCUPIED' && <div className="bed-context"><strong>{selectedBed.patient_name}</strong><span>{selectedBed.patient_number}</span><span>{selectedBed.admission_number}</span></div>}
            {selectedBed.status === 'RESERVED' && <div className="bed-context"><strong>{selectedBed.hold_number}</strong><span>{selectedBed.hold_expires_at ? new Date(selectedBed.hold_expires_at).toLocaleString() : 'Expiry unavailable'}</span></div>}
            <div className="bed-detail-actions">
              {selectedBed.status === 'AVAILABLE' && permissions.canCreateHold && <button className="btn-primary" type="button" onClick={() => setModal('hold')}><i className="ph ph-clock" /> Hold Bed</button>}
              {(selectedBed.status === 'AVAILABLE' || selectedBed.status === 'RESERVED') && permissions.canCreateAdmission && <button className="btn-secondary" type="button" onClick={() => {
                const params = new URLSearchParams({ branch_id: branchId, ward_id: selectedBed.ward_id, bed_id: selectedBed.id });
                if (selectedBed.current_hold_id) params.set('hold_id', selectedBed.current_hold_id);
                if (selectedBed.patient_id) params.set('patient_id', selectedBed.patient_id);
                navigate(`/admissions/inpatients?${params.toString()}`);
              }}><i className="ph ph-user-plus" /> Allot Bed</button>}
              {selectedBed.status === 'OCCUPIED' && permissions.canTransfer && <button className="btn-primary" type="button" onClick={() => setModal('transfer')}><i className="ph ph-arrows-left-right" /> Transfer</button>}
              {selectedBed.status === 'RESERVED' && permissions.canReleaseHold && <button className="btn-secondary" type="button" onClick={() => setConfirmAction({ type: 'release-hold', id: selectedBed.current_hold_id ?? '', label: selectedBed.bed_number })}>Release Hold</button>}
              {selectedBed.status === 'RESERVED' && permissions.canCancelHold && <button className="btn-danger" type="button" onClick={() => setConfirmAction({ type: 'cancel-hold', id: selectedBed.current_hold_id ?? '', label: selectedBed.bed_number })}>Cancel Hold</button>}
              {!['OCCUPIED', 'RESERVED'].includes(selectedBed.status) && permissions.canChangeBedStatus && <button className="btn-secondary" type="button" onClick={() => { statusForm.reset({ status: selectedBed.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE', reason: '' }); setModal('status'); }}><i className="ph ph-wrench" /> Change Status</button>}
            </div>
          </>}
        </aside>
      </div>}

      {bedMeta && bedMeta.totalPages > 1 && <div className="bed-pagination"><span>Showing {(bedMeta.page - 1) * bedMeta.limit + 1}-{Math.min(bedMeta.page * bedMeta.limit, bedMeta.total)} of {bedMeta.total} beds</span><div><button disabled={page <= 1} onClick={() => updateParam('page', String(page - 1), false)} type="button"><i className="ph ph-caret-left" /></button><strong>{page}</strong><button disabled={page >= bedMeta.totalPages} onClick={() => updateParam('page', String(page + 1), false)} type="button"><i className="ph ph-caret-right" /></button></div></div>}
    </section>

    <section className="content-card ward-table-panel"><div className="section-heading"><div><h2>Ward Configuration</h2><p>Active branch wards and operational status</p></div></div><div className="table-scroll"><table className="data-table responsive-table"><thead><tr><th>Ward</th><th>Type</th><th>Floor</th><th>Status</th><th>Action</th></tr></thead><tbody>{wards.map((ward) => <tr key={ward.id}><td data-label="Ward"><strong>{ward.name}</strong><small>{ward.description || 'No description'}</small></td><td data-label="Type">{ward.ward_type}</td><td data-label="Floor">{ward.floor}</td><td data-label="Status"><StatusBadge tone={statusTone(ward.status)}>{ward.status}</StatusBadge></td><td data-label="Action">{permissions.canChangeWardStatus && <button className="btn-secondary compact" onClick={() => setConfirmAction({ type: 'ward-status', id: ward.id, label: ward.name, status: ward.status })} type="button">{ward.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}</tbody></table></div></section>

    <Modal title="Add Ward" open={modal === 'ward'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.createWard.isPending} onClick={() => void submitWard()} type="button">Save Ward</button></>}><form className="modal-form-grid" onSubmit={submitWard}><label>Ward name<input {...wardForm.register('name')} /></label><label>Ward type<input {...wardForm.register('ward_type')} /></label><label>Floor<input {...wardForm.register('floor')} /></label><label className="span-2">Description<textarea {...wardForm.register('description')} /></label></form></Modal>
    <Modal title="Add Bed" open={modal === 'bed'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.createBed.isPending} onClick={() => void submitBed()} type="button">Save Bed</button></>}><form className="modal-form-grid" onSubmit={submitBed}><label className="span-2">Ward<select {...bedForm.register('ward_id')}><option value="">Select ward</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label><label>Bed number<input {...bedForm.register('bed_number')} /></label><label>Bed category<input {...bedForm.register('bed_category')} /></label><label>Room number<input {...bedForm.register('room_number')} /></label></form></Modal>
    <Modal title="Admission Policy" open={modal === 'policy'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Close</button>{permissions.canEditPolicy && <button className="btn-primary" disabled={configuration.savePolicy.isPending} onClick={() => void submitPolicy()} type="button">Save Policy</button>}</>}><form className="modal-form-grid" onSubmit={submitPolicy}><label>Hold duration (minutes)<input min="5" max="240" type="number" {...policyForm.register('bed_hold_duration_minutes')} /></label><label>Minimum deposit<input min="0" type="number" {...policyForm.register('admission_minimum_deposit_amount')} /></label><label className="checkbox-field"><input type="checkbox" {...policyForm.register('admission_consent_required')} /> Admission consent required</label><label className="checkbox-field"><input type="checkbox" {...policyForm.register('admission_advance_deposit_required')} /> Advance deposit required</label></form></Modal>
    <Modal title={`Hold ${selectedBed?.bed_number ?? 'Bed'}`} open={modal === 'hold'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.createHold.isPending} onClick={() => void submitHold()} type="button">Confirm Hold</button></>}><form className="modal-form-grid" onSubmit={submitHold}><label className="span-2">Find patient<input placeholder="Search MRN, name or phone" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} /></label><label className="span-2">Patient<select {...holdForm.register('patient_id')}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.patient_number} - {[patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')}</option>)}</select></label><label className="span-2">Reason<textarea {...holdForm.register('reason')} /></label>{patientSearch.trim().length > 0 && patientSearch.trim().length < 2 && <p className="form-hint span-2">Enter at least two characters to search.</p>}</form></Modal>
    <Modal title={`Transfer from ${selectedBed?.bed_number ?? 'Bed'}`} open={modal === 'transfer'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.transfer.isPending} onClick={() => void submitTransfer()} type="button">Confirm Transfer</button></>}><form className="modal-form-grid" onSubmit={submitTransfer}><label className="span-2">Destination branch<select {...transferForm.register('destination_branch_id')} onChange={(event) => { transferForm.setValue('destination_branch_id', event.target.value); transferForm.setValue('destination_ward_id', ''); transferForm.setValue('destination_bed_id', ''); updateParam('destination_branch', event.target.value, false); }}><option value="">Select branch</option>{feature.branches.map((branch) => <option key={branch.id} value={branch.id} disabled={branch.id !== branchId && !permissions.canCrossBranchTransfer}>{branch.name}</option>)}</select></label><label>Destination ward<select {...transferForm.register('destination_ward_id')}><option value="">Select ward</option>{transferWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select></label><label>Destination bed<select {...transferForm.register('destination_bed_id')}><option value="">Select available bed</option>{availableTransferBeds.filter((bed) => bed.id !== selectedBed?.id).map((bed) => <option key={bed.id} value={bed.id}>{bed.bed_number}{bed.room_number ? ` / Room ${bed.room_number}` : ''}</option>)}</select></label><label className="span-2">Reason<textarea {...transferForm.register('reason')} /></label></form></Modal>
    <Modal title={`Change ${selectedBed?.bed_number ?? 'Bed'} Status`} open={modal === 'status'} onClose={() => setModal(null)} footer={<><button className="btn-secondary" onClick={() => setModal(null)} type="button">Cancel</button><button className="btn-primary" disabled={configuration.bedStatus.isPending} onClick={() => void submitStatus()} type="button">Update Status</button></>}><form className="modal-form-grid" onSubmit={submitStatus}><label className="span-2">Status<select {...statusForm.register('status')}><option value="AVAILABLE">Available</option><option value="BLOCKED">Blocked</option><option value="UNDER_MAINTENANCE">Under Maintenance</option><option value="INACTIVE">Inactive</option></select></label><label className="span-2">Reason<textarea {...statusForm.register('reason')} /></label></form></Modal>
    <ConfirmDialog open={Boolean(confirmAction)} title={confirmAction?.type === 'ward-status' ? 'Change ward status' : 'Confirm hold action'} message={confirmAction ? `${confirmAction.type === 'ward-status' ? 'Change the operational status of' : confirmAction.type === 'release-hold' ? 'Release the active hold on' : 'Cancel the active hold on'} ${confirmAction.label}?` : ''} confirmLabel="Confirm" onCancel={() => setConfirmAction(null)} onConfirm={() => void runConfirmedAction()} />
  </div>;
}
