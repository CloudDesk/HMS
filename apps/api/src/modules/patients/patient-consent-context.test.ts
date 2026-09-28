import { describe, expect, it } from 'vitest';
import { normalizeConsentContextType } from './patient.routes.js';

describe('patient consent context normalization', () => {
  it.each([
    ['PATIENT', null, null, 'PATIENT'],
    ['ADMISSION', 'admission-id', null, 'INPATIENT_ADMISSION'],
    ['INPATIENT_ADMISSION', 'admission-id', null, 'INPATIENT_ADMISSION'],
    ['PROCEDURE', null, 'procedure-id', 'PROCEDURE_BOOKING'],
    ['PROCEDURE_BOOKING', null, 'procedure-id', 'PROCEDURE_BOOKING'],
    [null, null, null, 'PATIENT'],
  ] as const)(
    'maps %s to the stored context %s',
    (value, admissionId, procedureId, expected) => {
      expect(normalizeConsentContextType(value, admissionId, procedureId)).toBe(expected);
    },
  );
});
