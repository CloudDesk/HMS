import { describe, expect, it } from 'vitest';
import {
  formatDocumentDate,
  formatFileSize,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
  getReviewStatusBadge,
  portalDocumentSchema,
  portalDocumentsListResponseSchema,
} from './contracts';

describe('Documents Contracts & Schemas', () => {
  it('parses valid portal document correctly', () => {
    const raw = {
      id: 'doc-001',
      patient_id: 'pat-123',
      document_type: 'CLINICAL',
      title: 'Discharge Summary 2026',
      file_name: 'discharge_summary.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 524288,
      description: 'Hospital discharge note',
      source: 'HOSPITAL',
      review_status: 'VERIFIED',
      document_date: '2026-09-20',
      provider_name: 'HMS Central Hospital',
      created_at: '2026-09-20T10:00:00.000Z',
    };

    const parsed = portalDocumentSchema.parse(raw);
    expect(parsed.id).toBe('doc-001');
    expect(parsed.document_type).toBe('CLINICAL');
    expect(parsed.title).toBe('Discharge Summary 2026');
    expect(parsed.file_size_bytes).toBe(524288);
    expect(parsed.review_status).toBe('VERIFIED');
  });

  it('parses documents list response', () => {
    const raw = {
      data: [
        {
          id: 'doc-001',
          patient_id: 'pat-123',
          document_type: 'INSURANCE',
          title: 'Health Policy Card',
          file_name: 'card.png',
          mime_type: 'image/png',
          file_size_bytes: 1048576,
          description: null,
          source: 'PATIENT',
          review_status: 'PENDING',
          document_date: null,
          provider_name: 'Star Health',
          created_at: '2026-09-21T10:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    const parsed = portalDocumentsListResponseSchema.parse(raw);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.document_type).toBe('INSURANCE');
    expect(parsed.meta.total).toBe(1);
  });

  describe('Document Formatters', () => {
    it('formats file sizes accurately', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(150000)).toBe('146 KB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });

    it('formats document dates', () => {
      expect(formatDocumentDate('2026-09-24T00:00:00.000Z')).toBe('24 Sept 2026');
      expect(formatDocumentDate(null)).toBe('-');
    });

    it('returns labels and icons for document categories', () => {
      expect(getDocumentTypeLabel('CLINICAL')).toBe('Clinical Record');
      expect(getDocumentTypeLabel('INSURANCE')).toBe('Insurance Document');
      expect(getDocumentTypeLabel('OTHER')).toBe('Other File');

      expect(getDocumentTypeIcon('CLINICAL')).toBe('🩺');
      expect(getDocumentTypeIcon('INSURANCE')).toBe('🛡️');
      expect(getDocumentTypeIcon('OTHER')).toBe('📄');
    });

    it('returns review status badges', () => {
      const verified = getReviewStatusBadge('VERIFIED');
      expect(verified.label).toBe('Verified');
      expect(verified.bg).toBe('#DCFCE7');

      const pending = getReviewStatusBadge('PENDING');
      expect(pending.label).toBe('Under Review');
      expect(pending.bg).toBe('#FEF3C7');
    });
  });
});
