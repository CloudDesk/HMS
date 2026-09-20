import { z } from 'zod';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = z.string().trim().regex(objectIdRegex, 'Invalid ObjectId');

export const dentalStageStatusEnum = z.enum([
  'PLANNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]);

export const createDentalStageSchema = z
  .object({
    plan_item_id: z.string().trim().min(1).max(100),
    stage_name: z.string().trim().min(1).max(200),
    assigned_doctor_id: objectId,
    tooth_number: z
      .number()
      .int()
      .refine(isValidFdiTooth, 'Invalid FDI tooth number')
      .nullable()
      .optional(),
    service_id: objectId.nullable().optional(),
    sequence: z.number().int().positive().optional(),
    planned_date: z.coerce.date().nullable().optional(),
    prosthetic_lab_order_id: objectId.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const updateDentalStageStatusSchema = z
  .object({
    status: dentalStageStatusEnum,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const assignDoctorStageSchema = z
  .object({
    doctor_id: objectId,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const scheduleDentalStageSchema = z
  .object({
    doctor_id: objectId.optional(),
    appointment_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    start_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
    utc_datetime: z.string().trim().datetime().optional(),
    duration_minutes: z.number().int().min(5).max(240).optional(),
    priority: z.enum(['ROUTINE', 'URGENT']).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const rescheduleDentalStageSchema = z
  .object({
    appointment_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    start_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:mm)'),
    utc_datetime: z.string().trim().datetime().optional(),
    duration_minutes: z.number().int().min(5).max(240).optional(),
    reschedule_reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const cancelStageAppointmentSchema = z
  .object({
    reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const dentalStageParamsSchema = z
  .object({
    stageId: objectId,
  })
  .strict();

export const episodeStageParamsSchema = z
  .object({
    episodeId: objectId,
  })
  .strict();

export const episodeStagesQuerySchema = z
  .object({
    plan_item_id: z.string().trim().optional(),
  })
  .strict();

