import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../../api/api-error';
import type { BranchResponse } from '../../api/branches';
import { useBranchWardBedConfigurationFeature } from '../../hooks/branches/useBranchWardBedConfigurationFeature';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Select an active ward');
const wardSchema = z.object({
  name: z.string().trim().min(1, 'Ward name is required').max(100),
  ward_type: z.string().trim().min(1, 'Ward type is required').max(100),
  floor: z.string().trim().min(1, 'Floor is required').max(50),
  description: z.string().trim().max(500),
});
const bedSchema = z.object({
  ward_id: objectId,
  bed_number: z.string().trim().min(1, 'Bed number is required').max(50),
  bed_category: z.string().trim().min(1, 'Bed category is required').max(100),
  room_number: z.string().trim().max(50),
});

type WardForm = z.infer<typeof wardSchema>;
type BedForm = z.infer<typeof bedSchema>;
type PanelMode = 'overview' | 'ward' | 'bed';

type BranchWardBedConfigurationProps = {
  branch: BranchResponse | null;
  open: boolean;
  onClose: () => void;
};

const messageFor = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'You do not have permission to configure wards or beds.';
    if (error.status === 409) return error.message;
    return error.message || 'Unable to save the branch configuration.';
  }
  return error instanceof Error ? error.message : 'Unable to save the branch configuration.';
};

const toneFor = (status: string) => status === 'ACTIVE' || status === 'AVAILABLE'
  ? 'green' as const
  : status === 'OCCUPIED'
    ? 'red' as const
    : status === 'RESERVED'
      ? 'orange' as const
      : status === 'BLOCKED'
        ? 'purple' as const
        : 'gray' as const;

const labelFor = (status: string) => status
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/(^|\s)\S/g, (value) => value.toUpperCase());

export function BranchWardBedConfiguration({
  branch,
  open,
  onClose,
}: BranchWardBedConfigurationProps) {
  const [mode, setMode] = useState<PanelMode>('overview');
  const [formError, setFormError] = useState('');
  const feature = useBranchWardBedConfigurationFeature({
    branchId: branch?.id ?? '',
    enabled: open && Boolean(branch),
  });
  const { wards, wardMeta, beds, bedMeta, summary } = feature.data;
  const activeWards = wards.filter((ward) => ward.status === 'ACTIVE');
  const busy = feature.status.creatingWard || feature.status.creatingBed;

  const wardForm = useForm<WardForm>({
    resolver: zodResolver(wardSchema),
    defaultValues: { name: '', ward_type: '', floor: '', description: '' },
  });
  const bedForm = useForm<BedForm>({
    resolver: zodResolver(bedSchema),
    defaultValues: { ward_id: '', bed_number: '', bed_category: '', room_number: '' },
  });

  useEffect(() => {
    if (!open) {
      setMode('overview');
      setFormError('');
      wardForm.reset();
      bedForm.reset();
    }
  }, [bedForm, open, wardForm]);

  const close = () => {
    if (!busy) onClose();
  };

  const submitWard = wardForm.handleSubmit(async (values) => {
    setFormError('');
    try {
      await feature.actions.createWard({
        ...values,
        description: values.description || null,
      });
      toast.success(`Ward added to ${branch?.name ?? 'branch'}.`);
      wardForm.reset();
      setMode('overview');
    } catch (error) {
      setFormError(messageFor(error));
    }
  });

  const submitBed = bedForm.handleSubmit(async (values) => {
    setFormError('');
    try {
      await feature.actions.createBed({
        ...values,
        room_number: values.room_number || null,
      });
      toast.success(`Bed added to ${branch?.name ?? 'branch'}.`);
      bedForm.reset();
      setMode('overview');
    } catch (error) {
      setFormError(messageFor(error));
    }
  });

  const footer = mode === 'overview' ? (
    <button className="btn-secondary" onClick={close} type="button">Close</button>
  ) : (
    <>
      <button className="btn-secondary" disabled={busy} onClick={() => { setFormError(''); setMode('overview'); }} type="button">Back</button>
      <button
        className="btn-primary"
        disabled={busy}
        form={mode === 'ward' ? 'branch-ward-form' : 'branch-bed-form'}
        type="submit"
      >
        {busy ? 'Saving...' : mode === 'ward' ? 'Save Ward' : 'Save Bed'}
      </button>
    </>
  );

  return (
    <Modal
      footer={footer}
      icon="ph-buildings"
      onClose={close}
      open={open}
      size="large"
      title={`${branch?.name ?? 'Branch'} - Wards and Beds`}
    >
      {mode === 'ward' ? (
        <form className="modal-form-grid" id="branch-ward-form" onSubmit={submitWard}>
          {formError ? <div className="form-error-banner span-2" role="alert">{formError}</div> : null}
          <label>Ward name <span className="required">*</span><input autoFocus {...wardForm.register('name')} />{wardForm.formState.errors.name ? <small>{wardForm.formState.errors.name.message}</small> : null}</label>
          <label>Ward type <span className="required">*</span><input placeholder="General, ICU, Maternity..." {...wardForm.register('ward_type')} />{wardForm.formState.errors.ward_type ? <small>{wardForm.formState.errors.ward_type.message}</small> : null}</label>
          <label>Floor <span className="required">*</span><input {...wardForm.register('floor')} />{wardForm.formState.errors.floor ? <small>{wardForm.formState.errors.floor.message}</small> : null}</label>
          <label className="span-2">Description<textarea {...wardForm.register('description')} />{wardForm.formState.errors.description ? <small>{wardForm.formState.errors.description.message}</small> : null}</label>
        </form>
      ) : mode === 'bed' ? (
        <form className="modal-form-grid" id="branch-bed-form" onSubmit={submitBed}>
          {formError ? <div className="form-error-banner span-2" role="alert">{formError}</div> : null}
          <label className="span-2">Ward <span className="required">*</span><select autoFocus {...bedForm.register('ward_id')}><option value="">Select active ward</option>{activeWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name} - Floor {ward.floor}</option>)}</select>{bedForm.formState.errors.ward_id ? <small>{bedForm.formState.errors.ward_id.message}</small> : null}</label>
          <label>Bed number <span className="required">*</span><input {...bedForm.register('bed_number')} />{bedForm.formState.errors.bed_number ? <small>{bedForm.formState.errors.bed_number.message}</small> : null}</label>
          <label>Bed category <span className="required">*</span><input placeholder="General, ICU, Private..." {...bedForm.register('bed_category')} />{bedForm.formState.errors.bed_category ? <small>{bedForm.formState.errors.bed_category.message}</small> : null}</label>
          <label>Room number<input {...bedForm.register('room_number')} />{bedForm.formState.errors.room_number ? <small>{bedForm.formState.errors.room_number.message}</small> : null}</label>
        </form>
      ) : (
        <div className="branch-infrastructure">
          {!feature.permissions.canViewWards && !feature.permissions.canViewBeds ? (
            <EmptyState icon="ph-lock" title="Permission required" message="Ward and bed configuration access has not been assigned to this account." />
          ) : feature.status.error ? (
            <EmptyState icon="ph-warning-circle" title="Unable to load wards and beds" message={messageFor(feature.status.error)} />
          ) : feature.status.loading ? (
            <div className="um-state-cell"><span className="loading-spinner" /> Loading branch wards and beds...</div>
          ) : (
            <>
              <div className="branch-infrastructure-summary" aria-label="Branch bed summary">
                <div><span>Total beds</span><strong>{summary.total}</strong></div>
                <div><span>Available</span><strong>{summary.available}</strong></div>
                <div><span>Occupied</span><strong>{summary.occupied}</strong></div>
                <div><span>Reserved</span><strong>{summary.reserved}</strong></div>
              </div>

              <section className="branch-infrastructure-section">
                <div className="section-heading">
                  <div><h2>Wards</h2><p>{wardMeta?.total ?? wards.length} configured for this branch</p></div>
                  {feature.permissions.canCreateWard ? <button className="btn-secondary compact" onClick={() => { setFormError(''); setMode('ward'); }} type="button"><i className="ph ph-plus" /> Add Ward</button> : null}
                </div>
                {wards.length === 0 ? (
                  <EmptyState icon="ph-buildings" title="No wards configured" message="Add the first ward before creating beds for this branch." />
                ) : (
                  <div className="table-responsive"><table className="data-table"><thead><tr><th>Ward</th><th>Type</th><th>Floor</th><th>Status</th></tr></thead><tbody>{wards.map((ward) => <tr key={ward.id}><td><strong>{ward.name}</strong><small>{ward.description || 'No description'}</small></td><td>{ward.ward_type}</td><td>{ward.floor}</td><td><StatusBadge tone={toneFor(ward.status)}>{labelFor(ward.status)}</StatusBadge></td></tr>)}</tbody></table></div>
                )}
              </section>

              <section className="branch-infrastructure-section">
                <div className="section-heading">
                  <div><h2>Beds</h2><p>{bedMeta?.total ?? beds.length} configured for this branch</p></div>
                  {feature.permissions.canCreateBed ? <button className="btn-secondary compact" disabled={activeWards.length === 0} onClick={() => { setFormError(''); setMode('bed'); }} type="button"><i className="ph ph-plus" /> Add Bed</button> : null}
                </div>
                {beds.length === 0 ? (
                  <EmptyState icon="ph-bed" title="No beds configured" message={activeWards.length === 0 ? 'Create an active ward before adding beds.' : 'Add the first bed for this branch.'} />
                ) : (
                  <div className="table-responsive"><table className="data-table"><thead><tr><th>Bed</th><th>Ward</th><th>Room</th><th>Category</th><th>Status</th></tr></thead><tbody>{beds.map((bed) => <tr key={bed.id}><td><strong>{bed.bed_number}</strong></td><td>{bed.ward_name}</td><td>{bed.room_number || '-'}</td><td>{bed.bed_category}</td><td><StatusBadge tone={toneFor(bed.status)}>{labelFor(bed.status)}</StatusBadge></td></tr>)}</tbody></table></div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
