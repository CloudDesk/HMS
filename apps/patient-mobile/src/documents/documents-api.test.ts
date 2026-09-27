import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { DocumentsApi } from './documents-api';

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
});
