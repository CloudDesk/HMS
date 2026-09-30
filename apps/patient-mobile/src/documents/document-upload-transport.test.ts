import { describe, expect, it, vi } from 'vitest';
import { fetch as xhrFetch } from 'whatwg-fetch';
import { MobileTransport } from '../api/transport';
import { SessionManager } from '../auth/session-manager';
import type { AuthApi } from '../auth/auth-api';
import type { SessionStore } from '../storage/session-store';
import { DocumentsApi } from './documents-api';

vi.mock('whatwg-fetch', () => ({ fetch: vi.fn() }));

describe('Document upload shared multipart transport', () => {
  it.each([
    ['file:///data/user/0/com.hms.mycare/cache/photo.jpg', 'file:///data/user/0/com.hms.mycare/cache/photo.jpg'],
    ['content://media/external/images/media/123', 'content://media/external/images/media/123'],
    ['/data/user/0/com.hms.mycare/cache/photo.jpg', 'file:///data/user/0/com.hms.mycare/cache/photo.jpg'],
  ])('sends Android URI %s through the shared authenticated XHR path', async (uri, expectedUri) => {
    vi.mocked(xhrFetch).mockReset().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: 'doc-1', patient_id: 'patient-1', document_type: 'CLINICAL', title: 'Sample',
      file_name: 'photo.jpg', mime_type: 'image/jpeg', file_size_bytes: 46000,
      source: 'PATIENT', review_status: 'PENDING', created_at: '2026-09-30T00:00:00Z',
    } }), { status: 201 }));
    const jsonFetcher = vi.fn<typeof fetch>();
    const transport = new MobileTransport({ environment: 'production', apiBaseUrl: 'https://api.example.test/api' }, jsonFetcher);
    const manager = new SessionManager({} as AuthApi, {} as SessionStore, transport,
      async () => true, { platform: 'android', appVersion: 'test' });
    vi.spyOn(manager, 'accessToken').mockResolvedValue('test-token');
    // Inspect RN descriptors before Node's FormData can stringify them.
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    try {
      const result = await new DocumentsApi(manager).uploadDocument({
        patientId: 'patient-1', documentType: 'CLINICAL', title: ' Sample ',
        file: { uri, name: ' photo.jpg ', type: 'IMAGE/JPEG' },
      });
      expect(append.mock.calls).toEqual([
        ['patient_id', 'patient-1'], ['document_type', 'CLINICAL'], ['title', 'Sample'],
        ['file', { uri: expectedUri, name: 'photo.jpg', type: 'image/jpeg' }],
      ]);
      expect(xhrFetch).toHaveBeenCalledExactlyOnceWith('https://api.example.test/api/patient-portal/documents/upload',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData),
          headers: { Accept: 'application/json', Authorization: 'Bearer test-token' } }));
      expect(jsonFetcher).not.toHaveBeenCalled();
      expect(result.id).toBe('doc-1');
    } finally { append.mockRestore(); }
  });
});
