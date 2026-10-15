import { z } from 'zod';

export const authorizationStatuses = ['DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED'] as const;
export type AuthorizationStatus = typeof authorizationStatuses[number];
export const authorizationId = z.string().regex(/^[a-f\d]{24}$/i);
export const authorizationRequestSchema = z.object({
  memberId: authorizationId,
  branchId: authorizationId,
  encounterId: authorizationId.optional(), // Existing OPD visit reference.
  requestingDoctorId: authorizationId.optional(),
  clinicalDocumentId: authorizationId.optional(),
  requestedDate: z.iso.date(),
  authorizationContext: z.string().trim().min(1).max(100),
  lines: z.array(z.object({ serviceId: authorizationId, requestedQuantity: z.number().int().positive().max(10000) }).strict()).min(1).max(50),
}).strict().refine(data => new Set(data.lines.map(line => line.serviceId)).size === data.lines.length, 'Duplicate services are not allowed');
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
export const authorizationActionSchema = z.object({ version: z.number().int().nonnegative() }).strict();
export const authorizationCancelSchema = authorizationActionSchema.extend({ reason: z.string().trim().min(1).max(250) });
export const authorizationListSchema = z.object({
  branchId: authorizationId,
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export const authorizationDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PENDING', 'FAILED']),
  externalReference: z.string().max(120).optional(),
  lines: z.array(z.object({
    serviceId: authorizationId,
    approvedQuantity: z.number().nonnegative().optional(),
    approvedAmount: z.number().nonnegative().optional(),
    rejectedQuantity: z.number().nonnegative().optional(),
  }).strip()).max(50).default([]),
}).strip();
export type AuthorizationDecision = z.infer<typeof authorizationDecisionSchema>;
