import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
export const createInpatientAdmissionSchema = z.object({ patient_id: id, branch_id: id, ward_id: id, bed_id: id, admitting_doctor_id: id, department_id: id, admission_date: z.string().datetime({ offset: true }), admission_type: z.enum(['MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OBSERVATION', 'OTHER']), reason: text('Reason', 500), notes: z.string().trim().max(1000).nullable().optional() });
export const listInpatientAdmissionsSchema = z.object({ branch_id: id, status: z.enum(['DRAFT', 'ADMITTED', 'CANCELLED']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const inpatientAdmissionIdSchema = z.object({ id });
