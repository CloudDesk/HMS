import { describe, expect, it, vi } from 'vitest';
import { fetch as xhrFetch } from 'whatwg-fetch';
import { MobileTransport } from '../api/transport';
import { SessionManager } from '../auth/session-manager';
import type { AuthApi } from '../auth/auth-api';
import type { SessionStore } from '../storage/session-store';
import { ConsentsApi } from './consents-api';

vi.mock('whatwg-fetch', () => ({ fetch: vi.fn() }));

describe('Consent signature shared transport', () => {
  it('sends all native multipart fields through SessionManager and the existing XHR upload transport', async () => {
    const response = { id: 'sig-1', patient_id: 'patient-1', document_type: 'CONSENT', title: 'Signature',
      file_name: 'signature.png', mime_type: 'image/png', file_size_bytes: 20, context_id: 'consent-1',
      consent_kind: 'PATIENT_SIGNATURE', consent_status: 'SIGNED', created_at: '2026-09-29T00:00:00Z' };
    vi.mocked(xhrFetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: response }), { status: 201 }));
    const jsonFetcher = vi.fn<typeof fetch>();
    const transport = new MobileTransport({ environment: 'production', apiBaseUrl: 'https://api.example.test/api' }, jsonFetcher);
    const manager = new SessionManager({} as AuthApi, {} as SessionStore, transport,
      async () => true, { platform: 'android', appVersion: 'test' });
    vi.spyOn(manager, 'accessToken').mockResolvedValue('test-token');
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    try {
      const result = await new ConsentsApi(manager).uploadConsentSignature('patient-1', 'consent-1',
        { uri: 'file:///cache/signature.png', name: 'signature.png', type: 'image/png' });
      expect(append.mock.calls).toEqual([
        ['patient_id', 'patient-1'], ['consent_document_id', 'consent-1'],
        ['file', { uri: 'file:///cache/signature.png', name: 'signature.png', type: 'image/png' }],
      ]);
      expect(xhrFetch).toHaveBeenCalledWith('https://api.example.test/api/patient-portal/consent-signature',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData),
          headers: { Accept: 'application/json', Authorization: 'Bearer test-token' } }));
      expect(jsonFetcher).not.toHaveBeenCalled();
      expect(result).toMatchObject({ consent_status: 'SIGNED', context_id: 'consent-1' });
    } finally { append.mockRestore(); }
  });
});
