import { describe, expect, it } from 'vitest';
import { comparisonUnitsSchema, resultComparisonProblem } from './ophthalmology-result-comparison.js';

const vf = { form_type: 'VISUAL_FIELD', form_schema_version: 'QA', payload: { eye: 'OD', machine: 'QA_DEVICE', program: 'QA_PROGRAM', strategy: 'QA_STRATEGY', result_indices: { mean_deviation: 1 } } };
const units = { comparison_units: { 'result_indices.mean_deviation': 'QA_UNIT' } };
describe('explicit prior-result comparison compatibility', () => {
  it('requires explicit matching units, numeric measurements and matching schema/protocol/eye', () => {
    expect(resultComparisonProblem(vf, vf, units, units)).toBeNull();
    expect(resultComparisonProblem(vf, vf, {}, units)).toBe('UNITS_NOT_CONFIGURED');
    expect(resultComparisonProblem(vf, vf, units, { comparison_units: { 'result_indices.mean_deviation': 'OTHER_UNIT' } })).toBe('UNITS_MISMATCH');
    expect(resultComparisonProblem(vf, { ...vf, form_schema_version: 'OTHER' }, units, units)).toBe('FORM_SCHEMA_MISMATCH');
    expect(resultComparisonProblem(vf, { ...vf, payload: { ...vf.payload, eye: 'OU' } }, units, units)).toBe('EYE_MISMATCH');
    expect(resultComparisonProblem(vf, { ...vf, payload: { ...vf.payload, strategy: 'OTHER' } }, units, units)).toBe('PROTOCOL_MISMATCH');
    expect(resultComparisonProblem(vf, { ...vf, payload: { ...vf.payload, result_indices: { mean_deviation: '1' } } }, units, units)).toBe('MEASUREMENTS_MISSING');
  });
  it('compares OCT type and scan sets without relying on array order or converting units', () => {
    const oct = { form_type: 'OCT', form_schema_version: 'QA', payload: { eye: 'OS', oct_type: 'QA_TYPE', requested_scans: ['QA_A', 'QA_B'], measurements: { OS: { thickness: 1 } } } };
    const profile = { comparison_units: { 'measurements.OS.thickness': 'QA_UNIT' } };
    expect(resultComparisonProblem(oct, { ...oct, payload: { ...oct.payload, requested_scans: ['QA_B', 'QA_A'] } }, profile, profile)).toBeNull();
    expect(resultComparisonProblem(oct, { ...oct, payload: { ...oct.payload, requested_scans: ['QA_A'] } }, profile, profile)).toBe('PROTOCOL_MISMATCH');
    expect(resultComparisonProblem(oct, oct, { comparison_units: { 'unrelated.value': 'QA_UNIT' } }, { comparison_units: { 'unrelated.value': 'QA_UNIT' } })).toBe('MEASUREMENTS_MISSING');
  });
  it('rejects unsafe paths, blank units and unbounded unit maps', () => {
    expect(comparisonUnitsSchema.safeParse({ 'measurements.constructor.bad': 'QA' }).success).toBe(false);
    expect(comparisonUnitsSchema.safeParse({ 'measurements..bad': 'QA' }).success).toBe(false);
    expect(comparisonUnitsSchema.safeParse({ 'measurements.OD.value': ' ' }).success).toBe(false);
    expect(comparisonUnitsSchema.safeParse(Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`measurements.n${i}`, 'QA']))).success).toBe(false);
  });
});
