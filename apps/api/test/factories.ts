import mongoose from 'mongoose';

export const createObjectId = () => new mongoose.Types.ObjectId().toHexString();

export const createTestPatient = () => ({
  id: createObjectId(),
  patient_number: `MRN-${Math.floor(Math.random() * 10000)}`,
  first_name: 'Test',
  last_name: 'Patient',
});

export const createTestBranch = () => ({
  id: createObjectId(),
  name: 'Test Branch',
});
