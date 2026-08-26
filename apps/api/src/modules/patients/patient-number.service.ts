import { PatientModel } from './patient.model.js';
import { PatientNumberSequenceModel } from './patient-number.model.js';

const sequenceFromPatientNumber = (patientNumber: string | undefined) => {
  const match = patientNumber?.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

export const allocatePatientNumber = async () => {
  const year = new Date().getFullYear();
  const key = `PATIENT_MRN_${year}`;
  const latest = await PatientModel.findOne({ patientNumber: new RegExp(`^HMS-${year}-\\d+$`) })
    .select('patientNumber')
    .sort({ patientNumber: -1 })
    .lean();
  const existingMaximum = sequenceFromPatientNumber(latest?.patientNumber);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await PatientNumberSequenceModel.findOneAndUpdate(
        { key },
        [{ $set: { value: { $add: [{ $ifNull: ['$value', existingMaximum] }, 1] } } }],
        { upsert: true, new: true, updatePipeline: true },
      ).lean();
      return `HMS-${year}-${String(counter!.value).padStart(6, '0')}`;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new Error('Unable to allocate a patient number');
};
