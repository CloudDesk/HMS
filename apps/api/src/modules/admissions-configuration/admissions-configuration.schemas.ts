import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = (label: string, max = 100) => z.string().trim().min(1, `${label} is required`).max(max);
export const wardListSchema = z.object({ branch_id: id, search: z.string().trim().max(100).optional(), ward_type: z.string().trim().max(100).optional(), floor: z.string().trim().max(50).optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const bedListSchema = z.object({ branch_id: id, ward_id: id.optional(), search: z.string().trim().max(100).optional(), bed_category: z.string().trim().max(100).optional(), room_number: z.string().trim().max(50).optional(), status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const idParamsSchema = z.object({ id });
export const wardBodySchema = z.object({ branch_id: id, name: text('Ward name'), ward_type: text('Ward type'), floor: text('Floor', 50), description: z.string().trim().max(500).nullable().optional() });
export const bedBodySchema = z.object({ branch_id: id, ward_id: id, bed_number: text('Bed number', 50), bed_category: text('Bed category'), room_number: z.string().trim().max(50).nullable().optional() });
export const updateBedBodySchema = z.object({ branch_id: id, bed_number: text('Bed number', 50).optional(), bed_category: text('Bed category').optional(), room_number: z.string().trim().max(50).nullable().optional() }).refine((value) => value.bed_number || value.bed_category || value.room_number !== undefined, 'At least one bed field is required');
export const wardStatusSchema = z.object({ branch_id: id, status: z.enum(['ACTIVE', 'INACTIVE']) });
export const bedStatusSchema = z.object({ branch_id: id, status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'UNDER_MAINTENANCE', 'INACTIVE']) });
