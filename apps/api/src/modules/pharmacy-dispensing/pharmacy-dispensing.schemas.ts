import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const positiveInt = z.number().int().min(1);
export const listSchema = z.object({ branch_id: objectId, status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED']).optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const idSchema = z.object({ id: objectId });
export const saveSchema = z.object({ version: z.number().int().min(0), items: z.array(z.object({ prescription_item_id: objectId, medicine_id: objectId, batch_id: objectId, confirmed_quantity: positiveInt, pharmacist_instructions: z.string().trim().max(500).nullable().optional() })).min(1) });
export const confirmSchema = z.object({ version: z.number().int().min(0), idempotency_key: z.string().trim().min(16).max(100) });
export const cancelSchema = z.object({ version: z.number().int().min(0), reason: z.string().trim().min(3).max(500) });
export const reverseSchema = z.object({ version: z.number().int().min(0), reason: z.string().trim().min(3).max(500), idempotency_key: z.string().trim().min(16).max(100) });
