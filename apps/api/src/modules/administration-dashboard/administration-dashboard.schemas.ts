import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const executiveDashboardQuerySchema = z.object({
  branch_id: objectId.optional(),
  range: z.enum(['week', 'month', 'year']).default('week'),
  schedule_date: z.string().date().optional(),
});
