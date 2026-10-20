import { z } from 'zod';
import { apiClient } from './client';
import { ophthalmologyIdSchema as id } from './ophthalmology';
const version = z.number().int().nonnegative(); const date = z.string().datetime({ offset: true });
export const publicationSourceTypeSchema = z.enum(['CONSULTATION_SUMMARY', 'OPTICAL_PRESCRIPTION', 'TEST_RESULT']);
export const publicationSchema = z.object({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id,
  source_type: publicationSourceTypeSchema, source_id: id, source_version: version.min(1), status: z.enum(['APPROVED_FOR_PORTAL', 'WITHDRAWN']),
  published_by: id, published_at: date, withdrawn_by: id.nullable(), withdrawn_at: date.nullable(), withdrawal_reason: z.string().nullable(), version, created_at: date, updated_at: date });
export const publicationQuerySchema = z.object({ branch_id: id, visit_id: id.optional(), source_id: id.optional(), source_version: z.coerce.number().int().positive().optional(), source_type: publicationSourceTypeSchema.optional(), status: z.enum(['APPROVED_FOR_PORTAL', 'WITHDRAWN']).optional(), page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const publishWriteSchema = z.object({ source_type: publicationSourceTypeSchema, source_id: id, source_version: version.min(1) }).strict();
export const withdrawalWriteSchema = z.object({ expected_version: version, expected_status: z.literal('APPROVED_FOR_PORTAL'), reason: z.string().trim().min(1).max(2000) }).strict();
export type OphthalmologyPublication = z.infer<typeof publicationSchema>;
export type PublicationQuery = z.infer<typeof publicationQuerySchema>;
export type PublicationSource = z.infer<typeof publishWriteSchema>;
export type PublicationWithdrawal = z.infer<typeof withdrawalWriteSchema>;
const pageSchema = z.object({ data: z.array(publicationSchema), meta: z.object({ total: version, page: version.min(1), limit: version.min(1).max(100), totalPages: version.min(1) }) });
export const ophthalmologyPublicationsApi = {
  list: async (params: PublicationQuery, signal?: AbortSignal) => { const query = publicationQuerySchema.parse(params); const search = new URLSearchParams(); for (const [key, value] of Object.entries(query)) search.set(key, String(value)); return pageSchema.parse(await apiClient.request<unknown>(`/ophthalmology/publications?${search}`, { signal })); },
  publish: async (body: PublicationSource, key: string) => publicationSchema.parse(await apiClient.request<unknown>('/ophthalmology/publications', { method: 'POST', headers: { 'Idempotency-Key': z.string().min(8).max(200).parse(key) }, body: publishWriteSchema.parse(body) })),
  withdraw: async (publicationId: string, body: PublicationWithdrawal) => publicationSchema.parse(await apiClient.request<unknown>(`/ophthalmology/publications/${id.parse(publicationId)}/withdraw`, { method: 'POST', body: withdrawalWriteSchema.parse(body) })),
};
