import { AppError } from '../../shared/errors/app-error.js';
import type { OphthalmologyCoreTestFormType, OphthalmologyTestResultStatus } from './ophthalmology.types.js';

const fields: Record<OphthalmologyCoreTestFormType, Set<string>> = {
  VISUAL_ACUITY: new Set(['chart_type', 'test_distance', 'lighting', 'correction_used', 'distance', 'low_vision', 'near', 'conclusion_codes']),
  LENSOMETRY: new Set(['optical_power', 'lens_type', 'material', 'coating_codes', 'optical_centre_pd', 'segment_height', 'lens_condition',
    'condition_notes', 'spectacle_age', 'usage_type', 'comfortable', 'change_reason_codes', 'existing_prescription_document_id']),
  AUTOREFRACTION_KERATOMETRY: new Set(['cycloplegic', 'cycloplegic_medication', 'readings', 'selected_reading_index', 'spherical_equivalent',
    'pd', 'pupil_diameter', 'keratometry', 'observations']),
  OBJECTIVE_REFRACTION: new Set(['method', 'retinoscopy_type', 'working_distance', 'cycloplegic_drug', 'administration_at', 'examination_at',
    'raw_power', 'final_power', 'reflex_media', 'observation_codes']),
  SUBJECTIVE_REFRACTION: new Set(['starting_power', 'final_power', 'bcva', 'duochrome', 'jcc', 'fogging', 'acceptance', 'binocular_balance',
    'dominant_eye', 'diplopia', 'near_addition', 'working_distance', 'near_acuity', 'usage_requirement_codes', 'impression']),
  INTRAOCULAR_PRESSURE: new Set(['method', 'measured_at', 'position', 'anesthetic_used', 'fluorescein_used', 'drug', 'readings',
    'selected_reading_index', 'final_iop', 'unit', 'alert_interpretation']),
  SLIT_LAMP_ANTERIOR_SEGMENT: new Set(['eyes']),
  POSTERIOR_FUNDUS_EXAM: new Set(['dilation_required', 'dilation_confirmation', 'contraindication', 'dilation_medications', 'method', 'eyes']),
};

const requiredByForm: Record<OphthalmologyCoreTestFormType, string[]> = {
  VISUAL_ACUITY: ['chart_type'], LENSOMETRY: ['optical_power'],
  AUTOREFRACTION_KERATOMETRY: ['readings', 'selected_reading_index'], OBJECTIVE_REFRACTION: ['method', 'final_power'],
  SUBJECTIVE_REFRACTION: ['final_power', 'bcva', 'acceptance'],
  INTRAOCULAR_PRESSURE: ['method', 'measured_at', 'position', 'readings', 'selected_reading_index', 'final_iop', 'unit'],
  SLIT_LAMP_ANTERIOR_SEGMENT: ['eyes'], POSTERIOR_FUNDUS_EXAM: ['dilation_required', 'method', 'eyes'],
};
const slitLampStructures = new Set(['lids_lashes', 'lacrimal', 'conjunctiva', 'sclera', 'cornea', 'anterior_chamber', 'iris', 'pupil',
  'lens', 'anterior_vitreous', 'tear_film']);
const fundusStructures = new Set(['media', 'vitreous', 'media_vitreous', 'optic_disc', 'macula', 'fovea', 'macula_fovea', 'vessels',
  'retina', 'vessels_retina', 'diagram_document_id', 'image_document_ids', 'remarks']);

const getPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, key) => {
  if (!current || typeof current !== 'object') return undefined;
  return (current as Record<string, unknown>)[key];
}, value);
const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
const invalid = (message: string, code = 'OPHTHALMOLOGY_RESULT_INVALID') => new AppError(message, 400, code);

const validateAxes = (value: unknown, path = 'payload') => {
  if (Array.isArray(value)) return value.forEach((entry, index) => validateAxes(entry, `${path}.${index}`));
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'axis' || key.endsWith('_axis')) && nested !== null && nested !== undefined
      && (typeof nested !== 'number' || !Number.isFinite(nested) || nested < 0 || nested > 180)) {
      throw invalid(`${path}.${key} must be a number from 0 through 180`, 'OPHTHALMOLOGY_RESULT_RANGE_INVALID');
    }
    validateAxes(nested, `${path}.${key}`);
  }
};

const requireEyeData = (payload: Record<string, unknown>, formType: OphthalmologyCoreTestFormType) => {
  const candidates = formType === 'VISUAL_ACUITY' ? ['distance', 'low_vision', 'near']
    : formType === 'POSTERIOR_FUNDUS_EXAM' || formType === 'SLIT_LAMP_ANTERIOR_SEGMENT' ? ['eyes']
      : ['optical_power', 'readings', 'final_power', 'final_iop'];
  if (!candidates.some((path) => { const eye = getPath(payload, path); return eye && typeof eye === 'object'
    && (present((eye as Record<string, unknown>).OD) || present((eye as Record<string, unknown>).OS)); })) {
    throw invalid(`${formType} requires an OD or OS result`, 'OPHTHALMOLOGY_RESULT_LATERALITY_REQUIRED');
  }
};
const validateSelectedReadings = (payload: Record<string, unknown>, formType: OphthalmologyCoreTestFormType) => {
  if (formType !== 'AUTOREFRACTION_KERATOMETRY' && formType !== 'INTRAOCULAR_PRESSURE') return;
  const readings = payload.readings as Record<string, unknown[]>; const selected = payload.selected_reading_index as Record<string, number>;
  for (const eye of ['OD', 'OS']) {
    if (!readings?.[eye]) continue; const index = selected?.[eye];
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= readings[eye].length) {
      throw invalid(`Selected ${eye} reading does not reference a retained source reading`, 'OPHTHALMOLOGY_RESULT_INVALID');
    }
    if (formType === 'INTRAOCULAR_PRESSURE') {
      const final = (payload.final_iop as Record<string, unknown>)?.[eye];
      if (final !== readings[eye][index]) throw invalid(`Final ${eye} IOP must match the selected retained reading`, 'OPHTHALMOLOGY_RESULT_INVALID');
    } else {
      const reading = readings[eye][index] as Record<string, unknown>; const reported = (payload.spherical_equivalent as Record<string, unknown>)?.[eye];
      if (typeof reported === 'number' && typeof reading?.sphere === 'number') {
        const calculated = reading.sphere + (typeof reading.cylinder === 'number' ? reading.cylinder / 2 : 0);
        if (Math.abs(reported - calculated) > 0.01) throw invalid(`Spherical equivalent for ${eye} does not match its selected source reading`, 'OPHTHALMOLOGY_RESULT_INVALID');
      }
    }
  }
};
const applyIopThresholds = (payload: Record<string, unknown>, profileValues: Record<string, unknown>) => {
  const rule = profileValues.iop_thresholds;
  if (!rule || typeof rule !== 'object') throw invalid('Configured IOP thresholds are required', 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
  const values = rule as Record<string, unknown>; const required = ['low', 'high', 'asymmetry', 'low_code', 'high_code', 'asymmetry_code', 'within_code'];
  if (required.some((key) => !present(values[key]))) throw invalid('Configured IOP thresholds are incomplete', 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
  const final = payload.final_iop as Record<string, unknown>; const alerts = new Set<string>();
  for (const eye of ['OD', 'OS']) { const value = final?.[eye]; if (typeof value !== 'number') continue;
    if (value < (values.low as number)) alerts.add(values.low_code as string);
    if (value > (values.high as number)) alerts.add(values.high_code as string);
  }
  if (typeof final?.OD === 'number' && typeof final?.OS === 'number' && Math.abs(final.OD - final.OS) >= (values.asymmetry as number)) {
    alerts.add(values.asymmetry_code as string);
  }
  if (!alerts.size) alerts.add(values.within_code as string); payload.alert_interpretation = [...alerts];
};

export const validateCoreTestPayload = (formType: OphthalmologyCoreTestFormType, payload: Record<string, unknown>,
  profileValues: Record<string, unknown>, status: OphthalmologyTestResultStatus) => {
  const unknown = Object.keys(payload).filter((key) => !fields[formType].has(key));
  if (unknown.length) throw invalid(`Unsupported ${formType} field: ${unknown.join(', ')}`);
  validateAxes(payload);
  if (status === 'DRAFT') return;
  for (const path of requiredByForm[formType]) if (!present(getPath(payload, path))) {
    throw invalid(`${path} is required to complete ${formType}`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
  }
  requireEyeData(payload, formType);
  validateSelectedReadings(payload, formType);
  if (formType === 'AUTOREFRACTION_KERATOMETRY' && payload.cycloplegic === true && !present(payload.cycloplegic_medication)) {
    throw invalid('Cycloplegic medication details are required', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'OBJECTIVE_REFRACTION' && payload.method === 'CYCLOPLEGIC'
    && (!present(payload.cycloplegic_drug) || !present(payload.administration_at) || !present(payload.examination_at))) {
    throw invalid('Cycloplegic drug and administration/examination times are required', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'POSTERIOR_FUNDUS_EXAM' && payload.dilation_required === true
    && (!present(payload.dilation_confirmation) || !present(payload.dilation_medications))) {
    throw invalid('Dilation confirmation and medication administration are required', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'INTRAOCULAR_PRESSURE') {
    if (payload.unit !== 'mmHg') throw invalid('IOP unit must be mmHg'); applyIopThresholds(payload, profileValues);
  }
  if (formType === 'SLIT_LAMP_ANTERIOR_SEGMENT' || formType === 'POSTERIOR_FUNDUS_EXAM') {
    const allowed = formType === 'SLIT_LAMP_ANTERIOR_SEGMENT' ? slitLampStructures : fundusStructures;
    const eyes = payload.eyes as Record<string, unknown>;
    for (const eye of ['OD', 'OS']) { const value = eyes?.[eye]; if (!value || typeof value !== 'object') continue;
      const unsupported = Object.keys(value as Record<string, unknown>).filter((key) => !allowed.has(key));
      if (unsupported.length) throw invalid(`Unsupported ${formType} structure: ${unsupported.join(', ')}`);
    }
  }

  const configuredRequired = profileValues.required_fields;
  if (Array.isArray(configuredRequired)) for (const path of configuredRequired) {
    if (typeof path === 'string' && !present(getPath(payload, path))) {
      throw invalid(`Configured field ${path} is required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
    }
  }
  const ranges = profileValues.numeric_ranges;
  if (ranges && typeof ranges === 'object') for (const [path, rule] of Object.entries(ranges as Record<string, unknown>)) {
    const value = getPath(payload, path); if (!present(value)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || !rule || typeof rule !== 'object') throw invalid(`Configured numeric field ${path} is invalid`);
    const { min, max } = rule as { min?: unknown; max?: unknown };
    if ((typeof min === 'number' && value < min) || (typeof max === 'number' && value > max)) {
      throw invalid(`${path} is outside the configured range`, 'OPHTHALMOLOGY_RESULT_RANGE_INVALID');
    }
  }
  const options = profileValues.allowed_values;
  if (options && typeof options === 'object') for (const [path, allowed] of Object.entries(options as Record<string, unknown>)) {
    const value = getPath(payload, path); if (!present(value)) continue;
    if (!Array.isArray(allowed) || !allowed.includes(value)) throw invalid(`${path} is not an approved configured value`, 'OPHTHALMOLOGY_RESULT_OPTION_INVALID');
  }
};

export const profileSupportsForm = (values: Record<string, unknown>, formType: OphthalmologyCoreTestFormType,
  schemaVersion: string, testCode: string) => values.form_type === formType && values.schema_version === schemaVersion
  && Array.isArray(values.test_codes) && values.test_codes.some((code) => typeof code === 'string' && code.toUpperCase() === testCode);
