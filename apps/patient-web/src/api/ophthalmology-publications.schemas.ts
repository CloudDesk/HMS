import { z } from 'zod';
const text = z.string().nullable().optional(); const number = z.number().nullable().optional();
const diagnosis = z.object({ code: text, display: text, codingSystem: text, type: text, laterality: text, status: text, severity: text, stage: text, differential: z.boolean().optional() });
const power = z.object({ sphere: number, cylinder: number, axis: number, addition: number, prism: number, prism_base: text });
const optical = z.object({ status: text, clinical_version: z.number().optional(), prescription_type: text, power: z.object({ OD: power.optional(), OS: power.optional() }).optional(),
  pupillary_distance: z.object({ format: text, binocular: number, OD: number, OS: number }).optional(), segment_height: z.object({ OD: number, OS: number }).optional(),
  lens_type: text, material: text, coating_codes: z.array(z.string()).optional(), usage_instructions: text, valid_until: text, review_date: text, approved_at: text });
const clinical = z.object({ clinical_summary: text, patient_instructions: text, follow_up_decision: text,
  treatment_plans: z.array(z.object({ diagnosis_code: text, diagnosis_laterality: text, treatment: text, category: text, priority: text, status: text })).optional() });
export const ophthalmologyPublicPayloadSchema = z.discriminatedUnion('kind', [
  optical.extend({ kind: z.literal('OPTICAL_PRESCRIPTION'), clinical_version: z.number().int().positive() }),
  z.object({ kind: z.literal('TEST_RESULT'), clinical_version: z.number().int().positive(), test_code: text, test_name: text, laterality: text,
    performed_at: text, completed_at: text, reviewed_at: text, reliability: text, report_document_ids: z.array(z.string()).optional() }),
  z.object({ kind: z.literal('CONSULTATION_SUMMARY'), clinical_version: z.number().int().positive(), approved_at: text,
    consultation: z.object({ chief_complaint: text, history_present_illness: text, past_history: text, family_history: text, allergies: text, physical_examination: text, assessment: text, treatment_plan: text }).optional(),
    diagnoses: z.array(diagnosis).optional(), clinical_review: clinical.optional(), optical_prescription: optical.nullable().optional(),
    medication_prescriptions: z.array(z.object({ status: text, patient_instructions: text, submitted_at: text,
      items: z.array(z.object({ medicine_name: text, strength: text, dosage: text, route: text, frequency: text, duration: text, quantity: number, intake_time: text, instructions: text })).optional() })).optional(),
    procedure_recommendations: z.array(z.object({ procedure_name: text, clinical_reason: text, status: text, doctor_name: text })).optional(),
    referrals: z.array(z.object({ specialty: text, priority: text, facility: text, doctor_name: text, reason: text, appointment_date: text, status: text })).optional(),
    follow_ups: z.array(z.object({ date: text, doctor_name: text, reason: text, status: text })).optional(),
  }),
]);
export const ophthalmologyPublicationSchema = z.object({ id: z.string(), source_type: z.enum(['CONSULTATION_SUMMARY', 'OPTICAL_PRESCRIPTION', 'TEST_RESULT']), source_id: z.string(), source_version: z.number().int().positive(), published_at: z.string(),
  payload: z.unknown().transform((value) => { const parsed = ophthalmologyPublicPayloadSchema.safeParse(value); return parsed.success ? parsed.data : null; }),
});
export type PortalOphthalmologyPublication = z.infer<typeof ophthalmologyPublicationSchema>;
