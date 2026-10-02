import { z } from 'zod';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const clinicalContextBranchSchema = z.object({ branch_id: id });
export const clinicalContextParamsSchema = z.object({
  id,
  orderType: z.enum(['LABORATORY', 'IMAGING']),
});

export const clinicalContextPrescriptionSchema = z.object({
  items: z.array(z.object({
    medicine_name: z.string().trim().min(1).max(200),
    strength: z.string().trim().max(100).nullable().optional().default(null),
    dosage: z.string().trim().min(1).max(100),
    route: z.string().trim().min(1).max(100),
    frequency: z.string().trim().min(1).max(100),
    duration: z.string().trim().min(1).max(100),
    quantity: z.number().int().positive().nullable().optional().default(null),
    instructions: z.string().trim().max(500).nullable().optional().default(null),
  })).min(1).max(100),
  follow_up_date: z.string().datetime({ offset: true }).nullable().optional(),
  doctor_instructions: nullableText(2000),
  patient_instructions: nullableText(2000),
}).strict();

export const clinicalContextOrderSchema = z.object({
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
  destination: nullableText(200),
  specimen_type: nullableText(200),
  items: z.array(z.object({
    service_id: id,
    investigation_name: z.string().trim().max(200).optional().default(''),
    category: z.string().trim().min(1).max(200),
  })).min(1).max(100),
  clinical_notes: nullableText(2000),
  instructions: nullableText(2000),
}).strict();
