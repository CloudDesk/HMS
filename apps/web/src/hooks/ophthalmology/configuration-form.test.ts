import { describe, expect, it } from 'vitest';
import { adminConfigurationSchema } from '../../api/ophthalmology-admin';
import { configurationEditorDefaults, configurationEditorSchema, configurationEditorValues } from './configuration-form';
const id = '111111111111111111111111';
const record = (values: Record<string, unknown>) => adminConfigurationSchema.parse({ id, branch_id: id, code: 'QA', name: 'QA profile', type: 'FORM_PROFILE', description: null, effective_from: null, effective_to: null, revision: 1, status: 'DRAFT', version: 1, values });
describe('structured clinical configuration editor', () => {
  it('preserves opaque and unsupported clinical settings during metadata-only editing', () => {
    const original = record({ form_type: 'VISUAL_ACUITY', schema_version: 'QA', test_codes: ['QA'], vendor: { preserve: true }, allowed_values: { opaque_rule: [{ preserve: true }] } });
    const baseline = configurationEditorDefaults(original);
    expect(configurationEditorValues({ ...baseline, name: 'Renamed' }, original.values, baseline)).toEqual(original.values);
  });
  it('builds typed choice/range rules without clinical defaults or stringifying numeric/boolean choices', () => {
    const defaults = configurationEditorDefaults(record({ form_type: 'VISUAL_ACUITY', schema_version: 'QA', test_codes: ['QA'] }));
    const form = { ...defaults, numeric_ranges: [{ path: 'test_distance.value', min: 0, max: null }], allowed_values: [{ path: 'low_vision.OD.hand_movement', kind: 'BOOLEAN' as const, choices: 'true\nfalse' }], required_fields: 'chart_type\ntest_distance.value' };
    expect(configurationEditorValues(form, { preserve: 1 })).toMatchObject({ preserve: 1, numeric_ranges: { 'test_distance.value': { min: 0 } }, allowed_values: { 'low_vision.OD.hand_movement': [true, false] }, required_fields: ['chart_type', 'test_distance.value'] });
  });
  it('rejects unsafe paths, duplicate paths and inverted numeric bounds', () => {
    const form = configurationEditorDefaults(record({ form_type: 'LENSOMETRY', schema_version: 'QA', test_codes: ['QA'] }));
    expect(configurationEditorSchema.safeParse({ ...form, numeric_ranges: [{ path: '__proto__.bad', min: null, max: null }] }).success).toBe(false);
    const range = { path: 'optical_power.OD.axis', min: 180, max: 0 };
    expect(configurationEditorSchema.safeParse({ ...form, numeric_ranges: [range] }).success).toBe(false);
    expect(configurationEditorSchema.safeParse({ ...form, allowed_values: [{ path: 'method', kind: 'TEXT', choices: 'QA' }, { path: 'method', kind: 'TEXT', choices: 'QA2' }] }).success).toBe(false);
  });
  it('does not seed hospital options into a new master', () => { expect(configurationEditorDefaults(null).entries).toEqual([]); expect(configurationEditorDefaults(null).iop_high).toBeNull(); });
  it('preserves unsupported choices and range metadata when another rule is edited', () => {
    const original = record({ form_type: 'VISUAL_ACUITY', schema_version: 'QA', test_codes: ['QA'], numeric_ranges: { 'test_distance.value': { min: 0, vendor: 'retain' } }, allowed_values: { opaque: [{ retain: true }], chart_type: ['QA'] }, iop_thresholds: { opaque: true } });
    const baseline = configurationEditorDefaults(original);
    const edited = configurationEditorValues({ ...baseline, numeric_ranges: [{ path: 'test_distance.value', min: 1, max: null }], allowed_values: [{ path: 'chart_type', kind: 'TEXT', choices: 'QA2' }] }, original.values, baseline);
    expect(edited).toMatchObject({ numeric_ranges: { 'test_distance.value': { min: 1, vendor: 'retain' } }, allowed_values: { opaque: [{ retain: true }], chart_type: ['QA2'] }, iop_thresholds: { opaque: true } });
  });
  it('roundtrips explicit comparison units without seeding or overwriting unrelated profile metadata', () => {
    const original = record({ form_type: 'VISUAL_FIELD', schema_version: 'QA', test_codes: ['QA'], vendor: { retain: true }, comparison_units: { 'result_indices.mean_deviation': 'QA_UNIT' } });
    const baseline = configurationEditorDefaults(original);
    expect(baseline.comparison_units).toEqual([{ path: 'result_indices.mean_deviation', unit: 'QA_UNIT' }]);
    expect(configurationEditorValues({ ...baseline, comparison_units: [{ path: 'result_indices.mean_deviation', unit: 'QA_OTHER' }] }, original.values, baseline)).toMatchObject({ vendor: { retain: true }, comparison_units: { 'result_indices.mean_deviation': 'QA_OTHER' } });
    expect(configurationEditorDefaults(null).comparison_units).toEqual([]);
    expect(configurationEditorSchema.safeParse({ ...baseline, comparison_units: [{ path: 'result_indices.mean_deviation', unit: '' }] }).success).toBe(false);
  });

});
