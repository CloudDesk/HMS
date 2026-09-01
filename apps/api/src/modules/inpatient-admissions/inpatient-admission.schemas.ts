import { z } from 'zod';
import { ADMISSION_SOURCE_TYPES, ADMISSION_TYPES } from './inpatient-admission.types.js';
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const referenceId = z
  .union([z.string().trim().max(100), z.literal(''), z.null(), z.undefined()])
  .transform((val) => (val && typeof val === 'string' && val.trim().length > 0 ? val.trim() : null));

export const createInpatientAdmissionSchema = z.object({ patient_id: id, branch_id: id, ward_id: id, bed_id: id, hold_id: referenceId.optional(), admitting_doctor_id: id, department_id: id, admission_date: z.string().datetime({ offset: true }), admission_type: z.enum(['MEDICAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'OBSERVATION', 'OTHER']), reason: text('Reason', 500), notes: z.string().trim().max(1000).nullable().optional() });
export const saveDischargeSummarySchema = z.object({
  hemodynamic_stability_24h: z.boolean(),
  post_op_recovery_cleared: z.boolean(),
  home_oral_med_converted: z.boolean(),
  summary_finalized: z.boolean(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();
export const listInpatientAdmissionsSchema = z.object({ branch_id: id, status: z.enum(['DRAFT', 'ADMITTED', 'DISCHARGED', 'CANCELLED']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const inpatientAdmissionIdSchema = z.object({ id });
export const createInpatientRoundNoteSchema = z.object({
  subjective: text('Subjective findings', 4000),
  objective: text('Objective findings', 4000),
  assessment: text('Assessment', 4000),
  plan: text('Plan', 4000),
}).strict();
export const createInpatientVitalSchema = z.object({
  bp_systolic: z.number().int().min(30).max(300),
  bp_diastolic: z.number().int().min(20).max(200),
  heart_rate: z.number().int().min(20).max(300),
  temperature: z.number().min(25).max(45),
  spo2: z.number().int().min(0).max(100),
  respiratory_rate: z.number().int().min(0).max(100),
  pain_score: z.number().int().min(0).max(10),
}).strict();
const sourceType = z.enum(ADMISSION_SOURCE_TYPES);
const admissionType = z.enum(ADMISSION_TYPES);
const optionalId = z
  .union([z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier'), z.literal(''), z.null(), z.undefined()])
  .transform((val) => (val && typeof val === 'string' && val.trim().length > 0 ? val : null));
export const createAdmissionRequestSchema = z.object({ patient_id: id, branch_id: id, department_id: id, recommending_doctor_id: id, source_type: sourceType, source_id: optionalId, admission_type: admissionType, priority: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']), reason: text('Reason', 500), notes: z.string().trim().max(1000).nullable().optional() }).strict();
export const listAdmissionRequestsSchema = z.object({ branch_id: id, status: z.enum(['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION', 'CONFIRMED', 'CANCELLED']).optional(), source_type: sourceType.optional(), patient_id: id.optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const admissionRequestActionSchema = z.object({ id, });
export const admissionRequestBranchSchema = z.object({ branch_id: id });
export const validateAdmissionRequestSchema = z.object({ ward_id: id, bed_id: id, hold_id: referenceId.optional(), consent_document_id: referenceId.optional(), deposit_invoice_id: referenceId.optional() }).strict();
export const confirmAdmissionRequestSchema = validateAdmissionRequestSchema.extend({ admission_date: z.string().datetime({ offset: true }) }).strict();
export const cancelAdmissionRequestSchema = z.object({ reason: text('Cancellation reason', 500) }).strict();
