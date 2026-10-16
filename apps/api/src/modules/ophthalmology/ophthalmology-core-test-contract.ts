import { AppError } from '../../shared/errors/app-error.js';
import type { OphthalmologyTestFormType, OphthalmologyTestResultStatus } from './ophthalmology.types.js';

const fields: Record<OphthalmologyTestFormType, Set<string>> = {
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
  PACHYMETRY: new Set(['method', 'repeat_readings', 'average_thickness', 'thickness_unit', 'quality', 'technician_impression_codes',
    'report_document_id', 'remarks', 'repeat_recommended']),
  COLOUR_VISION: new Set(['method', 'testing_eye', 'plates_shown', 'correct', 'incorrect', 'score_percent', 'result', 'defect_type',
    'severity', 'reliability', 'remarks']),
  MOTILITY_SQUINT_BINOCULAR: new Set(['assessment_methods', 'fixing_eye', 'deviation_type', 'deviation_nature', 'measurements',
    'ocular_movements', 'nystagmus', 'nystagmus_details', 'diplopia', 'diplopia_details', 'abnormal_head_posture',
    'abnormal_head_posture_details', 'stereopsis', 'worth_four_dot', 'impression_codes']),
  DRY_EYE: new Set(['symptom_codes', 'questionnaire_score', 'schirmer', 'tbut_seconds', 'fluorescein_staining', 'lissamine_staining',
    'tear_meniscus', 'meibomian_glands', 'meibum', 'blink', 'lid_margin', 'corneal_sensation', 'impression_codes']),
  VISUAL_FIELD: new Set(['machine', 'program', 'strategy', 'eye', 'correction_used', 'pupil_diameter', 'fixation_target',
    'reliability_indices', 'result_indices', 'clinical_pattern', 'comparison', 'report_document_id', 'impression', 'remarks']),
  OCT: new Set(['oct_type', 'eye', 'requested_scans', 'scan_quality', 'signal_strength', 'measurements', 'segmentation_error',
    'artefact', 'artefact_comment', 'comparison', 'report_document_id', 'image_document_ids', 'technician_observation_codes']),
  FUNDUS_PHOTOGRAPHY: new Set(['image_sets']),
  CORNEAL_TOPOGRAPHY: new Set(['keratometry', 'corneal_thickness', 'anterior_elevation', 'posterior_elevation', 'asphericity',
    'pupil_diameter', 'white_to_white', 'scan_quality', 'map_document_ids', 'impression_codes', 'repeat_recommended']),
  BIOMETRY_IOL: new Set(['measurements', 'target_refraction', 'calculations', 'measurement_quality', 'special_factor_codes',
    'discontinuation_date', 'proposed_iol', 'backup_iol', 'selection_status', 'report_document_id', 'remarks', 'alternative_calculations']),
  B_SCAN: new Set(['eye', 'indication', 'probe_orientation', 'gain', 'axial_length', 'findings', 'lesion', 'image_document_ids',
    'video_document_ids', 'report_document_id', 'technician_observation']),
  GONIOSCOPY: new Set(['eyes']),
  CONTACT_LENS: new Set(['record_stage', 'lens_details', 'trial_lens', 'fit_assessment', 'over_refraction', 'visual_acuity', 'comfort',
    'ocular_response', 'outcome', 'education', 'follow_up']),
  PAEDIATRIC_VISION: new Set(['assessment_methods', 'cycloplegic_refraction', 'alignment', 'red_reflex', 'amblyopia_assessment',
    'binocular_vision', 'cooperation', 'parent_reported', 'birth_development_history', 'result_codes', 'age_at_assessment_months',
    'guardian_recorded']),
};

const requiredByForm: Record<OphthalmologyTestFormType, string[]> = {
  VISUAL_ACUITY: ['chart_type'], LENSOMETRY: ['optical_power'],
  AUTOREFRACTION_KERATOMETRY: ['readings', 'selected_reading_index'], OBJECTIVE_REFRACTION: ['method', 'final_power'],
  SUBJECTIVE_REFRACTION: ['final_power', 'bcva', 'acceptance'],
  INTRAOCULAR_PRESSURE: ['method', 'measured_at', 'position', 'readings', 'selected_reading_index', 'final_iop', 'unit'],
  SLIT_LAMP_ANTERIOR_SEGMENT: ['eyes'], POSTERIOR_FUNDUS_EXAM: ['dilation_required', 'method', 'eyes'],
  PACHYMETRY: ['method', 'repeat_readings', 'average_thickness', 'thickness_unit', 'quality'],
  COLOUR_VISION: ['method', 'testing_eye', 'plates_shown', 'correct', 'incorrect', 'score_percent', 'result', 'reliability'],
  MOTILITY_SQUINT_BINOCULAR: ['assessment_methods', 'impression_codes'],
  DRY_EYE: ['symptom_codes', 'impression_codes'],
  VISUAL_FIELD: ['machine', 'program', 'strategy', 'eye', 'correction_used', 'reliability_indices', 'result_indices', 'impression'],
  OCT: ['oct_type', 'eye', 'requested_scans', 'scan_quality', 'signal_strength', 'measurements', 'technician_observation_codes'],
  FUNDUS_PHOTOGRAPHY: ['image_sets'],
  CORNEAL_TOPOGRAPHY: ['keratometry', 'scan_quality', 'impression_codes'],
  BIOMETRY_IOL: ['measurements', 'target_refraction', 'calculations', 'measurement_quality', 'selection_status'],
  B_SCAN: ['eye', 'indication', 'probe_orientation', 'gain', 'findings'],
  GONIOSCOPY: ['eyes'],
  CONTACT_LENS: ['record_stage', 'lens_details', 'trial_lens', 'fit_assessment', 'over_refraction', 'visual_acuity', 'comfort',
    'ocular_response', 'outcome', 'education'],
  PAEDIATRIC_VISION: ['assessment_methods', 'alignment', 'red_reflex', 'amblyopia_assessment', 'binocular_vision', 'cooperation',
    'parent_reported', 'birth_development_history', 'result_codes'],
};
const slitLampStructures = new Set(['lids_lashes', 'lacrimal', 'conjunctiva', 'sclera', 'cornea', 'anterior_chamber', 'iris', 'pupil',
  'lens', 'anterior_vitreous', 'tear_film']);
const fundusStructures = new Set(['media', 'vitreous', 'media_vitreous', 'optic_disc', 'macula', 'fovea', 'macula_fovea', 'vessels',
  'retina', 'vessels_retina', 'diagram_document_id', 'image_document_ids', 'remarks']);
const eyeDataCandidates: Partial<Record<OphthalmologyTestFormType, string[]>> = {
  PACHYMETRY: ['repeat_readings'], MOTILITY_SQUINT_BINOCULAR: ['ocular_movements', 'measurements'],
  DRY_EYE: ['schirmer', 'tbut_seconds', 'fluorescein_staining', 'lissamine_staining', 'tear_meniscus', 'meibomian_glands'],
  OCT: ['measurements'], CORNEAL_TOPOGRAPHY: ['keratometry'], BIOMETRY_IOL: ['measurements'], B_SCAN: ['findings'],
  GONIOSCOPY: ['eyes'], CONTACT_LENS: ['lens_details'], PAEDIATRIC_VISION: ['alignment', 'red_reflex'],
};

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

const requireEyeData = (payload: Record<string, unknown>, formType: OphthalmologyTestFormType) => {
  const candidates = formType === 'VISUAL_ACUITY' ? ['distance', 'low_vision', 'near']
    : formType === 'POSTERIOR_FUNDUS_EXAM' || formType === 'SLIT_LAMP_ANTERIOR_SEGMENT' ? ['eyes']
      : eyeDataCandidates[formType] ?? ['optical_power', 'readings', 'final_power', 'final_iop'];
  if (['COLOUR_VISION', 'VISUAL_FIELD', 'FUNDUS_PHOTOGRAPHY'].includes(formType)) return;
  if (!candidates.some((path) => { const eye = getPath(payload, path); return eye && typeof eye === 'object'
    && (present((eye as Record<string, unknown>).OD) || present((eye as Record<string, unknown>).OS)); })) {
    throw invalid(`${formType} requires an OD or OS result`, 'OPHTHALMOLOGY_RESULT_LATERALITY_REQUIRED');
  }
};
const validateSelectedReadings = (payload: Record<string, unknown>, formType: OphthalmologyTestFormType) => {
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

const approximately = (left: number, right: number) => Math.abs(left - right) <= 0.01;
const validateAdvancedCalculations = (formType: OphthalmologyTestFormType, payload: Record<string, unknown>) => {
  if (formType === 'PACHYMETRY') {
    const readings = payload.repeat_readings as Record<string, unknown[]>; const averages = payload.average_thickness as Record<string, unknown>;
    for (const eye of ['OD', 'OS']) { const values = readings?.[eye]; if (!values) continue;
      if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
        throw invalid(`${eye} pachymetry readings must retain one or more numeric source readings`);
      }
      const average = (values as number[]).reduce((sum, value) => sum + value, 0) / values.length;
      if (typeof averages?.[eye] !== 'number' || !approximately(averages[eye] as number, average)) {
        throw invalid(`${eye} pachymetry average does not match retained source readings`, 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID');
      }
    }
  }
  if (formType === 'COLOUR_VISION') {
    const shown = payload.plates_shown; const correct = payload.correct; const incorrect = payload.incorrect; const score = payload.score_percent;
    if (![shown, correct, incorrect].every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 0)
      || shown !== (correct as number) + (incorrect as number)) throw invalid('Colour vision plate counts are inconsistent', 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID');
    const expected = shown === 0 ? 0 : ((correct as number) / (shown as number)) * 100;
    if (typeof score !== 'number' || !approximately(score, expected)) throw invalid('Colour vision score does not match the plate counts', 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID');
  }
  if (formType === 'CORNEAL_TOPOGRAPHY') {
    const eyes = payload.keratometry as Record<string, Record<string, unknown>>;
    for (const eye of ['OD', 'OS']) { const value = eyes?.[eye]; if (!value) continue;
      const { k1, k2, average_k: average, corneal_astigmatism: astigmatism } = value;
      if (typeof k1 === 'number' && typeof k2 === 'number') {
        if (typeof average === 'number' && !approximately(average, (k1 + k2) / 2)) throw invalid(`${eye} average K is invalid`, 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID');
        if (typeof astigmatism === 'number' && !approximately(astigmatism, Math.abs(k2 - k1))) throw invalid(`${eye} corneal astigmatism is invalid`, 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID');
      }
    }
  }
};

const validateAdvancedConditions = (formType: OphthalmologyTestFormType, payload: Record<string, unknown>, profileValues: Record<string, unknown>) => {
  if (formType === 'COLOUR_VISION' && payload.result === 'ABNORMAL'
    && (!present(payload.defect_type) || !present(payload.severity))) throw invalid('Abnormal colour vision requires defect type and severity', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  if (formType === 'COLOUR_VISION' && payload.reliability === 'POOR' && !present(payload.remarks)) {
    throw invalid('Poor colour vision reliability requires remarks', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'MOTILITY_SQUINT_BINOCULAR') for (const [flag, detail] of [['nystagmus', 'nystagmus_details'], ['diplopia', 'diplopia_details'],
    ['abnormal_head_posture', 'abnormal_head_posture_details']] as const) if (payload[flag] === true && !present(payload[detail])) {
    throw invalid(`${detail} is required for a positive finding`, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'OCT' && (payload.segmentation_error === true || payload.artefact === true) && !present(payload.artefact_comment)) {
    throw invalid('OCT segmentation error or artefact requires a comment', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
  }
  if (formType === 'FUNDUS_PHOTOGRAPHY') {
    const sets = payload.image_sets; if (!Array.isArray(sets) || sets.length === 0) throw invalid('At least one fundus image set is required', 'OPHTHALMOLOGY_RESULT_REQUIRED');
    for (const [index, raw] of sets.entries()) { const item = raw as Record<string, unknown>;
      for (const key of ['eye', 'image_type', 'fields', 'dilatation', 'quality', 'image_document_ids']) if (!present(item[key])) {
        throw invalid(`image_sets.${index}.${key} is required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
      }
      item.image_count = (item.image_document_ids as unknown[]).length;
      if (item.quality === 'POOR' && item.repeat_required !== true && !present(item.notes)) throw invalid('Poor fundus image quality requires repeat or notes', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
  }
  if (formType === 'BIOMETRY_IOL' && payload.selection_status !== 'PROPOSED') {
    throw new AppError('Phase 6 IOL selection must remain PROPOSED pending doctor approval', 422, 'OPHTHALMOLOGY_REVIEW_REQUIRED');
  }
  if (formType === 'B_SCAN') {
    const lesions = payload.lesion as Record<string, Record<string, unknown>> | undefined;
    for (const eye of ['OD', 'OS']) if (lesions?.[eye]?.present === true && !present(lesions[eye]?.dimensions)) {
      throw invalid(`${eye} B-scan lesion requires dimensions`, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
  }
  if (formType === 'GONIOSCOPY') {
    const eyes = payload.eyes as Record<string, Record<string, unknown>>; const requiredQuadrants = Array.isArray(profileValues.required_quadrants)
      ? profileValues.required_quadrants.filter((value): value is string => typeof value === 'string') : [];
    for (const eye of ['OD', 'OS']) { const quadrants = eyes?.[eye]?.quadrants as Record<string, Record<string, unknown>> | undefined; if (!quadrants) continue;
      const names = requiredQuadrants.length ? requiredQuadrants : Object.keys(quadrants); if (names.length === 0) throw invalid(`${eye} gonioscopy requires examined quadrants`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
      for (const name of names) { const item = quadrants[name]; if (!item || !present(item.angle_grade)) throw invalid(`${eye}.${name} angle grade is required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
        if (item.pas === true && !present(item.pas_extent)) throw invalid(`${eye}.${name} PAS requires extent`, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
        if (item.neovascularization === true && !present(item.neovascularization_details)) throw invalid(`${eye}.${name} neovascularization requires details`, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
      }
    }
  }
  const qualityValues = Object.entries(payload).filter(([key]) => key.includes('quality')).flatMap(([, value]) => value && typeof value === 'object'
    ? Object.values(value as Record<string, unknown>) : [value]);
  if (qualityValues.includes('POOR') && payload.repeat_recommended !== true && !present(payload.remarks)
    && !present(payload.technician_observation_codes)) throw invalid('Poor quality requires repeat/review disposition or remarks', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
};

const validateComparisonShape = (formType: OphthalmologyTestFormType, payload: Record<string, unknown>) => {
  if (formType !== 'VISUAL_FIELD' && formType !== 'OCT') return;
  const raw = payload.comparison; if (!present(raw)) return;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('Comparison must be a structured reference');
  const comparison = raw as Record<string, unknown>; const outcomes = ['STABLE', 'IMPROVED', 'WORSENED', 'NOT_COMPARED'];
  if (!outcomes.includes(comparison.outcome as string)) throw invalid('Comparison outcome is invalid', 'OPHTHALMOLOGY_RESULT_OPTION_INVALID');
  if (comparison.outcome === 'NOT_COMPARED') {
    if (present(comparison.result_id) || present(comparison.clinical_version)) throw invalid('NOT_COMPARED cannot reference a prior result');
    return;
  }
  if (typeof comparison.result_id !== 'string' || !comparison.result_id || !Number.isInteger(comparison.clinical_version)
    || (comparison.clinical_version as number) < 1) throw invalid('Progression requires an exact prior result version', 'OPHTHALMOLOGY_COMPARISON_REQUIRED');
};

const validateSpecializedConditions = (formType: OphthalmologyTestFormType, payload: Record<string, unknown>) => {
  if (formType === 'CONTACT_LENS') {
    const lenses = payload.lens_details as Record<string, Record<string, unknown>>;
    const fit = payload.fit_assessment as Record<string, Record<string, unknown>>;
    const overRefraction = payload.over_refraction as Record<string, unknown>; const acuity = payload.visual_acuity as Record<string, unknown>;
    const comfort = payload.comfort as Record<string, unknown>; const response = payload.ocular_response as Record<string, unknown>;
    for (const eye of ['OD', 'OS']) { const lens = lenses?.[eye]; if (!lens) continue;
      for (const key of ['optical_product_version_id', 'lens_type', 'brand', 'material', 'base_curve', 'diameter', 'sphere']) {
        if (!present(lens[key])) throw invalid(`${eye} contact lens ${key} is required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
      }
      if (typeof lens.cylinder === 'number' && lens.cylinder !== 0 && !present(lens.axis)) {
        throw invalid(`${eye} contact lens axis is required when cylinder is present`, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
      }
      for (const key of ['centration', 'coverage', 'movement', 'push_up']) if (!present(fit?.[eye]?.[key])) {
        throw invalid(`${eye} fit assessment ${key} is required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
      }
      if (!present(overRefraction?.[eye]) || !present(acuity?.[eye]) || !present(comfort?.[eye]) || !present(response?.[eye])) {
        throw invalid(`${eye} over-refraction, acuity, comfort and ocular response are required`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
      }
    }
    const education = payload.education as Record<string, unknown>;
    if (education?.insertion_removal_training !== true || education?.hygiene_instructions_provided !== true) {
      throw invalid('Contact lens training and hygiene education must be recorded', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
    const followUp = payload.follow_up as Record<string, unknown> | undefined;
    if (followUp?.required === true && !present(followUp.recommended_date) && !present(followUp.follow_up_id)) {
      throw invalid('Required contact lens follow-up needs a recommended date or existing follow-up reference', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
  }
  if (formType === 'PAEDIATRIC_VISION') {
    const cycloplegic = payload.cycloplegic_refraction as Record<string, unknown> | null | undefined;
    if (cycloplegic && (!present(cycloplegic.medication_configuration_version_id) || !present(cycloplegic.administered_at)
      || !present(cycloplegic.examined_at) || !present(cycloplegic.eyes))) {
      throw invalid('Cycloplegic paediatric refraction requires medication, timing and eye results', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
    if (payload.cooperation === 'UNABLE' && !(payload.result_codes as unknown[])?.includes('REPEAT')) {
      throw invalid('Unable paediatric cooperation requires a repeat result', 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
  }
};

export const validateCoreTestPayload = (formType: OphthalmologyTestFormType, payload: Record<string, unknown>,
  profileValues: Record<string, unknown>, status: OphthalmologyTestResultStatus) => {
  const unknown = Object.keys(payload).filter((key) => !fields[formType].has(key));
  if (unknown.length) throw invalid(`Unsupported ${formType} field: ${unknown.join(', ')}`);
  validateAxes(payload);
  validateComparisonShape(formType, payload);
  if (status === 'DRAFT') return;
  for (const path of requiredByForm[formType]) if (!present(getPath(payload, path))) {
    throw invalid(`${path} is required to complete ${formType}`, 'OPHTHALMOLOGY_RESULT_REQUIRED');
  }
  requireEyeData(payload, formType);
  validateSelectedReadings(payload, formType);
  validateAdvancedCalculations(formType, payload);
  validateAdvancedConditions(formType, payload, profileValues);
  validateSpecializedConditions(formType, payload);
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

export const profileSupportsForm = (values: Record<string, unknown>, formType: OphthalmologyTestFormType,
  schemaVersion: string, testCode: string) => values.form_type === formType && values.schema_version === schemaVersion
  && Array.isArray(values.test_codes) && values.test_codes.some((code) => typeof code === 'string' && code.toUpperCase() === testCode);
