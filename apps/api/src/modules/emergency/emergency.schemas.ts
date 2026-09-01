import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
export const emergencyIdSchema = z.object({ id });
export const emergencyBranchSchema = z.object({ branch_id: id });
export const emergencyListSchema = z.object({
  branch_id: id,
  department_id: id.optional(),
  status: z
    .enum([
      'REGISTERED',
      'WAITING_FOR_TRIAGE',
      'TRIAGED',
      'WAITING_FOR_DOCTOR',
      'IN_CONSULTATION',
      'IN_TREATMENT',
      'READY_FOR_DISPOSITION',
      'DISCHARGED',
      'TRANSFERRED',
      'CONVERTED_TO_IP',
      'LEFT',
      'NO_SHOW',
      'CANCELLED',
    ])
    .optional(),
  triage_level: z
    .enum([
      'LEVEL_1_CRITICAL',
      'LEVEL_2_HIGH',
      'LEVEL_3_MEDIUM',
      'LEVEL_4_LOW',
      'LEVEL_5_NON_URGENT',
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const createEmergencySchema = z
  .object({
    branch_id: id,
    department_id: id,
    patient_id: id.nullable().optional(),
    provisional_identity: z
      .object({
        display_name: z.string().trim().min(2).max(150),
        estimated_age: z.number().int().min(0).max(130).nullable().optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).nullable().optional(),
        contact: nullableText(100),
        identity_notes: nullableText(500),
      })
      .nullable()
      .optional(),
    arrival_mode: z.string().trim().min(2).max(100),
    arrival_at: z.string().datetime().optional(),
    chief_complaint: z.string().trim().min(3).max(1000),
    arrival_notes: nullableText(2000),
  })
  .superRefine((value, ctx) => {
    if (!value.patient_id && !value.provisional_identity)
      ctx.addIssue({
        code: 'custom',
        path: ['provisional_identity'],
        message: 'Existing patient or provisional identity is required',
      });
  });
const optionalVital = z.number().min(0).nullable().optional();
export const triageSchema = z.object({
  level: z.enum([
    'LEVEL_1_CRITICAL',
    'LEVEL_2_HIGH',
    'LEVEL_3_MEDIUM',
    'LEVEL_4_LOW',
    'LEVEL_5_NON_URGENT',
  ]),
  area: z.string().trim().min(2).max(100),
  pain_score: z.number().int().min(0).max(10).nullable().optional(),
  vitals: z.object({
    systolic_bp: optionalVital,
    diastolic_bp: optionalVital,
    pulse: optionalVital,
    temperature_c: z.number().min(20).max(50).nullable().optional(),
    spo2: z.number().min(0).max(100).nullable().optional(),
    respiratory_rate: optionalVital,
    gcs: z.number().min(3).max(15).nullable().optional(),
  }),
  abcde: z.object({
    airway: z.string().trim().min(1).max(100),
    breathing: z.string().trim().min(1).max(100),
    circulation: z.string().trim().min(1).max(100),
    disability: z.string().trim().min(1).max(100),
    exposure: z.string().trim().min(1).max(100),
  }),
  notes: nullableText(4000),
});
export const consultationSchema = z.object({
  doctor_id: id,
  chief_complaint: z.string().trim().min(3).max(1000),
  history: z.string().trim().max(4000).optional().default('Emergency clinical history documented.'),
  examination: z.string().trim().max(4000).optional().default('Bedside physical examination performed.'),
  diagnosis: z.string().trim().min(1).max(2000),
  plan: z.string().trim().min(1).max(4000),
  treatment: nullableText(4000),
  notes: nullableText(4000),
  ready_for_disposition: z.boolean().optional(),
});
export const orderSchema = z.object({
  order_type: z.enum(['PHARMACY', 'LABORATORY', 'IMAGING']),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
  items: z
    .array(
      z.object({
        service_id: id.optional(),
        medicine_name: z.string().trim().max(200).optional(),
        name: z.string().trim().min(1).max(200),
        category: z.string().trim().min(1).max(100),
        dosage: z.string().trim().max(100).optional(),
        route: z.string().trim().max(100).optional(),
        frequency: z.string().trim().max(100).optional(),
        duration: z.string().trim().max(100).optional(),
        quantity: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
  destination: nullableText(200),
  specimen_type: nullableText(100),
  clinical_notes: nullableText(2000),
  instructions: nullableText(2000),
});
export const dispositionSchema = z
  .object({
    decision: z.enum(['DISCHARGE', 'ADMIT', 'TRANSFER', 'LEFT']),
    reason: nullableText(1000),
    summary: nullableText(4000),
    instructions: nullableText(4000),
    transfer_destination: nullableText(300),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'DISCHARGE' && (!value.summary || !value.instructions))
      ctx.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Discharge summary and instructions are required',
      });
    if (value.decision === 'TRANSFER' && (!value.reason || !value.transfer_destination))
      ctx.addIssue({
        code: 'custom',
        path: ['transfer_destination'],
        message: 'Transfer reason and destination are required',
      });
    if (value.decision === 'LEFT' && !value.reason)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required' });
  });
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
export const linkPatientSchema = z.object({
  patient_id: id,
  reason: z.string().trim().min(3).max(1000).optional(),
});
export const priorityOverrideSchema = z.object({
  level: triageSchema.shape.level,
  reason: z.string().trim().min(3).max(1000),
});
export const emergencyReferralListSchema = z.object({
  booked: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const emergencyReferralSchema = z.object({
  target_department_id: id,
  target_doctor_id: id.nullable().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
  reason: z.string().trim().min(3).max(1000),
  clinical_notes: z.string().trim().min(3).max(4000),
});
export const bookEmergencyReferralSchema = z.object({
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  utc_datetime: z.string().datetime(),
  duration_minutes: z.number().int().min(5).max(240),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
  priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']).optional(),
  notes: nullableText(2000),
});
