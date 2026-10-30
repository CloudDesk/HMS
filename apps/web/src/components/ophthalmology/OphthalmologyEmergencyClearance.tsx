import { confirmAction } from '../ui/confirm-action';
import { useState, useContext } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { clearAlertSchema, type ClearOphthalmologyAlert, type OphthalmologyAlert } from '../../api/ophthalmology';
import { inpatientAdmissionsApi } from '../../api/inpatient-admissions';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { navigate, useAppLocation } from '../../routing/navigation';
import { Modal } from '../ui/Modal';
import { AuthContext } from '../../auth/auth-context-value';
import { hasPermission } from '../../auth/access-control';

function ClearanceDialog({ alert, feature: f }: { alert: OphthalmologyAlert; feature: OphthalmologyWorkspaceFeature }) {
  const [original] = useState(alert);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ClearOphthalmologyAlert>({
    resolver: zodResolver(clearAlertSchema),
    defaultValues: { expected_version: original.version, disposition: 'RESUME_ROUTINE_OPD', clearance_rationale: '', resumption_permitted: false },
  });
  const stale = original.version !== alert.version || original.status !== alert.status;
  const close = () => f.setQuery('clear_alert_id', '');
  const disabled = !f.canClearEmergency || stale || f.busy || isSubmitting;
  return <Modal open title="Clear Emergency" className="oph-workspace" onClose={close} footer={<>
    <button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={close}>Cancel</button>
    <button type="submit" form="oph-emergency-clearance" className="doc-btn primary" disabled={disabled}>Record clearance</button>
  </>}>
    <form id="oph-emergency-clearance" onSubmit={handleSubmit(async (body) => {
      if (disabled || !await confirmAction('Record this emergency disposition? Admission disposition creates an inpatient admission request; bed allocation remains a separate step.')) return;
      const result = await f.clearEmergency(original, body);
      if (result) close();
    })}>
      <p>{original.reason}</p>
      {stale && <p role="alert">This alert changed. Close and reopen clearance to review its current version.</p>}
      {f.clearanceQuery.isError && <p role="alert">Unable to verify the alert. <button type="button" className="doc-btn" onClick={() => void f.clearanceQuery.refetch()}>Retry</button></p>}
      {f.actionError && <p role="alert" className="form-error-banner">{f.actionError}</p>}
      <fieldset disabled={disabled} className="oph-fieldset">
        <label className="doc-field"><span>Disposition <span className="required-asterisk">*</span></span>
          <select {...register('disposition')} onChange={(event) => {
            const disposition = clearAlertSchema.shape.disposition.parse(event.target.value);
            setValue('disposition', disposition, { shouldDirty: true });
            if (disposition !== 'RESUME_ROUTINE_OPD') setValue('resumption_permitted', false, { shouldDirty: true });
          }}>
            <option value="RESUME_ROUTINE_OPD">Resume routine OPD</option>
            <option value="ADMIT_TO_INPATIENT">Admit to inpatient</option>
            <option value="TRANSFER_EXTERNAL">Transfer externally</option>
          </select>
        </label>
        <label className="doc-field"><span>Clearance rationale <span className="required-asterisk">*</span></span><textarea maxLength={5000} {...register('clearance_rationale')} /></label>
        {errors.clearance_rationale && <p role="alert">{errors.clearance_rationale.message}</p>}
        <label><input type="checkbox" {...register('resumption_permitted')} disabled={watch('disposition') !== 'RESUME_ROUTINE_OPD'} /> Routine OPD resumption permitted</label>
        {errors.resumption_permitted && <p role="alert">{errors.resumption_permitted.message}</p>}
      </fieldset>
    </form>
  </Modal>;
}

export function EmergencyAdmissionRequestCard({
  admissionRequestId,
  branchId,
}: {
  admissionRequestId: string;
  branchId: string;
}) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];
  const isSuper = Boolean(roles.some((r) => r.code === 'SUPER_ADMIN'));
  const canViewAdmissions = isSuper || (Boolean(user) && hasPermission(permissions, { module: 'Admissions', screen: 'Admission Requests', action: 'View' }, roles));
  const canViewBeds = isSuper || (Boolean(user) && hasPermission(permissions, { module: 'Admissions', screen: 'Bed Management', action: 'View' }, roles));

  const { data: request, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admissions', 'request', admissionRequestId, branchId],
    queryFn: () => inpatientAdmissionsApi.request(admissionRequestId, branchId),
    enabled: Boolean(admissionRequestId && branchId),
    staleTime: 10_000,
  });

  return (
    <div
      role="region"
      aria-label="Inpatient Admission Handoff"
      style={{
        marginTop: '12px',
        padding: '14px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🏥</span> Inpatient Admission Request (Emergency Handoff)
        </h4>
        <button
          type="button"
          className="doc-btn"
          onClick={() => void refetch()}
          disabled={isFetching}
          title="Refresh admission request status"
          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
        >
          {isFetching ? 'Refreshing...' : '🔄 Refresh Status'}
        </button>
      </div>

      <div style={{ fontSize: '0.9rem', color: '#1e293b', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        <div>
          <strong>Request ID:</strong> <span style={{ fontFamily: 'monospace' }}>{admissionRequestId}</span>
        </div>
        <div>
          <strong>Request Number:</strong> <span>{request?.request_number ?? (isLoading ? 'Loading...' : '—')}</span>
        </div>
        <div>
          <strong>Status:</strong>{' '}
          {isLoading ? (
            <span>Loading...</span>
          ) : request ? (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: request.status === 'CONFIRMED' ? '#dcfce7' : request.status === 'CANCELLED' ? '#fee2e2' : '#fef3c7',
                color: request.status === 'CONFIRMED' ? '#166534' : request.status === 'CANCELLED' ? '#991b1b' : '#92400e',
              }}
            >
              {request.status}
            </span>
          ) : (
            <span style={{ color: '#64748b' }}>Awaiting Validation</span>
          )}
        </div>
        <div>
          <strong>Priority:</strong> <span>{request?.priority ?? 'EMERGENCY'}</span>
        </div>
      </div>

      {isError && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '8px' }}>
          ⚠️ Unable to fetch live admission request details. The request was recorded; please check Inpatient queue or retry.
          <button type="button" className="doc-btn" onClick={() => void refetch()} style={{ marginLeft: '8px', fontSize: '0.75rem', padding: '2px 6px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Bed allocation clarity: Crucial safeguard to not falsely claim bed is allocated */}
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: request?.bed_id ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${request?.bed_id ? '#bbf7d0' : '#fef3c7'}`,
          fontSize: '0.85rem',
          marginBottom: '12px',
        }}
      >
        {request?.bed_id ? (
          <p style={{ margin: 0, color: '#166534' }}>
            ✅ <strong>Bed Allocated:</strong> Bed {request.bed_id} (Ward: {request.ward_id ?? 'Assigned'}).
          </p>
        ) : (
          <p style={{ margin: 0, color: '#92400e' }}>
            ⏳ <strong>Bed Status:</strong> Awaiting inpatient bed coordination. Bed allocation is performed separately by the admission/nursing desk.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {canViewAdmissions && (
          <button
            type="button"
            className="doc-btn primary"
            onClick={() => navigate(`/admissions/requests?search=${encodeURIComponent(request?.request_number || admissionRequestId)}`)}
          >
            📋 Open Inpatient Request Queue →
          </button>
        )}
        {canViewBeds && (
          <button
            type="button"
            className="doc-btn"
            onClick={() => navigate('/admissions/bed-availability')}
          >
            🛏️ Check Bed Availability →
          </button>
        )}
        {!canViewAdmissions && !canViewBeds && (
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Inpatient bed allocation requires Admission / Inpatient permissions. Hand off Request ID <strong>{admissionRequestId}</strong> to the IP Admissions desk.
          </span>
        )}
      </div>
    </div>
  );
}

export function OphthalmologyEmergencyClearance({ feature: f, view = 'all' }: { feature: OphthalmologyWorkspaceFeature; view?: 'all' | 'dialog' | 'history' }) {
  const { search } = useAppLocation();
  const selectedId = new URLSearchParams(search).get('clear_alert_id');
  const alerts = f.emergencyAlerts ?? [];
  const selected = alerts.find((alert) => alert.id === selectedId && alert.status !== 'CLEARED');
  return <>
    {view !== 'dialog' && alerts.filter((alert) => view !== 'history' || alert.status === 'CLEARED').map((alert) => <section className="doc-card" key={alert.id}>
      <h3>Emergency disposition · {alert.status}</h3><p>{alert.reason}</p>
      {alert.clearance && <><p>{alert.clearance.disposition} · {alert.clearance.clearance_rationale}</p>
        <p>Cleared {new Date(alert.clearance.cleared_at).toLocaleString()} · clinician {alert.clearance.cleared_by} · Routine resumption {alert.clearance.resumption_permitted ? 'permitted' : 'not permitted'}</p>
        {alert.clearance.admission_request_id ? (
          <EmergencyAdmissionRequestCard
            admissionRequestId={alert.clearance.admission_request_id}
            branchId={alert.branch_id}
          />
        ) : alert.clearance.disposition === 'ADMIT_TO_INPATIENT' ? (
          <p role="alert" className="form-error-banner" style={{ marginTop: '8px' }}>
            ⚠️ Emergency disposition was marked ADMIT_TO_INPATIENT, but no admission request ID was returned by the server.
          </p>
        ) : null}</>}
      {f.canClearEmergency && alert.status !== 'CLEARED' && <button type="button" className="doc-btn" onClick={() => f.setQuery('clear_alert_id', alert.id)}>Clear Emergency</button>}
    </section>)}
    {view !== 'history' && selected && <ClearanceDialog key={`${f.visitId}-${selected.id}`} alert={selected} feature={f} />}
  </>;
}
