import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const consentTemplateListSchema = z.object({
  branch_id: objectId,
  context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
export const saveConsentTemplateSchema = z.object({
  branch_id: objectId,
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(100),
  context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']),
  mandatory: z.boolean(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
export const consentTemplateIdSchema = z.object({ id: objectId });
export const consentRequirementSchema = z.object({
  branch_id: objectId, patient_id: objectId, context_type: z.enum(['PATIENT', 'PROCEDURE', 'ADMISSION']), context_id: objectId,
});
