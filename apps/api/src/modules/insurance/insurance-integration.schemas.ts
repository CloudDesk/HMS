import { z } from 'zod';
import { authorizationId } from './insurance-authorization.schemas.js';
export const insuranceEncounterQuery = z.object({ encounterType: z.enum(['OPD', 'IPD', 'EMERGENCY']).default('OPD') }).strict();
export const encounterCoverageSchema = z.object({ memberId: authorizationId.optional(), quantity: z.number().int().positive().max(10000).default(1) }).strict();
export const shaMappingSchema = z.object({
  serviceId: authorizationId, interventionCode: z.string().trim().min(1).max(120),
  effectiveFrom: z.iso.date(), effectiveTo: z.iso.date().optional(),
}).strict().refine(value => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, 'Invalid effective period');
export const shaMappingListSchema = z.object({ serviceId: authorizationId.optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) }).strict();
export const shaMappingDeactivateSchema = z.object({ version: z.number().int().nonnegative(), reason: z.string().trim().min(1).max(250) }).strict();
export type ShaMappingInput = z.infer<typeof shaMappingSchema>;
