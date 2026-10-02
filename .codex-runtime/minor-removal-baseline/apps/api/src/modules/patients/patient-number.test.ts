import { describe, expect, it, vi } from 'vitest';
import { allocatePatientNumber } from './patient-number.service.js';
import type { PatientRepository } from './patient.repository.js';

describe('patient-number.service', () => {
  it('allocates sequential patient MRN number using PatientRepository', async () => {
    const mockRepo: Partial<PatientRepository> = {
      findLatestPatientNumber: vi.fn().mockResolvedValue('HMS-2026-000005'),
      allocatePatientNumberCounter: vi.fn().mockResolvedValue(6),
    };

    const result = await allocatePatientNumber(mockRepo as PatientRepository);
    expect(result).toBe('HMS-2026-000006');
    expect(mockRepo.findLatestPatientNumber).toHaveBeenCalledWith(2026);
    expect(mockRepo.allocatePatientNumberCounter).toHaveBeenCalledWith('PATIENT_MRN_2026', 5);
  });
});
