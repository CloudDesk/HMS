import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { opticalPowerSchema, opticalWriteSchema, type OpticalPrescription } from '../../api/ophthalmology-care';
import type { OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import type { CareWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
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

const prescriptionTypes = [
  { id: 'DISTANCE', label: 'Distance', desc: 'General & driving vision' },
  { id: 'NEAR', label: 'Near / Reading', desc: 'Close-up reading work' },
  { id: 'BIFOCAL', label: 'Bifocal', desc: 'Distance + reading segment' },
  { id: 'PROGRESSIVE', label: 'Progressive (PAL)', desc: 'Smooth multifocal corridor' },
  { id: 'OCCUPATIONAL', label: 'Occupational', desc: 'Computer & intermediate desk' },
] as const;

export function OphthalmologyOpticalEditor({ feature: f, workspace }: { feature: OphthalmologyCareFeature; workspace: CareWorkspace }) {
  const [baseline, setBaseline] = useState(f.optical);
  const [showSlip, setShowSlip] = useState(false);
  const { register, control, handleSubmit, setValue, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({
    resolver: zodResolver(editorSchema),
    defaultValues: initial(baseline),
  });
  const values = useWatch({ control });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'area']);

  const changed = baseline?.id !== f.optical?.id || (baseline?.version ?? 0) !== (f.optical?.version ?? 0);
  const disabled = !f.canSaveOptical || f.busy || isSubmitting || changed;

  const apply = (saved: OpticalPrescription) => {
    setBaseline(saved);
    reset(initial(saved));
  };

  const field = (name: 'lens_type' | 'material', label: string, options: string[] | null) => (
    <label className="doc-field">
      <span>{label} <span className="oph-required">*</span></span>
      {options ? (
        <select {...register(name)}>
          <option value="">Select configured value</option>
          {values[name] && !options.includes(values[name]) && (
            <option value={values[name]}>Saved {values[name]} (not currently configured)</option>
          )}
          {options.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      ) : (
        <input maxLength={80} placeholder={`Enter ${label.toLowerCase()}`} {...register(name)} />
      )}
    </label>
  );

  const status = baseline?.status ?? 'NOT_SAVED';

  return (
    <form
      className="doc-card"
      style={{ padding: '24px' }}
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
          if (saved) apply(saved);
        } catch (error) {
          setError('root', {
            message: error instanceof z.ZodError
              ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ')
              : error instanceof Error ? error.message : 'Check the optical prescription.',
          });
        }
      })}
    >
      {/* Top Professional Header Bar */}
      <div className="oph-optical-header">
        <div className="oph-optical-header-left">
          <div className="oph-optical-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="15" r="4"></circle>
              <circle cx="18" cy="15" r="4"></circle>
              <line x1="10" y1="15" x2="14" y2="15"></line>
              <path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"></path>
              <path d="M2.5 13L5 7c.7-1.3 1.9-2 3.5-2h7c1.6 0 2.8.7 3.5 2l2.5 6"></path>
            </svg>
            <span>Optical & Spectacle Prescription</span>
          </div>
          <span className={`oph-intake-status-pill ${status === 'APPROVED' ? 'completed' : status === 'DRAFT' ? 'draft' : 'not-saved'}`}>
            {status === 'APPROVED' ? '✓ Approved & Locked' : status === 'DRAFT' ? 'Draft Prescription' : 'Not Saved'}
          </span>
          <span className={isDirty ? 'oph-intake-dirty-pill' : 'oph-intake-clean-pill'}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isDirty ? '#f97316' : '#10b981' }}></span>
            {isDirty ? 'Unsaved changes' : 'Synchronized'}
            {baseline ? ` · v${baseline.version}` : ''}
          </span>
        </div>
        <div className="oph-optical-header-right">
          <button
            type="button"
            className="doc-btn"
            disabled={f.busy || f.opticalQuery.isError}
            onClick={() => {
              if (!isDirty || window.confirm('Discard entered values and load the latest saved optical prescription?')) {
                setBaseline(f.optical);
                reset(initial(f.optical));
              }
            }}
          >
            Load latest saved prescription
          </button>
          {baseline && (
            <button
              type="button"
              className="doc-btn"
              onClick={() => setShowSlip((prev) => !prev)}
            >
              {showSlip ? 'Hide Spectacle Slip' : 'Preview & Print Spectacle Slip'}
            </button>
          )}
        </div>
      </div>

      {changed && (
        <p role="alert" className="form-error-banner">
          The saved prescription changed on the server. Your entries remain here; reload the saved version before continuing.
        </p>
      )}

      {/* Clinical Profile Binding Banner */}
      <div className="oph-profile-banner">
        <div>
          <strong>Bound Clinical Profile:</strong> {f.configuration?.name ?? 'Default Ophthalmology Completion Profile'}
          <span style={{ marginLeft: '10px', color: '#64748b' }}>· Refraction findings are not an approved prescription until authorized.</span>
        </div>
        {f.configurationQuery.isError && (
          <button type="button" className="doc-btn" onClick={() => void f.configurationQuery.refetch()}>
            Retry bound profile
          </button>
        )}
      </div>

      <EditorErrors errors={errors} />

      <fieldset className="oph-fieldset" disabled={disabled}>
        {/* 1. Prescription Type Selection */}
        <div className="oph-power-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">1</span>
              <div className="oph-section-title-wrap">
                <h3>Prescription Classification <span className="oph-required">*</span></h3>
                <p className="oph-section-subtitle">Select intended optical focal range and usage purpose.</p>
              </div>
            </div>
            {values.prescription_type && (
              <span className="oph-badge oph-badge-blue">
                {values.prescription_type}
              </span>
            )}
          </div>

          <div className="oph-type-selector">
            {prescriptionTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`oph-type-btn ${values.prescription_type === type.id ? 'active' : ''}`}
                onClick={() => setValue('prescription_type', type.id, { shouldDirty: true })}
              >
                <span>{values.prescription_type === type.id ? '✓' : '•'}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
          {/* Synchronized select for full accessibility and validation */}
          <select {...register('prescription_type')} style={{ display: 'none' }}>
            <option value="">Select type</option>
            {opticalWriteSchema.shape.prescription_type.options.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 2. Unified Optical Refraction Power Matrix (OD vs OS) */}
        <div className="oph-power-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">2</span>
              <div className="oph-section-title-wrap">
                <h3>Refraction Power Matrix (Rx) <span className="oph-required">*</span></h3>
                <p className="oph-section-subtitle">Ophthalmic corrective power parameters for Right Eye (OD) and Left Eye (OS).</p>
              </div>
            </div>
          </div>

          <div className="oph-power-table-wrapper">
            <table className="oph-power-table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>Eye Laterality</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Prescribe</th>
                  <th>Sphere (SPH) *</th>
                  <th>Cylinder (CYL)</th>
                  <th>Axis (°)</th>
                  <th>Near Add (ADD)</th>
                  <th>Prism</th>
                  <th>Prism Base</th>
                  <th>Segment Ht (mm)</th>
                </tr>
              </thead>
              <tbody>
                {(['OD', 'OS'] as const).map((eye) => {
                  const isOD = eye === 'OD';
                  const isPrescribed = Boolean(values.power?.[eye]);
                  const hasCyl = values.power?.[eye]?.cylinder != null;
                  const isMultifocal = ['BIFOCAL', 'PROGRESSIVE'].includes(values.prescription_type ?? '');

                  return (
                    <tr key={eye} className={!isPrescribed ? 'disabled-row' : ''}>
                      <td>
                        <span className={`oph-badge ${isOD ? 'oph-badge-blue' : 'oph-badge-green'}`} style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                          {isOD ? 'OD (Right Eye)' : 'OS (Left Eye)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.82rem', color: isPrescribed ? '#2563eb' : '#64748b' }}>
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
                          <span>{isPrescribed ? 'Active' : 'Not Prescribed'}</span>
                        </label>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.25"
                          min="-40"
                          max="40"
                          disabled={!isPrescribed}
                          placeholder="e.g. -1.50"
                          className="oph-power-input"
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
                          placeholder="e.g. -0.50"
                          className="oph-power-input"
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
                          placeholder={hasCyl ? 'Axis Req *' : '0-180'}
                          className="oph-power-input"
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
                          className="oph-power-input"
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
                          placeholder="0-30"
                          className="oph-power-input"
                          {...register(`power.${eye}.prism`, { setValueAs: optionalNumber })}
                        />
                      </td>
                      <td>
                        <select
                          disabled={!isPrescribed}
                          className="oph-power-input"
                          {...register(`power.${eye}.prism_base`, { setValueAs: (v) => v || null })}
                        >
                          <option value="">Base</option>
                          <option value="BU">BU (Up)</option>
                          <option value="BD">BD (Down)</option>
                          <option value="BI">BI (In)</option>
                          <option value="BO">BO (Out)</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="5"
                          max="50"
                          disabled={!isPrescribed}
                          placeholder={isMultifocal ? 'Seg Ht Req *' : 'mm'}
                          className="oph-power-input"
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

        {/* 3. Pupillary Distance (PD) */}
        <div className="oph-spec-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">3</span>
              <div className="oph-section-title-wrap">
                <h3>Pupillary Distance & Centration (PD) <span className="oph-required">*</span></h3>
                <p className="oph-section-subtitle">Specify binocular total PD or monocular naso-pupillary distances in millimeters.</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '8px 0 16px', flexWrap: 'wrap' }}>
            {[
              { id: 'BINOCULAR', label: 'Binocular PD (Single Total)' },
              { id: 'MONOCULAR', label: 'Monocular PD (Separate OD & OS)' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                className={`oph-type-btn ${values.pupillary_distance?.format === fmt.id ? 'active' : ''}`}
                onClick={() => setValue('pupillary_distance.format', fmt.id as 'BINOCULAR' | 'MONOCULAR', { shouldDirty: true })}
              >
                <span>{values.pupillary_distance?.format === fmt.id ? '✓' : '•'}</span>
                <span>{fmt.label}</span>
              </button>
            ))}
          </div>
          <select {...register('pupillary_distance.format')} style={{ display: 'none' }}>
            <option value="BINOCULAR">BINOCULAR</option>
            <option value="MONOCULAR">MONOCULAR</option>
          </select>

          <div className="doc-form-grid two">
            {values.pupillary_distance?.format === 'BINOCULAR' && (
              <label className="doc-field">
                <span>Binocular PD (mm) <span className="oph-required">*</span></span>
                <input
                  type="number"
                  step="0.5"
                  min="30"
                  max="90"
                  placeholder="e.g. 63.0"
                  {...register('pupillary_distance.binocular', { setValueAs: optionalNumber })}
                />
              </label>
            )}
            {values.pupillary_distance?.format === 'MONOCULAR' && (
              <>
                <label className="doc-field">
                  <span>OD Monocular PD (mm) <span className="oph-required">*</span></span>
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="50"
                    placeholder="e.g. 31.5"
                    {...register('pupillary_distance.OD', { setValueAs: optionalNumber })}
                  />
                </label>
                <label className="doc-field">
                  <span>OS Monocular PD (mm) <span className="oph-required">*</span></span>
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="50"
                    placeholder="e.g. 31.5"
                    {...register('pupillary_distance.OS', { setValueAs: optionalNumber })}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* 4. Lens Design, Material & Surface Coatings */}
        <div className="oph-spec-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">4</span>
              <div className="oph-section-title-wrap">
                <h3>Lens Design, Materials & Coatings</h3>
                <p className="oph-section-subtitle">Ophthalmic lens refractive index, substrate material, and surface treatments.</p>
              </div>
            </div>
          </div>

          <div className="doc-form-grid two">
            {field('lens_type', 'Lens Type', f.lensTypes ?? ['Single Vision', 'Progressive Addition (PAL)', 'Bifocal (D-Segment)', 'Trifocal', 'Occupational / Office'])}
            {field('material', 'Lens Material', f.materials ?? ['CR-39 Standard Plastic', 'Polycarbonate (Impact Resistant)', 'Hi-Index 1.60', 'Hi-Index 1.67 Ultra-Thin', 'Trivex High-Definition'])}
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Applied Coatings & Treatments
            </label>
            <Controller
              control={control}
              name="coating_codes"
              render={({ field }) => {
                const availableCoatings = f.coatings ?? ['Anti-Reflective (AR)', 'Blue Light Filter', 'UV 400 Protection', 'Hard Scratch-Resistant', 'Photochromic (Transitions)'];
                const currentList = field.value ?? [];
                return (
                  <div className="oph-coating-grid">
                    {availableCoatings.map((code) => {
                      const isSelected = currentList.includes(code);
                      return (
                        <label
                          key={code}
                          className={`oph-coating-chip ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              field.onChange(
                                checked
                                  ? [...new Set([...currentList, code])]
                                  : currentList.filter((entry) => entry !== code)
                              );
                            }}
                          />
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{code}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* 5. Validity Period & Usage Instructions */}
        <div className="oph-spec-card">
          <div className="oph-section-header">
            <div className="oph-section-header-left">
              <span className="oph-section-number">5</span>
              <div className="oph-section-title-wrap">
                <h3>Validity Period & Dispensing Instructions</h3>
                <p className="oph-section-subtitle">Prescription expiry timeline, clinical review date, and instructions for optician and patient.</p>
              </div>
            </div>
          </div>

          <div className="doc-form-grid two">
            <Controller
              control={control}
              name="valid_until"
              render={({ field }) => (
                <label className="doc-field">
                  <span>Valid Until (Local Time) <span className="oph-required">*</span></span>
                  <input
                    type="datetime-local"
                    value={localDateTime(field.value)}
                    onChange={(event) => field.onChange(inputInstant(event.target.value) ?? '')}
                  />
                </label>
              )}
            />
            <Controller
              control={control}
              name="review_date"
              render={({ field }) => (
                <label className="doc-field">
                  <span>Review Date (Local Time - Optional)</span>
                  <input
                    type="datetime-local"
                    value={localDateTime(field.value)}
                    onChange={(event) => field.onChange(inputInstant(event.target.value))}
                  />
                </label>
              )}
            />
          </div>

          <label className="doc-field" style={{ marginTop: '12px' }}>
            <span>Usage Instructions & Patient Advice <span className="oph-required">*</span></span>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="e.g. Full-time wear for distance vision and driving. Reading glasses as prescribed. Clean with microfiber cloth only."
              {...register('usage_instructions')}
            />
          </label>
        </div>

        {/* Action & Submission Footer */}
        <div className="oph-intake-submit-bar">
          <div style={{ fontSize: '0.86rem', color: '#64748b' }}>
            {baseline?.status === 'APPROVED' ? (
              <span style={{ color: '#047857', fontWeight: 600 }}>✓ Prescription is approved and locked. Ready for dispensing.</span>
            ) : isDirty ? (
              <span style={{ color: '#b45309', fontWeight: 600 }}>● You have unsaved changes in this prescription draft.</span>
            ) : (
              <span style={{ color: '#047857', fontWeight: 600 }}>✓ Optical draft is saved.</span>
            )}
          </div>
          <div className="oph-submit-actions">
            <button className="oph-submit-btn primary" type="submit" disabled={disabled}>
              {f.busy ? 'Saving…' : 'Save Optical Draft'}
            </button>
            <button
              type="button"
              className="oph-submit-btn success"
              disabled={!f.canApproveOptical || f.busy || isDirty || changed || !baseline || baseline.status !== 'DRAFT'}
              onClick={async () => {
                if (baseline && window.confirm(`Approve saved optical prescription version ${baseline.version}? Approval locks its contents.`)) {
                  const saved = await f.approveOptical(baseline.version);
                  if (saved) apply(saved);
                }
              }}
            >
              Approve Optical Prescription
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
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 14 14"></polyline>
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
