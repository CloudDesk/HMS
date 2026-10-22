import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { eyeSchema, saveIntakeSchema, type SaveOphthalmologyIntake, type OphthalmologyContext, type OphthalmologyIntakeView } from '../../api/ophthalmology';
import { configuredIntakeOptions, initialIntake, intakeCompletionIssues, hasPositiveEyeHistory, clearPositiveEyeHistory } from '../../hooks/ophthalmology/intake-form';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';

const nullable = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value: unknown) => value === '' || value == null ? null : Number(value);
const isoDate = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00`).toISOString() : '';
const dateInput = (value: string | null | undefined) => value ? format(new Date(value), 'yyyy-MM-dd') : '';
const eyeOptions = ['OD', 'OS', 'OU', 'NOT_APPLICABLE'];
type Props = { feature: OphthalmologyWorkspaceFeature; context: OphthalmologyContext; view: OphthalmologyIntakeView };

export function OphthalmologyIntakeForm({ feature: f, context, view }: Props) {
  const form = useForm<SaveOphthalmologyIntake>({ resolver: zodResolver(saveIntakeSchema), defaultValues: initialIntake(context, view.intake) });
  const { register, control, handleSubmit, reset, getValues, setValue, formState: { errors, isDirty, isSubmitting } } = form;
  const values = useWatch({ control });
  const surgeries = useFieldArray({ control, name: 'previous_eye_surgeries' });
  const treatments = useFieldArray({ control, name: 'current_eye_treatments' });
  const injuries = useFieldArray({ control, name: 'previous_eye_injury_or_laser' });
  const [newSurgeryEye, setNewSurgeryEye] = useState('');
  const [newInjuryEye, setNewInjuryEye] = useState('');
  const [newInjuryType, setNewInjuryType] = useState('');

  useEffect(() => {
    const localVersion = getValues('expected_version');
    if (!isDirty && (localVersion === null || (view.intake && view.intake.version >= localVersion))) {
      reset(initialIntake(context, view.intake));
    }
  }, [context, view.intake, reset, getValues, isDirty]);

  useEffect(() => {
    if (!getValues('complaint_configuration_version_id') && f.complaints.length > 0) {
      const activeComplaint = f.complaints.find((item) => item.status === 'ACTIVE') ?? f.complaints[0];
      if (activeComplaint) setValue('complaint_configuration_version_id', activeComplaint.id, { shouldDirty: false });
    }
    if (!getValues('emergency_configuration_version_id') && f.emergencies.length > 0) {
      const activeEmergency = f.emergencies.find((item) => item.status === 'ACTIVE') ?? f.emergencies[0];
      if (activeEmergency) setValue('emergency_configuration_version_id', activeEmergency.id, { shouldDirty: false });
    }
  }, [f.complaints, f.emergencies, getValues, setValue]);

  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'edit_context']);
  const disabled = !f.canEdit || f.busy || isSubmitting || view.intake?.status === 'COMPLETED' || f.intakeQuery.isError || f.contextQuery.isError;
  const complaint = f.complaints.find((item) => item.id === values.complaint_configuration_version_id);
  const emergency = f.emergencies.find((item) => item.id === values.emergency_configuration_version_id);
  const complaintOptions = configuredIntakeOptions(complaint, 'options');
  const emergencyOptions = configuredIntakeOptions(emergency, 'criteria');
  const completionIssues = intakeCompletionIssues(getValues(), complaint, emergency);

  const toggle = (name: 'complaint_codes' | 'associated_symptom_codes' | 'emergency_criterion_codes' | 'previous_report_document_ids', code: string, checked: boolean) => {
    const current = getValues(name);
    setValue(name, checked ? [...new Set([...current, code])] : current.filter((entry) => entry !== code), { shouldDirty: true });
  };

  const codes = (
    name: 'complaint_codes' | 'associated_symptom_codes' | 'emergency_criterion_codes',
    options: ReturnType<typeof configuredIntakeOptions>,
    variant: 'primary' | 'secondary' | 'emergency' = 'primary',
  ) => {
    const selectedCodes = values[name] ?? [];
    return (
      <div className="oph-chip-grid">
        {options.length === 0 && (
          <p role="status" style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', gridColumn: '1 / -1' }}>
            Select an approved configuration with available options.
          </p>
        )}
        {options.map((option) => {
          const isSelected = selectedCodes.includes(option.code);
          return (
            <label
              key={option.code}
              className={`oph-chip ${variant === 'emergency' ? 'emergency' : variant === 'secondary' ? 'secondary' : ''} ${isSelected ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(event) => toggle(name, option.code, event.target.checked)}
              />
              <span className="oph-chip-indicator">
                {isSelected && (
                  <svg className="oph-chip-check" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="oph-chip-label">{option.label}</span>
            </label>
          );
        })}
        {selectedCodes
          .filter((code) => !options.some((option) => option.code === code))
          .map((code) => (
            <div
              key={code}
              className="oph-badge oph-badge-amber"
              style={{ gridColumn: '1 / -1', padding: '6px 12px', fontSize: '0.82rem' }}
            >
              Saved selection: <strong>{code}</strong> (configuration unavailable on this page)
            </div>
          ))}
      </div>
    );
  };

  const select = (name: 'duration_unit' | 'onset' | 'progression' | 'severity', label: string, options: readonly string[]) => (
    <label className="doc-field">
      <span>{label.replace(/ \*$/, '')}{label.endsWith(' *') && <span className="oph-required"> *</span>}</span>
      <select {...register(name, { setValueAs: nullable })}>
        <option value="">Select</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );

  const configurationSelect = (name: 'complaint_configuration_version_id' | 'emergency_configuration_version_id', label: string, records: typeof f.complaints) => (
    <label className="doc-field">
      <span>{label} <span className="oph-required">*</span></span>
      <select {...register(name)}>
        <option value="">Select approved version</option>
        {values[name] && !records.some((record) => record.id === values[name]) && (
          <option value={values[name]}>Saved version (not on this page)</option>
        )}
        {records.map((record) => (
          <option value={record.id} key={record.id}>
            {record.name} · revision {record.revision}
          </option>
        ))}
      </select>
    </label>
  );

  const intakeStatus = view.intake?.status ?? 'NOT_SAVED';

  return (
    <form onSubmit={handleSubmit(async (body) => { const saved = await f.save(body); if (saved) reset(initialIntake(context, saved)); })}>
      {/* Top Clinical Header & Actions Toolbar */}
      <div className="oph-intake-header">
        <div className="oph-intake-header-left">
          <div className="oph-intake-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Ophthalmic Clinical Intake</span>
          </div>
          <span className={`oph-intake-status-pill ${intakeStatus === 'COMPLETED' ? 'completed' : intakeStatus === 'DRAFT' ? 'draft' : 'not-saved'}`}>
            {intakeStatus.replace('_', ' ')}
          </span>
          <span className={isDirty ? 'oph-intake-dirty-pill' : 'oph-intake-clean-pill'}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isDirty ? '#f97316' : '#10b981' }}></span>
            {isDirty ? 'Unsaved changes' : 'No unsaved changes'}
            {view.intake ? ` · v${view.intake.version}` : ''}
          </span>
        </div>
        {/* <div className="oph-intake-header-right">
          <button type="button" className="doc-btn" disabled={f.busy} onClick={() => { f.setQuery('section', 'tests'); }}>
            Open test forms
          </button>
          <button
            type="button"
            className="doc-btn"
            disabled={f.busy}
            onClick={() => {
              if (!isDirty || window.confirm('Discard unsaved intake changes and reload the saved record?')) {
                reset(initialIntake(context, view.intake));
                void f.intakeQuery.refetch();
                void f.contextQuery.refetch();
              }
            }}
          >
            Reload saved record
          </button>
          <button type="button" className="doc-btn" disabled={f.busy} onClick={() => { f.back(); }}>
            Return to consultation
          </button>
        </div> */}
      </div>

      {f.actionError && (
        <p className="form-error-banner" role="alert">
          {f.actionError} Your entries are retained. For a stale record, reload before retrying.
        </p>
      )}
      {Object.entries(errors).map(([name, error]) => (
        <p key={name} className="form-error-banner" role="alert">
          {name.replaceAll('_', ' ')}: {error.message ?? 'Check the entries in this section.'}
        </p>
      ))}

      <fieldset disabled={disabled} className="oph-fieldset">
        {/* Collapsible Active Configurations */}
        <details className="oph-config-accordion">
          <summary className="oph-config-summary">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Master Configurations (Auto-Selected Active Profiles)</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Click to configure versions ▼</span>
          </summary>
          <div className="oph-config-body">
            <div className="doc-form-grid two">
              {configurationSelect('complaint_configuration_version_id', 'Complaint configuration', f.complaints)}
              {configurationSelect('emergency_configuration_version_id', 'Emergency screening configuration', f.emergencies)}
            </div>
            {[f.complaintsQuery, f.emergenciesQuery].some((query) => query.isLoading) && <p role="status">Loading configuration…</p>}
            {[f.complaintsQuery, f.emergenciesQuery].some((query) => query.isError) && (
              <p role="alert">
                Configuration lookup failed.{' '}
                <button type="button" className="doc-btn" onClick={() => { void f.complaintsQuery.refetch(); void f.emergenciesQuery.refetch(); }}>
                  Retry configuration
                </button>
              </p>
            )}
            <div className="oph-toolbar" style={{ marginTop: '12px' }}>
              <button type="button" className="doc-btn" disabled={f.configurationPage <= 1} onClick={() => f.setQuery('configuration_page', String(f.configurationPage - 1))}>
                Previous configurations
              </button>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Page {f.configurationPage}</span>
              <button
                type="button"
                className="doc-btn"
                disabled={f.configurationPage >= Math.max(f.complaintsQuery.data?.meta.totalPages ?? 0, f.emergenciesQuery.data?.meta.totalPages ?? 0)}
                onClick={() => f.setQuery('configuration_page', String(f.configurationPage + 1))}
              >
                Next configurations
              </button>
            </div>
          </div>
        </details>

        {/* 1. Chief Complaint & History of Present Illness */}
        <section className="oph-intake-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">1</span>
              <div className="oph-section-title-wrap">
                <h3>Chief Complaints <span className="oph-required">*</span></h3>
                <p className="oph-section-subtitle">Select all presenting symptoms reported by the patient for this encounter.</p>
              </div>
            </div>
            <span className="oph-badge oph-badge-blue">
              {(values.complaint_codes ?? []).length} Selected
            </span>
          </div>

          {/* Primary complaint chips */}
          {codes('complaint_codes', complaintOptions, 'primary')}

          {/* Structured HPI Presentation Box */}
          <div className="oph-hpi-box">
            <div className="oph-hpi-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Presentation & History of Present Illness (HPI)</span>
            </div>
            <div className="oph-hpi-grid">
              <div className="doc-field">
                <span>Affected Eye <span className="oph-required">*</span></span>
                <select {...register('affected_eye')}>
                  {['OD', 'OS', 'OU', 'NOT_SPECIFIED'].map((eye) => (
                    <option key={eye} value={eye}>
                      {eye === 'OD' ? 'OD - Right Eye' : eye === 'OS' ? 'OS - Left Eye' : eye === 'OU' ? 'OU - Both Eyes' : 'General / Not Specified'}
                    </option>
                  ))}
                </select>
                <div className="oph-eye-selector">
                  {[
                    { id: 'OD', label: 'OD (Right)' },
                    { id: 'OS', label: 'OS (Left)' },
                    { id: 'OU', label: 'OU (Both)' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`oph-eye-btn ${values.affected_eye === item.id ? 'active' : ''}`}
                      onClick={() => setValue('affected_eye', item.id as 'OD' | 'OS' | 'OU', { shouldDirty: true })}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="doc-field">
                <span>Duration & Unit <span className="oph-required">*</span></span>
                <div className="oph-duration-group">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="any"
                    placeholder="e.g. 3"
                    {...register('duration_value', { setValueAs: numeric })}
                  />
                  <select {...register('duration_unit', { setValueAs: nullable })}>
                    <option value="">Unit *</option>
                    {['DAY', 'WEEK', 'MONTH', 'YEAR'].map((u) => (
                      <option key={u} value={u}>{u.toLowerCase()}(s)</option>
                    ))}
                  </select>
                </div>
              </div>

              {select('onset', 'Onset *', ['SUDDEN', 'GRADUAL', 'UNKNOWN'])}
              {select('progression', 'Progression', ['IMPROVING', 'STABLE', 'WORSENING', 'INTERMITTENT'])}
              {select('severity', 'Severity', ['MILD', 'MODERATE', 'SEVERE'])}
            </div>
          </div>

          <label className="doc-field" style={{ marginTop: '18px' }}>
            <span>Clinical Description & Associated Symptoms (HPI Details)</span>
            <textarea
              rows={3}
              maxLength={4000}
              placeholder="Record detailed onset circumstances, pain characteristics, vision changes, or secondary/associated symptoms accompanying the chief complaint..."
              {...register('description', { setValueAs: nullable })}
            />
          </label>
        </section>

        {/* 2. Ophthalmic History */}
        <section className="oph-intake-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">2</span>
              <div className="oph-section-title-wrap">
                <h3>Ophthalmic History</h3>
                <p className="oph-section-subtitle">Prior eye surgeries, laser procedures, injuries, treatments, and vision correction history.</p>
              </div>
            </div>
          </div>

          {/* No Significant History Toggle Card */}
          <div
            className={`oph-history-toggle-card ${values.no_significant_ophthalmic_history ? 'active' : ''}`}
            onClick={() => {
              if (values.no_significant_ophthalmic_history) {
                setValue('no_significant_ophthalmic_history', false, { shouldDirty: true });
                return;
              }
              const current = getValues();
              if (hasPositiveEyeHistory(current)) {
                if (!window.confirm('Clear the positive ophthalmic history entries and confirm no significant ophthalmic history? Shared medical history, allergies and report references are preserved.')) return;
                reset(clearPositiveEyeHistory(current), { keepDefaultValues: true });
              } else {
                setValue('no_significant_ophthalmic_history', true, { shouldDirty: true });
              }
            }}
          >
            <div className="oph-history-toggle-left">
              <input
                type="checkbox"
                checked={values.no_significant_ophthalmic_history ?? false}
                onChange={() => {}} // Handled by outer card
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div className="oph-history-toggle-text">
                <h4>No significant ophthalmic history</h4>
                <p>Patient reports no previous ocular surgeries, laser treatments, ocular trauma, or chronic eye medications.</p>
              </div>
            </div>
            {values.no_significant_ophthalmic_history && (
              <span className="oph-badge oph-badge-green">Verified Negative</span>
            )}
          </div>

          <div style={{ margin: '8px 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
            Previous eye disease codes: {(values.previous_eye_disease_codes ?? []).join(', ') || 'None recorded'}. Family history codes: {(values.family_history_codes ?? []).join(', ') || 'None recorded'}.
          </div>

          {/* Previous Eye Surgeries */}
          <div style={{ marginTop: '18px' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#1e293b', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Previous Eye Surgeries ({surgeries.fields.length})</span>
            </h4>
            {surgeries.fields.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: '6px 0 10px' }}>
                No surgical history entries recorded.
              </p>
            ) : (
              <div className="oph-repeat-container">
                {surgeries.fields.map((field, index) => (
                  <div className="oph-repeat-item" key={field.id}>
                    <label className="doc-field" style={{ flex: 2 }}>
                      <span>Procedure <span className="oph-required">*</span></span>
                      <input
                        placeholder="e.g. Cataract surgery (Phaco + IOL), Trabeculectomy"
                        {...register(`previous_eye_surgeries.${index}.procedure`)}
                        maxLength={250}
                      />
                    </label>
                    <label className="doc-field" style={{ flex: 1 }}>
                      <span>Eye</span>
                      <select {...register(`previous_eye_surgeries.${index}.laterality`)}>
                        <option value="">Select</option>
                        {eyeOptions.map((eye) => <option key={eye} value={eye}>{eye}</option>)}
                      </select>
                    </label>
                    <label className="doc-field" style={{ flex: 1.2 }}>
                      <span>Date <span className="oph-required">*</span></span>
                      <input
                        type="date"
                        value={dateInput(values.previous_eye_surgeries?.[index]?.date ?? '')}
                        onChange={(event) => setValue(`previous_eye_surgeries.${index}.date`, isoDate(event.target.value), { shouldDirty: true })}
                      />
                    </label>
                    <button
                      type="button"
                      className="oph-repeat-delete-btn"
                      onClick={() => surgeries.remove(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="oph-add-toolbar">
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>Add Surgery:</span>
              <select
                value={newSurgeryEye}
                onChange={(event) => setNewSurgeryEye(event.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem', borderRadius: '6px' }}
              >
                <option value="">Select eye laterality</option>
                {eyeOptions.map((eye) => <option key={eye} value={eye}>{eye}</option>)}
              </select>
              <button
                type="button"
                className="doc-btn"
                disabled={surgeries.fields.length >= 50 || !newSurgeryEye}
                onClick={() => {
                  const eye = eyeSchema.safeParse(newSurgeryEye);
                  if (eye.success) {
                    surgeries.append({ procedure: '', laterality: eye.data, date: '' });
                    setNewSurgeryEye('');
                  }
                }}
              >
                + Add Surgery
              </button>
            </div>
          </div>

          {/* Current Eye Treatment */}
          <div style={{ marginTop: '22px' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#1e293b', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Current Eye Treatments ({treatments.fields.length})</span>
            </h4>
            {treatments.fields.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: '6px 0 10px' }}>
                No active eye treatments recorded.
              </p>
            ) : (
              <div className="oph-repeat-container">
                {treatments.fields.map((field, index) => (
                  <div className="oph-repeat-item" key={field.id}>
                    <label className="doc-field" style={{ flex: 1.5 }}>
                      <span>Treatment Type <span className="oph-required">*</span></span>
                      <input
                        placeholder="e.g. Anti-glaucoma drop, Artificial tears, Antibiotic ointment"
                        {...register(`current_eye_treatments.${index}.type`)}
                        maxLength={120}
                      />
                    </label>
                    <label className="doc-field" style={{ flex: 2 }}>
                      <span>Details & Frequency <span className="oph-required">*</span></span>
                      <input
                        placeholder="e.g. Timolol 0.5% 1 drop BD both eyes, 3 months"
                        {...register(`current_eye_treatments.${index}.details`)}
                        maxLength={1000}
                      />
                    </label>
                    <button
                      type="button"
                      className="oph-repeat-delete-btn"
                      onClick={() => treatments.remove(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="doc-btn"
              disabled={treatments.fields.length >= 50}
              onClick={() => treatments.append({ type: '', details: '' })}
            >
              + Add Treatment
            </button>
          </div>

          {/* Previous Injury / Laser */}
          <div style={{ marginTop: '22px' }}>
            <h4 style={{ fontSize: '0.92rem', color: '#1e293b', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Previous Injury or Laser Treatment ({injuries.fields.length})</span>
            </h4>
            {injuries.fields.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: '6px 0 10px' }}>
                No prior ocular injuries or laser treatments.
              </p>
            ) : (
              <div className="oph-repeat-container">
                {injuries.fields.map((field, index) => (
                  <div className="oph-repeat-item" key={field.id}>
                    <label className="doc-field" style={{ flex: 1 }}>
                      <span>Type</span>
                      <select {...register(`previous_eye_injury_or_laser.${index}.type`)}>
                        <option value="INJURY">INJURY</option>
                        <option value="LASER">LASER</option>
                      </select>
                    </label>
                    <label className="doc-field" style={{ flex: 1 }}>
                      <span>Eye</span>
                      <select {...register(`previous_eye_injury_or_laser.${index}.laterality`)}>
                        {eyeOptions.map((eye) => <option key={eye} value={eye}>{eye}</option>)}
                      </select>
                    </label>
                    <label className="doc-field" style={{ flex: 1.2 }}>
                      <span>Date (if known)</span>
                      <input
                        type="date"
                        value={dateInput(values.previous_eye_injury_or_laser?.[index]?.date ?? null)}
                        onChange={(event) => setValue(`previous_eye_injury_or_laser.${index}.date`, isoDate(event.target.value) || null, { shouldDirty: true })}
                      />
                    </label>
                    <label className="doc-field" style={{ flex: 2 }}>
                      <span>Details <span className="oph-required">*</span></span>
                      <input
                        placeholder="e.g. Corneal foreign body removal, YAG capsulotomy"
                        {...register(`previous_eye_injury_or_laser.${index}.details`)}
                        maxLength={1000}
                      />
                    </label>
                    <button
                      type="button"
                      className="oph-repeat-delete-btn"
                      onClick={() => injuries.remove(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="oph-add-toolbar">
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>Add Injury / Laser:</span>
              <select
                value={newInjuryType}
                onChange={(event) => setNewInjuryType(event.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem', borderRadius: '6px' }}
              >
                <option value="">Select type</option>
                <option value="INJURY">INJURY</option>
                <option value="LASER">LASER</option>
              </select>
              <select
                value={newInjuryEye}
                onChange={(event) => setNewInjuryEye(event.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem', borderRadius: '6px' }}
              >
                <option value="">Select eye laterality</option>
                {eyeOptions.map((eye) => <option key={eye} value={eye}>{eye}</option>)}
              </select>
              <button
                type="button"
                className="doc-btn"
                disabled={injuries.fields.length >= 50 || !newInjuryEye || !newInjuryType}
                onClick={() => {
                  const eye = eyeSchema.safeParse(newInjuryEye);
                  if (eye.success && (newInjuryType === 'INJURY' || newInjuryType === 'LASER')) {
                    injuries.append({ type: newInjuryType, laterality: eye.data, date: null, details: '' });
                    setNewInjuryEye('');
                    setNewInjuryType('');
                  }
                }}
              >
                + Add Entry
              </button>
            </div>
          </div>

          {/* Refractive Correction: Spectacles & Contact Lenses */}
          <div className="oph-correction-grid">
            {(['spectacle_use', 'contact_lens_use'] as const).map((name) => {
              const isSpec = name === 'spectacle_use';
              const uses = Boolean(values[name]?.uses);
              return (
                <div key={name} className={`oph-correction-card ${uses ? 'active' : ''}`}>
                  <div className="oph-correction-header">
                    <span className="oph-correction-title">
                      <span>{isSpec ? '👓' : '👁️'}</span>
                      <span>{isSpec ? 'Spectacles History' : 'Contact Lens History'}</span>
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" {...register(`${name}.uses`)} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: uses ? '#2563eb' : '#64748b' }}>
                        {uses ? 'Active User' : 'Non-User'}
                      </span>
                    </label>
                  </div>
                  <div className="doc-form-grid two" style={{ marginTop: '10px' }}>
                    <label className="doc-field">
                      <span>Age (Months)</span>
                      <input
                        type="number"
                        min="0"
                        max="1200"
                        disabled={!uses}
                        placeholder="e.g. 24"
                        {...register(`${name}.age_months`, { setValueAs: numeric })}
                      />
                    </label>
                    <label className="doc-field">
                      <span>Wearing Pattern</span>
                      <input
                        disabled={!uses}
                        maxLength={500}
                        placeholder="e.g. Constant, Reading, Screen"
                        {...register(`${name}.wearing_pattern`, { setValueAs: nullable })}
                      />
                    </label>
                  </div>
                  {!uses && (values[name]?.age_months != null || values[name]?.wearing_pattern) && (
                    <button
                      type="button"
                      className="doc-btn"
                      style={{ marginTop: '8px', fontSize: '0.78rem' }}
                      onClick={() => {
                        setValue(`${name}.age_months`, null, { shouldDirty: true });
                        setValue(`${name}.wearing_pattern`, null, { shouldDirty: true });
                      }}
                    >
                      Clear orphaned correction details
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Long-Term Steroid Use Alert */}
          <div className={`oph-steroid-card ${values.long_term_steroid_use ? 'active' : ''}`}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, fontWeight: 700, color: '#92400e' }}>
              <input type="checkbox" {...register('long_term_steroid_use')} />
              <span>⚠️ Long-Term Steroid Use (Topical or Systemic)</span>
            </label>
            <label className="doc-field" style={{ flex: 1, minWidth: '240px', margin: 0 }}>
              <span>Steroid Regimen & Details</span>
              <input
                maxLength={1000}
                disabled={!values.long_term_steroid_use}
                placeholder="Specify medication, dosage, duration and prescribing physician..."
                {...register('long_term_steroid_details', { setValueAs: nullable })}
              />
            </label>
          </div>
        </section>

        {/* 3. Shared Medical History & Allergies */}
        <section className="oph-intake-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">3</span>
              <div className="oph-section-title-wrap">
                <h3>Shared Medical History & Allergies</h3>
                <p className="oph-section-subtitle">Cross-department systemic records and verification of patient allergies.</p>
              </div>
            </div>
          </div>

          <div className="oph-shared-grid">
            <div className="oph-shared-panel">
              <h4>Systemic Medical History</h4>
              {Object.entries(view.shared_history).length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                  No systemic history records found on patient profile.
                </p>
              ) : (
                <dl className="oph-shared-dl">
                  {Object.entries(view.shared_history).map(([key, value]) => (
                    <div key={key} style={{ display: 'contents' }}>
                      <dt>{key.replaceAll('_', ' ')}:</dt>
                      <dd>{value || 'Not recorded'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="oph-shared-panel">
              <h4>Clinical Verification</h4>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 12px' }}>
                Both systemic history and allergies must be confirmed before this intake can be completed.
              </p>
              <div className="oph-review-grid">
                <label className={`oph-review-card ${values.shared_medical_history_reviewed ? 'checked' : ''}`}>
                  <input type="checkbox" {...register('shared_medical_history_reviewed')} />
                  <span>Medical history reviewed <span className="oph-required">*</span></span>
                </label>
                <label className={`oph-review-card ${values.shared_allergy_reviewed ? 'checked' : ''}`}>
                  <input type="checkbox" {...register('shared_allergy_reviewed')} />
                  <span>Allergies reviewed <span className="oph-required">*</span></span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Previous Reports */}
        <section className="oph-intake-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">4</span>
              <div className="oph-section-title-wrap">
                <h3>Previous Reports & Diagnostic Documents</h3>
                <p className="oph-section-subtitle">Link prior ophthalmic scans, visual field charts, or external lab results.</p>
              </div>
            </div>
            <span className="oph-badge oph-badge-blue">
              {values.previous_report_document_ids?.length ?? 0} Linked
            </span>
          </div>

          {(values.previous_report_document_ids ?? []).length === 0 ? (
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic', margin: '0 0 12px' }}>
              No document references linked to this intake.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 12px' }}>
              {(values.previous_report_document_ids ?? []).map((docId) => (
                <div key={docId} className="oph-badge oph-badge-blue" style={{ gap: '8px', padding: '6px 12px' }}>
                  <span>Document: <code>{docId.slice(0, 10)}…</code></span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                    onClick={() => setValue('previous_report_document_ids', getValues('previous_report_document_ids').filter((v) => v !== docId), { shouldDirty: true })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {f.canViewReports && (
            <button
              type="button"
              className="doc-btn"
              onClick={() => f.setQuery('reports', f.reportsOpen ? 'closed' : 'open')}
            >
              {f.reportsOpen ? 'Close Patient Documents' : 'Select Existing Patient Reports'}
            </button>
          )}

          {f.reportsOpen && f.canViewReports && (
            <div aria-label="Existing patient reports" style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {f.reportsQuery.isLoading && <p role="status">Loading patient documents…</p>}
              {f.reportsQuery.isError && (
                <p role="alert">
                  Patient documents could not be loaded.{' '}
                  <button type="button" className="doc-btn" onClick={() => void f.reportsQuery.refetch()}>
                    Retry
                  </button>
                </p>
              )}
              {!f.reportsQuery.isLoading && !f.reportsQuery.isError && !f.reports.length && (
                <p style={{ fontSize: '0.84rem', color: '#64748b', fontStyle: 'italic' }}>No patient documents found on this page.</p>
              )}
              {f.reports.map((document) => (
                <label className="oph-option" key={document.id}>
                  <input
                    type="checkbox"
                    checked={(values.previous_report_document_ids ?? []).includes(document.id)}
                    onChange={(event) => toggle('previous_report_document_ids', document.id, event.target.checked)}
                  />{' '}
                  <strong>{document.title}</strong> · {document.document_type}
                </label>
              ))}
              <div className="oph-toolbar" style={{ marginTop: '12px' }}>
                <button type="button" className="doc-btn" disabled={f.reportPage <= 1} onClick={() => f.setQuery('report_page', String(f.reportPage - 1))}>
                  Previous reports
                </button>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Page {f.reportPage}</span>
                <button
                  type="button"
                  className="doc-btn"
                  disabled={f.reportPage >= (f.reportsQuery.data?.meta.totalPages ?? 0)}
                  onClick={() => f.setQuery('report_page', String(f.reportPage + 1))}
                >
                  Next reports
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 5. Emergency Screening */}
        <section className="oph-emergency-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number red">5</span>
              <div className="oph-section-title-wrap">
                <h3 style={{ color: '#991b1b' }}>Emergency Screening & Red-Flag Criteria</h3>
                <p className="oph-section-subtitle">Screen for urgent vision-threatening or acute conditions requiring immediate triage.</p>
              </div>
            </div>
            {(values.emergency_criterion_codes ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="oph-badge oph-badge-red">
                  ⚠️ {(values.emergency_criterion_codes ?? []).length} Red Flags Present
                </span>
                {f.canEscalate && (
                  <button
                    type="button"
                    className="doc-btn danger"
                    style={{ padding: '4px 10px', fontSize: '0.82rem' }}
                    disabled={f.busy}
                    onClick={() => {
                      if (window.confirm('Immediately escalate this emergency alert to on-duty ophthalmologists and block routine testing?')) {
                        void f.escalate(
                          values.other_urgent_condition_detail || `Emergency red flags identified: ${(values.emergency_criterion_codes ?? []).join(', ')}`,
                          values.emergency_criterion_codes,
                          'EMERGENCY'
                        );
                      }
                    }}
                  >
                    Immediate Emergency Escalation
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="oph-emergency-alert-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Completing intake with any positive criteria immediately alerts and routes to the emergency eye triage team.</span>
          </div>

          {codes('emergency_criterion_codes', emergencyOptions, 'emergency')}

          <label className="doc-field" style={{ marginTop: '14px' }}>
            <span>Other Urgent Condition Details / Mechanism of Trauma</span>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Provide exact details for suspected acute glaucoma, chemical burns, penetrating injuries or sudden vision loss..."
              {...register('other_urgent_condition_detail', { setValueAs: nullable })}
            />
          </label>
        </section>

        {/* Bottom Submission Toolbar */}
        <div className="oph-intake-submit-bar">
          <div style={{ fontSize: '0.86rem', color: '#64748b' }}>
            {view.intake?.status === 'COMPLETED' ? (
              <span style={{ color: '#047857', fontWeight: 600 }}>✓ This intake is completed and finalized.</span>
            ) : completionIssues.length === 0 ? (
              <span style={{ color: '#047857', fontWeight: 600 }}>✓ All mandatory fields completed. Ready to save or finalize.</span>
            ) : (
              <span style={{ color: '#b45309', fontWeight: 600 }}>{completionIssues.length} item(s) needed before final completion.</span>
            )}
          </div>

          <div className="oph-submit-actions">
            <button className="oph-submit-btn primary" type="submit" disabled={f.busy}>
              {f.busy ? 'Saving…' : 'Save Intake Draft'}
            </button>
            <button
              type="button"
              className="oph-submit-btn success"
              disabled={!view.intake || isDirty || completionIssues.length > 0 || view.intake?.status === 'COMPLETED'}
              onClick={() => {
                if (window.confirm('Complete the saved intake and route any emergency screening alerts?')) {
                  void f.complete();
                }
              }}
            >
              Complete Intake
            </button>
          </div>
        </div>
      </fieldset>

      {/* Completion Issues Reminder Box */}
      {view.intake?.status !== 'COMPLETED' && completionIssues.length > 0 && (
        <div className="oph-issues-box">
          <div className="oph-issues-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Mandatory Requirements Before Completing Intake:</span>
          </div>
          <ul className="oph-issues-list">
            {completionIssues.map((issue, index) => (
              <li key={`${index}-${issue}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
