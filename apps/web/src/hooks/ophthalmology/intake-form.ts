import { z } from 'zod';
import { intakeFieldsSchema, type OphthalmologyConfiguration, type OphthalmologyIntake, type SaveOphthalmologyIntake, type OphthalmologyContext } from '../../api/ophthalmology';

export function initialIntake(context: OphthalmologyContext, intake: OphthalmologyIntake | null): SaveOphthalmologyIntake {
  return {
    ...(intake ? intakeFieldsSchema.parse(intakeFieldsSchema.keyof().options.reduce<Record<string, unknown>>((fields, key) => { fields[key] = intake[key]; return fields; }, {})) : {
      complaint_codes: [], affected_eye: context.affected_eye, duration_value: null, duration_unit: null, onset: null, progression: null, severity: null,
      associated_symptom_codes: [], description: null, no_significant_ophthalmic_history: false, previous_eye_disease_codes: [], previous_eye_surgeries: [],
      current_eye_treatments: [], previous_eye_injury_or_laser: [], spectacle_use: { uses: false, age_months: null, wearing_pattern: null },
      contact_lens_use: { uses: false, age_months: null, wearing_pattern: null }, long_term_steroid_use: false, long_term_steroid_details: null,
      family_history_codes: [], previous_report_document_ids: [], shared_medical_history_reviewed: false, shared_allergy_reviewed: false,
      emergency_criterion_codes: [], other_urgent_condition_detail: null,
    }),
    expected_version: intake?.version ?? null, complaint_configuration_version_id: intake?.complaint_configuration_version_id ?? '',
    emergency_configuration_version_id: intake?.emergency_configuration_version_id ?? '',
  };
}
const optionSchema = z.union([z.string().trim().min(1), z.object({ code: z.string().trim().min(1), label: z.string().optional(), active: z.boolean().optional(), requires_description: z.boolean().optional() })]);
export function configuredIntakeOptions(configuration: OphthalmologyConfiguration | undefined, key: 'options' | 'criteria') {
  const parsed = z.array(optionSchema).safeParse(configuration?.values[key]);
  if (!parsed.success) return [];
  return parsed.data.flatMap((entry) => typeof entry === 'string'
    ? [{ code: entry.toUpperCase(), label: entry, requiresDescription: false }]
    : entry.active === false ? [] : [{ code: entry.code.toUpperCase(), label: entry.label || entry.code, requiresDescription: entry.requires_description === true }]);
}
export function intakeCompletionIssues(body: SaveOphthalmologyIntake, complaint: OphthalmologyConfiguration | undefined, emergency: OphthalmologyConfiguration | undefined): string[] {
  const issues: string[] = [];
  if (!body.complaint_codes.length) issues.push('Select at least one complaint.');
  if (!body.duration_value || !body.duration_unit || !body.onset) issues.push('Record a positive duration, duration unit and onset.');
  if (!body.shared_medical_history_reviewed || !body.shared_allergy_reviewed) issues.push('Confirm review of shared medical history and allergies.');
  const complaints = configuredIntakeOptions(complaint, 'options');
  const criteria = configuredIntakeOptions(emergency, 'criteria');
  if (!complaints.length || !criteria.length) issues.push('Load the approved complaint and emergency configuration before completing.');
  for (const code of [...body.complaint_codes, ...body.associated_symptom_codes]) {
    const option = complaints.find((item) => item.code === code);
    if (!option) issues.push(`Complaint option ${code} is unavailable in the selected configuration.`);
    if (option?.requiresDescription && !body.description?.trim()) issues.push(`Describe ${option.label}.`);
  }
  if (body.emergency_criterion_codes.some((code) => !criteria.some((item) => item.code === code))) issues.push('An emergency selection is unavailable in the selected configuration.');
  return issues;
}
export function hasPositiveEyeHistory(body: SaveOphthalmologyIntake) {
  return Boolean(body.previous_eye_disease_codes.length || body.previous_eye_surgeries.length || body.current_eye_treatments.length || body.previous_eye_injury_or_laser.length || body.family_history_codes.length || body.spectacle_use.uses || body.contact_lens_use.uses || body.long_term_steroid_use);
}
export function clearPositiveEyeHistory(body: SaveOphthalmologyIntake): SaveOphthalmologyIntake {
  return { ...body, no_significant_ophthalmic_history: true, previous_eye_disease_codes: [], previous_eye_surgeries: [], current_eye_treatments: [], previous_eye_injury_or_laser: [], family_history_codes: [], spectacle_use: { uses: false, age_months: null, wearing_pattern: null }, contact_lens_use: { uses: false, age_months: null, wearing_pattern: null }, long_term_steroid_use: false, long_term_steroid_details: null };
}
