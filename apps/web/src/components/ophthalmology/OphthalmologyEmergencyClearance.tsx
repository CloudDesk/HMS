import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clearAlertSchema, type ClearOphthalmologyAlert, type OphthalmologyAlert } from '../../api/ophthalmology';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { useAppLocation } from '../../routing/navigation';
import { Modal } from '../ui/Modal';

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
      if (disabled || !window.confirm('Record this emergency disposition? Admission disposition creates an inpatient admission request; bed allocation remains a separate step.')) return;
      const result = await f.clearEmergency(original, body);
      if (result) close();
    })}>
      <p>{original.reason}</p>
      {stale && <p role="alert">This alert changed. Close and reopen clearance to review its current version.</p>}
      {f.clearanceQuery.isError && <p role="alert">Unable to verify the alert. <button type="button" className="doc-btn" onClick={() => void f.clearanceQuery.refetch()}>Retry</button></p>}
      {f.actionError && <p role="alert" className="form-error-banner">{f.actionError}</p>}
      <fieldset disabled={disabled} className="oph-fieldset">
        <label className="doc-field">Disposition <span className="required-asterisk">*</span>
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
        <label className="doc-field">Clearance rationale <span className="required-asterisk">*</span><textarea maxLength={5000} {...register('clearance_rationale')} /></label>
        {errors.clearance_rationale && <p role="alert">{errors.clearance_rationale.message}</p>}
        <label><input type="checkbox" {...register('resumption_permitted')} disabled={watch('disposition') !== 'RESUME_ROUTINE_OPD'} /> Routine OPD resumption permitted</label>
        {errors.resumption_permitted && <p role="alert">{errors.resumption_permitted.message}</p>}
      </fieldset>
    </form>
  </Modal>;
}

export function OphthalmologyEmergencyClearance({ feature: f }: { feature: OphthalmologyWorkspaceFeature }) {
  const { search } = useAppLocation();
  const selectedId = new URLSearchParams(search).get('clear_alert_id');
  const alerts = f.emergencyAlerts ?? [];
  const selected = alerts.find((alert) => alert.id === selectedId && alert.status !== 'CLEARED');
  return <>
    {alerts.map((alert) => <section className="doc-card" key={alert.id}>
      <h3>Emergency disposition · {alert.status}</h3><p>{alert.reason}</p>
      {alert.clearance && <><p>{alert.clearance.disposition} · {alert.clearance.clearance_rationale}</p>
        <p>Cleared {new Date(alert.clearance.cleared_at).toLocaleString()} · clinician {alert.clearance.cleared_by} · Routine resumption {alert.clearance.resumption_permitted ? 'permitted' : 'not permitted'}</p>
        {alert.clearance.admission_request_id && <p>Admission request: {alert.clearance.admission_request_id}. Awaiting admission workflow and bed coordination.</p>}</>}
      {f.canClearEmergency && alert.status !== 'CLEARED' && <button type="button" className="doc-btn" onClick={() => f.setQuery('clear_alert_id', alert.id)}>Clear Emergency</button>}
    </section>)}
    {selected && <ClearanceDialog key={`${f.visitId}-${selected.id}`} alert={selected} feature={f} />}
  </>;
}
