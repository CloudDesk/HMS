import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const date = z.string().date();
export const phaseTwoReportQuerySchema = z.object({ branch_id: id, date_from: date.optional(), date_to: date.optional(), department_id: id.optional(), doctor_id: id.optional(), ward_id: id.optional(), status: z.string().trim().max(50).optional(), source_type: z.enum(['OPD', 'OPD_VISIT', 'EMERGENCY', 'EMERGENCY_ENCOUNTER', 'IP_ADMISSION', 'PROCEDURE', 'PROCEDURE_BOOKING', 'SURGERY']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).refine((value) => !value.date_from || !value.date_to || value.date_from <= value.date_to, { message: 'Date from must not be after date to' });
