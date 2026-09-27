import { z } from 'zod';

export const portalDocumentTypeSchema = z.enum(['INSURANCE', 'CLINICAL', 'OTHER']);
export const portalDocumentSourceSchema = z.enum(['HOSPITAL', 'PATIENT', 'GUARDIAN']);
export const portalDocumentReviewStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
]);

export const portalDocumentSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  document_type: portalDocumentTypeSchema,
  title: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.number(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  source: portalDocumentSourceSchema,
  review_status: portalDocumentReviewStatusSchema,
  document_date: z.string().nullable().optional().transform((v) => v ?? null),
  provider_name: z.string().nullable().optional().transform((v) => v ?? null),
  created_at: z.string(),
});

export const portalDocumentsListResponseSchema = z.object({
  data: z.array(portalDocumentSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export type PortalDocumentType = z.infer<typeof portalDocumentTypeSchema>;
export type PortalDocumentSource = z.infer<typeof portalDocumentSourceSchema>;
export type PortalDocumentReviewStatus = z.infer<typeof portalDocumentReviewStatusSchema>;
export type PortalDocument = z.infer<typeof portalDocumentSchema>;
export type PortalDocumentsListResponse = z.infer<typeof portalDocumentsListResponseSchema>;

export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getDocumentTypeLabel(type: PortalDocumentType | string): string {
  switch (type?.toUpperCase()) {
    case 'CLINICAL':
      return 'Clinical Record';
    case 'INSURANCE':
      return 'Insurance Document';
    case 'OTHER':
      return 'Other File';
    default:
      return type || 'Document';
  }
}

export function getDocumentTypeIcon(type: PortalDocumentType | string): string {
  switch (type?.toUpperCase()) {
    case 'CLINICAL':
      return '🩺';
    case 'INSURANCE':
      return '🛡️';
    case 'OTHER':
      return '📄';
    default:
      return '📁';
  }
}

export function getReviewStatusBadge(status: PortalDocumentReviewStatus | string): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status?.toUpperCase()) {
    case 'VERIFIED':
      return {
        label: 'Verified',
        bg: '#DCFCE7',
        text: '#166534',
        border: '#86EFAC',
      };
    case 'PENDING':
      return {
        label: 'Under Review',
        bg: '#FEF3C7',
        text: '#92400E',
        border: '#FDE68A',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        bg: '#FEE2E2',
        text: '#991B1B',
        border: '#FECACA',
      };
    case 'NOT_REQUIRED':
    default:
      return {
        label: 'Hospital Record',
        bg: '#F1F5F9',
        text: '#475569',
        border: '#CBD5E1',
      };
  }
}
