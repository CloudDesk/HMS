import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { ConsentsApi } from './consents-api';
import { consentPreviewHtml } from './consent-html';

afterEach(() => vi.unstubAllEnvs());

function setup(token: string | null = 'test-token') {
  vi.stubEnv('EXPO_PUBLIC_HMS_ENV', 'production');
  vi.stubEnv('EXPO_PUBLIC_HMS_API_URL', 'https://api.example.test/api');
  const accessToken = vi.fn().mockResolvedValue(token);
  const authenticatedRequest = vi.fn();
  const fetcher = vi.fn<typeof fetch>();
  const api = new ConsentsApi({ accessToken, authenticatedRequest } as unknown as SessionManager, fetcher);
  return { api, accessToken, authenticatedRequest, fetcher };
}

describe('Consent previews', () => {
  it('uses the portal document endpoint and a bearer header for recorded signature images', async () => {
    const { api } = setup();
    expect(await api.getDocumentSource('patient-1', 'signature-2')).toEqual({
      uri: 'https://api.example.test/api/patient-portal/patients/patient-1/documents/signature-2/download',
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('retrieves actual HTML from the authenticated consent form download', async () => {
    const { api, fetcher } = setup();
    const html = '<html><head></head><body>Dental consent terms</body></html>';
    fetcher.mockResolvedValue(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    const signal = new AbortController().signal;
    expect(await api.getFormHtml('patient-1', 'consent-1', signal)).toBe(html);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/patient-portal/patients/patient-1/documents/consent-1/download',
      { headers: { Authorization: 'Bearer test-token' }, credentials: 'omit', signal },
    );
  });

  it('does not request a file without an access token', async () => {
    const { api, fetcher } = setup(null);
    await expect(api.getFormHtml('patient-1', 'consent-1', new AbortController().signal))
      .rejects.toMatchObject({ kind: 'auth' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects authorization errors instead of rendering error content', async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValue(new Response('Denied', { status: 403 }));
    await expect(api.getFormHtml('patient-1', 'consent-1', new AbortController().signal))
      .rejects.toMatchObject({ kind: 'auth', status: 403 });
  });

  it('does not treat a non-HTML response as consent terms', async () => {
    const { api, fetcher } = setup();
    fetcher.mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }));
    await expect(api.getFormHtml('patient-1', 'consent-1', new AbortController().signal))
      .rejects.toThrow('not an HTML document');
  });

  it('links a signature on a later document page while preserving signed state', async () => {
    const { api, authenticatedRequest } = setup();
    const form = { id: 'consent-1', patient_id: 'patient-1', document_type: 'CONSENT', title: 'Dental Consent',
      file_name: 'consent-DENTAL-001-v1.html', mime_type: 'text/html', file_size_bytes: 6000,
      consent_status: 'SIGNED', created_at: '2026-09-29T00:00:00Z' };
    const signature = { ...form, id: 'signature-2', file_name: 'signature.png', mime_type: 'image/png',
      context_id: form.id, consent_kind: 'PATIENT_SIGNATURE' };
    authenticatedRequest.mockResolvedValueOnce({ data: [form], meta: { page: 1, limit: 1, total: 2 } })
      .mockResolvedValueOnce({ data: [signature], meta: { page: 2, limit: 1, total: 2 } });
    const result = await api.listConsents('patient-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: form.id, signature_document_id: signature.id, is_signed: true, status: 'SIGNED' });
    expect(authenticatedRequest).toHaveBeenLastCalledWith('/patient-portal/documents', expect.anything(),
      { query: { patient_id: 'patient-1', page: 2, limit: 100 } });
  });

  it('retains HTML terms and formatting while restricting active content and external resources', () => {
    const html = '<html><head><style>p{color:black}</style></head><body><p>Consent terms &amp; risks</p></body></html>';
    const preview = consentPreviewHtml(html);
    expect(preview).toContain('<p>Consent terms &amp; risks</p>');
    expect(preview).toContain("default-src 'none'");
    expect(preview).toContain("img-src data:");
    expect(preview.indexOf('Content-Security-Policy')).toBeLessThan(preview.indexOf('<style>'));
  });
});
