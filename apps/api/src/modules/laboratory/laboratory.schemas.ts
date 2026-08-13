import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Object id is invalid');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['SUBMITTED', 'RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'RESULT_ENTERED', 'VERIFIED', 'COMPLETED']).optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  date_from: dateOnly.optional(), date_to: dateOnly.optional(),
  patient_id: objectId.optional(), doctor_id: objectId.optional(), branch_id: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict().refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
  message: 'date_from must be on or before date_to', path: ['date_from'],
});
const paramsSchema = z.object({ id: objectId }).strict();
const statusSchema = z.object({ status: z.enum(['RECEIVED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'VERIFIED', 'COMPLETED']) }).strict();
const resultItemSchema = z.object({
  service_id: objectId,
  service_name: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(500),
  unit: z.string().trim().max(100).nullable().optional(),
  reference_range: z.string().trim().max(200).nullable().optional(),
  comments: z.string().trim().max(1000).nullable().optional(),
}).strict();
const resultSchema = z.object({
  result_items: z.array(resultItemSchema).min(1).max(100),
  remarks: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine((data, context) => {
  const ids = data.result_items.map((item) => item.service_id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Duplicate result service', path: ['result_items'] });
});

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', parsed.error.flatten());
  return parsed.data;
};
export const parseLaboratoryListQuery = (value: unknown) => parse(listSchema, value);
export const parseLaboratoryParams = (value: unknown) => parse(paramsSchema, value);
export const parseLaboratoryStatusBody = (value: unknown) => parse(statusSchema, value);
export const parseLaboratoryResultBody = (value: unknown) => parse(resultSchema, value);
