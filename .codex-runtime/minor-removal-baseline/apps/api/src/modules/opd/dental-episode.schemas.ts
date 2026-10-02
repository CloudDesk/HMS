import { z } from 'zod';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().trim().regex(objectIdRegex, 'Invalid ObjectId');

export const dentalEpisodeStatusEnum = z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);

export const createDentalEpisodeSchema = z
  .object({
    patient_id: objectId,
    originating_visit_id: objectId,
    primary_tooth_number: z
      .number()
      .int()
      .refine(isValidFdiTooth, 'Invalid FDI tooth number')
      .nullable()
      .optional(),
    diagnosis_code: z.string().trim().max(50).nullable().optional(),
    diagnosis_name: z.string().trim().max(255).nullable().optional(),
    treatment_plan_summary: z.string().trim().max(1000).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const updateDentalEpisodeStatusSchema = z
  .object({
    status: dentalEpisodeStatusEnum,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const linkVisitToEpisodeSchema = z
  .object({
    visit_id: objectId,
  })
  .strict();

export const dentalEpisodeParamsSchema = z
  .object({
    episodeId: objectId,
  })
  .strict();

export const patientEpisodesParamsSchema = z
  .object({
    patientId: objectId,
  })
  .strict();

export const patientToothHistoryQuerySchema = z
  .object({
    exclude_visit_id: objectId.optional(),
  })
  .strict();
