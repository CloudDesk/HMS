import type { SessionManager } from '../auth/session-manager';
import {
  portalDocumentsListResponseSchema,
  type PortalDocumentsListResponse,
} from './contracts';

export class DocumentsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async listDocuments(
    patientId: string,
    page = 1,
    limit = 100
  ): Promise<PortalDocumentsListResponse> {
    const response = await this.sessionManager.authenticatedRequest(
      '/patient-portal/documents',
      portalDocumentsListResponseSchema,
      {
        query: {
          patient_id: patientId,
          page: String(page),
          limit: String(limit),
        },
      }
    );

    return portalDocumentsListResponseSchema.parse(response);
  }

  getDownloadEndpoint(patientId: string, documentId: string): string {
    return `/patient-portal/patients/${encodeURIComponent(
      patientId
    )}/documents/${encodeURIComponent(documentId)}/download`;
  }
}
