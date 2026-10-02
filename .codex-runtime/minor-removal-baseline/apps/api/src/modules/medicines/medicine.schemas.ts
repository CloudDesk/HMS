import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const medicineStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

const medicineIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Medicine id is invalid'),
}).strict();

const listMedicinesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: medicineStatusSchema.optional(),
  dosage_form: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['name', 'code', 'generic_name', 'status', 'created_at', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).strict();

const createMedicineBodySchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  generic_name: optionalText(200),
  strength: optionalText(100),
  dosage_form: optionalText(100),
  unit: optionalText(50),
  description: optionalText(1000),
  status: medicineStatusSchema.optional(),
}).strict();

const updateMedicineBodySchema = createMedicineBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

const updateMedicineStatusBodySchema = z.object({ status: medicineStatusSchema }).strict();

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
};

export const parseMedicineIdParams = (value: unknown) => parse(medicineIdParamsSchema, value);
export const parseMedicineListQuery = (value: unknown) => parse(listMedicinesQuerySchema, value);
export const parseCreateMedicineBody = (value: unknown) => parse(createMedicineBodySchema, value);
export const parseUpdateMedicineBody = (value: unknown) => parse(updateMedicineBodySchema, value);
export const parseUpdateMedicineStatusBody = (value: unknown) => parse(updateMedicineStatusBodySchema, value);
