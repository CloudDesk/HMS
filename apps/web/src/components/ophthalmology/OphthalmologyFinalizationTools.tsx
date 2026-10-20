import { useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CompletionWorkspace, OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { useOphthalmologyFinalizationFeature, type OphthalmologyFinalizationFeature } from '../../hooks/ophthalmology/useOphthalmologyFinalizationFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { amendmentWriteSchema, completeWriteSchema, reopenWriteSchema, planCorrectionSchema } from '../../api/ophthalmology-completion';
import { Modal } from '../ui/Modal';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

const formSchema = z.object({ reason: z.string().trim().max(2000), section: z.enum(['', 'patient_instructions', 'clinical_summary', 'follow_up_decision', 'treatment_plans']), after: z.string().max(10000), follow_up_decision: z.enum(['', 'FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']), plans: z.array(planCorrectionSchema).max(100) });
function FinalizationDialog({ completion: c, feature: f }: { completion: OphthalmologyCompletionFeature; feature: OphthalmologyFinalizationFeature }) {
  const [baseline] = useState({ version: c.finalizationVersion, readiness: c.readiness, signature: JSON.stringify(c.readiness), source: f.source, episode: c.history?.amendment_episodes.find((e) => e.status === 'OPEN')?.id });
  const key = useRef(crypto.randomUUID());
  const { register, control, handleSubmit, setError, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { reason: '', section: '', after: '', follow_up_decision: baseline.source?.current.follow_up_decision ?? '', plans: baseline.source?.current.treatment_plans.map(({ clinician_user_id, ...plan }) => { void clinician_user_id; return plan; }) ?? [] } });
  const plans = useFieldArray({ control, name: 'plans', keyName: 'form_key' });
  const values = useWatch({ control });
  const committed = useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'finalization_action']);
  const changed = baseline.version !== c.finalizationVersion || baseline.signature !== JSON.stringify(c.readiness) || (f.action === 'amend' && baseline.source?.version !== f.source?.version);
  const allowed = f.action === 'complete' ? f.canComplete : f.action === 'reopen' ? f.canReopen : f.canAmend && f.sourceReady;
  const disabled = !allowed || changed || f.busy || isSubmitting;
  const close = () => { if (!f.busy && !isSubmitting) c.setQuery({ finalization_action: null }); };
  const before = values.section ? baseline.source?.current[values.section] : undefined;
  return <Modal open size="large" className="oph-workspace" title={f.action === 'complete' ? 'Doctor approval and completion' : f.action === 'reopen' ? 'Reopen for amendment' : 'Correct clinical source'} onClose={close} footer={<><button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={close}>Close</button><button className="doc-btn primary" type="submit" form="oph-finalization" disabled={disabled}>{f.action === 'complete' ? 'Approve exact consultation version' : f.action === 'reopen' ? 'Open amendment episode' : 'Save correction for reapproval'}</button></>}>
    <p>Original finalization version {baseline.version}. Approval records your authenticated doctor identity and time.</p>{changed && <p role="alert">Saved information changed. Your entries remain here; close and review the latest versions before continuing.</p>}
    <button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={() => { void c.refresh(); if (f.action === 'amend') void f.sourceQuery.refetch(); }}>Refresh saved information</button>
    <form id="oph-finalization" onSubmit={handleSubmit(async (values) => {
      if (disabled || baseline.version === undefined || !baseline.readiness) return;
      try {
        let saved;
        if (f.action === 'complete') {
          if (baseline.readiness.clinical_review_version === null) return;
          if (!window.confirm('Approve and complete these exact consultation versions? Outstanding checks require an existing authorized server override. This records authenticated approval; it does not publish patient records.')) return;
          saved = await f.complete(completeWriteSchema.parse({ expected_version: baseline.version, expected_context_version: baseline.readiness.context_version,
            expected_consultation_version: baseline.readiness.consultation_version, expected_clinical_review_version: baseline.readiness.clinical_review_version,
            expected_optical_prescription_version: baseline.readiness.optical_prescription_version }), key.current);
        } else if (f.action === 'reopen') {
          const body = reopenWriteSchema.parse({ expected_version: baseline.version, expected_status: 'COMPLETED', reason: values.reason });
          if (!window.confirm('Open an amendment episode and withdraw active publication snapshots for this consultation? Original versions remain immutable and corrections require doctor reapproval.')) return;
          saved = await f.reopen(body);
        } else if (values.section && baseline.episode && baseline.source) {
          const body = amendmentWriteSchema.parse({ expected_version: baseline.version, expected_status: 'AMENDMENT_OPEN', episode_id: baseline.episode,
            section: values.section, before_value: before ?? null, after_value: values.section === 'treatment_plans' ? values.plans : values.section === 'follow_up_decision' ? values.follow_up_decision || null : values.after.trim() || null, reason: values.reason });
          if (!window.confirm('Save this correction as a new clinical source version? The prior approved record remains preserved.')) return;
          saved = await f.amend(body);
        }
        if (saved) { committed(); c.setQuery({ finalization_action: null }); }
      } catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') : error instanceof Error ? error.message : 'Check the entered values.' }); }
    })}><EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={disabled}>
      {f.action === 'complete' ? <><p>Context {baseline.readiness?.context_version} · consultation {baseline.readiness?.consultation_version} · clinical review {baseline.readiness?.clinical_review_version} · optical {baseline.readiness?.optical_prescription_version ?? 'None'}</p><ul>{baseline.readiness?.requirements.map((r) => <li key={r.code}>{r.code} · {r.satisfied ? 'Satisfied' : 'Unmet — recorded override required'} · {r.details}</li>)}</ul></> : <>
        {f.action === 'amend' && <><label className="doc-field">Source section <span className="oph-required">*</span><select {...register('section')}><option value="">Select supported source section</option><option value="patient_instructions">Patient instructions</option><option value="clinical_summary">Clinical summary</option><option value="follow_up_decision">Follow-up decision</option><option value="treatment_plans">Treatment plans</option></select></label><p>Saved before value: {Array.isArray(before) ? `${before.length} saved treatment plans` : before ?? 'Not recorded'}</p>{values.section === 'follow_up_decision' ? <label className="doc-field">Corrected follow-up decision<select {...register('follow_up_decision')}><option value="">Not recorded — reapproval checks still apply</option><option value="FOLLOW_UP_RECORDED">Follow-up recorded</option><option value="NO_FOLLOW_UP">No follow-up</option></select></label> : values.section === 'treatment_plans' ? <><p>Changes apply to the treatment plan record. Linked prescriptions, orders, procedures and appointments are preserved and require their own actions.</p>{plans.fields.map((plan, index) => <section className="doc-card" key={plan.form_key}><h4>{plan.diagnosis_code} · {plan.diagnosis_laterality}</h4><label className="doc-field">Treatment <span className="oph-required">*</span><textarea {...register(`plans.${index}.treatment`)} maxLength={4000} /></label><label className="doc-field">Category <span className="oph-required">*</span><input {...register(`plans.${index}.category`)} maxLength={80} /></label><label className="doc-field">Priority<select {...register(`plans.${index}.priority`)}><option>ROUTINE</option><option>URGENT</option><option>EMERGENCY</option></select></label><label className="doc-field">Plan status<select {...register(`plans.${index}.status`)}><option>PLANNED</option><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select></label></section>)}{!plans.fields.length && <p>No existing treatment plans to correct.</p>}</> : <label className="doc-field">Corrected value<textarea {...register('after')} maxLength={values.section === 'clinical_summary' ? 10000 : 4000} /></label>}<p>This changes the clinical source and records an immutable before/after journal. Diagnosis, optical and test result changes require their separate typed correction workflows.</p></>}
        <label className="doc-field">Reason <span className="oph-required">*</span><textarea {...register('reason')} maxLength={2000} /></label>
      </>}
    </fieldset>{f.error && <p role="alert" className="form-error-banner">{f.error} Entries are retained. If the response was interrupted, refresh history before retrying.</p>}</form>
  </Modal>;
}
export function OphthalmologyFinalizationTools({ workspace, completion: c }: { workspace: CompletionWorkspace; completion: OphthalmologyCompletionFeature }) {
  const f = useOphthalmologyFinalizationFeature(workspace, c);
  return <section className="doc-card"><h4>Doctor approval and amendment</h4><p>Completion evaluates the approved server configuration. Missing hospital configuration is not treated as satisfied. Publication is a separate authorized action.</p><div className="oph-toolbar">
    {f.canComplete && <button className="doc-btn primary" type="button" disabled={f.busy} onClick={() => c.setQuery({ completion_action: null, finalization_action: 'complete' })}>{c.history?.status === 'AMENDMENT_OPEN' ? 'Reapprove corrected consultation' : 'Approve and complete consultation'}</button>}
    {f.canReopen && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => c.setQuery({ completion_action: null, finalization_action: 'reopen' })}>Reopen for amendment</button>}
    {f.canAmend && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => c.setQuery({ completion_action: null, finalization_action: 'amend' })}>Correct clinical source</button>}
  </div>{f.action === 'amend' && !f.source && <><p role="status">{f.sourceQuery.isError ? 'Clinical source could not be loaded.' : 'Loading supported clinical source…'}</p><button type="button" className="doc-btn" onClick={() => void f.sourceQuery.refetch()}>Retry clinical source</button><button type="button" className="doc-btn" onClick={() => c.setQuery({ finalization_action: null })}>Close amendment</button></>}
    {f.action && c.finalizationVersion !== undefined && (f.action !== 'amend' || f.source) && <FinalizationDialog key={f.action} completion={c} feature={f} />}
    {!f.action && f.error && <p role="alert">{f.error}</p>}
  </section>;
}
