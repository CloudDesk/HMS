import { describe, expect, it } from 'vitest';
import {
  consentDocumentRawSchema,
  consentDocumentsListResponseSchema,
  formatConsentDate,
  getConsentStatusLabel,
  getConsentStatusVariant,
  mapDocumentsToConsentItems,
} from './contracts';

describe('Consents Contracts & Schemas', () => {
  it('parses raw consent document', () => {
    const raw = {
      id: 'doc-1',
      patient_id: 'pat-1',
      document_type: 'CONSENT',
      title: 'Inpatient Admission Consent',
      file_name: 'admission-consent.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 102400,
      provider_name: 'Main Hospital',
      document_date: '2026-09-20',
      description: 'General consent for hospital admission and care',
      source: 'HOSPITAL',
      review_status: 'VERIFIED',
      context_id: null,
      consent_kind: 'GENERAL_ADMISSION',
      consent_status: 'PENDING',
      signed_at: null,
      signed_by_name: null,
      created_at: '2026-09-20T10:00:00.000Z',
    };

    const parsed = consentDocumentRawSchema.parse(raw);
    expect(parsed.title).toBe('Inpatient Admission Consent');
    expect(parsed.document_type).toBe('CONSENT');
    expect(parsed.file_size_bytes).toBe(102400);
  });

  it('parses documents list response', () => {
    const raw = {
      data: [
        {
          id: 'doc-1',
          patient_id: 'pat-1',
          document_type: 'CONSENT',
          title: 'Surgical Informed Consent',
          file_name: 'surgery-consent.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 204800,
          source: 'HOSPITAL',
          review_status: 'NOT_REQUIRED',
          created_at: '2026-09-22T08:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    };

    const parsed = consentDocumentsListResponseSchema.parse(raw);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.title).toBe('Surgical Informed Consent');
  });

  it('maps documents to consent items and links signatures correctly', () => {
    const documents = [
      {
        id: 'consent-1',
        patient_id: 'pat-1',
        document_type: 'CONSENT',
        title: 'Dental Surgery Consent',
        file_name: 'dental-consent.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 150000,
        provider_name: 'Dental Clinic',
        document_date: '2026-09-24',
        description: 'Consent for extraction',
        source: 'HOSPITAL',
        review_status: 'NOT_REQUIRED',
        context_id: null,
        consent_kind: null,
        consent_status: 'PENDING',
        signed_at: null,
        signed_by_name: null,
        created_at: '2026-09-24T09:00:00.000Z',
      },
      {
        id: 'sig-1',
        patient_id: 'pat-1',
        document_type: 'CONSENT',
        title: 'Signature for Dental Surgery Consent',
        file_name: 'sig.png',
        mime_type: 'image/png',
        file_size_bytes: 45000,
        provider_name: null,
        document_date: null,
        description: null,
        source: 'PATIENT',
        review_status: 'NOT_REQUIRED',
        context_id: 'consent-1',
        consent_kind: 'PATIENT_SIGNATURE',
        consent_status: 'SIGNED',
        signed_at: '2026-09-24T09:30:00.000Z',
        signed_by_name: 'John Doe',
        created_at: '2026-09-24T09:30:00.000Z',
      },
      {
        id: 'consent-2',
        patient_id: 'pat-1',
        document_type: 'CONSENT',
        title: 'Anesthesia Consent',
        file_name: 'anesthesia.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 180000,
        provider_name: 'Main Campus',
        document_date: null,
        description: 'General anesthesia consent',
        source: 'HOSPITAL',
        review_status: 'NOT_REQUIRED',
        context_id: null,
        consent_kind: null,
        consent_status: 'PENDING',
        signed_at: null,
        signed_by_name: null,
        created_at: '2026-09-25T11:00:00.000Z',
      },
      {
        id: 'other-doc-1',
        patient_id: 'pat-1',
        document_type: 'CLINICAL',
        title: 'Blood Test Report',
        file_name: 'blood-test.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 80000,
        source: 'HOSPITAL',
        review_status: 'VERIFIED',
        context_id: null,
        consent_kind: null,
        consent_status: null,
        signed_at: null,
        signed_by_name: null,
        created_at: '2026-09-25T12:00:00.000Z',
      },
    ];

    const consentItems = mapDocumentsToConsentItems(documents);

    expect(consentItems).toHaveLength(2);

    const first = consentItems.find((c) => c.id === 'consent-1');
    expect(first).toBeDefined();
    expect(first?.is_signed).toBe(true);
    expect(first?.status).toBe('SIGNED');
    expect(first?.signature_document_id).toBe('sig-1');
    expect(first?.signature_file_name).toBe('sig.png');

    const second = consentItems.find((c) => c.id === 'consent-2');
    expect(second).toBeDefined();
    expect(second?.is_signed).toBe(false);
    expect(second?.status).toBe('PENDING_SIGNATURE');
    expect(second?.signature_document_id).toBeNull();
  });

  describe('Consent Formatters & Helpers', () => {
    it('formats consent dates correctly', () => {
      expect(formatConsentDate('2026-09-28T00:00:00.000Z')).toBe('28 Sept 2026');
      expect(formatConsentDate(null)).toBe('-');
    });

    it('returns proper status labels', () => {
      expect(getConsentStatusLabel('SIGNED')).toBe('Signed & Recorded');
      expect(getConsentStatusLabel('PENDING_SIGNATURE')).toBe('Signature Required');
      expect(getConsentStatusLabel('VERIFIED')).toBe('Hospital Verified');
      expect(getConsentStatusLabel('EXPIRED')).toBe('Consent Expired');
      expect(getConsentStatusLabel('REJECTED')).toBe('Signature Declined');
    });

    it('returns correct status variants for badges', () => {
      expect(getConsentStatusVariant('VERIFIED')).toBe('success');
      expect(getConsentStatusVariant('SIGNED')).toBe('info');
      expect(getConsentStatusVariant('PENDING_SIGNATURE')).toBe('warning');
      expect(getConsentStatusVariant('REJECTED')).toBe('danger');
      expect(getConsentStatusVariant('EXPIRED')).toBe('danger');
    });
  });
});
