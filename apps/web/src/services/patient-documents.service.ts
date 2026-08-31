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
  review: (
    patientId: string,
    documentId: string,
    payload: { review_status: 'VERIFIED' | 'REJECTED'; review_notes?: string | null },
  ) => patientsApi.reviewDocument(patientId, documentId, payload),
  delete: (patientId: string, documentId: string) => patientsApi.deleteDocument(patientId, documentId),
};
