import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

export const createAttemptSchema = z.strictObject({
  amount: z.number().int().positive().max(250000),
  payerPhone: z.string().regex(/^254[17]\d{8}$/),
  idempotencyKey: z.string().uuid(),
});
export const attemptVersionSchema = z.strictObject({ expectedVersion: z.number().int().nonnegative() });
export type CreateMpesaAttempt = z.infer<typeof createAttemptSchema>;
export const parseAttemptInput = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Invalid M-PESA request', 400, 'MPESA_REQUEST_INVALID');
  return parsed.data;
};
export const invoiceIdSchema = z.strictObject({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) });
export const attemptIdSchema = z.strictObject({ id: z.string().regex(/^[a-f0-9]{64}$/) });

export const listAttemptsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  invoiceId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  submissionState: z.enum(['CREATED', 'SUBMITTING', 'PENDING', 'UNKNOWN', 'REJECTED']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'FAILED', 'CONFLICT', 'UNRESOLVED']).optional(),
  postingStatus: z.enum(['DISABLED', 'READY', 'POSTING', 'POSTED', 'POSTING_FAILED', 'MANUAL_REVIEW_REQUIRED']).optional(),
  unresolvedOnly: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional(),
});
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>;

export const listExceptionsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExceptionsQuery = z.infer<typeof listExceptionsQuerySchema>;

export const reconcileOptionsSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ReconcileOptions = z.infer<typeof reconcileOptionsSchema>;
