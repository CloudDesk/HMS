import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().trim().regex(objectIdRegex, 'Invalid ObjectId');

export const createDentalQuotationItemSchema = z
  .object({
    treatment_plan_item_id: z.string().trim().nullable().optional(),
    service_id: objectId.nullable().optional(),
    procedure_name: z.string().trim().min(1, 'Procedure name is required').max(300),
    tooth_number: z.number().int().min(1).max(85).nullable().optional(),
    quantity: z.number().int().min(1).default(1).optional(),
    unit_price: z.number().min(0).optional(),
    discount_amount: z.number().min(0).default(0).optional(),
    tax_amount: z.number().min(0).default(0).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const createDentalQuotationOptionSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().min(1, 'Option name is required').max(150),
    description: z.string().trim().max(1000).nullable().optional(),
    sequence: z.number().int().min(1).default(1).optional(),
    discount_amount: z.number().min(0).default(0).optional(),
    tax_amount: z.number().min(0).default(0).optional(),
    items: z.array(createDentalQuotationItemSchema).min(1, 'Each option must contain at least one item'),
  })
  .strict();

export const createDentalQuotationSchema = z
  .object({
    doctor_id: objectId.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    valid_until: z.string().datetime({ offset: true }).nullable().optional(),
    discount_amount: z.number().min(0).default(0).optional(),
    tax_amount: z.number().min(0).default(0).optional(),
    items: z.array(createDentalQuotationItemSchema).optional(),
    options: z.array(createDentalQuotationOptionSchema).optional(),
  })
  .strict()
  .refine((data) => (data.items && data.items.length > 0) || (data.options && data.options.length > 0), {
    message: 'Either items or options must contain at least one item',
  });

export const updateDentalQuotationDraftSchema = z
  .object({
    doctor_id: objectId.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    valid_until: z.string().datetime({ offset: true }).nullable().optional(),
    discount_amount: z.number().min(0).default(0).optional(),
    tax_amount: z.number().min(0).default(0).optional(),
    items: z.array(createDentalQuotationItemSchema).optional(),
    options: z.array(createDentalQuotationOptionSchema).optional(),
  })
  .strict()
  .refine((data) => (data.items && data.items.length > 0) || (data.options && data.options.length > 0), {
    message: 'Either items or options must contain at least one item',
  });

export const dentalQuotationParamsSchema = z
  .object({
    quotationId: objectId,
  })
  .strict();

export const episodeQuotationParamsSchema = z
  .object({
    episodeId: objectId,
  })
  .strict();

export const patientQuotationsParamsSchema = z
  .object({
    patientId: objectId,
  })
  .strict();

export const acceptDentalQuotationSchema = z
  .object({
    selected_option_id: z.string().trim().min(1, 'Selected option ID is required'),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const rejectDentalQuotationSchema = z
  .object({
    reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const postponeDentalQuotationSchema = z
  .object({
    reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
