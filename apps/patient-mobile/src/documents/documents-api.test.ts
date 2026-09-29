import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { DocumentsApi, normalizeDocumentUpload } from './documents-api';
import type { UploadDocumentInput } from './contracts';

describe('normalizeDocumentUpload', () => {
  it('adds file:// prefix to raw path without scheme', () => {
    const result = normalizeDocumentUpload({
      uri: '/data/user/0/documents/doc.pdf',
    });
    expect(result.uri).toBe('file:///data/user/0/documents/doc.pdf');
    expect(result.name).toMatch(/^document-\d+\.pdf$/);
    expect(result.type).toBe('application/pdf');
  });

  it('preserves existing content:// and file:// schemes', () => {
    const contentResult = normalizeDocumentUpload({
      uri: 'content://media/external/images/media/1234',
      type: 'image/png',
      name: 'scan.png',
    });
    expect(contentResult.uri).toBe('content://media/external/images/media/1234');
    expect(contentResult.name).toBe('scan.png');
    expect(contentResult.type).toBe('image/png');

    const fileResult = normalizeDocumentUpload({
      uri: 'file:///var/mobile/Containers/Data/doc.pdf',
      name: 'report.pdf',
    });
    expect(fileResult.uri).toBe('file:///var/mobile/Containers/Data/doc.pdf');
    expect(fileResult.name).toBe('report.pdf');
    expect(fileResult.type).toBe('application/pdf');
  });

  it('infers MIME type from extension when MIME is missing or generic', () => {
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.png' }).type).toBe('image/png');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.jpg' }).type).toBe('image/jpeg');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.jpeg' }).type).toBe('image/jpeg');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.webp' }).type).toBe('image/webp');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.heic' }).type).toBe('image/heic');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.pdf' }).type).toBe('application/pdf');
    expect(normalizeDocumentUpload({ uri: 'file:///path/file.unknown' }).type).toBe('application/pdf');
  });

  it('normalizes image/jpg to image/jpeg', () => {
    const result = normalizeDocumentUpload({
      uri: 'file:///path/file.jpg',
      type: 'image/jpg',
    });
    expect(result.type).toBe('image/jpeg');
  });

  it('appends correct extension if name is provided without extension', () => {
    const result = normalizeDocumentUpload({
      uri: 'file:///path/my_report',
      type: 'application/pdf',
      name: 'my_report',
    });
    expect(result.name).toBe('my_report.pdf');
  });
});

describe('DocumentsApi', () => {
  const sampleResponse = {
    data: [
      {
        id: 'doc-001',
        patient_id: 'pat-123',
        document_type: 'CLINICAL',
        title: 'MRI Brain Scan Report',
        file_name: 'mri_scan.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 2097152,
        description: 'Brain scan report',
        source: 'HOSPITAL',
        review_status: 'VERIFIED',
        document_date: '2026-09-18',
        provider_name: 'HMS Diagnostics',
        created_at: '2026-09-18T12:00:00.000Z',
      },
    ],
    meta: {
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    },
  };

  it('listDocuments fetches and validates documents for a given patient', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleResponse),
    } as unknown as SessionManager;

    const api = new DocumentsApi(mockSessionManager);
    const result = await api.listDocuments('pat-123');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('MRI Brain Scan Report');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/documents',
      expect.anything(),
      {
        query: {
          patient_id: 'pat-123',
          page: '1',
          limit: '100',
        },
      }
    );
  });

  it('getDownloadEndpoint constructs the correct download path', () => {
    const mockSessionManager = {} as unknown as SessionManager;
    const api = new DocumentsApi(mockSessionManager);
    const endpoint = api.getDownloadEndpoint('pat-123', 'doc-999');

    expect(endpoint).toBe(
      '/patient-portal/patients/pat-123/documents/doc-999/download'
    );
  });

  it('throws error when response schema does not match', async () => {
    const invalidResponse = {
      data: [{ id: 'doc-1' }], // missing required fields
    };

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(invalidResponse),
    } as unknown as SessionManager;

    const api = new DocumentsApi(mockSessionManager);
    await expect(api.listDocuments('pat-123')).rejects.toThrow();
  });

  describe('uploadDocument', () => {
    const mockUploadedDocument = {
      id: 'doc-uploaded-123',
      patient_id: 'pat-123',
      document_type: 'CLINICAL',
      title: 'Discharge Summary',
      file_name: 'discharge.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 102400,
      description: 'Previous hospital summary',
      source: 'PATIENT',
      review_status: 'PENDING',
      document_date: '2026-09-20',
      provider_name: 'City General Hospital',
      created_at: '2026-09-20T10:00:00.000Z',
    };

    it('submits multipart request with all fields and returns parsed document', async () => {
      const mockSessionManager = {
        authenticatedMultipartRequest: vi.fn().mockResolvedValue(mockUploadedDocument),
      } as unknown as SessionManager;

      const api = new DocumentsApi(mockSessionManager);
      const input: UploadDocumentInput = {
        patientId: 'pat-123',
        documentType: 'CLINICAL',
        title: 'Discharge Summary',
        file: {
          uri: 'file:///path/to/discharge.pdf',
          name: 'discharge.pdf',
          type: 'application/pdf',
        },
        providerName: 'City General Hospital',
        documentDate: '2026-09-20',
        description: 'Previous hospital summary',
      };

      const result = await api.uploadDocument(input);

      expect(result).toEqual(mockUploadedDocument);
      expect(mockSessionManager.authenticatedMultipartRequest).toHaveBeenCalledTimes(1);

      const [path, schema, formData] = (
        mockSessionManager.authenticatedMultipartRequest as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [string, unknown, FormData];

      expect(path).toBe('/patient-portal/documents/upload');
      expect(schema).toBeDefined();
      expect(formData).toBeInstanceOf(FormData);
    });

    it('handles upload without optional fields correctly', async () => {
      const mockSessionManager = {
        authenticatedMultipartRequest: vi.fn().mockResolvedValue(mockUploadedDocument),
      } as unknown as SessionManager;

      const api = new DocumentsApi(mockSessionManager);
      const input: UploadDocumentInput = {
        patientId: 'pat-123',
        documentType: 'INSURANCE',
        title: 'Insurance Card Front',
        file: {
          uri: '/path/to/card.jpg',
        },
      };

      const result = await api.uploadDocument(input);
      expect(result.id).toBe('doc-uploaded-123');
      expect(mockSessionManager.authenticatedMultipartRequest).toHaveBeenCalledWith(
        '/patient-portal/documents/upload',
        expect.anything(),
        expect.any(FormData)
      );
    });

    it('rejects when authenticatedMultipartRequest throws an error', async () => {
      const mockSessionManager = {
        authenticatedMultipartRequest: vi.fn().mockRejectedValue(new Error('Network upload failed')),
      } as unknown as SessionManager;

      const api = new DocumentsApi(mockSessionManager);
      const input: UploadDocumentInput = {
        patientId: 'pat-123',
        documentType: 'OTHER',
        title: 'ID Proof',
        file: { uri: 'file:///path/id.png' },
      };

      await expect(api.uploadDocument(input)).rejects.toThrow('Network upload failed');
    });
  });
});
