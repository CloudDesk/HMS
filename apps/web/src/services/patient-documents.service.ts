import {
  patientsApi,
  type PatientDocumentListParams,
  type UploadPatientDocumentPayload,
} from '../api/patients';

export const patientDocumentsService = {
  list: (patientId: string, params: PatientDocumentListParams) => patientsApi.documents(patientId, params),
  upload: (patientId: string, payload: UploadPatientDocumentPayload) => patientsApi.uploadDocument(patientId, payload),
  replace: (patientId: string, documentId: string, payload: UploadPatientDocumentPayload) =>
    patientsApi.replaceDocument(patientId, documentId, payload),
  download: (patientId: string, documentId: string) => patientsApi.downloadDocument(patientId, documentId),
  delete: (patientId: string, documentId: string) => patientsApi.deleteDocument(patientId, documentId),
};
