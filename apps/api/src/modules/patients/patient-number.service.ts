import { PatientRepository } from './patient.repository.js';

const sequenceFromPatientNumber = (patientNumber: string | undefined) => {
  const match = patientNumber?.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

export const allocatePatientNumber = async (patientRepository: PatientRepository = new PatientRepository()) => {
  const year = new Date().getFullYear();
  const key = `PATIENT_MRN_${year}`;
  const latestPatientNumber = await patientRepository.findLatestPatientNumber(year);
  const existingMaximum = sequenceFromPatientNumber(latestPatientNumber);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const value = await patientRepository.allocatePatientNumberCounter(key, existingMaximum);
      return `HMS-${year}-${String(value).padStart(6, '0')}`;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new Error('Unable to allocate a patient number');
};
