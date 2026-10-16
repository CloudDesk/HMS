import { describe, expect, it } from 'vitest';
import { resultAcquisitions, removeAcquisition } from './result-acquisitions';
import { entryValues, fieldEntryKey, mergeResultEntries, resultReferenceFields } from './result-fields';

describe('contracted result acquisition rows', () => {
  it('retains all saved dilation rows and scopes new eyes to the task', () => {
    const payload = { dilation_medications: [{ drug: 'QA', dose: 'QA', laterality: 'OS', instilled_at: '2026-10-16T00:00:00Z', vendor: 'preserve' }] };
    const { fields } = resultAcquisitions('POSTERIOR_FUNDUS_EXAM', 'OS', payload, { dilation_medications: 1 });
    expect(fields).toHaveLength(10);
    expect(fields.find((field) => field.path === 'dilation_medications.1.laterality')?.options).toEqual(['OS']);
    const entries = { ...entryValues(fields, payload), [fieldEntryKey('dilation_medications.1.drug')]: 'QA2' };
    expect(mergeResultEntries(fields, entries, payload, {})).toEqual({ dilation_medications: [payload.dilation_medications[0], { drug: 'QA2' }] });
  });
  it('removes only the selected acquisition while preserving unknown source data', () => {
    const payload = { calculations: { OD: [{ formula: 'QA', vendor: 1 }, { formula: 'QA2', vendor: 2 }] }, source: { retained: true } };
    expect(removeAcquisition(payload, 'calculations.OD', 0)).toEqual({ calculations: { OD: [payload.calculations.OD[1]] }, source: payload.source });
    expect(payload.calculations.OD).toHaveLength(2);
    expect(() => removeAcquisition(payload, '__proto__.bad', 0)).toThrow();
  });
  it('edits and clears multiple document references without truncating other structured findings', () => {
    const id = '111111111111111111111111'; const second = '222222222222222222222222';
    const fields = resultReferenceFields('OCT', 'OS'); const images = fields.filter((field) => field.path === 'image_document_ids');
    const original = { image_document_ids: [id, second], measurements: { OS: { preserved: true } } };
    const entries = entryValues(images, original);
    expect(mergeResultEntries(images, entries, original, {})).toEqual(original);
    expect(mergeResultEntries(images, { [fieldEntryKey('image_document_ids')]: '[]' }, original, {})).toEqual({ ...original, image_document_ids: [] });
  });
  it('removes cleared code positions in descending order without deleting retained codes', () => {
    const payload = { conclusion_codes: ['QA1', 'QA2', 'QA3'] };
    const { fields } = resultAcquisitions('VISUAL_ACUITY', 'OD', payload);
    const entries = entryValues(fields, payload); entries[fieldEntryKey('conclusion_codes.0')] = ''; entries[fieldEntryKey('conclusion_codes.1')] = '';
    expect(mergeResultEntries(fields, entries, payload, {})).toEqual({ conclusion_codes: ['QA3'] });
  });
  it('adds independent photo sets and IOL calculations without seeding measurements or options', () => {
    const sets = resultAcquisitions('FUNDUS_PHOTOGRAPHY', 'OU', {}, { image_sets: 1 });
    expect(sets.fields.filter((field) => field.path.endsWith('.eye'))).toHaveLength(2);
    const calculations = resultAcquisitions('BIOMETRY_IOL', 'OS', {}, { 'calculations.OS': 2 });
    expect(calculations.fields).toHaveLength(8);
    expect(calculations.fields.some((field) => field.path.includes('OD'))).toBe(false);
    expect(Object.values(entryValues(calculations.fields, {})).every((value) => value === '')).toBe(true);
  });
});
