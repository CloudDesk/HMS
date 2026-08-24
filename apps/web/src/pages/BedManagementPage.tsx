import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Bed, BedStatus, Ward } from '../api/admissions-configuration';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useBedManagementFeature } from '../hooks/admissions/useBedManagementFeature';

const wardSchema = z.object({ name: z.string().trim().min(1, 'Ward name is required'), ward_type: z.string().trim().min(1, 'Ward type is required'), room_type: z.string().trim(), floor: z.string().trim().min(1, 'Floor is required'), capacity: z.number().int().min(1, 'Capacity must be at least one'), description: z.string().trim().max(500) });
const bedSchema = z.object({ ward_id: z.string().min(1, 'Ward is required'), bed_number: z.string().trim().min(1, 'Bed ID is required'), bed_type: z.string().trim().min(1, 'Bed type is required'), charge_category: z.string().trim().min(1, 'Charge category is required'), gender_restriction: z.enum(['ANY', 'MALE', 'FEMALE', 'OTHER']), room_number: z.string().trim() });
type WardForm = z.infer<typeof wardSchema>;
type BedForm = z.infer<typeof bedSchema>;
const masterBedStatuses = ['AVAILABLE', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as const;
const tone = (status: string) => status === 'ACTIVE' || status === 'AVAILABLE' ? 'green' as const : status === 'INACTIVE' || status === 'UNDER_MAINTENANCE' ? 'gray' as const : status === 'OCCUPIED' ? 'red' as const : 'orange' as const;

export function BedManagementPage() {
  const { state, capabilities, actions } = useBedManagementFeature();
  const [tab, setTab] = useState<'wards' | 'beds'>('wards');
  const [editingWard, setEditingWard] = useState<Ward | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const wardForm = useForm<WardForm>({ resolver: zodResolver(wardSchema), defaultValues: { name: '', ward_type: '', room_type: '', floor: '', capacity: 1, description: '' } });
  const bedForm = useForm<BedForm>({ resolver: zodResolver(bedSchema), defaultValues: { ward_id: '', bed_number: '', bed_type: '', charge_category: '', gender_restriction: 'ANY', room_number: '' } });

  useEffect(() => {
    if (!bedForm.getValues('ward_id') && state.wards[0]) bedForm.setValue('ward_id', state.wards[0].id);
  }, [bedForm, state.wards]);

  const editWard = (ward: Ward) => { setEditingWard(ward); wardForm.reset({ name: ward.name, ward_type: ward.ward_type, room_type: ward.room_type ?? '', floor: ward.floor, capacity: ward.capacity ?? 1, description: ward.description ?? '' }); };
  const editBed = (bed: Bed) => { setEditingBed(bed); bedForm.reset({ ward_id: bed.ward_id, bed_number: bed.bed_number, bed_type: bed.bed_type, charge_category: bed.charge_category, gender_restriction: bed.gender_restriction, room_number: bed.room_number ?? '' }); };
  const resetWard = () => { setEditingWard(null); wardForm.reset({ name: '', ward_type: '', room_type: '', floor: '', capacity: 1, description: '' }); };
  const resetBed = () => { setEditingBed(null); bedForm.reset({ ward_id: state.wards[0]?.id ?? '', bed_number: '', bed_type: '', charge_category: '', gender_restriction: 'ANY', room_number: '' }); };
  const saveWard = async (values: WardForm) => { try { await actions.saveWard({ branch_id: state.branchId, ...values, room_type: values.room_type || null, description: values.description || null }, editingWard); resetWard(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save ward.'); } };
  const saveBed = async (values: BedForm) => { try { await actions.saveBed({ branch_id: state.branchId, ward_id: values.ward_id, bed_number: values.bed_number, bed_category: values.charge_category, bed_type: values.bed_type, charge_category: values.charge_category, gender_restriction: values.gender_restriction, room_number: values.room_number || null }, editingBed); resetBed(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save bed.'); } };
  const changeWardStatus = async (ward: Ward) => { try { await actions.changeWardStatus(ward); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to change ward status.'); } };
  const changeBedStatus = async (bed: Bed, status: typeof masterBedStatuses[number]) => { try { await actions.changeBedStatus(bed, status); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to change bed status.'); } };

  return <div className="page-shell">
    <div className="page-heading"><h1>Ward &amp; Bed Master</h1><p>Branch-scoped ward, room, capacity, restriction, charge, and operational bed configuration</p></div>
    <div className="filters-toolbar">
      <label><span>Branch</span><select value={state.branchId} onChange={(event) => actions.setBranchId(event.target.value)}>{state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label><span>Search</span><input value={state.search} onChange={(event) => actions.setSearch(event.target.value)} placeholder="Ward, room or bed ID" /></label>
      <label><span>Bed status</span><select value={state.bedStatus} onChange={(event) => actions.setBedStatus(event.target.value as BedStatus | '')}><option value="">All statuses</option>{(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE'] as BedStatus[]).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
    </div>
    {!state.branchId && <div className="admin-dashboard-state admin-dashboard-state--error"><strong>{state.branchError ? 'Unable to load branches' : 'No authorized active branch'}</strong><span>Branch access is required before managing wards and beds.</span></div>}
    {state.branchId && <>
      <section className="kpi-grid"><article className="kpi-card"><span>Total beds</span><strong>{state.summary.total}</strong></article><article className="kpi-card"><span>Available</span><strong>{state.summary.available}</strong></article><article className="kpi-card"><span>Occupied / Reserved</span><strong>{state.summary.occupied + state.summary.reserved}</strong></article><article className="kpi-card"><span>Unavailable / Inactive</span><strong>{state.summary.blocked + state.summary.under_maintenance + state.summary.inactive}</strong></article></section>
      <div className="tabs-container"><button className={`tab-btn ${tab === 'wards' ? 'active' : ''}`} onClick={() => setTab('wards')}>Ward / Room Master</button><button className={`tab-btn ${tab === 'beds' ? 'active' : ''}`} onClick={() => setTab('beds')}>IP Bed Master</button></div>
      {tab === 'wards' && <section className="content-card">
        {(editingWard ? capabilities.canEditWard : capabilities.canCreateWard) && <form className="inline-form" onSubmit={wardForm.handleSubmit(saveWard)}><input placeholder="Ward name" {...wardForm.register('name')} /><input placeholder="Ward type" {...wardForm.register('ward_type')} /><input placeholder="Room type" {...wardForm.register('room_type')} /><input placeholder="Floor" {...wardForm.register('floor')} /><input type="number" min={1} placeholder="Capacity" {...wardForm.register('capacity', { valueAsNumber: true })} /><input placeholder="Description" {...wardForm.register('description')} /><button className="btn-primary" disabled={state.saving}>{editingWard ? 'Save ward' : 'Add ward'}</button>{editingWard && <button className="btn-secondary" type="button" onClick={resetWard}>Cancel</button>}</form>}
        <p className="form-error">{Object.values(wardForm.formState.errors)[0]?.message}</p>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Ward / Room</th><th>Type</th><th>Floor</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.loading ? <tr><td colSpan={6}>Loading ward configuration...</td></tr> : state.wards.length === 0 ? <tr><td colSpan={6}>No wards configured.</td></tr> : state.wards.map((ward) => <tr key={ward.id}><td><strong>{ward.name}</strong><small>{ward.room_type || ward.description || 'No room type'}</small></td><td>{ward.ward_type}</td><td>{ward.floor}</td><td>{ward.capacity ?? '-'}</td><td><StatusBadge tone={tone(ward.status)}>{ward.status}</StatusBadge></td><td>{capabilities.canEditWard && <button className="btn-secondary compact" type="button" onClick={() => editWard(ward)}>Edit</button>} {capabilities.canChangeWardStatus && <button className="btn-secondary compact" type="button" onClick={() => void changeWardStatus(ward)}>{ward.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}</tbody></table></div>
      </section>}
      {tab === 'beds' && <section className="content-card">
        {(editingBed ? capabilities.canEditBed : capabilities.canCreateBed) && <form className="inline-form" onSubmit={bedForm.handleSubmit(saveBed)}><select disabled={Boolean(editingBed)} {...bedForm.register('ward_id')}><option value="">Select ward</option>{state.wards.filter((ward) => ward.status === 'ACTIVE').map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select><input placeholder="Bed ID" {...bedForm.register('bed_number')} /><input placeholder="Bed type" {...bedForm.register('bed_type')} /><input placeholder="Charge category" {...bedForm.register('charge_category')} /><select {...bedForm.register('gender_restriction')}><option value="ANY">No gender restriction</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select><input placeholder="Room number" {...bedForm.register('room_number')} /><button className="btn-primary" disabled={state.saving}>{editingBed ? 'Save bed' : 'Add bed'}</button>{editingBed && <button className="btn-secondary" type="button" onClick={resetBed}>Cancel</button>}</form>}
        <p className="form-error">{Object.values(bedForm.formState.errors)[0]?.message}</p>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Bed ID</th><th>Ward / Room</th><th>Bed type</th><th>Charge category</th><th>Restriction</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.loading ? <tr><td colSpan={7}>Loading bed configuration...</td></tr> : state.beds.length === 0 ? <tr><td colSpan={7}>No beds configured.</td></tr> : state.beds.map((bed) => <tr key={bed.id}><td><strong>{bed.bed_number}</strong></td><td>{bed.ward_name}{bed.room_number ? ` / ${bed.room_number}` : ''}</td><td>{bed.bed_type}</td><td>{bed.charge_category}</td><td>{bed.gender_restriction}</td><td><StatusBadge tone={tone(bed.status)}>{bed.status.replaceAll('_', ' ')}</StatusBadge></td><td>{capabilities.canEditBed && <button className="btn-secondary compact" type="button" disabled={bed.status === 'OCCUPIED' || bed.status === 'RESERVED'} onClick={() => editBed(bed)}>Edit</button>} {capabilities.canChangeBedStatus && <select aria-label={`Status for ${bed.bed_number}`} disabled={bed.status === 'OCCUPIED' || bed.status === 'RESERVED'} value={masterBedStatuses.includes(bed.status as typeof masterBedStatuses[number]) ? bed.status : ''} onChange={(event) => void changeBedStatus(bed, event.target.value as typeof masterBedStatuses[number])}><option value="" disabled>Operational</option>{masterBedStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>}</td></tr>)}</tbody></table></div>
      </section>}
    </>}
  </div>;
}
