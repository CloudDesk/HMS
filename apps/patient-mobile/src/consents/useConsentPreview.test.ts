// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consentItemSchema, type ConsentItem } from './contracts';
import { useConsentPreview } from './useConsentPreview';

const mocks = vi.hoisted(() => ({ manager: {}, html: vi.fn(), source: vi.fn() }));
vi.mock('../ui/AuthContext', () => ({ useAuth: () => ({ manager: mocks.manager }) }));
vi.mock('./consents-api', () => ({ ConsentsApi: class {
  getFormHtml = mocks.html;
  getDocumentSource = mocks.source;
} }));

const consent = consentItemSchema.parse({ id: 'form-1', patient_id: 'patient-1', title: 'Dental Consent',
  created_at: '2026-09-29', form_file_name: 'consent-DENTAL-001-v1.html', form_mime_type: 'text/html',
  form_file_size_bytes: 6000, signature_document_id: 'signature-1', is_signed: true, status: 'SIGNED' });
let root: Root;
let current: ReturnType<typeof useConsentPreview> | undefined;
function Harness({ item, visible }: { item: ConsentItem; visible: boolean }) {
  current = useConsentPreview(item, visible);
  return null;
}
async function render(item = consent, visible = true) {
  await act(async () => { root.render(createElement(Harness, { item, visible })); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.html.mockReset().mockResolvedValue('<html><body>Dental terms</body></html>');
  mocks.source.mockReset().mockResolvedValue({ uri: 'https://api.example/signature', headers: { Authorization: 'Bearer test' } });
  root = createRoot(document.createElement('div'));
  current = undefined;
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

describe('Consent modal preview lifecycle', () => {
  it('fetches only when opened and preserves separate form and signature IDs', async () => {
    await render(consent, false);
    expect(mocks.html).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
    await render();
    expect(mocks.html).toHaveBeenCalledWith('patient-1', 'form-1', expect.any(AbortSignal));
    expect(mocks.source).toHaveBeenCalledWith('patient-1', 'signature-1');
    expect(current?.preview?.html).toContain('Dental terms');
    expect(current?.preview?.signature?.headers.Authorization).toBe('Bearer test');
    expect(current?.preview?.signatureLoading).toBe(true);
    await act(async () => current?.signatureLoaded());
    expect(current?.preview?.signatureLoading).toBe(false);
  });

  it('shows independent errors and retries the image source after an image load failure', async () => {
    mocks.html.mockRejectedValueOnce(new Error('Form unavailable'));
    await render();
    expect(current?.preview?.formError).toBeTruthy();
    expect(current?.preview?.signature).not.toBeNull();
    await act(async () => current?.signatureFailed());
    expect(current?.preview?.signatureError).toContain('Unable to load');
    await act(async () => current?.retry());
    expect(mocks.source).toHaveBeenCalledTimes(2);
    expect(current?.preview?.signatureError).toBeNull();
    expect(current?.preview?.html).toContain('Dental terms');
  });

  it('aborts and hides previews on close', async () => {
    await render();
    const signal: AbortSignal = mocks.html.mock.calls[0]?.[2];
    await render(consent, false);
    expect(signal.aborted).toBe(true);
    expect(current?.preview).toBeNull();
  });

  it('ignores an old patient response after switching consent context', async () => {
    let completeOld: (html: string) => void = () => { throw new Error('Not initialized'); };
    mocks.html.mockImplementationOnce(() => new Promise<string>((resolve) => { completeOld = resolve; }));
    await render();
    await render({ ...consent, id: 'form-2', patient_id: 'patient-2', signature_document_id: null });
    await act(async () => completeOld('Previous patient private form'));
    expect(current?.preview?.html).toContain('Dental terms');
    expect(current?.preview?.html).not.toContain('Previous patient');
    expect(current?.preview?.signature).toBeNull();
  });
});
