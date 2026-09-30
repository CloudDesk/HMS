import type { SessionManager } from '../auth/session-manager';
import { normalizeImageUpload } from '../portal/portal-api';
import { ApiFailure } from '../api/errors';
import { readPublicConfig } from '../config/config';
import { DocumentsApi } from '../documents/documents-api';
import {
  consentDocumentRawSchema,
  consentDocumentsListResponseSchema,
  mapDocumentsToConsentItems,
  type ConsentDocumentRaw,
  type ConsentItem,
} from './contracts';

export class ConsentsApi {
  constructor(private readonly sessionManager: SessionManager, private readonly fetcher: typeof fetch = fetch) {}

  async getDocumentSource(patientId: string, documentId: string) {
    const token = await this.sessionManager.accessToken();
    if (!token) throw new ApiFailure('auth');
    const endpoint = new DocumentsApi(this.sessionManager).getDownloadEndpoint(patientId, documentId);
    return {
      uri: `${readPublicConfig().apiBaseUrl}${endpoint}`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  async getFormHtml(patientId: string, documentId: string, signal: AbortSignal): Promise<string> {
    const source = await this.getDocumentSource(patientId, documentId);
    const response = await this.fetcher(source.uri, {
      headers: source.headers, credentials: 'omit', signal,
    });
    if (!response.ok) {
      throw new ApiFailure(response.status === 401 || response.status === 403 ? 'auth' : 'server', response.status);
    }
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      throw new Error('This consent form is not an HTML document. Please review it in Patient Portal.');
    }
    return response.text();
  }

  async listConsents(patientId: string): Promise<ConsentItem[]> {
    const documents: ConsentDocumentRaw[] = [];
    let page = 1;
    while (true) {
      const response = await this.sessionManager.authenticatedRequest(
        '/patient-portal/documents',
        consentDocumentsListResponseSchema,
        { query: { patient_id: patientId, page, limit: 100 } },
      );

      documents.push(...response.data);
      if (!response.data.length || page * response.meta.limit >= response.meta.total) break;
      page += 1;
    }
    return mapDocumentsToConsentItems(documents);
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
