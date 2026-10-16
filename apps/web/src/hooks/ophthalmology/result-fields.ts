import { z } from 'zod';
import { coreFormSchema, testFormSchema, type CoreFormType, type TestFormType } from '../../api/ophthalmology';

type FieldKind = 'text' | 'number' | 'boolean' | 'choice' | 'instant' | 'reference' | 'documents';
export type ResultField = { path: string; label: string; kind: FieldKind; options?: readonly string[]; eye?: string; referenceType?: 'OPTICAL_PRODUCT' | 'DRUG_OPTION' | 'DOCUMENT' };
const field = (path: string, label: string, kind: FieldKind = 'text', options?: readonly string[]): ResultField => ({ path, label, kind, options });
const power = (prefix: string, eyes: string[]) => eyes.flatMap((eye) => ['sphere', 'cylinder', 'axis'].map((key) => field(`${prefix}.${eye}.${key}`, `${eye} ${prefix.replaceAll('_', ' ')} ${key}`, 'number')));
const measure = (prefix: string, label: string) => [field(`${prefix}.value`, label, 'number'), field(`${prefix}.unit`, `${label} unit`, 'choice')];
export function coreResultFields(type: CoreFormType, laterality: string, payload: Record<string, unknown>, additionalReadings: Record<string, number> = {}): ResultField[] {
  const eyes = laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS'];
  switch (type) {
    case 'VISUAL_ACUITY': return [field('chart_type', 'Chart / scale', 'choice'), ...measure('test_distance', 'Test distance'), field('lighting', 'Lighting', 'choice'), field('correction_used', 'Correction used', 'choice'), ...eyes.flatMap((eye) => [
      ...['unaided_or_presenting', 'current_glasses', 'pinhole', 'bcva'].map((key) => field(`distance.${eye}.${key}`, `${eye} distance ${key.replaceAll('_', ' ')}`, 'choice')),
      ...measure(`low_vision.${eye}.counting_fingers_distance`, `${eye} counting fingers distance`), field(`low_vision.${eye}.hand_movement`, `${eye} hand movement`, 'boolean'), field(`low_vision.${eye}.perception_of_light`, `${eye} light perception`, 'boolean'),
      ...['unaided', 'existing_correction', 'best_correction', 'chart'].map((key) => field(`near.${eye}.${key}`, `${eye} near ${key.replaceAll('_', ' ')}`, 'choice')), ...measure(`near.${eye}.distance`, `${eye} near distance`),
    ])];
    case 'LENSOMETRY': return [...power('optical_power', eyes), ...eyes.flatMap((eye) => [field(`optical_power.${eye}.addition`, `${eye} addition`, 'number'), field(`optical_power.${eye}.prism`, `${eye} prism`, 'number'), field(`optical_power.${eye}.prism_base`, `${eye} prism base`, 'choice')]), ...['lens_type', 'material', 'lens_condition', 'usage_type'].map((key) => field(key, key.replaceAll('_', ' '), 'choice')), field('condition_notes', 'Lens condition notes'), ...measure('spectacle_age', 'Spectacle age'), field('comfortable', 'Comfortable', 'boolean')];
    case 'AUTOREFRACTION_KERATOMETRY': return [field('cycloplegic', 'Cycloplegic', 'boolean'), ...eyes.flatMap((eye) => {
      const readings = readPath(payload, `readings.${eye}`);
      const count = (Array.isArray(readings) ? Math.max(1, readings.length) : 1) + (additionalReadings[eye] ?? 0);
      return [...Array.from({ length: count }, (_, index) => ['sphere', 'cylinder', 'axis'].map((key) => field(`readings.${eye}.${index}.${key}`, `${eye} reading ${index + 1} ${key}`, 'number'))).flat(), field(`selected_reading_index.${eye}`, `${eye} selected reading (index begins at 0)`, 'number'), field(`spherical_equivalent.${eye}`, `${eye} spherical equivalent`, 'number'), ...['k1', 'k1_axis', 'k2', 'k2_axis', 'average_k', 'corneal_astigmatism'].map((key) => field(`keratometry.${eye}.${key}`, `${eye} ${key.replaceAll('_', ' ')}`, 'number'))];
    })];
    case 'OBJECTIVE_REFRACTION': return [field('method', 'Method', 'choice'), field('retinoscopy_type', 'Retinoscopy type', 'choice'), ...measure('working_distance', 'Working distance'), field('administration_at', 'Drug administration time', 'instant'), field('examination_at', 'Examination time', 'instant'), ...power('raw_power', eyes), ...power('final_power', eyes)];
    case 'SUBJECTIVE_REFRACTION': return [...power('starting_power', eyes), ...power('final_power', eyes), ...eyes.map((eye) => field(`bcva.${eye}`, `${eye} BCVA`, 'choice')), field('fogging', 'Fogging', 'boolean'), field('acceptance', 'Acceptance', 'choice'), field('dominant_eye', 'Dominant eye', 'choice'), field('diplopia', 'Diplopia', 'boolean'), ...measure('working_distance', 'Working distance'), field('impression', 'Impression')];
    case 'INTRAOCULAR_PRESSURE': return [field('method', 'Method', 'choice'), field('measured_at', 'Measurement time', 'instant'), field('position', 'Position', 'choice'), field('anesthetic_used', 'Anaesthetic used', 'boolean'), field('fluorescein_used', 'Fluorescein used', 'boolean'), field('drug', 'Drug'), field('unit', 'Pressure unit', 'choice', ['mmHg']), ...eyes.flatMap((eye) => {
      const readings = readPath(payload, `readings.${eye}`);
      const count = (Array.isArray(readings) ? Math.max(1, readings.length) : 1) + (additionalReadings[eye] ?? 0);
      return [...Array.from({ length: count }, (_, index) => field(`readings.${eye}.${index}`, `${eye} reading ${index + 1}`, 'number')), field(`selected_reading_index.${eye}`, `${eye} selected reading (index begins at 0)`, 'number'), field(`final_iop.${eye}`, `${eye} final IOP`, 'number')];
    })];
    case 'SLIT_LAMP_ANTERIOR_SEGMENT': return eyes.flatMap((eye) => ['lids_lashes', 'lacrimal', 'conjunctiva', 'sclera', 'cornea', 'anterior_chamber', 'iris', 'pupil', 'lens', 'anterior_vitreous', 'tear_film'].flatMap((structure) => [field(`eyes.${eye}.${structure}.status`, `${eye} ${structure.replaceAll('_', ' ')} status`, 'choice', ['NORMAL', 'ABNORMAL']), ...['finding', 'location', 'grade', 'remarks'].map((key) => field(`eyes.${eye}.${structure}.${key}`, `${eye} ${structure.replaceAll('_', ' ')} ${key}`))]));
    case 'POSTERIOR_FUNDUS_EXAM': return [field('dilation_required', 'Dilation required', 'boolean'), field('dilation_confirmation', 'Dilation confirmation', 'boolean'), field('contraindication', 'Contraindication'), field('method', 'Examination method', 'choice'), ...eyes.map((eye) => field(`eyes.${eye}.remarks`, `${eye} posterior eye remarks`))];
  }
}
export function readPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' && Object.hasOwn(value, key) ? Reflect.get(value, key) : undefined, root);
}
function writePath(root: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let target: object = root;
  keys.forEach((key, index) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid form path.');
    if (index === keys.length - 1) { Reflect.set(target, key, value); return; }
    const current: unknown = Reflect.get(target, key);
    if (current == null) Reflect.set(target, key, /^\d+$/.test(keys[index + 1] ?? '') ? [] : {});
    const next: unknown = Reflect.get(target, key);
    if (!next || typeof next !== 'object') throw new Error(`Saved ${keys.slice(0, index + 1).join('.')} has a different schema. Preserve it and request contract review.`);
    target = next;
  });
}
export const resultEditorSchema = z.object({ profile_id: z.string().regex(/^[a-f\d]{24}$/i, 'Select a matching form profile.'), performed_at: z.string().datetime({ offset: true }), reliability: z.enum(['GOOD', 'FAIR', 'POOR']), reliability_reason: z.string().max(1000), comments: z.string().max(4000), amendment_reason: z.string().max(1000).optional(), document_ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).optional(), entries: z.record(z.string(), z.string()) }).superRefine((data, ctx) => { if (data.reliability === 'POOR' && !data.reliability_reason.trim()) ctx.addIssue({ code: 'custom', path: ['reliability_reason'], message: 'Explain poor reliability.' }); });
export type ResultEditorValues = z.infer<typeof resultEditorSchema>;
export const fieldEntryKey = (path: string) => `field_${path.replaceAll('.', '__')}`;
export function entryValues(fields: ResultField[], payload: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(fields.map((descriptor) => { const value = readPath(payload, descriptor.path); return [fieldEntryKey(descriptor.path), descriptor.kind === 'documents' && Array.isArray(value) ? JSON.stringify(value) : ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '']; }));
}
export function mergeResultEntries(fields: ResultField[], entries: Record<string, string>, original: Record<string, unknown>, profile: Record<string, unknown>) {
  const payload = structuredClone(original);
  const removals: { path: string; index: number }[] = [];
  fields.forEach((descriptor) => {
    const raw = entries[fieldEntryKey(descriptor.path)] ?? '';
    const old = readPath(original, descriptor.path);
    if (descriptor.kind === 'documents') {
      if (!raw && old === undefined) return;
      const ids = z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).parse(JSON.parse(raw || '[]') as unknown);
      if (new Set(ids).size !== ids.length) throw new Error(`${descriptor.label} contains duplicate documents.`);
      writePath(payload, descriptor.path, ids); return;
    }
    if (raw === '' && old === undefined) return;
    if (String(old ?? '') === raw) return;
    if (raw === '' && old !== null && typeof old === 'object') return;
    if (old != null && !['string', 'number', 'boolean'].includes(typeof old)) throw new Error(`${descriptor.label} has a structured value that this control cannot replace.`);
    let value: unknown = raw.trim() === '' ? null : raw;
    if (value !== null && descriptor.kind === 'number') {
      value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`${descriptor.label} must be a number.`);
      if (descriptor.path.startsWith('selected_reading_index.') && (!Number.isInteger(value) || Number(value) < 0)) throw new Error(`${descriptor.label} must be a nonnegative whole-number index.`);
      if (/(^|\.)(axis|k1_axis|k2_axis)$/.test(descriptor.path) && (Number(value) < 0 || Number(value) > 180)) throw new Error(`${descriptor.label} must be between 0 and 180.`);
      const range = z.object({ min: z.number().optional(), max: z.number().optional() }).safeParse(readPath(profile.numeric_ranges, descriptor.path) ?? (profile.numeric_ranges && typeof profile.numeric_ranges === 'object' ? Reflect.get(profile.numeric_ranges, descriptor.path) : undefined));
      if (range.success && ((range.data.min !== undefined && Number(value) < range.data.min) || (range.data.max !== undefined && Number(value) > range.data.max))) throw new Error(`${descriptor.label} is outside the configured range.`);
    }
    if (value !== null && descriptor.kind === 'boolean') { if (raw !== 'true' && raw !== 'false') throw new Error(`Select ${descriptor.label}.`); value = raw === 'true'; }
    if (value !== null && descriptor.kind === 'instant' && !z.string().datetime({ offset: true }).safeParse(value).success) throw new Error(`${descriptor.label} must be a valid date/time.`);
    if (value !== null && descriptor.kind === 'reference' && !z.string().regex(/^[a-f\d]{24}$/i).safeParse(value).success) throw new Error(`${descriptor.label} requires a valid existing reference.`);
    if (value !== null && descriptor.kind === 'choice') {
      const configured = profile.allowed_values && typeof profile.allowed_values === 'object' ? Reflect.get(profile.allowed_values, descriptor.path) : undefined;
      const options = descriptor.options ?? (Array.isArray(configured) ? configured : []);
      if (!options.some((option) => option === value)) throw new Error(`${descriptor.label} requires a configured option.`);
    }
    const allowed = profile.allowed_values && typeof profile.allowed_values === 'object' ? Reflect.get(profile.allowed_values, descriptor.path) : undefined;
    if (value !== null && Array.isArray(allowed) && !allowed.includes(value)) throw new Error(`${descriptor.label} is not an approved configured value.`);
    if ((descriptor.kind === 'reference' || descriptor.kind === 'choice') && value === null && /\.\d+$/.test(descriptor.path)) {
      const keys = descriptor.path.split('.');
      const index = Number(keys.pop());
      removals.push({ path: keys.join('.'), index });
    } else writePath(payload, descriptor.path, value);
  });
  for (const { path, index } of removals.sort((a, b) => b.index - a.index)) {
    const parent = readPath(payload, path); if (Array.isArray(parent)) parent.splice(index, 1);
  }
  return payload;
}
export function resultReferenceFields(type: TestFormType, laterality: string, payload: Record<string, unknown> = {}, extra: Record<string, number> = {}): ResultField[] {
  const eyes = laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : laterality === 'OU' ? ['OD', 'OS'] : [];
  const reference = (path: string, label: string, referenceType: ResultField['referenceType'] = 'DOCUMENT'): ResultField => ({ path, label, kind: 'reference', referenceType });
  const fields: ResultField[] = [];
  if (type === 'CONTACT_LENS') fields.push(...eyes.map((eye) => reference(`lens_details.${eye}.optical_product_version_id`, `${eye} approved optical product`, 'OPTICAL_PRODUCT')));
  if (type === 'PAEDIATRIC_VISION') fields.push(reference('cycloplegic_refraction.medication_configuration_version_id', 'Approved cycloplegic medication', 'DRUG_OPTION'));
  if (['PACHYMETRY', 'VISUAL_FIELD', 'OCT', 'BIOMETRY_IOL', 'B_SCAN'].includes(type)) fields.push(reference('report_document_id', 'Report document'));
  if (type === 'LENSOMETRY') fields.push(reference('existing_prescription_document_id', 'Existing prescription document'));
  const documents = (path: string, label: string, eye?: string): ResultField => ({ path, label, kind: 'documents', referenceType: 'DOCUMENT', eye });
  if (type === 'SLIT_LAMP_ANTERIOR_SEGMENT') for (const eye of eyes) for (const structure of ['lids_lashes', 'lacrimal', 'conjunctiva', 'sclera', 'cornea', 'anterior_chamber', 'iris', 'pupil', 'lens', 'anterior_vitreous', 'tear_film']) fields.push(reference(`eyes.${eye}.${structure}.diagram_document_id`, `${eye} ${structure} diagram`), documents(`eyes.${eye}.${structure}.image_document_ids`, `${eye} ${structure} images`, eye));
  if (type === 'POSTERIOR_FUNDUS_EXAM') for (const eye of eyes) fields.push(reference(`eyes.${eye}.diagram_document_id`, `${eye} fundus diagram`), documents(`eyes.${eye}.image_document_ids`, `${eye} fundus images`, eye));
  if (type === 'OCT' || type === 'B_SCAN') fields.push(documents('image_document_ids', 'Image documents'));
  if (type === 'B_SCAN') fields.push(documents('video_document_ids', 'Video documents'));
  if (type === 'CORNEAL_TOPOGRAPHY') fields.push(documents('map_document_ids', 'Topography source maps'));
  if (type === 'FUNDUS_PHOTOGRAPHY') {
    const count = (Array.isArray(payload.image_sets) ? Math.max(1, payload.image_sets.length) : 1) + (extra.image_sets ?? 0);
    for (let index = 0; index < count; index++) fields.push(documents(`image_sets.${index}.image_document_ids`, `Image set ${index + 1} documents`));
  }
  return fields;
}
export function profileForm(values: Record<string, unknown>, testCode: string) {
  const type = testFormSchema.safeParse(values.form_type);
  return type.success && typeof values.schema_version === 'string' && Array.isArray(values.test_codes) && values.test_codes.some((code) => typeof code === 'string' && code.toUpperCase() === testCode) ? { type: type.data, schemaVersion: values.schema_version } : null;
}

// Broad Record<string, unknown> substructures have no new editable keys inferred from their names.
// These controls cover the explicit scalar contracts; existing deeper findings remain intact.
export function resultFields(type: TestFormType, laterality: string, payload: Record<string, unknown>, additionalReadings: Record<string, number> = {}): ResultField[] {
  const core = coreFormSchema.safeParse(type);
  if (core.success) return coreResultFields(core.data, laterality, payload, additionalReadings);
  const eyes = laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS'];
  const named = (names: string[], kind: FieldKind = 'text') => names.map((key) => field(key, key.replaceAll('_', ' '), kind));
  const perEye = (prefix: string, kind: FieldKind = 'number') => eyes.map((eye) => field(`${prefix}.${eye}`, `${eye} ${prefix.replaceAll('_', ' ')}`, kind));
  switch (type) {
    case 'PACHYMETRY': return [field('method', 'Method', 'choice'), field('thickness_unit', 'Thickness unit', 'choice'), ...eyes.flatMap((eye) => {
      const readings = readPath(payload, `repeat_readings.${eye}`);
      return [...Array.from({ length: (Array.isArray(readings) ? Math.max(readings.length, 1) : 1) + (additionalReadings[eye] ?? 0) }, (_, index) => field(`repeat_readings.${eye}.${index}`, `${eye} thickness reading ${index + 1}`, 'number')), field(`average_thickness.${eye}`, `${eye} average thickness`, 'number'), field(`quality.${eye}`, `${eye} quality`, 'choice')];
    }), field('remarks', 'Remarks'), field('repeat_recommended', 'Repeat recommended', 'boolean')];
    case 'COLOUR_VISION': return [field('method', 'Method', 'choice'), field('testing_eye', 'Tested eye', 'choice', laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS', 'OU']), ...named(['plates_shown', 'correct', 'incorrect', 'score_percent'], 'number'), ...named(['result', 'defect_type', 'severity', 'reliability'], 'choice'), field('remarks', 'Remarks')];
    case 'MOTILITY_SQUINT_BINOCULAR': return [...named(['fixing_eye', 'deviation_type', 'deviation_nature'], 'choice'), ...named(['nystagmus', 'diplopia', 'abnormal_head_posture'], 'boolean'), ...named(['nystagmus_details', 'diplopia_details', 'abnormal_head_posture_details'])];
    case 'DRY_EYE': return [field('questionnaire_score', 'Questionnaire score', 'number'), ...perEye('tbut_seconds'), ...perEye('meibum', 'choice'), ...perEye('corneal_sensation', 'choice')];
    case 'VISUAL_FIELD': return [...named(['machine', 'program', 'strategy'], 'choice'), field('eye', 'Tested eye', 'choice', laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS']), field('pupil_diameter', 'Pupil diameter', 'number'), field('fixation_target', 'Fixation target', 'choice'), field('impression', 'Impression'), field('remarks', 'Remarks')];
    case 'OCT': return [field('oct_type', 'OCT type', 'choice'), field('eye', 'Tested eye', 'choice', laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS', 'OU']), field('scan_quality', 'Scan quality', 'choice'), field('signal_strength', 'Signal strength', 'number'), ...named(['segmentation_error', 'artefact'], 'boolean'), field('artefact_comment', 'Artefact / segmentation comment')];
    case 'FUNDUS_PHOTOGRAPHY': {
      const sets = payload.image_sets;
      return Array.from({ length: Array.isArray(sets) ? Math.max(sets.length, 1) : 1 }, (_, index) => [field(`image_sets.${index}.eye`, `Image set ${index + 1} eye`, 'choice', laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS']), ...['image_type', 'dilatation', 'quality'].map((key) => field(`image_sets.${index}.${key}`, `Image set ${index + 1} ${key}`, 'choice')), field(`image_sets.${index}.notes`, `Image set ${index + 1} notes`), field(`image_sets.${index}.repeat_required`, `Image set ${index + 1} repeat required`, 'boolean')]).flat();
    }
    case 'CORNEAL_TOPOGRAPHY': return [...eyes.flatMap((eye) => ['k1', 'k1_axis', 'k2', 'k2_axis', 'kmax', 'average_k', 'corneal_astigmatism'].map((key) => field(`keratometry.${eye}.${key}`, `${eye} ${key.replaceAll('_', ' ')}`, 'number'))), ...perEye('asphericity'), ...perEye('pupil_diameter'), ...perEye('scan_quality', 'choice'), field('repeat_recommended', 'Repeat recommended', 'boolean')];
    case 'BIOMETRY_IOL': return [...perEye('target_refraction'), ...perEye('measurement_quality', 'choice'), field('selection_status', 'Selection status (doctor approval remains separate)', 'choice', ['PROPOSED']), field('discontinuation_date', 'Discontinuation date', 'instant'), field('remarks', 'Remarks')];
    case 'B_SCAN': return [field('eye', 'Tested eye', 'choice', laterality === 'OD' ? ['OD'] : laterality === 'OS' ? ['OS'] : ['OD', 'OS', 'OU']), ...named(['indication', 'probe_orientation'], 'choice'), field('gain', 'Gain', 'number'), ...eyes.flatMap((eye) => [field(`lesion.${eye}.present`, `${eye} lesion present`, 'boolean'), field(`lesion.${eye}.mobility`, `${eye} lesion mobility`)]), field('technician_observation', 'Technician observation')];
    case 'GONIOSCOPY': return eyes.flatMap((eye) => ['superior', 'inferior', 'nasal', 'temporal'].flatMap((quadrant) => [field(`eyes.${eye}.quadrants.${quadrant}.angle_grade`, `${eye} ${quadrant} angle grade`, 'choice'), field(`eyes.${eye}.quadrants.${quadrant}.pigmentation`, `${eye} ${quadrant} pigmentation`, 'choice'), field(`eyes.${eye}.quadrants.${quadrant}.pas`, `${eye} ${quadrant} PAS`, 'boolean'), field(`eyes.${eye}.quadrants.${quadrant}.pas_extent`, `${eye} ${quadrant} PAS extent`), field(`eyes.${eye}.quadrants.${quadrant}.neovascularization`, `${eye} ${quadrant} neovascularization`, 'boolean'), field(`eyes.${eye}.quadrants.${quadrant}.neovascularization_details`, `${eye} ${quadrant} neovascularization details`), field(`eyes.${eye}.quadrants.${quadrant}.other_finding`, `${eye} ${quadrant} other finding`)]));
    case 'CONTACT_LENS': return [field('record_stage', 'Lens record stage', 'choice', ['TRIAL', 'FINAL']), ...power('over_refraction', eyes), ...eyes.flatMap((eye) => [
      ...['lens_type', 'brand', 'material'].map((key) => field(`lens_details.${eye}.${key}`, `${eye} lens ${key}`, 'choice')),
      ...['base_curve', 'diameter', 'sphere', 'cylinder', 'axis', 'addition'].map((key) => field(`lens_details.${eye}.${key}`, `${eye} lens ${key}`, 'number')),
      ...['number', 'wearing_schedule', 'replacement_schedule'].map((key) => field(`trial_lens.${eye}.${key}`, `${eye} trial ${key.replaceAll('_', ' ')}`)),
      ...['centration', 'coverage', 'movement', 'push_up'].map((key) => field(`fit_assessment.${eye}.${key}`, `${eye} fit ${key.replaceAll('_', ' ')}`, 'choice')),
      field(`fit_assessment.${eye}.rotation`, `${eye} rotation`, 'number'), field(`comfort.${eye}`, `${eye} comfort`, 'choice'),
      ...['corneal', 'conjunctival', 'tear_exchange'].map((key) => field(`ocular_response.${eye}.${key}`, `${eye} ${key.replaceAll('_', ' ')}`, 'choice')),
    ]), field('outcome', 'Outcome', 'choice'), ...['insertion_removal_training', 'hygiene_instructions_provided', 'wear_schedule_counselling', 'warning_signs_explained'].map((key) => field(`education.${key}`, key.replaceAll('_', ' '), 'boolean')), field('education.notes', 'Education notes'), field('follow_up.required', 'Follow-up required', 'boolean'), field('follow_up.recommended_date', 'Recommended follow-up', 'instant'), field('follow_up.instructions', 'Follow-up instructions')];
    case 'PAEDIATRIC_VISION': return [field('cooperation', 'Cooperation', 'choice', ['GOOD', 'FAIR', 'POOR', 'UNABLE']), field('cycloplegic_refraction.administered_at', 'Cycloplegic administration time', 'instant'), field('cycloplegic_refraction.examined_at', 'Cycloplegic examination time', 'instant'), ...power('cycloplegic_refraction.eyes', eyes), field('parent_reported.notes', 'Parent-reported notes')];
    default: return [];
  }
}

// Only calculations explicitly verified in the backend contract are derived here.
export function deriveResultValues(type: TestFormType, original: Record<string, unknown>) {
  const payload = structuredClone(original);
  for (const eye of ['OD', 'OS']) {
    if (type === 'INTRAOCULAR_PRESSURE' || type === 'AUTOREFRACTION_KERATOMETRY') {
      const readings = readPath(payload, `readings.${eye}`);
      const index = readPath(payload, `selected_reading_index.${eye}`);
      if (Array.isArray(readings) && typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < readings.length) {
        const selected: unknown = readings[index];
        if (type === 'INTRAOCULAR_PRESSURE' && typeof selected === 'number') writePath(payload, `final_iop.${eye}`, selected);
        if (type === 'AUTOREFRACTION_KERATOMETRY' && selected && typeof selected === 'object') {
          const sphere: unknown = Reflect.get(selected, 'sphere'); const cylinder: unknown = Reflect.get(selected, 'cylinder');
          if (typeof sphere === 'number') writePath(payload, `spherical_equivalent.${eye}`, sphere + (typeof cylinder === 'number' ? cylinder / 2 : 0));
        }
      }
    }
    if (type === 'PACHYMETRY') {
      const readings = readPath(payload, `repeat_readings.${eye}`);
      const numbers = z.array(z.number().finite()).min(1).safeParse(readings);
      if (numbers.success) writePath(payload, `average_thickness.${eye}`, numbers.data.reduce((sum, value) => sum + value, 0) / numbers.data.length);
    }
    if (type === 'CORNEAL_TOPOGRAPHY') {
      const k1 = readPath(payload, `keratometry.${eye}.k1`); const k2 = readPath(payload, `keratometry.${eye}.k2`);
      if (typeof k1 === 'number' && typeof k2 === 'number') { writePath(payload, `keratometry.${eye}.average_k`, (k1 + k2) / 2); writePath(payload, `keratometry.${eye}.corneal_astigmatism`, Math.abs(k2 - k1)); }
    }
  }
  if (type === 'COLOUR_VISION' && typeof payload.plates_shown === 'number' && typeof payload.correct === 'number') payload.score_percent = payload.plates_shown === 0 ? 0 : (payload.correct / payload.plates_shown) * 100;
  return payload;
}
