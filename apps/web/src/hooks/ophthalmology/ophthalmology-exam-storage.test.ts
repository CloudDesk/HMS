import { describe, expect, it } from 'vitest';
import {
  defaultOphthalmicExamState,
  parseOphthalmicExam,
  serializeOphthalmicExam,
  type OphthalmicExamState,
} from './ophthalmology-exam-storage';

describe('ophthalmology-exam-storage', () => {
  it('serializes and parses round-trip correctly', () => {
    const customState: OphthalmicExamState = {
      ...defaultOphthalmicExamState,
      vaOdUnaided: '6/6',
      vaOsUnaided: '6/9',
      iopOd: '14',
      iopOs: '16',
      subjOdSph: '+1.50',
      subjOsSph: '+1.75',
      slitOdCornea: 'Clear',
      slitAntNotes: 'Normal anterior segment',
    };

    const serialized = serializeOphthalmicExam(customState);
    expect(serialized).toContain('<!-- OPHTHALMIC_EXAM_JSON:');
    expect(serialized).toContain('Visual Acuity: OD Unaided=6/6');
    expect(serialized).toContain('IOP (Applanation Tonometry (Goldmann GAT)): OD=14 mmHg, OS=16 mmHg');

    const parsed = parseOphthalmicExam(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.vaOdUnaided).toBe('6/6');
    expect(parsed?.vaOsUnaided).toBe('6/9');
    expect(parsed?.iopOd).toBe('14');
    expect(parsed?.iopOs).toBe('16');
    expect(parsed?.subjOdSph).toBe('+1.50');
    expect(parsed?.slitOdCornea).toBe('Clear');
  });

  it('handles null, undefined, empty and non-matching strings safely', () => {
    expect(parseOphthalmicExam(null)).toBeNull();
    expect(parseOphthalmicExam(undefined)).toBeNull();
    expect(parseOphthalmicExam('')).toBeNull();
    expect(parseOphthalmicExam('Regular doctor notes without exam marker')).toBeNull();
    expect(parseOphthalmicExam('<!-- OPHTHALMIC_EXAM_JSON:invalid-json -->')).toBeNull();
  });
});
