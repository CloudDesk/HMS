import type { SessionManager } from '../auth/session-manager';
import { normalizeImageUpload } from '../portal/portal-api';
import {
  consentDocumentRawSchema,
  consentDocumentsListResponseSchema,
  mapDocumentsToConsentItems,
  type ConsentDocumentRaw,
  type ConsentItem,
} from './contracts';

export class ConsentsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async listConsents(patientId: string): Promise<ConsentItem[]> {
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/documents',
      consentDocumentsListResponseSchema,
      {
        query: {
          patient_id: patientId,
          page: 1,
          limit: 100,
        },
      }
    );

    return mapDocumentsToConsentItems(response.data);
  }

  async uploadConsentSignature(
    patientId: string,
    consentDocumentId: string,
    file: { uri: string; name?: string; type?: string }
  ): Promise<ConsentDocumentRaw> {
    const normalized = normalizeImageUpload(file);
    const formData = new FormData();

    formData.append('patient_id', patientId);
    formData.append('consent_document_id', consentDocumentId);
    formData.append('file', {
      uri: normalized.uri,
      name: normalized.name,
      type: normalized.type,
    } as unknown as Blob);

    return this.sessionManager.authenticatedMultipartRequest(
      '/patient-portal/consent-signature',
      consentDocumentRawSchema,
      formData
    );
  }
}
