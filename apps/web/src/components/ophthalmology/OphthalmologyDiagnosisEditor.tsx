import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { OpdConsultationResponse } from '../../api/opd';
import { diagnosisEditSchema, useOphthalmologyDiagnosisEditor, type DiagnosisEdit, type DiagnosisForm } from '../../hooks/ophthalmology/useOphthalmologyDiagnosisEditor';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

const TOP_OPHTHALMOLOGY_PRESETS = [
  { code: 'H52.1', display: 'Myopia', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H52.0', display: 'Hyperopia', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H52.2', display: 'Astigmatism', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H52.4', display: 'Presbyopia', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H25.9', display: 'Senile Cataract, Unspecified', laterality: 'OD' as const, type: 'PRIMARY' as const },
  { code: 'H40.1', display: 'Primary Open-Angle Glaucoma', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H10.1', display: 'Acute Conjunctivitis', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'E11.3', display: 'Diabetic Retinopathy', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'H04.1', display: 'Dry Eye Syndrome', laterality: 'OU' as const, type: 'PRIMARY' as const },
  { code: 'T15.0', display: 'Corneal Foreign Body / Abrasion', laterality: 'OD' as const, type: 'PRIMARY' as const },
];

export function OphthalmologyDiagnosisEditor({ record, canEdit }: { record: OpdConsultationResponse; canEdit: boolean }) {
  const [baseline, setBaseline] = useState(record);
  const f = useOphthalmologyDiagnosisEditor(record, canEdit);
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty, isSubmitting } } = useForm<DiagnosisForm, unknown, DiagnosisEdit>({
    resolver: zodResolver(diagnosisEditSchema),
    defaultValues: {
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
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'area', 'care_tab']);

  const stale = baseline.version !== record.version;
  const disabled = !canEdit || stale || f.busy || isSubmitting;

  const handleAddPreset = (preset: typeof TOP_OPHTHALMOLOGY_PRESETS[number]) => {
    rows.append({
      code: preset.code,
      display: preset.display,
      codingSystem: 'ICD-10',
      type: preset.type,
      laterality: preset.laterality,
      status: 'CONFIRMED',
      differential: false,
      severity: '',
      stage: '',
      notes: '',
    });
  };

  return (
    <form
      className="doc-card oph-diag-card-wrapper"
      onSubmit={handleSubmit(async (values) => {
        if (disabled) return;
        const saved = await f.save(baseline.version ?? 0, values);
        if (saved) {
          setBaseline(saved);
          reset(values);
        }
      })}
    >
      <div className="oph-diag-header">
        <div className="oph-diag-title-group">
          <div className="oph-diag-icon-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Structured Ophthalmic Diagnoses &amp; Assessment
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Record confirmed and suspected conditions with laterality (OD/OS/OU). Diagnoses automatically link to the treatment plan and procedures.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="oph-status-badge version">
            Draft v{baseline.version ?? 0}
          </span>
          {canEdit && (
            <span className="oph-status-badge active">
              Editable
            </span>
          )}
        </div>
      </div>

      {stale && (
        <p role="alert" className="form-error-banner">
          The consultation changed in another session. Your unsaved entries are retained; please review before saving.
        </p>
      )}
      <EditorErrors errors={errors} />

      <fieldset className="oph-fieldset" disabled={disabled}>
        {/* Quick-add chips for common eye conditions */}
        <div className="oph-quick-presets-container">
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
        </div>

        {/* Global Clinical Assessment Narrative */}
        <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
          <label className="doc-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
              Doctor&apos;s Clinical Assessment &amp; Synthesis
            </span>
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
                    <span className="oph-diag-index-badge">#{index + 1}</span>
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
                        onClick={() => setValue(`diagnoses.${index}.type`, 'PRIMARY', { shouldDirty: true, shouldValidate: true })}
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
                      onClick={() => {
                        if (window.confirm(`Remove diagnosis "${currentItem?.display || row.display || `#${index + 1}`}" from draft?`)) {
                          rows.remove(index);
                        }
                      }}
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

                {/* Laterality & Status Segmented Bars */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Eye / Laterality <span className="oph-required">*</span>
                    </span>
                    <div className="oph-pill-group" style={{ width: '100%' }}>
                      {[
                        { id: 'OD', label: 'OD (Right Eye)' },
                        { id: 'OS', label: 'OS (Left Eye)' },
                        { id: 'OU', label: 'OU (Both Eyes)' },
                        { id: 'NOT_APPLICABLE', label: 'N/A' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`oph-pill-btn ${laterality === item.id ? `selected lat-${item.id.toLowerCase()}` : ''}`}
                          onClick={() => setValue(`diagnoses.${index}.laterality`, item.id as any, { shouldDirty: true, shouldValidate: true })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Diagnostic Certainty / Status <span className="oph-required">*</span>
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
                          onClick={() => setValue(`diagnoses.${index}.status`, item.id as any, { shouldDirty: true, shouldValidate: true })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Clinical Stratification */}
                <div className="doc-form-grid three" style={{ marginTop: '0.75rem', gap: '12px' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Severity</span>
                    <input
                      maxLength={120}
                      {...register(`diagnoses.${index}.severity`)}
                      placeholder="e.g. Mild, Moderate, Severe, High"
                    />
                  </label>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Stage / Progression</span>
                    <input
                      maxLength={120}
                      {...register(`diagnoses.${index}.stage`)}
                      placeholder="e.g. Stage 2, Immature, Early"
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        {...register(`diagnoses.${index}.differential`)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>Differential Diagnosis</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: '0.6rem' }}>
                  <label className="doc-field">
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Clinical Notes / Diagnostic Rationale</span>
                    <input
                      {...register(`diagnoses.${index}.notes`)}
                      placeholder="e.g. Verified with subjective refraction; funds copy confirms clear macula."
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
            onClick={() => rows.append({ code: '', display: '', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED', differential: false, severity: '', stage: '', notes: '' })}
          >
            + Add Custom Diagnosis
          </button>

          <button className="doc-btn primary" type="submit" disabled={disabled}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save Diagnosis Assessment
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
