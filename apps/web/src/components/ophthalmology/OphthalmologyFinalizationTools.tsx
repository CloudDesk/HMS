import { confirmAction } from '../ui/confirm-action';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CompletionWorkspace, OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { useOphthalmologyFinalizationFeature, type OphthalmologyFinalizationFeature } from '../../hooks/ophthalmology/useOphthalmologyFinalizationFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { amendmentWriteSchema, completeWriteSchema, reopenWriteSchema, planCorrectionSchema } from '../../api/ophthalmology-completion';
import { ophthalmologyIdSchema as id } from '../../api/ophthalmology';
import { treatmentActionTypeSchema, treatmentWriteBaseSchema } from '../../api/ophthalmology-care';
import { Modal } from '../ui/Modal';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
import { OphthalmologyTreatmentLinks } from './OphthalmologyTreatmentLinks';

const correctionEditorSchema = z.object({ ...treatmentWriteBaseSchema.shape, id: id.optional(),
  action_type: z.union([treatmentActionTypeSchema, z.literal('')]), legacy_category: z.string().nullable().optional(),
}).strict();
const formSchema = z.object({ reason: z.string().trim().max(2000), section: z.enum(['', 'patient_instructions', 'clinical_summary', 'follow_up_decision', 'treatment_plans']), after: z.string().max(10000), follow_up_decision: z.enum(['', 'FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP']), plans: z.array(correctionEditorSchema).max(100) });
function FinalizationDialog({ workspace, completion: c, feature: f }: { workspace: CompletionWorkspace; completion: OphthalmologyCompletionFeature; feature: OphthalmologyFinalizationFeature }) {
  const [baseline, setBaseline] = useState({ version: c.finalizationVersion, readiness: c.readiness, signature: JSON.stringify(c.readiness), source: f.source, episode: c.history?.amendment_episodes.find((e) => e.status === 'OPEN')?.id });
  const [linkRow, setLinkRow] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const { register, control, handleSubmit, setError, setValue, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { reason: '', section: '', after: '', follow_up_decision: baseline.source?.current.follow_up_decision ?? '', plans: baseline.source?.current.treatment_plans.map((plan) => ({
    id: plan.id, diagnosis_code: plan.diagnosis_code, diagnosis_laterality: plan.diagnosis_laterality, treatment: plan.treatment,
    action_type: plan.action_type ?? '', legacy_category: plan.legacy_category, priority: plan.priority, status: plan.status,
    medication_prescription_id: plan.medication_prescription_id, optical_prescription_id: plan.optical_prescription_id,
    clinical_order_ids: plan.clinical_order_ids, procedure_recommendation_id: plan.procedure_recommendation_id,
    referral_id: plan.referral_id, follow_up_id: plan.follow_up_id,
  })) ?? [] } });
  const plans = useFieldArray({ control, name: 'plans', keyName: 'form_key' });
  const values = useWatch({ control });
  const committed = useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'finalization_action']);
  const changed = baseline.version !== c.finalizationVersion || baseline.signature !== JSON.stringify(c.readiness) || (f.action === 'amend' && baseline.source?.version !== f.source?.version);
  const allowed = f.action === 'complete' ? f.canComplete : f.action === 'reopen' ? f.canReopen : f.canAmend && f.sourceReady;
  const disabled = !allowed || changed || f.busy || isSubmitting;
  const close = () => { if (!f.busy && !isSubmitting) c.setQuery({ finalization_action: null }); };
  const before = values.section ? baseline.source?.current[values.section] : undefined;
  const isClinicalReviewMissing = f.action === 'complete' && baseline.readiness?.clinical_review_version === null;

  const handleRefreshSaved = async () => {
    try {
      await c.refresh();
      if (f.action === 'amend') await f.sourceQuery.refetch();
      setBaseline({
        version: c.finalizationVersion,
        readiness: c.readiness,
        signature: JSON.stringify(c.readiness),
        source: f.source,
        episode: c.history?.amendment_episodes.find((e) => e.status === 'OPEN')?.id,
      });
      toast.success('Consultation readiness information refreshed.');
    } catch {
      toast.error('Failed to refresh consultation information.');
    }
  };

  const clearReferences = (index: number) => {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    setValue(`plans.${index}.medication_prescription_id`, null, options); setValue(`plans.${index}.optical_prescription_id`, null, options);
    setValue(`plans.${index}.clinical_order_ids`, [], options); setValue(`plans.${index}.procedure_recommendation_id`, null, options);
    setValue(`plans.${index}.referral_id`, null, options); setValue(`plans.${index}.follow_up_id`, null, options);
    setValue(`plans.${index}.legacy_category`, null, options);
  };
  return <Modal open size="large" className="oph-workspace" title={f.action === 'complete' ? 'Doctor approval and completion' : f.action === 'reopen' ? 'Reopen for amendment' : 'Correct clinical source'} onClose={close} footer={<><button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={close}>Close</button><button className="doc-btn primary" type="submit" form="oph-finalization" disabled={disabled}>{f.action === 'complete' ? 'Approve exact consultation version' : f.action === 'reopen' ? 'Open amendment episode' : 'Save correction for reapproval'}</button></>}>
    <p>Original finalization version {baseline.version}. Approval records your authenticated doctor identity and time.</p>{changed && <p role="alert">Saved information changed. Your entries remain here; close and review the latest versions before continuing.</p>}
    {isClinicalReviewMissing && (
      <div
        className="oph-alert-banner"
        role="alert"
        style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <i className="ph ph-warning-circle" style={{ fontSize: '1.25rem', color: '#d97706' }} />
          <strong style={{ color: '#92400e', fontSize: '0.92rem' }}>
            Clinical Review &amp; Treatment Plan Required Before Finalization
          </strong>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#78350f' }}>
          A saved Clinical Review &amp; Treatment Plan (Step 4) is a mandatory clinical prerequisite. You cannot complete consultation until Step 4 has been saved.
        </p>
        <button
          type="button"
          className="doc-btn primary compact"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          onClick={() => {
            close();
            c.setQuery({ finalization_action: null, section: 'clinical', care_tab: 'treatment' });
          }}
        >
          <i className="ph ph-arrow-right" />
          <span>Go to Step 4 (Clinical Review &amp; Treatment Plan)</span>
        </button>
      </div>
    )}
    <button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={handleRefreshSaved}>Refresh saved information</button>
    {f.action === 'complete' && <>
      {c.unmet.some((requirement) => c.linkFor(requirement.code)) && <div className="oph-toolbar">
        {c.unmet.map((requirement) => c.linkFor(requirement.code) && <button key={requirement.code} className="doc-btn" type="button"
          disabled={f.busy || isSubmitting} onClick={() => c.openRequirement(requirement.code)}>
          Resolve {requirement.code.replaceAll('_', ' ')} →
        </button>)}
      </div>}
      {c.canOverride && c.history?.status !== 'COMPLETED' && <div className="oph-toolbar">
        <button type="button" className="doc-btn" disabled={!c.writable || c.busy || f.busy || isSubmitting}
          onClick={() => c.setQuery({ finalization_action: null, completion_action: 'defer' })}>Record result deferral</button>
        <button type="button" className="doc-btn" disabled={!c.writable || c.busy || f.busy || isSubmitting || !c.unmet.length}
          onClick={() => c.setQuery({ finalization_action: null, completion_action: 'override' })}>Request authorized override</button>
      </div>}
    </>}
    <form id="oph-finalization" onSubmit={handleSubmit(async (values) => {
      if (disabled || baseline.version === undefined || !baseline.readiness) return;
      try {
        let saved;
        if (f.action === 'complete') {
          if (baseline.readiness.clinical_review_version === null) {
            toast.error('Clinical Review & Treatment Plan must be saved in Step 4 before approval.');
            setError('root', { message: 'Clinical Review & Treatment Plan has not been saved. Please complete Step 4 first.' });
            return;
          }
          if (!await confirmAction('Approve and complete these exact consultation versions? Outstanding checks require an existing authorized server override. This records authenticated approval; it does not publish patient records.')) return;
          saved = await f.complete(completeWriteSchema.parse({ expected_version: baseline.version, expected_context_version: baseline.readiness.context_version,
            expected_consultation_version: baseline.readiness.consultation_version, expected_clinical_review_version: baseline.readiness.clinical_review_version,
            expected_optical_prescription_version: baseline.readiness.optical_prescription_version }), key.current);
        } else if (f.action === 'reopen') {
          const body = reopenWriteSchema.parse({ expected_version: baseline.version, expected_status: 'COMPLETED', reason: values.reason });
          if (!await confirmAction('Open an amendment episode and withdraw active publication snapshots for this consultation? Original versions remain immutable and corrections require doctor reapproval.')) return;
          saved = await f.reopen(body);
        } else if (values.section && baseline.episode && baseline.source) {
          const correctedPlans = values.section === 'treatment_plans' ? values.plans.map(({ legacy_category, ...plan }) => {
            void legacy_category; return planCorrectionSchema.parse(plan);
          }) : null;
          const body = amendmentWriteSchema.parse({ expected_version: baseline.version, expected_status: 'AMENDMENT_OPEN', episode_id: baseline.episode,
            section: values.section, before_value: before ?? null, after_value: values.section === 'treatment_plans' ? correctedPlans : values.section === 'follow_up_decision' ? values.follow_up_decision || null : values.after.trim() || null, reason: values.reason });
          if (!await confirmAction('Save this correction as a new clinical source version? The prior approved record remains preserved.')) return;
          saved = await f.amend(body);
        }
        if (saved) { committed(); c.setQuery({ finalization_action: null }); }
      } catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') : error instanceof Error ? error.message : 'Check the entered values.' }); }
    })}><EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={disabled}>
      {f.action === 'complete' ? <><p>Context {baseline.readiness?.context_version} · consultation {baseline.readiness?.consultation_version} · clinical review {baseline.readiness?.clinical_review_version} · optical {baseline.readiness?.optical_prescription_version ?? 'None'}</p><ul>{baseline.readiness?.requirements.map((r) => <li key={r.code}>{r.code} · {r.satisfied ? 'Satisfied' : 'Unmet — recorded override required'} · {r.details}</li>)}</ul></> : <>
        {f.action === 'amend' && <>
          <label className="doc-field"><span>Source section <span className="oph-required">*</span></span><select {...register('section')}><option value="">Select supported source section</option><option value="patient_instructions">Patient instructions</option><option value="clinical_summary">Clinical summary</option><option value="follow_up_decision">Follow-up decision</option><option value="treatment_plans">Treatment plans</option></select></label>
          <p>Saved before value: {Array.isArray(before) ? `${before.length} saved treatment plans` : before ?? 'Not recorded'}</p>
          {values.section === 'follow_up_decision' ? <label className="doc-field">Corrected follow-up decision<select {...register('follow_up_decision')}><option value="">Not recorded — reapproval checks still apply</option><option value="FOLLOW_UP_RECORDED">Follow-up recorded</option><option value="NO_FOLLOW_UP">No follow-up</option></select></label>
            : values.section === 'treatment_plans' ? <>
              <p>Each corrected plan requires an explicit action and only its matching saved care record. Shared source records keep their own lifecycle.</p>
              {plans.fields.map((plan, index) => <section className="doc-card" key={plan.form_key}>
                <h4>{plan.diagnosis_code} · {plan.diagnosis_laterality}</h4>
                {values.plans?.[index]?.legacy_category && <p role="alert">Historical category: {values.plans[index]?.legacy_category}. Reclassify this plan before saving.</p>}
                <div className="doc-form-grid two">
                  <label className="doc-field"><span>Action <span className="oph-required">*</span></span><select {...register(`plans.${index}.action_type`, { onChange: () => { clearReferences(index); setLinkRow(null); } })}><option value="">Select treatment action</option>{treatmentActionTypeSchema.options.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className="doc-field">Priority<select {...register(`plans.${index}.priority`)}><option>ROUTINE</option><option>URGENT</option><option>EMERGENCY</option></select></label>
                  <label className="doc-field">Plan status<select {...register(`plans.${index}.status`)}><option>PLANNED</option><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select></label>
                </div>
                <label className="doc-field"><span>Treatment <span className="oph-required">*</span></span><textarea {...register(`plans.${index}.treatment`)} maxLength={4000} /></label>
                {values.plans?.[index]?.action_type === 'OTHER' ? <p>Other treatment is narrative-only and has no downstream reference.</p>
                  : <button type="button" className="doc-btn" disabled={!values.plans?.[index]?.action_type} onClick={() => setLinkRow(linkRow === plan.form_key ? null : plan.form_key)}>{linkRow === plan.form_key ? 'Close care reference' : 'Select saved care record'}</button>}
                {linkRow === plan.form_key && <OphthalmologyTreatmentLinks workspace={workspace} actionType={values.plans?.[index]?.action_type ?? ''} values={values.plans?.[index] ?? plan}
                  onSelect={(field, value) => setValue(`plans.${index}.${field}`, value, { shouldDirty: true, shouldValidate: true })}
                  onOrders={(ids) => setValue(`plans.${index}.clinical_order_ids`, ids, { shouldDirty: true, shouldValidate: true })} />}
              </section>)}
              {!plans.fields.length && <p>No existing treatment plans to correct.</p>}
            </> : <label className="doc-field">Corrected value<textarea {...register('after')} maxLength={values.section === 'clinical_summary' ? 10000 : 4000} /></label>}
          <p>This changes the clinical source and records an immutable before/after journal. Diagnosis, optical and test result changes require their separate typed correction workflows.</p>
        </>}
        <label className="doc-field"><span>Reason <span className="oph-required">*</span></span><textarea {...register('reason')} maxLength={2000} /></label>
      </>}
    </fieldset>{f.error && <p role="alert" className="form-error-banner">{f.error} Entries are retained. If the response was interrupted, refresh history before retrying.</p>}</form>
  </Modal>;
}
export function OphthalmologyFinalizationTools({ workspace, completion: c }: { workspace: CompletionWorkspace; completion: OphthalmologyCompletionFeature }) {
  const f = useOphthalmologyFinalizationFeature(workspace, c);
  return <>{(f.canReopen || f.canAmend) && <div className="oph-toolbar">
    {f.canReopen && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => c.setQuery({ completion_action: null, finalization_action: 'reopen' })}>Reopen for amendment</button>}
    {f.canAmend && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => c.setQuery({ completion_action: null, finalization_action: 'amend' })}>Correct clinical source</button>}
  </div>}{f.action === 'amend' && !f.source && <><p role="status">{f.sourceQuery.isError ? 'Clinical source could not be loaded.' : 'Loading supported clinical source…'}</p><button type="button" className="doc-btn" onClick={() => void f.sourceQuery.refetch()}>Retry clinical source</button><button type="button" className="doc-btn" onClick={() => c.setQuery({ finalization_action: null })}>Close amendment</button></>}
    {f.action && c.finalizationVersion !== undefined && (f.action !== 'amend' || f.source) && <FinalizationDialog key={f.action} workspace={workspace} completion={c} feature={f} />}
    {!f.action && f.error && <p role="alert">{f.error}</p>}
  </>;
}
