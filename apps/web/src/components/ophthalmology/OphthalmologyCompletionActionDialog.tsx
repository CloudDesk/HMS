import { confirmAction } from '../ui/confirm-action';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { deferralWriteSchema, overrideWriteSchema } from '../../api/ophthalmology-completion';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors, inputInstant, localDateTime } from './OphthalmologyConfigurationEditor';
import { QueueLookupPages } from './OphthalmologyQueueActionDialog';
import { Modal } from '../ui/Modal';

const formSchema = z.object({ source: z.string(), responsible_doctor_id: z.string(), reason: z.string().trim().min(1).max(2000), review_plan: z.string().max(2000), due_at: z.string().nullable() });
export function OphthalmologyCompletionActionDialog({ feature: f, action }: { feature: OphthalmologyCompletionFeature; action: 'defer' | 'override' }) {
  const [baseline] = useState({ version: f.finalizationVersion, unmet: f.unmet, readiness: JSON.stringify(f.readiness) });
  const { register, control, handleSubmit, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { source: '', responsible_doctor_id: '', reason: '', review_plan: '', due_at: null } });
  const values = useWatch({ control });
  const committed = useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'completion_action']);
  const changed = baseline.version !== f.finalizationVersion || baseline.readiness !== JSON.stringify(f.readiness) || action === 'override' && baseline.unmet.map((row) => row.code).sort().join() !== f.unmet.map((row) => row.code).sort().join();
  const sources = [...f.tasks.map((task) => ({ key: `TEST_TASK:${task.id}`, label: `${task.test_name} · ${task.laterality} · ${task.status}` })), ...f.orders.map((order) => ({ key: `CLINICAL_ORDER:${order.id}`, label: `${order.order_type} · ${order.status} · ${order.id}` }))];
  const selectable = action === 'override' ? baseline.unmet.length > 0 : sources.some((source) => source.key === values.source) && f.doctors.some((doctor) => doctor.id === values.responsible_doctor_id);
  const editingDisabled = !f.writable || f.busy || isSubmitting || changed || baseline.version === undefined;
  const disabled = editingDisabled || action === 'defer' && f.deferralLookupsUnavailable;
  const close = () => { if (!f.busy && !isSubmitting) f.setQuery({ completion_action: null }); };
  return <Modal open size="large" className="oph-workspace" title={action === 'defer' ? 'Record result deferral' : 'Request authorized completion override'} onClose={close} footer={<><button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={close}>Close</button><button type="submit" form="oph-completion-action" className="doc-btn primary" disabled={disabled || !selectable}>Record {action === 'defer' ? 'deferral' : 'override'}</button></>}>
    <p>Finalization version {baseline.version ?? 'Unavailable'}. This action does not complete the consultation.</p>{changed && <p role="alert">The saved state or unmet requirements changed. Your entries remain here. Close and reopen after reviewing the refreshed information.</p>}
    <button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={() => void f.refresh()}>Refresh readiness/history</button>
    <form id="oph-completion-action" onSubmit={handleSubmit(async (form) => {
      if (disabled || !selectable || baseline.version === undefined) return;
      try {
        if (!await confirmAction(action === 'defer' ? 'Record this result deferral, plan and responsible clinician? A deferral is not a review.' : 'Record this authorized override for every listed unmet requirement? The server rechecks configuration and permissions.')) return;
        let saved;
        if (action === 'defer') {
          const [type, sourceId] = form.source.split(':');
          const body = deferralWriteSchema.parse({ expected_version: baseline.version, source_type: type, source_id: sourceId, reason: form.reason, review_plan: form.review_plan || null, due_at: form.due_at, responsible_doctor_id: form.responsible_doctor_id });
          saved = await f.defer(body);
        } else saved = await f.override(overrideWriteSchema.parse({ expected_version: baseline.version, expected_unmet_codes: baseline.unmet.map((row) => row.code), reason: form.reason }));
        if (saved) { reset(form); committed(); f.setQuery({ completion_action: null }); }
      } catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ') : error instanceof Error ? error.message : 'Check the entered values.' }); }
    })}><EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={editingDisabled}>
      {action === 'override' ? <><p>All unmet requirements in this snapshot:</p><ul>{baseline.unmet.map((row) => <li key={row.code}>{row.code} · {row.details} · {row.resource_ids.join(', ') || 'No linked resource'}</li>)}</ul><p>An override records an exception reason. It does not mark a result reviewed, approve a prescription or authorize an unrelated action.</p></> : <>
        <label className="doc-field"><span>Unresolved source <span className="oph-required">*</span></span><select {...register('source')}><option value="">Select an authorized encounter task/order</option>{values.source && !sources.some((source) => source.key === values.source) && <option value={values.source}>Selected source (return to its page to verify)</option>}{sources.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
        {!f.canReadTasks && <p>Test Queue View is required to select a task.</p>}{!f.canReadOrders && <p>OPD Clinical Orders View is required to select an order.</p>}
        {f.canReadTasks && f.tasksQuery.isLoading && <p role="status">Loading eligible tasks…</p>}{f.canReadTasks && f.tasksQuery.isError && <p role="alert">Tasks could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.tasksQuery.refetch()}>Retry sources</button></p>}
        {f.canReadTasks && <QueueLookupPages page={f.page('deferral_page')} total={f.tasksQuery.data?.meta.totalPages ?? 0} change={(page) => f.setQuery({ deferral_page: String(page) })} label="source tasks" />}
        {f.canReadOrders && (f.labQuery.isError || f.imagingQuery.isError) && <p role="alert">Order sources could not be loaded. <button type="button" className="doc-btn" onClick={() => { void f.labQuery.refetch(); void f.imagingQuery.refetch(); }}>Retry orders</button></p>}
        <label className="doc-field"><span>Responsible clinician <span className="oph-required">*</span></span><select {...register('responsible_doctor_id')}><option value="">Select active branch/department doctor</option>{values.responsible_doctor_id && !f.doctors.some((doctor) => doctor.id === values.responsible_doctor_id) && <option value={values.responsible_doctor_id}>Selected clinician (return to their page to verify)</option>}{f.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}</select></label>
        {!f.canReadDoctors && <p>Doctor Directory View is required to select a responsible clinician.</p>}{f.canReadDoctors && f.doctorsQuery.isLoading && <p role="status">Loading doctors…</p>}{f.canReadDoctors && f.doctorsQuery.isError && <p role="alert">Doctors could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.doctorsQuery.refetch()}>Retry doctors</button></p>}{f.canReadDoctors && <QueueLookupPages page={f.page('responsible_page')} total={f.doctorsQuery.data?.meta.totalPages ?? 0} change={(page) => f.setQuery({ responsible_page: String(page) })} label="doctors" />}
        <label className="doc-field">Review plan<textarea maxLength={2000} {...register('review_plan')} /></label><Controller control={control} name="due_at" render={({ field }) => <label className="doc-field">Due date (local time)<input type="datetime-local" value={localDateTime(field.value)} onChange={(event) => field.onChange(inputInstant(event.target.value))} /></label>} /><p>Provide a review plan or a future due date. Existing deferrals and resolved sources are excluded.</p>
      </>}
      <label className="doc-field"><span>Reason <span className="oph-required">*</span></span><textarea maxLength={action === 'defer' ? 1000 : 2000} {...register('reason')} /></label>
    </fieldset>{f.error && <p role="alert" className="form-error-banner">{f.error} Entries are retained. If a response was interrupted, refresh history before retrying.</p>}</form>
  </Modal>;
}
