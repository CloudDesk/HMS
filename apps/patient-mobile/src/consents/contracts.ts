import { z } from 'zod';

export const consentStatusSchema = z.enum([
  'SIGNED',
  'PENDING_SIGNATURE',
  'VERIFIED',
  'EXPIRED',
  'REJECTED',
  'NOT_REQUIRED',
]);

export const consentDocumentRawSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  document_type: z.string(),
  title: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.number(),
  provider_name: z.string().nullable().optional().transform((v) => v ?? null),
  document_date: z.string().nullable().optional().transform((v) => v ?? null),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  source: z.string().default('HOSPITAL'),
  review_status: z.string().default('NOT_REQUIRED'),
  context_id: z.string().nullable().optional().transform((v) => v ?? null),
  consent_kind: z.string().nullable().optional().transform((v) => v ?? null),
  consent_status: z.string().nullable().optional().transform((v) => v ?? null),
  signed_at: z.string().nullable().optional().transform((v) => v ?? null),
  signed_by_name: z.string().nullable().optional().transform((v) => v ?? null),
  created_at: z.string(),
});

export const consentDocumentsListResponseSchema = z.object({
  data: z.array(consentDocumentRawSchema),
  meta: z.object({
    page: z.number().default(1),
    limit: z.number().default(50),
    total: z.number().default(0),
    totalPages: z.number().default(1),
  }),
});

export const consentItemSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  provider_name: z.string().nullable().optional().transform((v) => v ?? null),
  document_date: z.string().nullable().optional().transform((v) => v ?? null),
  created_at: z.string(),
  form_file_name: z.string(),
  form_mime_type: z.string(),
  form_file_size_bytes: z.number(),
  signature_document_id: z.string().nullable().optional().transform((v) => v ?? null),
  signature_file_name: z.string().nullable().optional().transform((v) => v ?? null),
  signature_uploaded_at: z.string().nullable().optional().transform((v) => v ?? null),
  is_signed: z.boolean(),
  status: consentStatusSchema,
});

export type ConsentStatus = z.infer<typeof consentStatusSchema>;
export type ConsentDocumentRaw = z.infer<typeof consentDocumentRawSchema>;
export type ConsentDocumentInput = z.input<typeof consentDocumentRawSchema>;
export type ConsentItem = z.infer<typeof consentItemSchema>;

export function mapDocumentsToConsentItems(
  documents: Array<ConsentDocumentRaw | ConsentDocumentInput>
): ConsentItem[] {
  const parsedDocs = documents.map((doc) => consentDocumentRawSchema.parse(doc));
  const consentForms = parsedDocs.filter(
    (doc) => doc.document_type === 'CONSENT' && doc.consent_kind !== 'PATIENT_SIGNATURE'
  );

  const consentSignatures = parsedDocs.filter(
    (doc) => doc.consent_kind === 'PATIENT_SIGNATURE'
  );

  return consentForms.map((form) => {
    const signature = consentSignatures.find((sig) => sig.context_id === form.id);
    const isSigned = Boolean(signature);

    let status: ConsentStatus;
    if (form.consent_status === 'EXPIRED') {
      status = 'EXPIRED';
    } else if (form.consent_status === 'REJECTED') {
      status = 'REJECTED';
    } else if (form.review_status === 'VERIFIED') {
      status = 'VERIFIED';
    } else if (isSigned) {
      status = 'SIGNED';
    } else {
      status = 'PENDING_SIGNATURE';
    }

    return {
      id: form.id,
      patient_id: form.patient_id,
      title: form.title,
      description: form.description,
      provider_name: form.provider_name,
      document_date: form.document_date,
      created_at: form.created_at,
      form_file_name: form.file_name,
      form_mime_type: form.mime_type,
      form_file_size_bytes: form.file_size_bytes,
      signature_document_id: signature?.id ?? null,
      signature_file_name: signature?.file_name ?? null,
      signature_uploaded_at: signature?.created_at ?? null,
      is_signed: isSigned,
      status,
    };
  });
}

export function formatConsentDate(dateString: string | null): string {
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

export function getConsentStatusLabel(status: ConsentStatus | string): string {
  switch (status?.toUpperCase()) {
    case 'SIGNED':
      return 'Signed & Recorded';
    case 'PENDING_SIGNATURE':
      return 'Signature Required';
    case 'VERIFIED':
      return 'Hospital Verified';
    case 'EXPIRED':
      return 'Consent Expired';
    case 'REJECTED':
      return 'Signature Declined';
    case 'NOT_REQUIRED':
      return 'Acknowledged';
    default:
      return status || 'Pending';
  }
}

export function getConsentStatusVariant(
  status: ConsentStatus | string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status?.toUpperCase()) {
    case 'VERIFIED':
      return 'success';
    case 'SIGNED':
      return 'info';
    case 'PENDING_SIGNATURE':
      return 'warning';
    case 'REJECTED':
    case 'EXPIRED':
      return 'danger';
    case 'NOT_REQUIRED':
    default:
      return 'neutral';
  }
}
