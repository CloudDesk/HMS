import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
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

const toneFor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'AVAILABLE':
      return 'green' as const;
    case 'OCCUPIED':
      return 'red' as const;
    case 'RESERVED':
      return 'orange' as const;
    case 'BLOCKED':
      return 'purple' as const;
    default:
      return 'gray' as const;
  }
};

const labelFor = (status: string) =>
  status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (value) => value.toUpperCase());

const PAGE_SIZE = 10;

export function BranchWardBedConfiguration({
  branch,
  open,
  onClose,
}: BranchWardBedConfigurationProps) {
  const [mode, setMode] = useState<PanelMode>('overview');
  const [formError, setFormError] = useState('');
  const [wardPage, setWardPage] = useState(1);
  const [bedPage, setBedPage] = useState(1);

  const feature = useBranchWardBedConfigurationFeature({
    branchId: branch?.id ?? '',
    enabled: open && Boolean(branch),
  });

  const { wards, beds, summary } = feature.data;
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
      setWardPage(1);
      setBedPage(1);
      wardForm.reset();
      bedForm.reset();
    }
  }, [bedForm, open, wardForm]);

  // Paginated Wards (10 per page)
  const totalWardPages = Math.ceil(wards.length / PAGE_SIZE) || 1;
  const paginatedWards = useMemo(() => {
    const start = (wardPage - 1) * PAGE_SIZE;
    return wards.slice(start, start + PAGE_SIZE);
  }, [wards, wardPage]);

  // Paginated Beds (10 per page)
  const totalBedPages = Math.ceil(beds.length / PAGE_SIZE) || 1;
  const paginatedBeds = useMemo(() => {
    const start = (bedPage - 1) * PAGE_SIZE;
    return beds.slice(start, start + PAGE_SIZE);
  }, [beds, bedPage]);

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
      setWardPage(1);
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
      setBedPage(1);
    } catch (error) {
      setFormError(messageFor(error));
    }
  });

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (page: number) => void,
    itemLabel: string,
  ) => {
    if (totalItems <= PAGE_SIZE) return null;

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalItems);

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderTop: '1px solid #f1f5f9',
          background: '#fafafa',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          fontSize: '0.8rem',
          color: '#64748b',
        }}
      >
        <div>
          Showing <strong style={{ color: '#1e293b' }}>{start}</strong> to{' '}
          <strong style={{ color: '#1e293b' }}>{end}</strong> of{' '}
          <strong style={{ color: '#1e293b' }}>{totalItems}</strong> {itemLabel}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: currentPage === 1 ? '#f8fafc' : '#ffffff',
              color: currentPage === 1 ? '#94a3b8' : '#334155',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <i className="ph ph-caret-left" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((pageNum, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = idx > 0 && prev !== undefined && pageNum - prev > 1;
              return (
                <span key={pageNum} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {showEllipsis && <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(pageNum)}
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      border: pageNum === currentPage ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: pageNum === currentPage ? '#2563eb' : '#ffffff',
                      color: pageNum === currentPage ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                    }}
                  >
                    {pageNum}
                  </button>
                </span>
              );
            })}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: currentPage === totalPages ? '#f8fafc' : '#ffffff',
              color: currentPage === totalPages ? '#94a3b8' : '#334155',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <i className="ph ph-caret-right" />
          </button>
        </div>
      </div>
    );
  };

  const footer =
    mode === 'overview' ? (
      <button
        className="btn-secondary"
        onClick={close}
        type="button"
        style={{
          padding: '0.5rem 1.25rem',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          background: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Close
      </button>
    ) : (
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            setFormError('');
            setMode('overview');
          }}
          type="button"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Overview
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          form={mode === 'ward' ? 'branch-ward-form' : 'branch-bed-form'}
          type="submit"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <i className="ph ph-check" />
          {busy ? 'Saving...' : mode === 'ward' ? 'Save Ward' : 'Save Bed'}
        </button>
      </div>
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
        <form
          className="modal-form-grid"
          id="branch-ward-form"
          onSubmit={submitWard}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '480px' }}
        >
          {formError ? (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '0.82rem',
              }}
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="adm-field">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Ward Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                autoFocus
                {...wardForm.register('name')}
                placeholder="e.g. General Ward A, ICU-1"
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
              />
              {wardForm.formState.errors.name && (
                <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {wardForm.formState.errors.name.message}
                </small>
              )}
            </div>

            <div className="adm-field">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Ward Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                placeholder="General, ICU, Maternity, Pediatric..."
                {...wardForm.register('ward_type')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
              />
              {wardForm.formState.errors.ward_type && (
                <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {wardForm.formState.errors.ward_type.message}
                </small>
              )}
            </div>
          </div>

          <div className="adm-field">
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Floor / Building Wing <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              placeholder="e.g. 1st Floor, Ground Floor - Block B"
              {...wardForm.register('floor')}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
            />
            {wardForm.formState.errors.floor && (
              <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {wardForm.formState.errors.floor.message}
              </small>
            )}
          </div>

          <div className="adm-field">
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Description <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              placeholder="Brief description or facilities in this ward..."
              rows={2}
              {...wardForm.register('description')}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '0.84rem' }}
            />
            {wardForm.formState.errors.description && (
              <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {wardForm.formState.errors.description.message}
              </small>
            )}
          </div>
        </form>
      ) : mode === 'bed' ? (
        <form
          className="modal-form-grid"
          id="branch-bed-form"
          onSubmit={submitBed}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '480px' }}
        >
          {formError ? (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '0.82rem',
              }}
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <div className="adm-field">
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Assigned Ward <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              autoFocus
              {...bedForm.register('ward_id')}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
            >
              <option value="">Select active ward</option>
              {activeWards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name} (Floor: {ward.floor}) - {ward.ward_type}
                </option>
              ))}
            </select>
            {bedForm.formState.errors.ward_id && (
              <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {bedForm.formState.errors.ward_id.message}
              </small>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="adm-field">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Bed Number / Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                placeholder="e.g. B01, Bed-101"
                {...bedForm.register('bed_number')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
              />
              {bedForm.formState.errors.bed_number && (
                <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {bedForm.formState.errors.bed_number.message}
                </small>
              )}
            </div>

            <div className="adm-field">
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Bed Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                placeholder="General, Semi-Private, ICU, Deluxe..."
                {...bedForm.register('bed_category')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
              />
              {bedForm.formState.errors.bed_category && (
                <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {bedForm.formState.errors.bed_category.message}
                </small>
              )}
            </div>
          </div>

          <div className="adm-field">
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Room / Bay Number <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              placeholder="e.g. Room 102, Bay 3"
              {...bedForm.register('room_number')}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.84rem' }}
            />
            {bedForm.formState.errors.room_number && (
              <small style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {bedForm.formState.errors.room_number.message}
              </small>
            )}
          </div>
        </form>
      ) : (
        <div className="branch-infrastructure" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!feature.permissions.canViewWards && !feature.permissions.canViewBeds ? (
            <EmptyState
              icon="ph-lock"
              title="Permission required"
              message="Ward and bed configuration access has not been assigned to this account."
            />
          ) : feature.status.error ? (
            <EmptyState
              icon="ph-warning-circle"
              title="Unable to load wards and beds"
              message={messageFor(feature.status.error)}
            />
          ) : feature.status.loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.88rem' }}>
              <i className="ph ph-spinner ph-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }} />
              Loading branch wards and beds...
            </div>
          ) : (
            <>
              {/* Summary Metrics Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.85rem',
                }}
                aria-label="Branch bed summary"
              >
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                    }}
                  >
                    <i className="ph ph-bed" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                      Total Beds
                    </span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                      {summary.total}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                    }}
                  >
                    <i className="ph ph-check-circle" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                      Available
                    </span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
                      {summary.available}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                    }}
                  >
                    <i className="ph ph-user" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                      Occupied
                    </span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.1 }}>
                      {summary.occupied}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#fffbeb',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                    }}
                  >
                    <i className="ph ph-clock" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>
                      Reserved
                    </span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', lineHeight: 1.1 }}>
                      {summary.reserved}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Wards */}
              <section
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ph ph-buildings" style={{ color: '#2563eb' }} /> Wards
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', background: '#eff6ff', color: '#2563eb' }}>
                        {wards.length}
                      </span>
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                      {wards.length} ward{wards.length === 1 ? '' : 's'} configured for this branch
                    </p>
                  </div>
                  {feature.permissions.canCreateWard ? (
                    <button
                      className="btn-secondary compact"
                      onClick={() => {
                        setFormError('');
                        setMode('ward');
                      }}
                      type="button"
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="ph ph-plus" /> Add Ward
                    </button>
                  ) : null}
                </div>

                {wards.length === 0 ? (
                  <div style={{ padding: '1.5rem' }}>
                    <EmptyState
                      icon="ph-buildings"
                      title="No wards configured"
                      message="Add the first ward before creating beds for this branch."
                    />
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Ward</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Type</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Floor</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedWards.map((ward) => (
                            <tr
                              key={ward.id}
                              style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                            >
                              <td style={{ padding: '10px 14px' }}>
                                <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.84rem' }}>{ward.name}</strong>
                                <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block', marginTop: '2px' }}>
                                  {ward.description || 'No description'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#334155' }}>{ward.ward_type}</td>
                              <td style={{ padding: '10px 14px', color: '#334155' }}>{ward.floor}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <StatusBadge tone={toneFor(ward.status)}>{labelFor(ward.status)}</StatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {renderPagination(wardPage, totalWardPages, wards.length, setWardPage, 'wards')}
                  </>
                )}
              </section>

              {/* Section 2: Beds */}
              <section
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ph ph-bed" style={{ color: '#059669' }} /> Beds
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', background: '#ecfdf5', color: '#059669' }}>
                        {beds.length}
                      </span>
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                      {beds.length} bed{beds.length === 1 ? '' : 's'} configured for this branch
                    </p>
                  </div>
                  {feature.permissions.canCreateBed ? (
                    <button
                      className="btn-secondary compact"
                      disabled={activeWards.length === 0}
                      onClick={() => {
                        setFormError('');
                        setMode('bed');
                      }}
                      type="button"
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: activeWards.length === 0 ? '#f1f5f9' : '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: activeWards.length === 0 ? '#94a3b8' : '#1e293b',
                        cursor: activeWards.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="ph ph-plus" /> Add Bed
                    </button>
                  ) : null}
                </div>

                {beds.length === 0 ? (
                  <div style={{ padding: '1.5rem' }}>
                    <EmptyState
                      icon="ph-bed"
                      title="No beds configured"
                      message={
                        activeWards.length === 0
                          ? 'Create an active ward before adding beds.'
                          : 'Add the first bed for this branch.'
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Bed</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Ward</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Room</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Category</th>
                            <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBeds.map((bed) => (
                            <tr
                              key={bed.id}
                              style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                            >
                              <td style={{ padding: '10px 14px' }}>
                                <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>{bed.bed_number}</strong>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#334155' }}>{bed.ward_name}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>{bed.room_number || '—'}</td>
                              <td style={{ padding: '10px 14px', color: '#334155' }}>{bed.bed_category}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <StatusBadge tone={toneFor(bed.status)}>{labelFor(bed.status)}</StatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {renderPagination(bedPage, totalBedPages, beds.length, setBedPage, 'beds')}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
