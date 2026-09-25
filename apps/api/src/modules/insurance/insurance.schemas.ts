import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = (label: string, max = 200) => z.string().trim().min(1, `${label} is required`).max(max);
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

export const insuranceIdParamsSchema = z.object({ id });
export const insuranceProviderActionParamsSchema = z.object({
  id,
  action: z.enum(['activate', 'deactivate']),
});

export const insuranceConfigurationUpdateSchema = z.object({
  operating_mode: z.enum(['PROVIDER', 'PAYER', 'TPA', 'HYBRID']),
  version: z.coerce.number().int().min(0),
  reason: text('Reason', 500),
});

export const insuranceProviderListSchema = z.object({
  search: z.string().trim().max(100).optional(),
  provider_type: z.enum(['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'IMAGING', 'DENTAL', 'OPTICAL', 'OTHER']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['provider_code', 'legal_name', 'provider_type', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceProviderCreateSchema = z.object({
  provider_code: text('Provider code', 50).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Provider code contains unsupported characters'),
  legal_name: text('Legal name', 200),
  trading_name: nullableText(200),
  provider_type: z.enum(['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'IMAGING', 'DENTAL', 'OPTICAL', 'OTHER']),
  registration_number: nullableText(100),
  tax_id: nullableText(100),
  contact_name: nullableText(150),
  phone: nullableText(30),
  email: z.string().trim().email().max(254).nullable().optional(),
  address: nullableText(500),
});

export const insuranceProviderUpdateSchema = insuranceProviderCreateSchema.partial().extend({
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one provider field is required',
});

export const insuranceStatusActionSchema = z.object({
  version: z.coerce.number().int().min(0),
  reason: text('Reason', 500),
});

export const insuranceProviderBranchListSchema = z.object({
  branch_id: id.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  effective_on: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['effective_from', 'effective_to', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const insuranceProviderBranchCreateSchema = z.object({
  branch_id: id,
  effective_from: isoDate,
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).superRefine((value, context) => {
  if (value.effective_to && value.effective_to < value.effective_from) {
    context.addIssue({ code: 'custom', path: ['effective_to'], message: 'Effective-to must be on or after effective-from' });
  }
});

export const insuranceProviderBranchUpdateSchema = z.object({
  effective_from: isoDate.optional(),
  effective_to: isoDate.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']).optional(),
  version: z.coerce.number().int().min(0),
}).refine((value) => Object.keys(value).some((key) => key !== 'version'), {
  message: 'At least one mapping field is required',
});
