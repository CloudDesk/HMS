import { describe, expect, it } from 'vitest';
import { coreFormSchema, testFormSchema } from '../../api/ophthalmology';
import { coreResultFields, resultFields, entryValues, fieldEntryKey, deriveResultValues, mergeResultEntries, profileForm, type ResultField } from './result-fields';
describe('structured ophthalmology result editing', () => {
  it('removes a cleared image reference without inserting null or losing other images', () => {
    const original = { images: ['111111111111111111111111', '222222222222222222222222'] };
    expect(mergeResultEntries([{ path: 'images.0', label: 'Image', kind: 'reference', referenceType: 'DOCUMENT' }], { [fieldEntryKey('images.0')]: '' }, original, {})).toEqual({ images: ['222222222222222222222222'] });
    expect(original.images).toHaveLength(2);
  });
  it('provides controls for all eight core forms and limits measurement controls to the task eye', () => {
    for (const type of coreFormSchema.options) {
      const fields = coreResultFields(type, 'OD', {});
      expect(fields.length).toBeGreaterThan(0); expect(fields.some((field) => field.path.includes('.OS.'))).toBe(false);
    }
    expect(coreResultFields('LENSOMETRY', 'OU', {}).some((field) => field.path === 'optical_power.OS.axis')).toBe(true);
  });
  it('maps explicit fields in all 21 contracted form families without inserting clinical defaults', () => {
    for (const type of testFormSchema.options) {
      const fields = resultFields(type, 'OS', {});
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((field) => field.path.includes('.OD.'))).toBe(false);
      expect(Object.values(entryValues(fields, {})).every((value) => value === '')).toBe(true);
    }
  });
  it('preserves unknown structured data and distinguishes zero, false and blank', () => {
    const fields: ResultField[] = [{ path: 'optical_power.OD.sphere', label: 'Sphere', kind: 'number' }, { path: 'comfortable', label: 'Comfort', kind: 'boolean' }, { path: 'condition_notes', label: 'Notes', kind: 'text' }];
    const original = { optical_power: { OD: { sphere: -2, cylinder: -1 } }, comfortable: true, condition_notes: 'Old', optical_centre_pd: { OD: { custom: 31 } } };
    const edited = mergeResultEntries(fields, { [fieldEntryKey('optical_power.OD.sphere')]: '0', [fieldEntryKey('comfortable')]: 'false', [fieldEntryKey('condition_notes')]: '' }, original, {});
    expect(edited).toEqual({ ...original, optical_power: { OD: { sphere: 0, cylinder: -1 } }, comfortable: false, condition_notes: null });
    expect(original.optical_power.OD.sphere).toBe(-2);
  });
  it('retains every existing source reading when editing a selected value', () => {
    const original = { readings: { OD: [10, 12, 14] }, selected_reading_index: { OD: 2 }, final_iop: { OD: 14 } };
    const fields = coreResultFields('INTRAOCULAR_PRESSURE', 'OD', original);
    const entries = entryValues(fields, original);
    entries[fieldEntryKey('readings.OD.1')] = '13';
    expect(mergeResultEntries(fields, entries, original, {})).toEqual({ ...original, readings: { OD: [10, 13, 14] } });
  });
  it('enforces axis and configured ranges/options without imposing invented ranges', () => {
    const fields: ResultField[] = [{ path: 'power.OD.axis', label: 'Axis', kind: 'number' }];
    expect(() => mergeResultEntries(fields, { [fieldEntryKey('power.OD.axis')]: '181' }, {}, {})).toThrow('between 0 and 180');
    expect(() => mergeResultEntries(fields, { [fieldEntryKey('power.OD.axis')]: '90' }, {}, { numeric_ranges: { 'power.OD.axis': { max: 80 } } })).toThrow('configured range');
    expect(() => mergeResultEntries([{ path: 'method', label: 'Method', kind: 'choice' }], { [fieldEntryKey('method')]: 'UNKNOWN' }, {}, {})).toThrow('configured option');
    expect(profileForm({ form_type: 'LENSOMETRY', schema_version: 'hospital-1', test_codes: ['LENS'] }, 'IOP')).toBeNull();
  });
  it('refuses to overwrite a structured value with a scalar and blocks prototype keys', () => {
    expect(() => mergeResultEntries([{ path: 'eyes.OD', label: 'Eye', kind: 'text' }], { [fieldEntryKey('eyes.OD')]: 'replace' }, { eyes: { OD: { preserved: true } } }, {})).toThrow('structured value');
    expect(() => mergeResultEntries([{ path: '__proto__.polluted', label: 'Invalid', kind: 'text' }], { [fieldEntryKey('__proto__.polluted')]: 'yes' }, {}, {})).toThrow('Invalid form path');
  });
  it('keeps an unavailable structured control intact while saving another field', () => {
    const fields: ResultField[] = [{ path: 'bcva.OD', label: 'BCVA', kind: 'choice' }, { path: 'impression', label: 'Impression', kind: 'text' }];
    const original = { bcva: { OD: { value: 'QA structured value' } }, impression: 'Before' };
    const entries = { ...entryValues(fields, original), [fieldEntryKey('impression')]: 'After' };
    expect(mergeResultEntries(fields, entries, original, {})).toEqual({ ...original, impression: 'After' });
  });
  it('adds source-reading controls without changing the keys of later measurements', () => {
    const original = { readings: { OD: [10] }, final_iop: { OD: 10 } };
    const fields = resultFields('INTRAOCULAR_PRESSURE', 'OD', original, { OD: 1 });
    const entries = { ...entryValues(fields, original), [fieldEntryKey('readings.OD.1')]: '12', [fieldEntryKey('selected_reading_index.OD')]: '1' };
    const edited = deriveResultValues('INTRAOCULAR_PRESSURE', mergeResultEntries(fields, entries, original, {}));
    expect(edited).toMatchObject({ readings: { OD: [10, 12] }, selected_reading_index: { OD: 1 }, final_iop: { OD: 12 } });
    expect(original.readings.OD).toEqual([10]);
  });
  it('derives verified calculations independently per eye without assigning default observations', () => {
    expect(deriveResultValues('AUTOREFRACTION_KERATOMETRY', { readings: { OS: [{ sphere: -2, cylinder: -1 }] }, selected_reading_index: { OS: 0 } })).toMatchObject({ spherical_equivalent: { OS: -2.5 } });
    expect(deriveResultValues('PACHYMETRY', { repeat_readings: { OD: [500, 502], OS: [510, 514] } })).toMatchObject({ average_thickness: { OD: 501, OS: 512 } });
    expect(deriveResultValues('COLOUR_VISION', { plates_shown: 4, correct: 3, incorrect: 1 }).score_percent).toBe(75);
    expect(deriveResultValues('CORNEAL_TOPOGRAPHY', { keratometry: { OD: { k1: 40, k2: 42 } } })).toMatchObject({ keratometry: { OD: { average_k: 41, corneal_astigmatism: 2 } } });
    expect(deriveResultValues('INTRAOCULAR_PRESSURE', {})).toEqual({});
  });
});
