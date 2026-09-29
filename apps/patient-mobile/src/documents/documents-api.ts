import type { SessionManager } from '../auth/session-manager';
import {
  portalDocumentSchema,
  portalDocumentsListResponseSchema,
  type PortalDocument,
  type PortalDocumentsListResponse,
  type UploadDocumentInput,
} from './contracts';

export function normalizeDocumentUpload(file: {
  uri: string;
  name?: string;
  type?: string;
}): { uri: string; name: string; type: string } {
  let uri = file.uri.trim();

  // Ensure local file paths have valid scheme prefix so React Native networking can resolve it
  if (
    !uri.startsWith('file://') &&
    !uri.startsWith('content://') &&
    !uri.startsWith('http://') &&
    !uri.startsWith('https://')
  ) {
    uri = `file://${uri}`;
  }

  // Derive and normalize MIME type
  let mimeType = file.type?.trim().toLowerCase();
  const cleanPath = (uri.split('?')[0] ?? '').split('#')[0] ?? '';
  const ext = cleanPath.split('.').pop()?.toLowerCase();

  if (!mimeType || mimeType === 'application/octet-stream' || !mimeType.includes('/')) {
    if (ext === 'pdf') {
      mimeType = 'application/pdf';
    } else if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'heic') {
      mimeType = 'image/heic';
    } else if (ext === 'heif') {
      mimeType = 'image/heif';
    } else {
      mimeType = 'application/pdf';
    }
  } else if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }

  // Derive and normalize file name with matching extension
  let fileName = file.name?.trim();
  const fileExtension =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/heic'
      ? 'heic'
      : mimeType === 'image/heif'
      ? 'heif'
      : 'jpg';

  if (!fileName) {
    fileName = `document-${Date.now()}.${fileExtension}`;
  } else if (!fileName.includes('.')) {
    fileName = `${fileName}.${fileExtension}`;
  }

  return { uri, name: fileName, type: mimeType };
}

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

  async uploadDocument(input: UploadDocumentInput): Promise<PortalDocument> {
    const normalized = normalizeDocumentUpload(input.file);
    const formData = new FormData();

    formData.append('patient_id', input.patientId);
    formData.append('document_type', input.documentType);
    formData.append('title', input.title.trim());
    formData.append('file', {
      uri: normalized.uri,
      name: normalized.name,
      type: normalized.type,
    } as unknown as Blob);

    if (input.providerName?.trim()) {
      formData.append('provider_name', input.providerName.trim());
    }
    if (input.documentDate?.trim()) {
      formData.append('document_date', input.documentDate.trim());
    }
    if (input.description?.trim()) {
      formData.append('description', input.description.trim());
    }

    return this.sessionManager.authenticatedMultipartRequest(
      '/patient-portal/documents/upload',
      portalDocumentSchema,
      formData
    );
  }

  getDownloadEndpoint(patientId: string, documentId: string): string {
    return `/patient-portal/patients/${encodeURIComponent(
      patientId
    )}/documents/${encodeURIComponent(documentId)}/download`;
  }
}
