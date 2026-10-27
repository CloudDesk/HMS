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
