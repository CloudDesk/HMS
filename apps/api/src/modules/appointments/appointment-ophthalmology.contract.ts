import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const ophthalmologyAppointmentSchema = z.object({
  visit_subtype: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW']),
  affected_eye: z.enum(['OD', 'OS', 'OU', 'NOT_SPECIFIED']), service_id: id.nullable().optional().default(null),
  sub_speciality_configuration_id: id.nullable().optional().default(null), sub_speciality_code: z.string().trim().min(1).max(80).nullable().optional().default(null),
  referral_source: z.enum(['INTERNAL', 'EXTERNAL']).nullable().optional().default(null), referred_by: z.string().trim().max(160).nullable().optional().default(null),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.sub_speciality_configuration_id) !== Boolean(value.sub_speciality_code)) ctx.addIssue({ code: 'custom', path: ['sub_speciality_code'], message: 'Choose a configured sub-speciality and its version together' });
  if (value.referred_by && !value.referral_source) ctx.addIssue({ code: 'custom', path: ['referral_source'], message: 'Choose internal or external referral context' });
});
const objectId = { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{24}$' } as const;
export const ophthalmologyAppointmentJsonSchema = { type: ['object', 'null'], additionalProperties: false, required: ['visit_subtype', 'affected_eye'], properties: {
  visit_subtype: { type: 'string', enum: ['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW'] },
  affected_eye: { type: 'string', enum: ['OD', 'OS', 'OU', 'NOT_SPECIFIED'] }, service_id: objectId, sub_speciality_configuration_id: objectId,
  sub_speciality_code: { type: ['string', 'null'], minLength: 1, maxLength: 80 }, referral_source: { type: ['string', 'null'], enum: ['INTERNAL', 'EXTERNAL', null] }, referred_by: { type: ['string', 'null'], maxLength: 160 },
} } as const;
export type OphthalmologyAppointmentIntent = z.infer<typeof ophthalmologyAppointmentSchema>;
export const ophthalmologyAppointmentVisitType = { NEW_CONSULTATION: 'NEW_CONSULTATION', FOLLOW_UP: 'FOLLOW_UP', EMERGENCY: 'EMERGENCY', POST_OPERATIVE: 'REVIEW', SCREENING: 'REVIEW', PROCEDURE_REVIEW: 'REVIEW' } as const;
