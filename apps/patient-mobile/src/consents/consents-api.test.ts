import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { ConsentsApi } from './consents-api';

describe('ConsentsApi', () => {
  it('listConsents queries patient documents and returns mapped consent items', async () => {
    const mockDocs = {
      data: [
        {
          id: 'consent-1',
          patient_id: 'pat-1',
          document_type: 'CONSENT',
          title: 'General Admission Consent',
          file_name: 'admission.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 50000,
          source: 'HOSPITAL',
          review_status: 'NOT_REQUIRED',
          created_at: '2026-09-24T00:00:00.000Z',
        },
        {
          id: 'sig-1',
          patient_id: 'pat-1',
          document_type: 'CONSENT',
          title: 'Signature for General Admission Consent',
          file_name: 'sig.png',
          mime_type: 'image/png',
          file_size_bytes: 20000,
          source: 'PATIENT',
          review_status: 'NOT_REQUIRED',
          context_id: 'consent-1',
          consent_kind: 'PATIENT_SIGNATURE',
          created_at: '2026-09-24T01:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 1,
      },
    };

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(mockDocs),
    } as unknown as SessionManager;

    const api = new ConsentsApi(mockSessionManager);
    const result = await api.listConsents('pat-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('General Admission Consent');
    expect(result[0]?.is_signed).toBe(true);
    expect(result[0]?.signature_document_id).toBe('sig-1');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/documents',
      expect.anything(),
      {
        query: {
          patient_id: 'pat-1',
          page: 1,
          limit: 100,
        },
      }
    );
  });

  it('uploadConsentSignature sends multipart payload to /patient-portal/consent-signature', async () => {
    const mockUploadedDoc = {
      id: 'sig-100',
      patient_id: 'pat-1',
      document_type: 'CONSENT',
      title: 'Signature for Admission Form',
      file_name: 'sig.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 30000,
      source: 'PATIENT',
      review_status: 'NOT_REQUIRED',
      context_id: 'consent-1',
      consent_kind: 'PATIENT_SIGNATURE',
      consent_status: 'SIGNED',
      created_at: '2026-09-28T00:00:00.000Z',
    };

    const mockSessionManager = {
      authenticatedMultipartRequest: vi.fn().mockResolvedValue(mockUploadedDoc),
    } as unknown as SessionManager;

    const api = new ConsentsApi(mockSessionManager);
    const result = await api.uploadConsentSignature('pat-1', 'consent-1', {
      uri: 'file:///path/to/signature.jpg',
      name: 'signature.jpg',
      type: 'image/jpeg',
    });

    expect(result.id).toBe('sig-100');
    expect(mockSessionManager.authenticatedMultipartRequest).toHaveBeenCalledWith(
      '/patient-portal/consent-signature',
      expect.anything(),
      expect.any(FormData)
    );
  });
});
