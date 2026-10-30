import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { opticalPowerSchema, opticalWriteSchema, type OpticalPrescription } from '../../api/ophthalmology-care';
import type { OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import type { CareWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { getEncounterDraft, setEncounterDraft, clearEncounterDraft, registerDraftSaveHandler } from '../../hooks/ophthalmology/encounter-draft-cache';
import { EditorErrors, inputInstant, localDateTime } from './OphthalmologyConfigurationEditor';

const blankPower = opticalPowerSchema.extend({ sphere: z.number().nullable() });
const editorSchema = z.object({
  ...opticalWriteSchema.shape,
  coating_codes: z.array(z.string().max(80)).max(20),
  power: z.object({
    OD: blankPower.nullable().optional(),
    OS: blankPower.nullable().optional(),
  }),
});
type Editor = z.infer<typeof editorSchema>;

function initial(record: OpticalPrescription | null): Partial<Editor> {
  if (!record) {
    return {
      expected_version: 0,
      power: { OD: null, OS: null },
      coating_codes: [],
      lens_type: '',
      material: '',
      usage_instructions: '',
      valid_until: '',
      review_date: null,
      segment_height: null,
    };
  }
  const current = record.current;
  return {
    expected_version: record.version,
    prescription_type: current.prescription_type,
    power: current.power,
    pupillary_distance: current.pupillary_distance,
    segment_height: current.segment_height,
    lens_type: current.lens_type,
    material: current.material,
    coating_codes: current.coating_codes,
    usage_instructions: current.usage_instructions,
    valid_until: current.valid_until,
    review_date: current.review_date,
  };
}

const optionalNumber = (value: string) => value === '' ? null : Number(value);

const coatingLabels: Record<string, string> = {
  ANTI_REFLECTIVE: 'Anti-reflective', BLUE_BLOCK: 'Blue-block', UV_400: 'UV 400',
  SCRATCH_RESISTANT: 'Scratch resistant', PHOTOCHROMIC: 'Photochromic',
};

function OpticalEyeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

const prescriptionTypes = [
  { id: 'DISTANCE', label: 'Distance', desc: 'General distance vision' },
  { id: 'NEAR', label: 'Near / Reading', desc: 'Reading and near work' },
  { id: 'BIFOCAL', label: 'Bifocal', desc: 'Distance and near powers' },
  { id: 'PROGRESSIVE', label: 'Progressive (PAL)', desc: 'Continuous range of vision' },
  { id: 'OCCUPATIONAL', label: 'Occupational', desc: 'Work specific usage' },
] as const;

export function OphthalmologyOpticalEditor({ feature: f, workspace }: { feature: OphthalmologyCareFeature; workspace: CareWorkspace }) {
  const visitId = workspace?.visitId ?? '';
  const cachedDraft = typeof getEncounterDraft === 'function' ? getEncounterDraft<Editor>(visitId, 'optical') : undefined;
  const [baseline, setBaseline] = useState(f.optical);
  const [showSlip, setShowSlip] = useState(false);
  const { register, control, handleSubmit, setValue, setError, reset, getValues, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({
    resolver: zodResolver(editorSchema),
    defaultValues: cachedDraft ?? initial(baseline),
  });
  const values = useWatch({ control });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'area']);

  useEffect(() => {
    if (isDirty && typeof setEncounterDraft === 'function') {
      setEncounterDraft(visitId, 'optical', getValues(), true);
    }
  }, [isDirty, getValues, visitId, values]);

  const onInvalid = (fieldErrors: FieldErrors<Editor>) => {
    const messages: string[] = [];
    if (fieldErrors.power) messages.push('Enter at least one prescribed eye with a valid sphere power.');
    if (fieldErrors.pupillary_distance) messages.push('Enter valid pupillary distance (PD).');
    if (fieldErrors.lens_type) messages.push('Select or enter Lens Type.');
    if (fieldErrors.material) messages.push('Select or enter Material.');
    if (fieldErrors.usage_instructions) messages.push('Usage Instructions are required.');
    if (fieldErrors.valid_until) messages.push('Prescription Validity date is required.');
    if (fieldErrors.root?.message) messages.push(fieldErrors.root.message);

    const displayMsg = messages.length > 0
      ? messages.join(' ')
      : 'Please complete all required fields (Power, PD, Lens Type, Material, Usage Instructions, Validity) to save draft.';
    toast.error(`Incomplete Prescription: ${displayMsg}`);
  };

  useEffect(() => {
    if (typeof registerDraftSaveHandler !== 'function') return;
    const saveFn = async () => {
      let saved = false;
      await handleSubmit(async (formValues) => {
        const cleanPower = {
          OD: formValues.power?.OD?.sphere != null ? formValues.power.OD : null,
          OS: formValues.power?.OS?.sphere != null ? formValues.power.OS : null,
        };
        const body = opticalWriteSchema.parse({
          ...formValues,
          power: cleanPower,
          coating_codes: (formValues.coating_codes ?? []).map((code) => code.trim()).filter(Boolean),
          expected_version: baseline?.version ?? 0,
        });
        const result = await f.saveOptical(body);
        if (result) {
          if (typeof clearEncounterDraft === 'function') clearEncounterDraft(visitId, 'optical');
          apply(result);
          saved = true;
          toast.success('Optical prescription draft saved.');
        }
      }, onInvalid)();
      if (!saved) throw new Error('Optical prescription draft could not be saved.');
    };
    const unregisterOptical = registerDraftSaveHandler('optical', saveFn);
    const unregisterCurrent = registerDraftSaveHandler('current', saveFn);
    return () => {
      unregisterOptical();
      unregisterCurrent();
    };
  }, [handleSubmit, f, reset, visitId, baseline?.version]);

  const changed = baseline?.id !== f.optical?.id || (baseline?.version ?? 0) !== (f.optical?.version ?? 0);
  const disabled = !f.canSaveOptical || f.busy || isSubmitting || changed;

  const apply = (saved: OpticalPrescription) => {
    if (typeof clearEncounterDraft === 'function') clearEncounterDraft(visitId, 'optical');
    setBaseline(saved);
    reset(initial(saved));
  };

  const field = (name: 'lens_type' | 'material', label: string, placeholder: string, options: string[] | null) => (
    <label className="oph-input-field">
      <span className="oph-input-label">{label} <span className="oph-required">*</span></span>
      {options ? (
        <select className="oph-text-input" {...register(name)}>
          <option value="">{placeholder}</option>
          {values[name] && !options.includes(values[name]) && (
            <option value={values[name]}>Saved {values[name]} (not currently configured)</option>
          )}
          {options.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      ) : (
        <input className="oph-text-input" maxLength={80} placeholder={placeholder} {...register(name)} />
      )}
    </label>
  );


  return (
    <form
      className="oph-optical-form-container oph-optical-reference"
      onSubmit={handleSubmit(async (formValues) => {
        try {
          const cleanPower = {
            OD: formValues.power?.OD?.sphere != null ? formValues.power.OD : null,
            OS: formValues.power?.OS?.sphere != null ? formValues.power.OS : null,
          };
          const body = opticalWriteSchema.parse({
            ...formValues,
            power: cleanPower,
            coating_codes: (formValues.coating_codes ?? []).map((code) => code.trim()).filter(Boolean),
            expected_version: baseline?.version ?? 0,
          });
          const saved = await f.saveOptical(body);
          if (saved) {
            apply(saved);
            toast.success('Optical prescription draft saved.');
          }
        } catch (error) {
          const msg = error instanceof z.ZodError
            ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ')
            : error instanceof Error ? error.message : 'Check the optical prescription.';
          setError('root', { message: msg });
          toast.error(msg);
        }
      }, onInvalid)}
    >
      {/* 1. Header Card with Title, Status Badges & Latest Prescription Action */}
      <div className="oph-exam-heading oph-optical-page-heading">
        <h2>Optical prescription</h2>
        <p className="oph-exam-description">Create, authorize, and dispense an optical prescription.</p>
      </div>
      {changed && (
        <p role="alert" className="form-error-banner">
          The saved prescription changed on the server. Your entries remain here; reload the saved version before continuing.
          <button type="button" className="oph-btn-outline" disabled={f.busy || f.opticalQuery.isError} onClick={() => {
            if (!isDirty || window.confirm('Discard entered values and load the latest saved optical prescription?')) {
              setBaseline(f.optical);
              reset(initial(f.optical));
            }
          }}>Load latest saved prescription</button>
        </p>
      )}

      <EditorErrors errors={errors} />

      <fieldset className="oph-optical-fieldset" disabled={disabled}>
        {/* Card 1: 1. Prescription Classification */}
        <div className="oph-card">
          <div className="oph-card-header">
            <h3 className="oph-card-title">
              1. Prescription classification <span className="oph-required">*</span>
            </h3>
            <p className="oph-card-subtitle">Select the intended focal range and use.</p>
          </div>

          <div className="oph-class-grid">
            {prescriptionTypes.map((type) => {
              const isSelected = values.prescription_type === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`oph-class-card ${isSelected ? 'selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setValue('prescription_type', type.id, { shouldDirty: true })}
                >
                  <div className="oph-class-icon"><OpticalEyeIcon /></div>
                  <div className="oph-class-label">{type.label}</div>
                  <div className="oph-class-desc">{type.desc}</div>
                </button>
              );
            })}
          </div>
          <select {...register('prescription_type')} style={{ display: 'none' }}>
            <option value="">Select type</option>
            {opticalWriteSchema.shape.prescription_type.options.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Card 2: 2. Refraction Power Matrix (Rx) */}
        <div className="oph-card">
          <div className="oph-card-header">
            <h3 className="oph-card-title">
              2. Refraction power matrix <span className="oph-required">*</span>
            </h3>
            <p className="oph-card-subtitle">Corrective power parameters for right and left eye.</p>
          </div>

          <div className="oph-rx-table-container">
            <table className="oph-rx-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Eye</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Prescription</th>
                  <th>Sphere (S) *</th>
                  <th>Cylinder (C)</th>
                  <th>Axis (°)</th>
                  <th>Near add (ADD)</th>
                  <th>Prism</th>
                  <th>Prism base</th>
                  <th>Segment ht (mm)</th>
                </tr>
              </thead>
              <tbody>
                {(['OD', 'OS'] as const).map((eye) => {
                  const isOD = eye === 'OD';
                  const isPrescribed = Boolean(values.power?.[eye]);
                  const hasCyl = values.power?.[eye]?.cylinder != null;
                  const isMultifocal = ['BIFOCAL', 'PROGRESSIVE'].includes(values.prescription_type ?? '');

                  return (
                    <tr key={eye} className={!isPrescribed ? 'row-disabled' : ''}>
                      <td>
                        <span className={`oph-eye-pill ${isOD ? 'od' : 'os'}`}>
                          {isOD ? 'OD · Right eye' : 'OS · Left eye'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label className="oph-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isPrescribed}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setValue(`power.${eye}`, { sphere: null }, { shouldDirty: true });
                              } else if (window.confirm(`Remove ${eye} power from this prescription draft?`)) {
                                setValue(`power.${eye}`, null, { shouldDirty: true });
                                setValue(`segment_height.${eye}`, null, { shouldDirty: true });
                              }
                            }}
                          />
                          <span>Active</span>
                        </label>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.25"
                          min="-40"
                          max="40"
                          disabled={!isPrescribed}
                          placeholder="e.g. -2.50"
                          className="oph-rx-input"
                          {...register(`power.${eye}.sphere`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.25"
                          min="-20"
                          max="20"
                          disabled={!isPrescribed}
                          placeholder="e.g. -0.75"
                          className="oph-rx-input"
                          {...register(`power.${eye}.cylinder`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="180"
                          disabled={!isPrescribed}
                          placeholder="e.g. 180"
                          className="oph-rx-input"
                          style={{ borderColor: hasCyl && values.power?.[eye]?.axis == null ? '#ef4444' : undefined }}
                          {...register(`power.${eye}.axis`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="10"
                          disabled={!isPrescribed}
                          placeholder="e.g. +2.00"
                          className="oph-rx-input"
                          {...register(`power.${eye}.addition`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="30"
                          disabled={!isPrescribed}
                          placeholder="e.g. 1.0"
                          className="oph-rx-input"
                          {...register(`power.${eye}.prism`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <select
                          disabled={!isPrescribed}
                          className="oph-rx-input oph-rx-select"
                          {...register(`power.${eye}.prism_base`, { setValueAs: (v) => v || null })}
                        >
                          <option value="">Base In</option>
                          <option value="BI">Base In</option>
                          <option value="BO">Base Out</option>
                          <option value="BU">Base Up</option>
                          <option value="BD">Base Down</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="5"
                          max="50"
                          disabled={!isPrescribed}
                          placeholder="e.g. 28"
                          className="oph-rx-input"
                          style={{ borderColor: isMultifocal && isPrescribed && values.segment_height?.[eye] == null ? '#f59e0b' : undefined }}
                          {...register(`segment_height.${eye}`, { setValueAs: optionalNumber })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: 3. Pupillary Distance & Centration (PD) */}
        <div className="oph-card">
          <div className="oph-card-header">
            <h3 className="oph-card-title">
              3. Pupillary distance &amp; centration <span className="oph-required">*</span>
            </h3>
            <p className="oph-card-subtitle">Specify binocular or monocular PD in millimetres.</p>
          </div>

          <div className="oph-pd-toggle-row">
            {[
              { id: 'BINOCULAR', label: 'Binocular PD (single total)' },
              { id: 'MONOCULAR', label: 'Monocular PD (separate OD & OS)' },
            ].map((fmt) => {
              const isActive = values.pupillary_distance?.format === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  className={`oph-pd-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setValue('pupillary_distance.format', fmt.id as 'BINOCULAR' | 'MONOCULAR', { shouldDirty: true })}
                >
                  <span className="oph-radio-circle">{isActive ? '◉' : '○'}</span>
                  <span>{fmt.label}</span>
                </button>
              );
            })}
          </div>
          <select {...register('pupillary_distance.format')} style={{ display: 'none' }}>
            <option value="BINOCULAR">BINOCULAR</option>
            <option value="MONOCULAR">MONOCULAR</option>
          </select>

          <div className="oph-grid-two" style={{ marginTop: '14px' }}>
            {values.pupillary_distance?.format === 'BINOCULAR' && (
              <label className="oph-input-field">
                <span className="oph-input-label">Binocular PD (mm) <span className="oph-required">*</span></span>
                <input
                  type="number"
                  step="0.5"
                  min="30"
                  max="90"
                  placeholder="e.g. 63.0"
                  className="oph-text-input"
                  {...register('pupillary_distance.binocular', { setValueAs: optionalNumber })}
                />
              </label>
            )}
            {values.pupillary_distance?.format === 'MONOCULAR' && (
              <>
                <label className="oph-input-field">
                  <span className="oph-input-label">OD Monocular PD (mm) <span className="oph-required">*</span></span>
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="50"
                    placeholder="e.g. 31.5"
                    className="oph-text-input"
                    {...register('pupillary_distance.OD', { setValueAs: optionalNumber })}
                  />
                </label>
                <label className="oph-input-field">
                  <span className="oph-input-label">OS Monocular PD (mm) <span className="oph-required">*</span></span>
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="50"
                    placeholder="e.g. 31.5"
                    className="oph-text-input"
                    {...register('pupillary_distance.OS', { setValueAs: optionalNumber })}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Card 4: 4. Lens Design, Materials & Coatings */}
        <div className="oph-card">
          <div className="oph-card-header">
            <h3 className="oph-card-title">
              4. Lens design, materials &amp; coatings
            </h3>
            <p className="oph-card-subtitle">Choose lens material and surface treatments.</p>
          </div>

          <div className="oph-grid-two" style={{ marginTop: '14px' }}>
            {field('lens_type', 'Lens type', 'Select lens type', f.lensTypes ?? ['Single Vision', 'Progressive Addition (PAL)', 'Bifocal (D-Segment)', 'Trifocal', 'Occupational / Office'])}
            {field('material', 'Lens material', 'Select lens material', f.materials ?? ['CR-39 Standard Plastic', 'Polycarbonate (Impact Resistant)', 'Hi-Index 1.60', 'Hi-Index 1.67 Ultra-Thin', 'Trivex High-Definition'])}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="oph-input-label" style={{ display: 'block', marginBottom: '8px' }}>
              Applied coatings &amp; treatments
            </label>
            <Controller
              control={control}
              name="coating_codes"
              render={({ field: cField }) => {
                const availableCoatings = f.coatings && f.coatings.length > 0
                  ? f.coatings
                  : ['Anti-Reflective', 'Blue Block', 'UV 400', 'Scratch Resistant', 'Photochromic'];
                const currentList = cField.value ?? [];
                return (
                  <div className="oph-coating-row">
                    {availableCoatings.map((code) => {
                      const isSelected = currentList.includes(code);
                      return (
                        <label
                          key={code}
                          className={`oph-coating-pill ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              cField.onChange(
                                checked
                                  ? [...new Set([...currentList, code])]
                                  : currentList.filter((entry) => entry !== code)
                              );
                            }}
                          />
                          {isSelected && <span className="oph-pill-check">✓</span>}
                          <span>{coatingLabels[code] ?? code.replaceAll('_', ' ')}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Card 5: 5. Validity Period & Dispensing Instructions */}
        <div className="oph-card">
          <div className="oph-card-header">
            <h3 className="oph-card-title">
              5. Validity &amp; dispensing instructions
            </h3>
            <p className="oph-card-subtitle">Prescription timeline and instructions for dispensing.</p>
          </div>

          <div className="oph-grid-two" style={{ marginTop: '14px' }}>
            <Controller
              control={control}
              name="valid_until"
              render={({ field: dField }) => (
                <label className="oph-input-field">
                  <span className="oph-input-label">Valid until (local time) <span className="oph-required">*</span></span>
                  <input
                    type="datetime-local"
                    className="oph-text-input"
                    value={localDateTime(dField.value)}
                    onChange={(event) => dField.onChange(inputInstant(event.target.value) ?? '')}
                  />
                </label>
              )}
            />
            <Controller
              control={control}
              name="review_date"
              render={({ field: dField }) => (
                <label className="oph-input-field">
                  <span className="oph-input-label">Review date (local time, optional)</span>
                  <input
                    type="datetime-local"
                    className="oph-text-input"
                    value={localDateTime(dField.value)}
                    onChange={(event) => dField.onChange(inputInstant(event.target.value))}
                  />
                </label>
              )}
            />
          </div>

          <label className="oph-input-field" style={{ marginTop: '14px' }}>
            <span className="oph-input-label">Instructions for optician &amp; patient <span className="oph-required">*</span></span>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Add dispensing or patient instructions..."
              className="oph-textarea"
              {...register('usage_instructions')}
            />
            <div className="oph-char-count">
              {(values.usage_instructions ?? '').length}/500
            </div>
          </label>
        </div>

        {/* Bottom Action Bar */}
        <div className="oph-bottom-action-bar">
          <div className="oph-action-status-wrap">
            {isDirty ? (
              <span className="oph-status-dirty">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>You have unsaved changes in this prescription draft.</span>
              </span>
            ) : baseline?.status === 'APPROVED' ? (
              <span className="oph-status-clean">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Prescription is approved and locked. Ready for dispensing.</span>
              </span>
            ) : (
              <span className="oph-status-clean">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Prescription draft is up to date.</span>
              </span>
            )}
          </div>
          <div className="oph-action-buttons">
            {baseline && <button type="button" className="oph-btn-outline" onClick={() => setShowSlip((prev) => !prev)}>{showSlip ? 'Hide spectacle slip' : 'Preview & print spectacle slip'}</button>}
            <button
              type="button"
              className="oph-btn-approve"
              disabled={!f.canApproveOptical || f.busy || isDirty || changed || !baseline || baseline.status !== 'DRAFT'}
              onClick={async () => {
                if (baseline && window.confirm(`Approve saved optical prescription version ${baseline.version}? Approval locks its contents.`)) {
                  const saved = await f.approveOptical(baseline.version);
                  if (saved) apply(saved);
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Authorize prescription</span>
            </button>
          </div>
        </div>
      </fieldset>

      {f.optical?.current.approved_at && (
        <div className="oph-history-toggle-card active" style={{ marginTop: '18px' }}>
          <div className="oph-history-toggle-left">
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <div className="oph-history-toggle-text">
              <h4>Doctor Authentication & Clinical Approval Confirmed</h4>
              <p>Approved by Doctor: <strong>{f.optical.current.approver_doctor_id}</strong> on {new Date(f.optical.current.approved_at).toLocaleString()}</p>
            </div>
          </div>
          <span className="oph-badge oph-badge-green">Locked for Dispensing</span>
        </div>
      )}

      {/* Official Spectacle Dispensing Slip Modal / Printable Card */}
      {showSlip && baseline && (
        <section className="oph-slip-card oph-printable" style={{ marginTop: '24px' }}>
          <div className="oph-slip-header">
            <div className="oph-slip-brand">
              <div className="oph-slip-logo">NGH</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Nairobi General Enterprise Hospital
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Department of Ophthalmology · Optical Dispensing Centre
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="oph-badge oph-badge-blue" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                RX-OPT-{workspace.visitId.slice(0, 8)}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Date: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px', fontSize: '0.82rem' }}>
            <div className="doc-form-grid two">
              <div>
                <p><strong>Encounter:</strong> {workspace.visitId} · <strong>Version:</strong> {baseline.version}</p>
                <p><strong>Status:</strong> <span className={`oph-badge ${baseline.status === 'APPROVED' ? 'oph-badge-green' : 'oph-badge-amber'}`}>{baseline.status}</span></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p><strong>Prescription Type:</strong> {baseline.current.prescription_type}</p>
                <p><strong>Lens & Material:</strong> {baseline.current.lens_type} ({baseline.current.material})</p>
              </div>
            </div>
            {baseline.current.coating_codes?.length > 0 && (
              <p style={{ margin: '6px 0 0' }}><strong>Coatings:</strong> {baseline.current.coating_codes.join(', ')}</p>
            )}
          </div>

          <div className="oph-table-scroll">
            <table className="doc-table" style={{ width: '100%', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#fff' }}>
                  <th>Eye</th>
                  <th>Sphere (SPH)</th>
                  <th>Cylinder (CYL)</th>
                  <th>Axis</th>
                  <th>Addition (ADD)</th>
                  <th>Prism / Base</th>
                  <th>Segment Ht</th>
                </tr>
              </thead>
              <tbody>
                {(['OD', 'OS'] as const).map((eye) => {
                  const p = baseline.current.power?.[eye];
                  const seg = baseline.current.segment_height?.[eye];
                  return (
                    <tr key={eye}>
                      <td><strong>{eye === 'OD' ? 'OD (Right Eye)' : 'OS (Left Eye)'}</strong></td>
                      <td>{p?.sphere !== null && p?.sphere !== undefined ? (p.sphere > 0 ? `+${p.sphere.toFixed(2)}` : p.sphere.toFixed(2)) : '—'}</td>
                      <td>{p?.cylinder !== null && p?.cylinder !== undefined ? (p.cylinder > 0 ? `+${p.cylinder.toFixed(2)}` : p.cylinder.toFixed(2)) : '—'}</td>
                      <td>{p?.axis !== null && p?.axis !== undefined ? `${p.axis}°` : '—'}</td>
                      <td>{p?.addition !== null && p?.addition !== undefined ? (p.addition > 0 ? `+${p.addition.toFixed(2)}` : p.addition.toFixed(2)) : '—'}</td>
                      <td>{p?.prism ? `${p.prism} ${p.prism_base ?? ''}` : '—'}</td>
                      <td>{seg !== null && seg !== undefined ? `${seg} mm` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '0.82rem' }}>
            <p><strong>Pupillary Distance (PD):</strong> {baseline.current.pupillary_distance?.format === 'BINOCULAR' ? `${baseline.current.pupillary_distance.binocular} mm (Binocular)` : baseline.current.pupillary_distance ? `OD: ${baseline.current.pupillary_distance.OD ?? '—'} mm, OS: ${baseline.current.pupillary_distance.OS ?? '—'} mm (Monocular)` : '—'}</p>
            <p><strong>Usage Instructions:</strong> {baseline.current.usage_instructions}</p>
            <p><strong>Valid Until:</strong> {new Date(baseline.current.valid_until).toLocaleDateString()} {baseline.current.review_date ? `· Review Date: ${new Date(baseline.current.review_date).toLocaleDateString()}` : ''}</p>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem' }}>
            <div>
              <p><strong>Dispensing Optician:</strong> ________________________</p>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Signature & Date</p>
            </div>
            <div>
              <p><strong>Prescribing Doctor:</strong> {baseline.current.approver_doctor_id ?? 'Doctor Review Pending'}</p>
              {baseline.current.approved_at && (
                <p style={{ color: '#047857', fontWeight: 600 }}>✓ Verified: {new Date(baseline.current.approved_at).toLocaleString()}</p>
              )}
            </div>
          </div>

          <div className="oph-toolbar oph-no-print" style={{ marginTop: '18px', justifyContent: 'flex-end' }}>
            <button type="button" className="doc-btn primary" onClick={() => window.print()}>
              Print Official Slip
            </button>
          </div>
        </section>
      )}

      {f.error && <p role="alert" className="form-error-banner">{f.error} Your entries are retained.</p>}

      {/* Optical Versions History Drawer */}
      {(f.optical?.history?.length ?? 0) > 0 && (
        <details className="oph-config-accordion" style={{ marginTop: '24px' }}>
          <summary className="oph-config-summary">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 14" />
              </svg>
              <span>Saved Prescription Version History ({f.optical?.history.length})</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>View prior revisions ▼</span>
          </summary>
          <div className="oph-config-body">
            {f.optical?.history.map((entry) => (
              <div key={entry.clinical_version} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Version {entry.clinical_version} · {entry.prescription_type}</strong>
                  <span className={`oph-badge ${entry.status === 'APPROVED' ? 'oph-badge-green' : 'oph-badge-amber'}`}>{entry.status}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0' }}>
                  Created: {new Date(entry.created_at).toLocaleString()} · Lens: {entry.lens_type} ({entry.material})
                </p>
                <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {(['OD', 'OS'] as const).map((eye) => (
                    <span key={eye} style={{ marginRight: '14px' }}>
                      {eye}: {entry.power[eye] ? `SPH ${entry.power[eye]?.sphere}, CYL ${entry.power[eye]?.cylinder ?? '—'}, AXIS ${entry.power[eye]?.axis ?? '—'}` : 'Not prescribed'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </form>
  );
}
