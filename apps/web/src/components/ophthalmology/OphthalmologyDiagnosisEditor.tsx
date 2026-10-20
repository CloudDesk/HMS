import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { OpdConsultationResponse } from '../../api/opd';
import { diagnosisEditSchema, useOphthalmologyDiagnosisEditor, type DiagnosisEdit, type DiagnosisForm } from '../../hooks/ophthalmology/useOphthalmologyDiagnosisEditor';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

export function OphthalmologyDiagnosisEditor({ record, canEdit }: { record: OpdConsultationResponse; canEdit: boolean }) {
  const [baseline, setBaseline] = useState(record);
  const f = useOphthalmologyDiagnosisEditor(record, canEdit);
  const { register, control, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<DiagnosisForm, unknown, DiagnosisEdit>({ resolver: zodResolver(diagnosisEditSchema), defaultValues: { assessment: baseline.assessment, diagnoses: (baseline.diagnoses ?? []).map((d) => ({ ...d, laterality: d.laterality ?? undefined, status: d.status ?? undefined, differential: d.differential ?? false })) } });
  const rows = useFieldArray({ control, name: 'diagnoses' });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'care_tab']);
  const stale = baseline.version !== record.version; const disabled = !canEdit || stale || f.busy || isSubmitting;
  return <form className="doc-card" onSubmit={handleSubmit(async (values) => { if (disabled) return; const saved = await f.save(baseline.version ?? 0, values); if (saved) { setBaseline(saved); reset(values); } })}><h3>Edit structured assessment</h3><p>Consultation version {baseline.version}. Use approved diagnosis terminology. Test measurements do not create diagnoses automatically.</p>
    {stale && <p role="alert">The consultation changed. Your entries are retained; reopen after reviewing the saved version.</p>}<EditorErrors errors={errors} />
    <fieldset className="oph-fieldset" disabled={disabled}><label className="doc-field">Assessment<textarea {...register('assessment')} /></label>
      {rows.fields.map((row, index) => <section className="doc-card" key={row.id}><h4>Diagnosis {index + 1}</h4><div className="doc-form-grid two">
        <label className="doc-field">Code <span className="oph-required">*</span><input {...register(`diagnoses.${index}.code`)} /></label><label className="doc-field">Display <span className="oph-required">*</span><input {...register(`diagnoses.${index}.display`)} /></label>
        <label className="doc-field">Coding system <span className="oph-required">*</span><input {...register(`diagnoses.${index}.codingSystem`)} /></label><label className="doc-field">Classification <span className="oph-required">*</span><select {...register(`diagnoses.${index}.type`)}><option value="">Select</option><option>PRIMARY</option><option>SECONDARY</option></select></label>
        <label className="doc-field">Eye <span className="oph-required">*</span><select {...register(`diagnoses.${index}.laterality`)}><option value="">Select</option>{['OD', 'OS', 'OU', 'NOT_APPLICABLE'].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="doc-field">Diagnostic status <span className="oph-required">*</span><select {...register(`diagnoses.${index}.status`)}><option value="">Select</option>{['SUSPECTED', 'CONFIRMED', 'RULED_OUT'].map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="doc-field">Severity<input maxLength={120} {...register(`diagnoses.${index}.severity`)} /></label><label className="doc-field">Stage<input maxLength={120} {...register(`diagnoses.${index}.stage`)} /></label><label><input type="checkbox" {...register(`diagnoses.${index}.differential`)} /> Differential diagnosis</label><label className="doc-field">Notes<textarea {...register(`diagnoses.${index}.notes`)} /></label>
      </div><button type="button" className="doc-btn" onClick={() => { if (window.confirm('Remove this diagnosis from the draft? Previous saved versions remain in history.')) rows.remove(index); }}>Remove diagnosis</button></section>)}
      <div className="oph-toolbar"><button type="button" className="doc-btn" onClick={() => rows.append({ code: '', display: '', codingSystem: '', type: '', laterality: '', status: '', differential: false })}>Add diagnosis</button><button className="doc-btn primary" type="submit">Save structured assessment</button></div>
    </fieldset>{f.error && <p role="alert" className="form-error-banner">{f.error} Your entries are retained.</p>}
  </form>;
}
