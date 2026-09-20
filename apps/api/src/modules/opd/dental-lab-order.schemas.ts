import { z } from 'zod';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const prostheticTypeSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
  z.enum(['CROWN', 'BRIDGE', 'OTHER']),
);

export const dentalLabOrderStatusSchema = z.enum([
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'READY',
  'CANCELLED',
]);

export const createDentalLabOrderSchema = z.object({
  patient_id: id,
  treatment_episode_id: id,
  treatment_stage_id: id,
  treatment_plan_item_id: z.string().trim().min(1).optional().nullable(),
  tooth_number: z
    .number()
    .int('Tooth number must be an integer')
    .refine(isValidFdiTooth, {
      message:
        'Invalid FDI tooth number. Must be valid permanent (11-18, 21-28, 31-38, 41-48) or primary (51-55, 61-65, 71-75, 81-85)',
    })
    .optional()
    .nullable(),
  prosthetic_type: prostheticTypeSchema,
  description: z.string().trim().min(1, 'Description is required'),
  assigned_lab_id: id.optional().nullable(),
  status: dentalLabOrderStatusSchema.optional(),
});

export const updateDentalLabOrderStatusSchema = z
  .object({
    status: dentalLabOrderStatusSchema,
    remarks: z.string().trim().optional().nullable(),
    cancellation_reason: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'CANCELLED') {
        return Boolean(data.cancellation_reason && data.cancellation_reason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Cancellation reason is required when cancelling a lab order',
      path: ['cancellation_reason'],
    },
  );

export const dentalLabOrderParamsSchema = z.object({
  id: id,
});

export const episodeLabOrdersParamsSchema = z.object({
  episodeId: id,
});
