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

export interface UploadDocumentInput {
  patientId: string;
  documentType: PortalDocumentType;
  title: string;
  file: {
    uri: string;
    name?: string;
    type?: string;
  };
  providerName?: string | null;
  documentDate?: string | null;
  description?: string | null;
}

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
];

export interface SelectedDocumentFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export function validateDocumentFile(file: {
  uri: string;
  name?: string;
  type?: string;
  size?: number;
}): { valid: boolean; error?: string; file?: SelectedDocumentFile } {
  const uri = file.uri?.trim() || '';
  if (!uri) {
    return { valid: false, error: 'Invalid file location.' };
  }

  // Size validation
  if (file.size !== undefined && file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File exceeds the 10 MB limit. Please choose a smaller file.',
    };
  }

  // Type & Extension validation
  const cleanPath = (uri.split('?')[0] ?? '').split('#')[0] ?? '';
  const ext = (file.name?.split('.').pop() || cleanPath.split('.').pop() || '').toLowerCase();
  const rawType = (file.type?.trim() || '').toLowerCase();

  const isSupportedMime = rawType ? SUPPORTED_DOCUMENT_MIME_TYPES.includes(rawType) : false;
  const isSupportedExt = ext ? SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext) : false;

  if (!isSupportedMime && !isSupportedExt && rawType !== 'application/octet-stream') {
    return {
      valid: false,
      error: 'Unsupported file type. Please select a PDF or image (JPG, PNG, WebP, HEIC).',
    };
  }

  // Normalize MIME
  let normalizedType = rawType;
  if (!normalizedType || normalizedType === 'application/octet-stream' || !normalizedType.includes('/')) {
    if (ext === 'pdf') normalizedType = 'application/pdf';
    else if (ext === 'png') normalizedType = 'image/png';
    else if (ext === 'webp') normalizedType = 'image/webp';
    else if (ext === 'heic') normalizedType = 'image/heic';
    else if (ext === 'heif') normalizedType = 'image/heif';
    else normalizedType = 'image/jpeg';
  } else if (normalizedType === 'image/jpg') {
    normalizedType = 'image/jpeg';
  }

  // Normalize file name
  let normalizedName = file.name?.trim();
  if (!normalizedName) {
    const defaultExt = normalizedType === 'application/pdf' ? 'pdf' : 'jpg';
    normalizedName = `document-${Date.now()}.${defaultExt}`;
  }

  return {
    valid: true,
    file: {
      uri,
      name: normalizedName,
      type: normalizedType,
      size: file.size,
    },
  };
}

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
