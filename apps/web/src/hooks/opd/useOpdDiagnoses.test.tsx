import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ICD10_DIAGNOSES } from '../../data/icd10-diagnoses';
import { diagnosesFromRecord, removeDiagnosisLine, useOpdDiagnoses } from './useOpdDiagnoses';

const diagnosis = ICD10_DIAGNOSES.find((item) => item.code === 'K21.9');
if (!diagnosis) throw new Error('Expected existing catalogue diagnosis');
const knownDiagnosis = diagnosis;

describe('OPD diagnosis persistence', () => {
  it('restores exact picker lines without interpreting narrative mentions as diagnoses', () => {
    const assessment = `Patient denies K21.9.\n${knownDiagnosis.code} - ${knownDiagnosis.name}\nPlan unchanged`;
    expect(diagnosesFromRecord({ assessment })).toEqual([knownDiagnosis]);
    expect(diagnosesFromRecord({ assessment: 'Patient denies K21.9 and reflux symptoms' })).toEqual([]);
  });

  it('removes only the generated line and preserves independent clinical narrative', () => {
    const narrative = 'Discussed reflux history; K21.9 remains in differential notes.';
    const assessment = `${narrative}\n${knownDiagnosis.code} - ${knownDiagnosis.name}\nReview next week`;
    const saved = removeDiagnosisLine(assessment, knownDiagnosis);
    expect(saved).toBe(`${narrative}\nReview next week`);
    expect(diagnosesFromRecord({ assessment: saved })).toEqual([]);
  });

  it('preserves persisted non-catalogue terminology and legacy custom-picker entries', () => {
    expect(diagnosesFromRecord({ assessment: 'DX-1234 - Existing custom assessment', diagnoses: [{ code: 'CUSTOM', display: 'Persisted terminology', codingSystem: 'Approved system', type: 'SECONDARY' }] }).map((item) => item.code)).toEqual(['CUSTOM', 'DX-1234']);
    expect(diagnosesFromRecord(null)).toEqual([]);
  });
});

describe('OPD diagnosis edits', () => {
  let root: Root;
  let container: HTMLDivElement;
  let current: ReturnType<typeof useOpdDiagnoses> | undefined;
  let assessment = '';

  function Harness() {
    const [value, setValue] = useState('Independent narrative');
    assessment = value;
    current = useOpdDiagnoses(null, setValue);
    return null;
  }
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('keeps add/remove chips and saveable assessment consistent across reload', async () => {
    await act(async () => current?.add(knownDiagnosis));
    expect(current?.selected).toEqual([knownDiagnosis]);
    expect(diagnosesFromRecord({ assessment })).toEqual([knownDiagnosis]);
    await act(async () => current?.add(knownDiagnosis));
    expect(current?.selected).toHaveLength(1);
    await act(async () => current?.remove(knownDiagnosis.code));
    expect(current?.selected).toEqual([]);
    expect(assessment).toBe('Independent narrative');
    expect(diagnosesFromRecord({ assessment })).toEqual([]);
  });
});
