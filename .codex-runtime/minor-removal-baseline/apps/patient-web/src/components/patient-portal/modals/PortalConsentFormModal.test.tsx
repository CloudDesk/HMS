import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalConsentFormModal } from './PortalConsentFormModal';
import type { PortalDocument } from '../../../api/patient-portal';

const mocks = vi.hoisted(() => ({
  downloadDocument: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.error, success: vi.fn() },
}));

vi.mock('../../../api/patient-portal', () => ({
  patientPortalApi: {
    downloadDocument: mocks.downloadDocument,
  },
}));

describe('PortalConsentFormModal', () => {
  let root: Root;
  let container: HTMLDivElement;

  const mockConsent: PortalDocument = {
    id: 'consent-123',
    patient_id: 'patient-1',
    document_type: 'CONSENT',
    title: 'Dental General Treatment Consent Form',
    file_name: 'treatment-consent.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 12040,
    description: null,
    source: 'HOSPITAL',
    review_status: 'VERIFIED',
    context_type: 'PATIENT',
    context_id: null,
    consent_template_id: 'template-1',
    consent_category: 'DENTAL',
    consent_version: 1,
    consent_status: 'SIGNED',
    consent_kind: null,
    signed_at: '2026-09-28T10:00:00Z',
    valid_until: null,
    signed_by_name: 'John Doe',
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    review_notes: null,
    document_date: '2026-09-28T09:00:00Z',
    provider_name: 'City Dental Clinic',
    uploaded_by: 'staff-1',
    uploaded_by_name: 'Dr. Smith',
    uploaded_at: '2026-09-28T09:00:00Z',
    verified_by: null,
    verified_at: null,
    created_at: '2026-09-28T09:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
  };

  const mockSignature: PortalDocument = {
    id: 'sig-999',
    patient_id: 'patient-1',
    document_type: 'CONSENT',
    title: 'Signature for Dental General Treatment Consent Form',
    file_name: 'patient-signature.png',
    mime_type: 'image/png',
    file_size_bytes: 4020,
    description: null,
    source: 'PATIENT',
    review_status: 'PENDING',
    context_type: 'PATIENT',
    context_id: 'consent-123',
    consent_template_id: 'template-1',
    consent_category: 'DENTAL',
    consent_version: 1,
    consent_status: 'SIGNED',
    consent_kind: 'PATIENT_SIGNATURE',
    signed_at: '2026-09-28T10:00:00Z',
    valid_until: null,
    signed_by_name: 'John Doe',
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    review_notes: null,
    document_date: null,
    provider_name: null,
    uploaded_by: 'patient-1',
    uploaded_by_name: 'John Doe',
    uploaded_at: '2026-09-28T10:00:00Z',
    verified_by: null,
    verified_at: null,
    created_at: '2026-09-28T10:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${blob.type || 'file'}`);
      static revokeObjectURL = vi.fn();
    });

    mocks.downloadDocument.mockImplementation(async (_pid: string, docId: string) => {
      if (docId === 'sig-999') {
        return { blob: new Blob(['signature-png-data'], { type: 'image/png' }) };
      }
      return { blob: new Blob(['consent-pdf-data'], { type: 'application/pdf' }) };
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('renders the consent document and the captured signature when signed', async () => {
    await act(async () => {
      root.render(
        <PortalConsentFormModal
          consent={mockConsent}
          onClose={vi.fn()}
          onUploadSignature={vi.fn()}
          open={true}
          patientId="patient-1"
          patientName="John Doe"
          signature={mockSignature}
        />,
      );
    });

    expect(document.body.textContent).toContain('Dental General Treatment Consent Form');
    expect(document.body.textContent).toContain('Signature Captured & Attached');
    expect(document.body.textContent).toContain('Replace Signature');
  });

  it('displays signature prompt when signature is not yet uploaded', async () => {
    await act(async () => {
      root.render(
        <PortalConsentFormModal
          consent={mockConsent}
          onClose={vi.fn()}
          onUploadSignature={vi.fn()}
          open={true}
          patientId="patient-1"
          patientName="John Doe"
          signature={null}
        />,
      );
    });

    expect(document.body.textContent).toContain('Signature Required');
    expect(document.body.textContent).toContain('Upload Signature');
  });
});
