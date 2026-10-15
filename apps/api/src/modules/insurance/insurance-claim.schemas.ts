import { z } from 'zod';
import { authorizationId } from './insurance-authorization.schemas.js';
export const createClaimSchema = z.object({ invoiceId: authorizationId, memberId: authorizationId.optional() }).strict();
export const listClaimsSchema = z.object({ branchId: authorizationId, limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().nonnegative().default(0) }).strict();
export const validateClaimSchema = z.object({ version: z.number().int().nonnegative() }).strict();
