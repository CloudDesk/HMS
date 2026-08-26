import { patientsApi, type SavePatientPayload } from '../api/patients';

export const patientRegistrationService = {
  create: (payload: SavePatientPayload) => patientsApi.create(payload),
};
