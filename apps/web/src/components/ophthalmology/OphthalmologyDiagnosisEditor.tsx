import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { OpdConsultationResponse } from '../../api/opd';
import { diagnosisEditSchema, useOphthalmologyDiagnosisEditor, type DiagnosisEdit, type DiagnosisForm } from '../../hooks/ophthalmology/useOphthalmologyDiagnosisEditor';
import { useOphthalmologyDraftGuard, getEncounterDraft, setEncounterDraft, clearEncounterDraft, registerDraftSaveHandler } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

const TOP_OPHTHALMOLOGY_PRESETS = [
  { code: 'H52.1', display: 'Myopia', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H52.0', display: 'Hyperopia', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H52.2', display: 'Astigmatism', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H25.9', display: 'Cataract', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H40.11', display: 'Primary Open-Angle Glaucoma', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'E11.319', display: 'Diabetic Retinopathy', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H04.123', display: 'Dry Eye', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H10.9', display: 'Conjunctivitis', laterality: 'OU' as const, type: 'PRIMARY' as const },
];

export function OphthalmologyDiagnosisEditor({ record, canEdit }: {
  record: OpdConsultationResponse;
  canEdit: boolean;
}) {
  const visitId = record.visit_id;
  const cachedDraft = getEncounterDraft<DiagnosisForm>(visitId, 'diagnosis');
  const [baseline, setBaseline] = useState(record);
  const f = useOphthalmologyDiagnosisEditor(record, canEdit);
  const { register, control, handleSubmit, reset, setValue, getValues, formState: { errors, isDirty, isSubmitting } } = useForm<DiagnosisForm, unknown, DiagnosisEdit>({
    resolver: zodResolver(diagnosisEditSchema),
    defaultValues: cachedDraft ?? {
      assessment: baseline.assessment ?? '',
      diagnoses: (baseline.diagnoses ?? []).map((d) => ({
        ...d,
        laterality: d.laterality ?? undefined,
        status: d.status ?? undefined,
        differential: d.differential ?? false,
      })),
    },
  });
  const rows = useFieldArray({ control, name: 'diagnoses' });
  const watchedDiagnoses = useWatch({ control, name: 'diagnoses' });
  const watchedAssessment = useWatch({ control, name: 'assessment' });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'care_tab']);

  useEffect(() => {
    if (isDirty) {
      setEncounterDraft(visitId, 'diagnosis', getValues(), true);
    }
  }, [isDirty, getValues, visitId, watchedDiagnoses, watchedAssessment]);

  useEffect(() => {
    return registerDraftSaveHandler('diagnosis', async () => {
      let saved = false;
      await handleSubmit(async (values) => {
        const result = await f.save(baseline.version ?? 0, values);
        if (result) {
          clearEncounterDraft(visitId, 'diagnosis');
          setBaseline(result);
          reset(values);
          saved = true;
        }
      })();
      if (!saved) throw new Error('Diagnosis assessment draft could not be saved.');
    });
  }, [handleSubmit, f, baseline.version, reset, visitId]);

  const stale = baseline.version !== record.version;
  const disabled = !canEdit || stale || f.busy || isSubmitting;

  const handleAddPreset = (preset: typeof TOP_OPHTHALMOLOGY_PRESETS[number]) => {
    const existing = getValues('diagnoses') || [];
    const hasPrimary = existing.some((d) => d.type === 'PRIMARY');
    rows.append({
      code: preset.code,
      display: preset.display,
      codingSystem: 'ICD-10',
      type: hasPrimary ? 'SECONDARY' : 'PRIMARY',
      laterality: preset.laterality,
      status: 'CONFIRMED',
      differential: false,
      severity: '',
      stage: '',
      notes: '',
    });
  };

  const setPrimaryDiagnosis = (targetIndex: number) => {
    const current = getValues('diagnoses') || [];
    current.forEach((_, idx) => {
      setValue(`diagnoses.${idx}.type`, idx === targetIndex ? 'PRIMARY' : 'SECONDARY', {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  };

  const handleRemoveDiagnosis = (index: number) => {
    const current = getValues('diagnoses') || [];
    const item = current[index];
    if (window.confirm(`Remove diagnosis "${item?.display || `#${index + 1}`}" from draft?`)) {
      rows.remove(index);
      if (item?.type === 'PRIMARY') {
        const remaining = current.filter((_, i) => i !== index);
        if (remaining.length > 0 && !remaining.some((d) => d.type === 'PRIMARY')) {
          setTimeout(() => {
            setValue('diagnoses.0.type', 'PRIMARY', { shouldDirty: true, shouldValidate: true });
          }, 0);
        }
      }
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<DiagnosisForm>) => {
    const errorMessages: string[] = [];
    if (fieldErrors.diagnoses) {
      if ('root' in fieldErrors.diagnoses && fieldErrors.diagnoses.root?.message) {
        errorMessages.push(fieldErrors.diagnoses.root.message);
      } else if (typeof fieldErrors.diagnoses.message === 'string') {
        errorMessages.push(fieldErrors.diagnoses.message);
      } else if (Array.isArray(fieldErrors.diagnoses)) {
        fieldErrors.diagnoses.forEach((rowErr, idx) => {
          if (rowErr) {
            Object.values(rowErr).forEach((fErr) => {
              if (fErr && typeof fErr === 'object' && 'message' in fErr && typeof fErr.message === 'string') {
                errorMessages.push(`Diagnosis #${idx + 1}: ${fErr.message}`);
              }
            });
          }
        });
      }
    }
    if (fieldErrors.assessment?.message) {
      errorMessages.push(fieldErrors.assessment.message);
    }
    const message = errorMessages.length > 0 ? errorMessages.join(' · ') : 'Please check required fields in diagnosis assessment.';
    toast.error(message);
  };

  return (
    <form
      className="doc-card oph-diag-card-wrapper"
      onSubmit={handleSubmit(async (values) => {
        if (disabled) return;
        const saved = await f.save(baseline.version ?? 0, values);
        if (saved) {
          clearEncounterDraft(visitId, 'diagnosis');
          setBaseline(saved);
          reset(values);
        }
      }, onInvalid)}
    >
      <div className="oph-diag-header">
        <div className="oph-diag-title-group">
          <div className="oph-diag-icon-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Ophthalmic diagnoses &amp; assessment
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Record primary and secondary diagnoses with ICD-10 codes, affected eye laterality, clinical staging, and diagnostic rationale.
            </p>
          </div>
        </div>
      </div>

      {stale && (
        <p role="alert" className="form-error-banner">
          The consultation changed in another session. Your unsaved entries are retained; please review before saving.
        </p>
      )}
      <EditorErrors errors={errors} />

      <fieldset className="oph-fieldset" disabled={disabled}>
        <div className="oph-diagnosis-section-heading"><span>01</span><h4>Clinical assessment &amp; diagnosis</h4><small>Primary diagnosis</small></div>
        {/* Quick-add chips for common eye conditions */}
        <details className="oph-quick-presets-container">
          <summary>Quick-add common ophthalmic conditions</summary>
          <div className="oph-quick-presets-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Quick-Add Common Ophthalmic Conditions:</span>
          </div>
          <div className="oph-quick-presets-list">
            {TOP_OPHTHALMOLOGY_PRESETS.map((p) => (
              <button
                key={p.code}
                type="button"
                className="oph-quick-chip"
                onClick={() => handleAddPreset(p)}
                title={`Add ${p.display} (${p.code})`}
              >
                <span className="plus">+</span> {p.display} <small>({p.code})</small>
              </button>
            ))}
          </div>
        </details>

        {/* Global Clinical Assessment Narrative */}
        <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
          <label className="doc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                Doctor&apos;s Clinical Assessment &amp; Synthesis <span className="oph-required">*</span>
              </span>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {(watchedAssessment?.length || 0)} / 1000
              </span>
            </div>
            <textarea
              {...register('assessment')}
              placeholder="e.g. Bilateral progressive myopic shift with early nuclear sclerotic changes. Visual acuity improved with manifest refraction. Normal IOP bilaterally. Retinal periphery intact..."
              rows={3}
              style={{ minHeight: '75px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '0.88rem' }}
            />
          </label>
        </div>

        {/* Diagnoses List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rows.fields.length === 0 && (
            <div className="oph-empty-diagnoses-box">
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>
                No diagnoses entered yet for this consultation.
              </p>
              <p style={{ margin: '4px 0 12px', fontSize: '0.82rem', color: '#64748b' }}>
                Click a quick-add chip above or click &quot;Add Custom Diagnosis&quot; below to record the clinical findings.
              </p>
              <button
                type="button"
                className="doc-btn primary"
                onClick={() => rows.append({ code: '', display: '', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED', differential: false, severity: '', stage: '', notes: '' })}
              >
                + Add First Diagnosis
              </button>
            </div>
          )}

          {rows.fields.map((row, index) => {
            const currentItem = watchedDiagnoses?.[index];
            const laterality = currentItem?.laterality ?? '';
            const status = currentItem?.status ?? '';
            const type = currentItem?.type ?? 'PRIMARY';

            return (
              <section className="oph-diag-row-card" key={row.id}>
                <div className="oph-diag-row-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="oph-diag-index-badge">{String(index + 1).padStart(2, '0')}</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                      {currentItem?.display || `Diagnosis Entry #${index + 1}`}
                    </strong>
                    {currentItem?.code && (
                      <span className="oph-code-badge">{currentItem.code}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Classification Selector */}
                    <div className="oph-pill-group">
                      <button
                        type="button"
                        className={`oph-pill-btn ${type === 'PRIMARY' ? 'selected primary' : ''}`}
                        onClick={() => setPrimaryDiagnosis(index)}
                      >
                        Primary
                      </button>
                      <button
                        type="button"
                        className={`oph-pill-btn ${type === 'SECONDARY' ? 'selected' : ''}`}
                        onClick={() => setValue(`diagnoses.${index}.type`, 'SECONDARY', { shouldDirty: true, shouldValidate: true })}
                      >
                        Secondary
                      </button>
                    </div>

                    <button
                      type="button"
                      className="oph-remove-diag-btn"
                      onClick={() => handleRemoveDiagnosis(index)}
                      title="Remove this diagnosis"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="doc-form-grid three" style={{ marginTop: '0.75rem', gap: '12px' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Condition Name <span className="oph-required">*</span>
                    </span>
                    <input
                      {...register(`diagnoses.${index}.display`)}
                      placeholder="e.g. Myopia, Senile Cataract"
                    />
                  </label>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      ICD-10 Code <span className="oph-required">*</span>
                    </span>
                    <input
                      {...register(`diagnoses.${index}.code`)}
                      placeholder="e.g. H52.1"
                    />
                  </label>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Coding System <span className="oph-required">*</span>
                    </span>
                    <input
                      {...register(`diagnoses.${index}.codingSystem`)}
                      placeholder="ICD-10"
                      defaultValue="ICD-10"
                    />
                  </label>
                </div>

                {/* Laterality, Severity, Stage, Status & Differential in single visual flow */}
                <div className="oph-diag-options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'flex-end', marginTop: '0.75rem', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Affected Eye (Laterality) <span className="oph-required">*</span>
                    </span>
                    <select aria-label={`Affected eye for diagnosis ${index + 1}`} value={laterality} onChange={(event) => setValue(`diagnoses.${index}.laterality`, event.target.value as 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE', { shouldDirty: true, shouldValidate: true })}>
                      <option value="" disabled>Select affected eye</option>
                      <option value="OD">OD · Right eye</option>
                      <option value="OS">OS · Left eye</option>
                      <option value="OU">OU · Both eyes</option>
                      <option value="NOT_APPLICABLE">Not applicable</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Severity <span className="oph-required">*</span>
                    </span>
                    <select
                      {...register(`diagnoses.${index}.severity`)}
                      style={{ width: '100%', height: '30px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', padding: '0 8px' }}
                    >
                      <option value="">Select...</option>
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Stage / Progression
                    </span>
                    <select
                      {...register(`diagnoses.${index}.stage`)}
                      style={{ width: '100%', height: '30px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', padding: '0 8px' }}
                    >
                      <option value="">Select...</option>
                      <option value="Early">Early</option>
                      <option value="Immature">Immature</option>
                      <option value="Mature">Mature</option>
                      <option value="Hypermature">Hypermature</option>
                      <option value="Gradual / Stable">Gradual / Stable</option>
                      <option value="Rapid">Rapid</option>
                    </select>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Diagnostic Status <span className="oph-required">*</span>
                    </span>
                    <div className="oph-pill-group" style={{ width: '100%' }}>
                      {[
                        { id: 'SUSPECTED', label: 'Suspected', colorClass: 'status-suspected' },
                        { id: 'CONFIRMED', label: 'Confirmed', colorClass: 'status-confirmed' },
                        { id: 'RULED_OUT', label: 'Ruled Out', colorClass: 'status-ruled-out' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`oph-pill-btn ${status === item.id ? `selected ${item.colorClass}` : ''}`}
                          onClick={() => setValue(`diagnoses.${index}.status`, item.id as 'SUSPECTED' | 'CONFIRMED' | 'RULED_OUT', { shouldDirty: true, shouldValidate: true })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ paddingBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        {...register(`diagnoses.${index}.differential`)}
                        style={{ width: '15px', height: '15px' }}
                      />
                      <span>Differential Diagnosis</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: '0.6rem' }}>
                  <label className="doc-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Clinical Notes / Diagnostic Rationale</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {(currentItem?.notes?.length || 0)} / 500
                      </span>
                    </div>
                    <textarea
                      {...register(`diagnoses.${index}.notes`)}
                      maxLength={500}
                      placeholder="e.g. Verified with subjective refraction; fundoscopy confirms clear macula."
                      style={{ fontSize: '0.84rem' }}
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="oph-toolbar" style={{ marginTop: '1.25rem', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="doc-btn"
            onClick={() => {
              const hasPrimary = (getValues('diagnoses') || []).some((d) => d.type === 'PRIMARY');
              rows.append({
                code: '',
                display: '',
                codingSystem: 'ICD-10',
                type: hasPrimary ? 'SECONDARY' : 'PRIMARY',
                laterality: 'OU',
                status: 'CONFIRMED',
                differential: false,
                severity: '',
                stage: '',
                notes: '',
              });
            }}
          >
            + Add custom diagnosis
          </button>

          <button className="doc-btn primary" type="submit" disabled={disabled}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save diagnosis assessment
          </button>
        </div>
      </fieldset>

      {f.error && (
        <p role="alert" className="form-error-banner" style={{ marginTop: '0.75rem' }}>
          {f.error} Your entered values are preserved.
        </p>
      )}
    </form>
  );
}
