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
const editorSchema = z.object({ ...opticalWriteSchema.shape, coating_codes: z.array(z.string().max(80)).max(20), power: z.object({ OD: blankPower.nullable().optional(), OS: blankPower.nullable().optional() }) });
type Editor = z.infer<typeof editorSchema>;
function initial(record: OpticalPrescription | null): Partial<Editor> {
  if (!record) return { expected_version: 0, power: { OD: null, OS: null }, coating_codes: [], lens_type: '', material: '', usage_instructions: '', valid_until: '', review_date: null, segment_height: null };
  const current = record.current;
  return { expected_version: record.version, prescription_type: current.prescription_type, power: current.power, pupillary_distance: current.pupillary_distance, segment_height: current.segment_height, lens_type: current.lens_type, material: current.material, coating_codes: current.coating_codes, usage_instructions: current.usage_instructions, valid_until: current.valid_until, review_date: current.review_date };
}
const optionalNumber = (value: string) => value === '' ? null : Number(value);
export function OphthalmologyOpticalEditor({ feature: f, workspace }: { feature: OphthalmologyCareFeature; workspace: CareWorkspace }) {
  const [baseline, setBaseline] = useState(f.optical);
  const [showSlip, setShowSlip] = useState(false);
  const { register, control, handleSubmit, setValue, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({ resolver: zodResolver(editorSchema), defaultValues: initial(baseline) });
  const values = useWatch({ control });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'area']);
  const changed = baseline?.id !== f.optical?.id || (baseline?.version ?? 0) !== (f.optical?.version ?? 0);
  const disabled = !f.canSaveOptical || f.busy || isSubmitting || changed;
  const apply = (saved: OpticalPrescription) => { setBaseline(saved); reset(initial(saved)); };
  const field = (name: 'lens_type' | 'material', label: string, options: string[] | null) => <label className="doc-field"><span>{label} <span className="oph-required">*</span></span>{options ? <select {...register(name)}><option value="">Select configured value</option>{values[name] && !options.includes(values[name]) && <option value={values[name]}>Saved {values[name]} (not currently configured)</option>}{options.map((value) => <option key={value}>{value}</option>)}</select> : <input maxLength={80} {...register(name)} />}</label>;
  return <form className="doc-card" onSubmit={handleSubmit(async (values) => {
    try {
      const body = opticalWriteSchema.parse({ ...values, coating_codes: values.coating_codes.map((code) => code.trim()).filter(Boolean), expected_version: baseline?.version ?? 0 });
      const saved = await f.saveOptical(body); if (saved) apply(saved);
    } catch (error) { setError('root', { message: error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ') : error instanceof Error ? error.message : 'Check the optical prescription.' }); }
  })}><h3>Optical prescription</h3><p>{baseline?.status ?? 'Not saved'} · version {baseline?.version ?? 0}. Refraction findings are not an approved prescription.</p>
    {changed && <p role="alert">The saved prescription changed. Your entries remain here; reload the saved version before continuing.</p>}
    <button type="button" className="doc-btn" disabled={f.busy || f.opticalQuery.isError} onClick={() => { if (!isDirty || window.confirm('Discard entered values and load the latest saved optical prescription?')) { setBaseline(f.optical); reset(initial(f.optical)); } }}>Load latest saved prescription</button>
    {!f.configuration && baseline?.status !== 'APPROVED' && <p role="alert">Find the encounter's bound active completion profile to enter optical selections. Clinical configuration access is required.</p>}
    <div className="oph-toolbar"><span>Bound clinical profile: {f.configuration?.name ?? 'Unavailable'}</span>{f.configurationQuery.isError && <button type="button" className="doc-btn" onClick={() => void f.configurationQuery.refetch()}>Retry bound profile</button>}</div>
    <EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={disabled}>
      <label className="doc-field"><span>Prescription type <span className="oph-required">*</span></span><select {...register('prescription_type')}><option value="">Select</option>{opticalWriteSchema.shape.prescription_type.options.map((type) => <option key={type}>{type}</option>)}</select></label>
      {(['OD', 'OS'] as const).map((eye) => <section className="doc-card" key={eye}><label><input type="checkbox" checked={Boolean(values.power?.[eye])} onChange={(event) => { if (event.target.checked) setValue(`power.${eye}`, { sphere: null }, { shouldDirty: true }); else if (window.confirm(`Remove ${eye} power from this draft?`)) { setValue(`power.${eye}`, null, { shouldDirty: true }); setValue(`segment_height.${eye}`, null, { shouldDirty: true }); } }} /> Prescribe {eye}</label>{values.power?.[eye] && <div className="doc-form-grid two">{(['sphere', 'cylinder', 'axis', 'addition', 'prism'] as const).map((key) => <label className="doc-field" key={key}><span>{eye} {key} {key === 'sphere' && <span className="oph-required">*</span>}</span><input type="number" step="any" {...register(`power.${eye}.${key}`, { setValueAs: optionalNumber })} /></label>)}<label className="doc-field">{eye} prism base<input maxLength={40} {...register(`power.${eye}.prism_base`, { setValueAs: (value: string) => value || null })} /></label><label className="doc-field">{eye} segment height (mm)<input type="number" step="any" {...register(`segment_height.${eye}`, { setValueAs: optionalNumber })} /></label></div>}</section>)}
      <div className="doc-form-grid two"><label className="doc-field"><span>PD format <span className="oph-required">*</span></span><select {...register('pupillary_distance.format')}><option value="">Select</option><option value="BINOCULAR">Binocular</option><option value="MONOCULAR">Monocular</option></select></label>
        {values.pupillary_distance?.format === 'BINOCULAR' && <label className="doc-field">Binocular PD (mm) <span className="oph-required">*</span><input type="number" step="any" {...register('pupillary_distance.binocular', { setValueAs: optionalNumber })} /></label>}
        {values.pupillary_distance?.format === 'MONOCULAR' && (['OD', 'OS'] as const).map((eye) => <label className="doc-field" key={eye}>{eye} PD (mm) <span className="oph-required">*</span><input type="number" step="any" {...register(`pupillary_distance.${eye}`, { setValueAs: optionalNumber })} /></label>)}
        {field('lens_type', 'Lens type', f.lensTypes)}{field('material', 'Material', f.materials)}
        <div className="doc-field"><span>Coatings</span><Controller control={control} name="coating_codes" render={({ field }) => f.coatings ? <div>{[...new Set([...f.coatings, ...field.value])].map((code) => <label className="oph-option" key={code}><input type="checkbox" checked={field.value.includes(code)} onChange={(event) => field.onChange(event.target.checked ? [...field.value, code] : field.value.filter((value) => value !== code))} />{code}{!f.coatings?.includes(code) ? ' (saved; not currently configured)' : ''}</label>)}</div> : <textarea aria-label="Coating codes, one per line" value={field.value.join('\n')} maxLength={1619} onChange={(event) => field.onChange(event.target.value.split('\n'))} />} /></div>
        <Controller control={control} name="valid_until" render={({ field }) => <label className="doc-field">Valid until (local time) <span className="oph-required">*</span><input type="datetime-local" value={localDateTime(field.value)} onChange={(event) => field.onChange(inputInstant(event.target.value) ?? '')} /></label>} />
        <Controller control={control} name="review_date" render={({ field }) => <label className="doc-field">Review date (local time)<input type="datetime-local" value={localDateTime(field.value)} onChange={(event) => field.onChange(inputInstant(event.target.value))} /></label>} />
      </div><label className="doc-field"><span>Usage instructions <span className="oph-required">*</span></span><textarea maxLength={2000} {...register('usage_instructions')} /></label><button type="submit" className="doc-btn primary">Save optical draft</button>
    </fieldset>
    <button type="button" className="doc-btn primary" disabled={!f.canApproveOptical || f.busy || isDirty || changed || !baseline || baseline.status !== 'DRAFT'} onClick={async () => { if (baseline && window.confirm(`Approve saved optical prescription version ${baseline.version}? Approval locks its contents.`)) { const saved = await f.approveOptical(baseline.version); if (saved) apply(saved); } }}>Approve saved optical prescription</button>
    {f.optical?.current.approved_at && <p>Approved by doctor {f.optical.current.approver_doctor_id} · {new Date(f.optical.current.approved_at).toLocaleString()}</p>}
    {baseline && (
      <div className="oph-toolbar oph-no-print">
        <button type="button" className="doc-btn" onClick={() => setShowSlip((prev) => !prev)}>
          {showSlip ? 'Hide spectacle slip' : 'Preview & print spectacle slip'}
        </button>
        {showSlip && (
          <button type="button" className="doc-btn primary" onClick={() => window.print()}>
            Print spectacle slip
          </button>
        )}
      </div>
    )}
    {showSlip && baseline && (
      <section className="doc-card oph-printable" style={{ marginTop: '16px', border: '2px solid #2563eb' }}>
        <div className="oph-toolbar oph-no-print" style={{ justifyContent: 'space-between' }}>
          <h4>Spectacle Dispensing Prescription</h4>
          <button type="button" className="doc-btn primary" onClick={() => window.print()}>
            Print Spectacle Slip
          </button>
        </div>
        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>
          <p><strong>Encounter:</strong> {workspace.visitId} · <strong>Version:</strong> {baseline.version} · <strong>Status:</strong> {baseline.status}</p>
          <p><strong>Prescription Type:</strong> {baseline.current.prescription_type} · <strong>Lens:</strong> {baseline.current.lens_type} ({baseline.current.material})</p>
          {baseline.current.coating_codes?.length > 0 && <p><strong>Coatings:</strong> {baseline.current.coating_codes.join(', ')}</p>}
        </div>
        <div className="oph-table-scroll">
          <table className="doc-table" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
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
        <div style={{ marginBottom: '12px' }}>
          <p><strong>Pupillary Distance (PD):</strong> {baseline.current.pupillary_distance?.format === 'BINOCULAR' ? `${baseline.current.pupillary_distance.binocular} mm (Binocular)` : baseline.current.pupillary_distance ? `OD: ${baseline.current.pupillary_distance.OD ?? '—'} mm, OS: ${baseline.current.pupillary_distance.OS ?? '—'} mm (Monocular)` : '—'}</p>
          <p><strong>Usage Instructions:</strong> {baseline.current.usage_instructions}</p>
          <p><strong>Valid Until:</strong> {new Date(baseline.current.valid_until).toLocaleDateString()} {baseline.current.review_date ? `· Review Date: ${new Date(baseline.current.review_date).toLocaleDateString()}` : ''}</p>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p><strong>Dispensing Optician:</strong> ________________________</p>
          </div>
          <div>
            <p><strong>Prescribing Doctor:</strong> {baseline.current.approver_doctor_id ?? 'Doctor Review Pending'}</p>
            {baseline.current.approved_at && <p><strong>Approved:</strong> {new Date(baseline.current.approved_at).toLocaleString()}</p>}
          </div>
        </div>
      </section>
    )}
    {f.error && <p role="alert" className="form-error-banner">{f.error} Your entries are retained.</p>}
    <h4>Saved optical versions</h4>{f.optical?.history.map((entry) => <details key={entry.clinical_version}><summary>Clinical version {entry.clinical_version} · {entry.status} · {new Date(entry.created_at).toLocaleString()}</summary><p>{entry.prescription_type} · {entry.lens_type} · {entry.material} · valid until {new Date(entry.valid_until).toLocaleString()}</p>{(['OD', 'OS'] as const).map((eye) => <p key={eye}>{eye}: {entry.power[eye] ? `SPH ${entry.power[eye]?.sphere}, CYL ${entry.power[eye]?.cylinder ?? '—'}, AXIS ${entry.power[eye]?.axis ?? '—'}, ADD ${entry.power[eye]?.addition ?? '—'}` : 'Not prescribed'}</p>)}<p>{entry.usage_instructions}</p></details>)}
  </form>;
}
