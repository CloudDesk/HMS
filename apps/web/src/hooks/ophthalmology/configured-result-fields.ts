import { z } from 'zod';
import type { TestFormType } from '../../api/ophthalmology';
import { readPath, type ResultField } from './result-fields';

// Published top-level payload vocabulary. Deeper keys are editable only when the
// versioned profile explicitly supplies their numeric or choice contract.
const roots: Record<TestFormType, readonly string[]> = {
  VISUAL_ACUITY: ['chart_type', 'test_distance', 'lighting', 'correction_used', 'distance', 'low_vision', 'near', 'conclusion_codes'],
  LENSOMETRY: ['optical_power', 'lens_type', 'material', 'coating_codes', 'optical_centre_pd', 'segment_height', 'lens_condition', 'condition_notes', 'spectacle_age', 'usage_type', 'comfortable', 'change_reason_codes', 'existing_prescription_document_id'],
  AUTOREFRACTION_KERATOMETRY: ['cycloplegic', 'cycloplegic_medication', 'readings', 'selected_reading_index', 'spherical_equivalent', 'pd', 'pupil_diameter', 'keratometry', 'observations'],
  OBJECTIVE_REFRACTION: ['method', 'retinoscopy_type', 'working_distance', 'cycloplegic_drug', 'administration_at', 'examination_at', 'raw_power', 'final_power', 'reflex_media', 'observation_codes'],
  SUBJECTIVE_REFRACTION: ['starting_power', 'final_power', 'bcva', 'duochrome', 'jcc', 'fogging', 'acceptance', 'binocular_balance', 'dominant_eye', 'diplopia', 'near_addition', 'working_distance', 'near_acuity', 'usage_requirement_codes', 'impression'],
  INTRAOCULAR_PRESSURE: ['method', 'measured_at', 'position', 'anesthetic_used', 'fluorescein_used', 'drug', 'readings', 'selected_reading_index', 'final_iop', 'unit', 'alert_interpretation'],
  SLIT_LAMP_ANTERIOR_SEGMENT: ['eyes'], POSTERIOR_FUNDUS_EXAM: ['dilation_required', 'dilation_confirmation', 'contraindication', 'dilation_medications', 'method', 'eyes'],
  PACHYMETRY: ['method', 'repeat_readings', 'average_thickness', 'thickness_unit', 'quality', 'technician_impression_codes', 'report_document_id', 'remarks', 'repeat_recommended'],
  COLOUR_VISION: ['method', 'testing_eye', 'plates_shown', 'correct', 'incorrect', 'score_percent', 'result', 'defect_type', 'severity', 'reliability', 'remarks'],
  MOTILITY_SQUINT_BINOCULAR: ['assessment_methods', 'fixing_eye', 'deviation_type', 'deviation_nature', 'measurements', 'ocular_movements', 'nystagmus', 'nystagmus_details', 'diplopia', 'diplopia_details', 'abnormal_head_posture', 'abnormal_head_posture_details', 'stereopsis', 'worth_four_dot', 'impression_codes'],
  DRY_EYE: ['symptom_codes', 'questionnaire_score', 'schirmer', 'tbut_seconds', 'fluorescein_staining', 'lissamine_staining', 'tear_meniscus', 'meibomian_glands', 'meibum', 'blink', 'lid_margin', 'corneal_sensation', 'impression_codes'],
  VISUAL_FIELD: ['machine', 'program', 'strategy', 'eye', 'correction_used', 'pupil_diameter', 'fixation_target', 'reliability_indices', 'result_indices', 'clinical_pattern', 'comparison', 'report_document_id', 'impression', 'remarks'],
  OCT: ['oct_type', 'eye', 'requested_scans', 'scan_quality', 'signal_strength', 'measurements', 'segmentation_error', 'artefact', 'artefact_comment', 'comparison', 'report_document_id', 'image_document_ids', 'technician_observation_codes'],
  FUNDUS_PHOTOGRAPHY: ['image_sets'], CORNEAL_TOPOGRAPHY: ['keratometry', 'corneal_thickness', 'anterior_elevation', 'posterior_elevation', 'asphericity', 'pupil_diameter', 'white_to_white', 'scan_quality', 'map_document_ids', 'impression_codes', 'repeat_recommended'],
  BIOMETRY_IOL: ['measurements', 'target_refraction', 'calculations', 'measurement_quality', 'special_factor_codes', 'discontinuation_date', 'proposed_iol', 'backup_iol', 'selection_status', 'report_document_id', 'remarks', 'alternative_calculations'],
  B_SCAN: ['eye', 'indication', 'probe_orientation', 'gain', 'axial_length', 'findings', 'lesion', 'image_document_ids', 'video_document_ids', 'report_document_id', 'technician_observation'], GONIOSCOPY: ['eyes'],
  CONTACT_LENS: ['record_stage', 'lens_details', 'trial_lens', 'fit_assessment', 'over_refraction', 'visual_acuity', 'comfort', 'ocular_response', 'outcome', 'education', 'follow_up'],
  PAEDIATRIC_VISION: ['assessment_methods', 'cycloplegic_refraction', 'alignment', 'red_reflex', 'amblyopia_assessment', 'binocular_vision', 'cooperation', 'parent_reported', 'birth_development_history', 'result_codes'],
};
export function configuredResultFields(type: TestFormType, laterality: string, fields: ResultField[], profile: Record<string, unknown>): ResultField[] {
  const result = [...fields];
  const units = z.record(z.string(), z.string().min(1)).safeParse(profile.comparison_units).data ?? {};
  const allowed = z.record(z.string(), z.array(z.union([z.string(), z.number(), z.boolean()]))).safeParse(profile.allowed_values).data ?? {};
  const ranges = z.record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() })).safeParse(profile.numeric_ranges).data ?? {};
  for (const path of new Set([...Object.keys(allowed), ...Object.keys(ranges), ...Object.keys(units)])) {
    const keys = path.split('.'); const root = keys[0];
    if (!root || !roots[type].includes(root) || keys.some((key) => ['__proto__', 'constructor', 'prototype'].includes(key)) || (laterality === 'OD' && keys.includes('OS')) || (laterality === 'OS' && keys.includes('OD')) || result.some((field) => field.path === path)) continue;
    const choices = allowed[path];
    if (!ranges[path] && !units[path] && !choices?.length) continue;
    const kind = ranges[path] || units[path] || choices?.every((choice) => typeof choice === 'number') ? 'number' : choices?.every((choice) => typeof choice === 'boolean') ? 'boolean' : 'choice';
    result.push({ path, label: keys.map((key) => key.replaceAll('_', ' ')).join(' · '), kind, ...(kind === 'choice' && choices ? { options: choices.filter((choice): choice is string => typeof choice === 'string') } : {}) });
  }
  return result.map((field) => units[field.path] ? { ...field, label: `${field.label} (${units[field.path]})` } : field);
}
export function unavailableRequiredPaths(fields: ResultField[], payload: Record<string, unknown>, profile: Record<string, unknown>) {
  const required = z.array(z.string()).safeParse(profile.required_fields).data ?? [];
  return required.filter((path) => readPath(payload, path) == null && !fields.some((field) => field.path === path || field.path.startsWith(`${path}.`)));
}
