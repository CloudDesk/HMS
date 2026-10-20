import { describe, expect, it } from 'vitest';
import { configuredResultFields, unavailableRequiredPaths } from './configured-result-fields';
import { mergeResultEntries, fieldEntryKey, resultFields } from './result-fields';
describe('versioned detailed result field contracts', () => {
  it('adds explicit numeric and choice controls from the profile while rejecting other-eye or unsupported roots', () => {
    const profile = { numeric_ranges: { 'measurements.OD.central_macular_thickness': { min: 0 }, 'measurements.OS.central_macular_thickness': { min: 0 }, 'doctor_approval.status': {} }, allowed_values: { 'measurements.OD.quality': ['QA_GOOD'], 'constructor.bad': ['BAD'] } };
    const fields = configuredResultFields('OCT', 'OD', [], profile);
    expect(fields.map((field) => field.path)).toEqual(['measurements.OD.quality', 'measurements.OD.central_macular_thickness']);
    const values = { [fieldEntryKey('measurements.OD.quality')]: 'QA_GOOD', [fieldEntryKey('measurements.OD.central_macular_thickness')]: '0' };
    expect(mergeResultEntries(fields, values, {}, profile)).toEqual({ measurements: { OD: { quality: 'QA_GOOD', central_macular_thickness: 0 } } });
  });
  it('supports detailed posterior controls only from approved profile paths', () => {
    const fields = configuredResultFields('POSTERIOR_FUNDUS_EXAM', 'OS', resultFields('POSTERIOR_FUNDUS_EXAM', 'OS', {}), { allowed_values: { 'eyes.OS.optic_disc.status': ['QA'] } });
    expect(fields.some((field) => field.path === 'eyes.OS.optic_disc.status')).toBe(true);
    expect(unavailableRequiredPaths(fields, {}, { required_fields: ['eyes.OS.optic_disc', 'untyped_required_field'] })).toEqual(['untyped_required_field']);
  });
  it('cannot author server-derived paediatric age or guardian facts through a profile', () => {
    expect(configuredResultFields('PAEDIATRIC_VISION', 'OU', [], { numeric_ranges: { age_at_assessment_months: {} }, allowed_values: { guardian_recorded: [true] } })).toEqual([]);
  });
  it('renders explicitly configured numeric comparison measurements with their unit labels', () => {
    const profile = { comparison_units: { 'measurements.OD.thickness': 'QA_UNIT', 'measurements.OS.thickness': 'QA_UNIT' } };
    const fields = configuredResultFields('OCT', 'OD', [], profile);
    expect(fields).toEqual([{ path: 'measurements.OD.thickness', label: 'measurements · OD · thickness (QA_UNIT)', kind: 'number' }]);
    expect(mergeResultEntries(fields, { [fieldEntryKey('measurements.OD.thickness')]: '0' }, {}, profile)).toEqual({ measurements: { OD: { thickness: 0 } } });
  });

});
