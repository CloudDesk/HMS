import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { Modal } from '../ui/Modal';
import { configurationTypeSchema, type AdminConfiguration } from '../../api/ophthalmology-admin';
import { testFormSchema } from '../../api/ophthalmology';
import { configurationEditorDefaults, configurationEditorSchema, configurationEditorValues, completionRequirements, type ConfigurationEditor } from '../../hooks/ophthalmology/configuration-form';
import type { OphthalmologyAdministrationFeature } from '../../hooks/ophthalmology/useOphthalmologyAdministrationFeature';

export function EditorErrors({ errors }: { errors: Record<string, unknown> }) {
  return <>{Object.entries(errors).map(([field, error]) => <p className="form-error-banner" role="alert" key={field}>{field.replaceAll('_', ' ')}: {error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Check the required entries.'}</p>)}</>;
}
export function useEditorLeaveGuard(dirty: boolean) {
  useOphthalmologyDraftGuard(dirty, ['branch_id', 'tab', 'visit_id', 'section', 'task_id']);
  return () => !dirty || window.confirm('Discard unsaved changes?');
}
export const localDateTime = (value: string | null | undefined) => value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : '';
export const inputInstant = (value: string) => value ? new Date(value).toISOString() : null;
const nullableNumber = (value: string) => value === '' ? null : Number(value);

export function OphthalmologyConfigurationEditor({ feature: f, record: initialRecord }: { feature: OphthalmologyAdministrationFeature; record: AdminConfiguration | null }) {
  const [record] = useState(initialRecord);
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isDirty, isSubmitting } } = useForm<ConfigurationEditor>({ resolver: zodResolver(configurationEditorSchema), defaultValues: configurationEditorDefaults(record) });
  const values = useWatch({ control });
  const entries = useFieldArray({ control, name: 'entries' });
  const units = useFieldArray({ control, name: 'comparison_units' });
  const ranges = useFieldArray({ control, name: 'numeric_ranges' });
  const choices = useFieldArray({ control, name: 'allowed_values' });
  const leave = useEditorLeaveGuard(isDirty);
  const close = () => { if (!f.busy && !isSubmitting && leave()) f.setQuery({ edit_id: null }); };
  const readOnly = f.list.isError || (record ? record.status !== 'DRAFT' || !f.canEdit : !f.canCreate);
  return <Modal size="large" className="oph-workspace" open title={record ? `Edit ${record.name} · revision ${record.revision}` : 'New ophthalmology master version'} onClose={close} footer={<><button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={close}>Cancel</button><button type="submit" form="oph-master-form" className="doc-btn primary" disabled={f.busy || isSubmitting || readOnly}>Save draft version</button></>}>
    <form id="oph-master-form" onSubmit={handleSubmit(async (form) => {
      try { await f.save({ resource: 'masters', id: record?.id ?? null, expected_version: record?.version ?? null, branch_id: f.branchId, type: form.type, code: form.code, body: { name: form.name, description: form.description.trim() || null, effective_from: form.effective_from, values: configurationEditorValues(form, record?.values ?? {}, configurationEditorDefaults(record)) } }); }
      catch (error) { setError('root', { message: error instanceof Error ? error.message : 'Check the configuration values.' }); }
    })}>
      <EditorErrors errors={errors} />{f.error && <p role="alert" className="form-error-banner">{f.error} Draft values are retained. Close and reopen a stale version before retrying.</p>}
      <fieldset className="oph-fieldset" disabled={f.busy || isSubmitting || readOnly}><div className="doc-form-grid two">
        <label className="doc-field"><span>Master type <span className="oph-required">*</span></span><select disabled={Boolean(record)} {...register('type')}>{configurationTypeSchema.options.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="doc-field"><span>Code <span className="oph-required">*</span></span><input readOnly={Boolean(record)} maxLength={80} {...register('code')} /></label>
        <label className="doc-field"><span>Name <span className="oph-required">*</span></span><input maxLength={160} {...register('name')} /></label><label className="doc-field">Effective from<input type="datetime-local" value={localDateTime(values.effective_from)} onChange={(event) => setValue('effective_from', inputInstant(event.target.value), { shouldDirty: true })} /></label>
        <label className="doc-field">Description<textarea maxLength={1000} {...register('description')} /></label>
      </div>
      {values.type !== 'FORM_PROFILE' && values.type !== 'COMPLETION_PROFILE' && <section><h4>{values.type === 'CLINICAL_THRESHOLD' ? 'Emergency criteria' : values.type === 'TEST_CATALOGUE' ? 'Tests' : values.type === 'VISUAL_ACUITY_SCALE' ? 'Visual acuity scale options (e.g. 6/6, 20/20, LogMAR)' : values.type === 'DRUG_OPTION' ? 'Eye medications and drop options' : values.type === 'OPTICAL_PRODUCT' ? 'Optical product choices (lenses, frames, coatings)' : values.type === 'COMPLAINT' ? 'Chief complaint options' : values.type === 'SUB_SPECIALITY' ? 'Subspecialties' : 'Options'}</h4>{entries.fields.map((entry, index) => <div className="oph-repeat" key={entry.id}><label className="doc-field"><span>Code <span className="oph-required">*</span></span><input maxLength={80} {...register(`entries.${index}.code`)} /></label><label className="doc-field"><span>Display label <span className="oph-required">*</span></span><input maxLength={160} {...register(`entries.${index}.label`)} /></label><label><input type="checkbox" {...register(`entries.${index}.active`)} /> Active option</label>{values.type === 'COMPLAINT' && <label><input type="checkbox" {...register(`entries.${index}.requires_description`)} /> Description required</label>}<button type="button" className="doc-btn" onClick={() => entries.remove(index)}>Remove option</button></div>)}<button type="button" className="doc-btn" disabled={entries.fields.length >= 100} onClick={() => entries.append({ code: '', label: '', active: true, requires_description: false })}>Add option</button></section>}
      {values.type === 'FORM_PROFILE' && <section><h4>Versioned result form</h4><div className="doc-form-grid two"><label className="doc-field"><span>Form family <span className="oph-required">*</span></span><select {...register('form_type')}><option value="">Select</option>{testFormSchema.options.map((type) => <option key={type}>{type}</option>)}</select></label><label className="doc-field"><span>Schema version <span className="oph-required">*</span></span><input maxLength={40} {...register('schema_version')} /></label><label className="doc-field"><span>Supported test codes (one per line) <span className="oph-required">*</span></span><textarea {...register('test_codes')} /></label><label className="doc-field">Required field paths (one per line)<textarea {...register('required_fields')} /></label><label className="doc-field">Required gonioscopy quadrants (one per line)<textarea {...register('required_quadrants')} /></label><label className="doc-field">Paediatric maximum age, years<input type="number" step="any" {...register('paediatric_max_age_years', { setValueAs: nullableNumber })} /></label></div>
        <h4>Hospital-approved numeric ranges</h4>{ranges.fields.map((row, index) => <div className="oph-repeat" key={row.id}><label className="doc-field"><span>Field path <span className="oph-required">*</span></span><input {...register(`numeric_ranges.${index}.path`)} /></label><label className="doc-field">Minimum<input type="number" step="any" {...register(`numeric_ranges.${index}.min`, { setValueAs: nullableNumber })} /></label><label className="doc-field">Maximum<input type="number" step="any" {...register(`numeric_ranges.${index}.max`, { setValueAs: nullableNumber })} /></label><button type="button" className="doc-btn" onClick={() => ranges.remove(index)}>Remove range</button></div>)}<button type="button" className="doc-btn" onClick={() => ranges.append({ path: '', min: null, max: null })}>Add range</button>
        {(values.form_type === 'VISUAL_FIELD' || values.form_type === 'OCT') && <><h4>Comparison measurement units</h4><p>Use hospital-approved unit codes for each numeric result path. Progression requires identical protocols, eyes and unit mappings in both saved profile versions. No conversion is performed.</p>{units.fields.map((row, index) => <div className="oph-repeat" key={row.id}><label className="doc-field"><span>Measurement path <span className="oph-required">*</span></span><input {...register(`comparison_units.${index}.path`)} /></label><label className="doc-field"><span>Unit code <span className="oph-required">*</span></span><input {...register(`comparison_units.${index}.unit`)} /></label><button type="button" className="doc-btn" onClick={() => units.remove(index)}>Remove unit</button></div>)}<button type="button" className="doc-btn" onClick={() => units.append({ path: '', unit: '' })}>Add comparison unit</button></>}
        <h4>Hospital-approved choices</h4>{choices.fields.map((row, index) => <div className="oph-repeat" key={row.id}><label className="doc-field"><span>Field path <span className="oph-required">*</span></span><input {...register(`allowed_values.${index}.path`)} /></label><label className="doc-field">Value type<select {...register(`allowed_values.${index}.kind`)}><option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option></select></label><label className="doc-field">Choices, one per line<textarea {...register(`allowed_values.${index}.choices`)} /></label><button type="button" className="doc-btn" onClick={() => choices.remove(index)}>Remove choices</button></div>)}<button type="button" className="doc-btn" onClick={() => choices.append({ path: '', kind: 'TEXT', choices: '' })}>Add field choices</button>
        {values.form_type === 'INTRAOCULAR_PRESSURE' && <><h4>Approved IOP interpretation</h4><div className="doc-form-grid two">{(['iop_low', 'iop_high', 'iop_asymmetry'] as const).map((name) => <label className="doc-field" key={name}>{name.replaceAll('_', ' ')}<input type="number" step="any" {...register(name, { setValueAs: nullableNumber })} /></label>)}{(['iop_low_code', 'iop_high_code', 'iop_asymmetry_code', 'iop_within_code'] as const).map((name) => <label className="doc-field" key={name}>{name.replaceAll('_', ' ')}<input {...register(name)} /></label>)}</div></>}
      </section>}
      {values.type === 'COMPLETION_PROFILE' && <section><h4>Completion prerequisites</h4><div className="oph-options">{completionRequirements.map((requirement) => <label key={requirement}><input type="checkbox" value={requirement} {...register('required_requirements')} /> {requirement.replaceAll('_', ' ')}</label>)}</div><label className="doc-field">Mandatory test codes, one per line<textarea {...register('mandatory_test_codes')} /></label><label><input type="checkbox" {...register('allow_override')} /> Permit authorised completion override</label></section>}
      
      </fieldset>
    </form>
  </Modal>;
}
