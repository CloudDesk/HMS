import { z } from 'zod';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

export const chairsideImageVisitParamsSchema = z.object({
  visitId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid visit ID'),
});

export const chairsideImageEpisodeParamsSchema = z.object({
  episodeId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid episode ID'),
});

export const chairsideImageIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid chairside image ID'),
});

export const listChairsideImagesQuerySchema = z.object({
  patient_id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid patient ID').optional(),
  episode_id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid episode ID').optional(),
  tooth_number: z.coerce.number().refine(isValidFdiTooth, 'Invalid FDI tooth number').optional(),
});
