import { describe, expect, it } from 'vitest';
import { saveIntakeSchema, type OphthalmologyContext, type OphthalmologyConfiguration } from '../../api/ophthalmology';
import { configuredIntakeOptions, initialIntake, intakeCompletionIssues, hasPositiveEyeHistory, clearPositiveEyeHistory } from './intake-form';

const id = '111111111111111111111111';
export const context: OphthalmologyContext = { id, visit_id: id, patient_id: id, branch_id: id, department_id: id, doctor_id: id, visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OS', workflow_status: 'CHECKED_IN', configuration_version_id: id, workflow_profile_version_id: id, version: 2 };
function configuration(type: string, values: Record<string, unknown>): OphthalmologyConfiguration { return { id, branch_id: id, type, values, code: 'QA', name: 'QA', revision: 1, version: 1, status: 'ACTIVE' }; }
describe('ophthalmology intake contract', () => {
  it('starts without fabricated complaints, history assertions or master selections', () => {
    const initial = initialIntake(context, null);
    expect(initial.affected_eye).toBe('OS'); expect(initial.complaint_configuration_version_id).toBe('');
    expect(initial.duration_value).toBeNull(); expect(initial.no_significant_ophthalmic_history).toBe(false);
    expect(initial.shared_allergy_reviewed).toBe(false); expect(initial.complaint_codes).toEqual([]);
  });
  it('allows an incomplete draft but requires positive duration, options and shared review for completion', () => {
    const draft = { ...initialIntake(context, null), complaint_configuration_version_id: id, emergency_configuration_version_id: id };
    expect(saveIntakeSchema.safeParse(draft).success).toBe(true);
    expect(intakeCompletionIssues(draft, undefined, undefined)).toHaveLength(4);
    const completed = { ...draft, complaint_codes: ['OTHER'], duration_value: 1, duration_unit: 'DAY' as const, onset: 'SUDDEN' as const, shared_medical_history_reviewed: true, shared_allergy_reviewed: true };
    const complaints = configuration('COMPLAINT', { options: [{ code: 'OTHER', label: 'Other', requires_description: true }] });
    const emergency = configuration('CLINICAL_THRESHOLD', { criteria: ['URGENT'] });
    expect(intakeCompletionIssues(completed, complaints, emergency)).toEqual(['Describe Other.']);
    expect(intakeCompletionIssues({ ...completed, description: 'Documented symptom' }, complaints, emergency)).toEqual([]);
  });
  it('rejects contradictory history, orphaned correction details and unexplained emergency criteria', () => {
    const draft = { ...initialIntake(context, null), complaint_configuration_version_id: id, emergency_configuration_version_id: id };
    expect(saveIntakeSchema.safeParse({ ...draft, no_significant_ophthalmic_history: true, long_term_steroid_use: true }).success).toBe(false);
    expect(saveIntakeSchema.safeParse({ ...draft, spectacle_use: { uses: false, age_months: 0, wearing_pattern: null } }).success).toBe(false);
    expect(saveIntakeSchema.safeParse({ ...draft, emergency_criterion_codes: ['OTHER'] }).success).toBe(false);
    expect(saveIntakeSchema.safeParse({ ...draft, duration_value: 0 }).success).toBe(true);
  });
  it('filters inactive options and refuses malformed configuration rather than fabricating choices', () => {
    expect(configuredIntakeOptions(configuration('COMPLAINT', { options: ['pain', { code: 'OLD', active: false }, { code: 'OTHER', requires_description: true }] }), 'options')).toEqual([{ code: 'PAIN', label: 'pain', requiresDescription: false }, { code: 'OTHER', label: 'OTHER', requiresDescription: true }]);
    expect(configuredIntakeOptions(configuration('COMPLAINT', { options: [42] }), 'options')).toEqual([]);
  });
  it('clears confirmed positive eye history while preserving shared review and report references', () => {
    const original = { ...initialIntake(context, null), family_history_codes: ['QA'], spectacle_use: { uses: true, age_months: 12, wearing_pattern: 'QA' }, previous_report_document_ids: [id], shared_allergy_reviewed: true };
    expect(hasPositiveEyeHistory(original)).toBe(true);
    const cleared = clearPositiveEyeHistory(original);
    expect(hasPositiveEyeHistory(cleared)).toBe(false); expect(cleared.no_significant_ophthalmic_history).toBe(true);
    expect(cleared.previous_report_document_ids).toEqual([id]); expect(cleared.shared_allergy_reviewed).toBe(true); expect(original.family_history_codes).toEqual(['QA']);
  });
  it('pre-populates other_urgent_condition_detail from registration warning reason when provided', () => {
    const initial = initialIntake(context, null, 'Chemical splash to left eye reported at reception');
    expect(initial.other_urgent_condition_detail).toBe('Chemical splash to left eye reported at reception');
  });
});