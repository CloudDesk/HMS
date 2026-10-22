import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clinicalReviewWriteSchema, treatmentWriteSchema, type ClinicalReview } from '../../api/ophthalmology-care';
import type { OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
import { OphthalmologyTreatmentLinks } from './OphthalmologyTreatmentLinks';

const rowSchema = treatmentWriteSchema.extend({ priority: z.union([treatmentWriteSchema.shape.priority, z.literal('')]), status: z.union([treatmentWriteSchema.shape.status, z.literal('')]), diagnosis_laterality: z.union([treatmentWriteSchema.shape.diagnosis_laterality, z.literal('')]) });
const editorSchema = z.object({ ...clinicalReviewWriteSchema.shape, treatment_plans: z.array(rowSchema).max(100) });
type Editor = z.infer<typeof editorSchema>;
function initial(record: ClinicalReview | null): Editor {
  return { expected_version: record?.version ?? 0, clinical_summary: record?.current.clinical_summary ?? '', follow_up_decision: record?.current.follow_up_decision ?? null, patient_instructions: record?.current.patient_instructions ?? null,
    treatment_plans: (record?.current.treatment_plans ?? []).map((plan) => ({ diagnosis_code: plan.diagnosis_code, diagnosis_laterality: plan.diagnosis_laterality, treatment: plan.treatment, category: plan.category, priority: plan.priority, status: plan.status, medication_prescription_id: plan.medication_prescription_id, clinical_order_ids: plan.clinical_order_ids, procedure_recommendation_id: plan.procedure_recommendation_id, referral_id: plan.referral_id, follow_up_id: plan.follow_up_id })) };
}
export function OphthalmologyClinicalReviewEditor({ feature: f }: { feature: OphthalmologyCareFeature }) {
  const [baseline, setBaseline] = useState(f.clinical);
  const [linkRow, setLinkRow] = useState<string | null>(null);
  const { register, control, handleSubmit, setValue, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({ resolver: zodResolver(editorSchema), defaultValues: initial(baseline) });
  const rows = useFieldArray({ control, name: 'treatment_plans' });
  const watched = useWatch({ control, name: 'treatment_plans' });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'area']);
  const changed = (baseline?.version ?? 0) !== (f.clinical?.version ?? 0) || baseline?.id !== f.clinical?.id;
  const disabled = !f.canSaveClinical || f.busy || isSubmitting || changed;
  return <form className="doc-card" onSubmit={handleSubmit(async (values) => {
    try { const body = clinicalReviewWriteSchema.parse({ ...values, expected_version: baseline?.version ?? 0 }); const saved = await f.saveClinical(body); if (saved) { setBaseline(saved); reset(initial(saved)); } }
    catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ') : 'Check the treatment entries.' }); }
  })}><h3>Clinical review and treatment plan</h3><p>{baseline?.status ?? 'Not saved'} · version {baseline?.version ?? 0}. Saving a draft does not approve or complete this consultation.</p>
    {changed && <p role="alert">The saved review changed. Your entries remain here; review the latest record before saving.</p>}
    <button type="button" className="doc-btn" disabled={f.busy || f.clinicalQuery.isError} onClick={() => { if (!isDirty || window.confirm('Discard entered values and load the latest saved review?')) { setBaseline(f.clinical); reset(initial(f.clinical)); } }}>Load latest saved review</button>
    <EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={disabled}>
      <label className="doc-field"><span>Clinical summary <span className="oph-required">*</span></span><textarea maxLength={10000} {...register('clinical_summary')} /></label>
      {rows.fields.map((row, index) => <section className="doc-card" key={row.id}><h4>Treatment {index + 1}</h4><div className="doc-form-grid two">
        <label className="doc-field"><span>Saved diagnosis and eye <span className="oph-required">*</span></span><select value={`${watched[index]?.diagnosis_code ?? ''}:${watched[index]?.diagnosis_laterality ?? ''}`} onChange={(event) => { const selected = f.diagnoses.find((diagnosis) => `${diagnosis.code}:${diagnosis.laterality ?? 'NOT_APPLICABLE'}` === event.target.value); if (selected) { setValue(`treatment_plans.${index}.diagnosis_code`, selected.code, { shouldDirty: true }); setValue(`treatment_plans.${index}.diagnosis_laterality`, selected.laterality ?? 'NOT_APPLICABLE', { shouldDirty: true }); } }}><option value=":">Select existing diagnosis</option>{row.diagnosis_code && !f.diagnoses.some((diagnosis) => diagnosis.code === row.diagnosis_code && (diagnosis.laterality ?? 'NOT_APPLICABLE') === row.diagnosis_laterality) && <option value={`${row.diagnosis_code}:${row.diagnosis_laterality}`}>Saved {row.diagnosis_code} · {row.diagnosis_laterality} (no longer current)</option>}{f.diagnoses.map((diagnosis) => <option key={`${diagnosis.code}:${diagnosis.laterality}`} value={`${diagnosis.code}:${diagnosis.laterality ?? 'NOT_APPLICABLE'}`}>{diagnosis.code} · {diagnosis.display} · {diagnosis.laterality ?? 'NOT_APPLICABLE'}</option>)}</select></label>
        <label className="doc-field"><span>Category <span className="oph-required">*</span></span><input maxLength={80} {...register(`treatment_plans.${index}.category`)} /></label>
        <label className="doc-field"><span>Priority <span className="oph-required">*</span></span><select {...register(`treatment_plans.${index}.priority`)}><option value="">Select</option>{treatmentWriteSchema.shape.priority.options.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="doc-field"><span>Status <span className="oph-required">*</span></span><select {...register(`treatment_plans.${index}.status`)}><option value="">Select</option>{treatmentWriteSchema.shape.status.options.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div><label className="doc-field"><span>Treatment <span className="oph-required">*</span></span><textarea maxLength={4000} {...register(`treatment_plans.${index}.treatment`)} /></label>
        <p>Saved care references are retained. Create or edit their source records in the shared encounter.</p>{[watched[index]?.medication_prescription_id, ...watched[index]?.clinical_order_ids ?? [], watched[index]?.procedure_recommendation_id, watched[index]?.referral_id, watched[index]?.follow_up_id].filter(Boolean).map((reference, item) => <p key={item}>{reference}</p>)}
        <button type="button" className="doc-btn" onClick={() => setLinkRow(linkRow === row.id ? null : row.id)}>{linkRow === row.id ? 'Close care references' : 'Link saved care records'}</button>
        {linkRow === row.id && <OphthalmologyTreatmentLinks workspace={f.workspace} values={watched[index] ?? row}
          onSelect={(key, value) => setValue(`treatment_plans.${index}.${key}`, value, { shouldDirty: true, shouldValidate: true })}
          onOrders={(values) => setValue(`treatment_plans.${index}.clinical_order_ids`, values, { shouldDirty: true, shouldValidate: true })} />}
        <button type="button" className="doc-btn" onClick={() => { if (window.confirm('Remove this treatment row from the draft?')) rows.remove(index); }}>Remove treatment</button>
      </section>)}
      <button type="button" className="doc-btn" disabled={rows.fields.length >= 100 || !f.diagnoses.length} onClick={() => rows.append({ diagnosis_code: '', diagnosis_laterality: '', treatment: '', category: '', priority: '', status: '' })}>Add treatment</button>
      <label className="doc-field">Follow-up decision<select {...register('follow_up_decision', { setValueAs: (value: string) => value || null })}><option value="">Not recorded</option><option value="FOLLOW_UP_RECORDED">Follow-up recorded in shared encounter</option><option value="NO_FOLLOW_UP">No follow-up required</option></select></label>
      <label className="doc-field">Patient instructions<textarea maxLength={4000} {...register('patient_instructions', { setValueAs: (value: string) => value || null })} /></label>
      <button type="submit" className="doc-btn primary">Save clinical review draft</button>
    </fieldset>{f.error && <p className="form-error-banner" role="alert">{f.error} Your entries are retained.</p>}
    <h4>Saved version history</h4>{f.clinical?.history.map((entry) => <details key={entry.clinical_version}><summary>Version {entry.clinical_version} · {new Date(entry.created_at).toLocaleString()} · clinician {entry.created_by}</summary><p>{entry.clinical_summary}</p>{entry.treatment_plans.map((plan) => <p key={plan.id}>{plan.diagnosis_code} · {plan.diagnosis_laterality} · {plan.treatment} · {plan.status}</p>)}</details>)}
  </form>;
}
