import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Object id is invalid');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']).optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(), date_from: dateOnly.optional(), date_to: dateOnly.optional(),
  patient_id: objectId.optional(), doctor_id: objectId.optional(), branch_id: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict().refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
  message: 'date_from must be on or before date_to', path: ['date_from'],
});
const paramsSchema = z.object({ id: objectId }).strict();
const statusSchema = z.object({ status: z.enum(['RECEIVED', 'IN_PROGRESS', 'VERIFIED', 'COMPLETED']) }).strict();
const reportSchema = z.object({
  findings: z.string().trim().min(1).max(10000),
  impression: z.string().trim().min(1).max(5000),
  recommendations: z.string().trim().max(5000).nullable().optional(),
}).strict();
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', parsed.error.flatten());
  return parsed.data;
};
export const parseImagingListQuery = (value: unknown) => parse(listSchema, value);
export const parseImagingParams = (value: unknown) => parse(paramsSchema, value);
export const parseImagingStatusBody = (value: unknown) => parse(statusSchema, value);
export const parseImagingReportBody = (value: unknown) => parse(reportSchema, value);
