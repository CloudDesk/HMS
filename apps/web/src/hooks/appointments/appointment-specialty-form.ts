import { z } from 'zod';
import { appointmentOphthalmologySchema } from '../../api/appointments-ophthalmology';
export const appointmentSpecialtyFormFields = { specialty_enabled: z.boolean(), specialty_subtype: z.string(), specialty_eye: z.string(), specialty_service_id: z.string(), specialty_configuration_id: z.string(), specialty_code: z.string(), specialty_referral_source: z.string(), specialty_referred_by: z.string().max(160) };
export type AppointmentSpecialtyForm = z.infer<z.ZodObject<typeof appointmentSpecialtyFormFields>>;
export const emptyAppointmentSpecialtyForm: AppointmentSpecialtyForm = { specialty_enabled: false, specialty_subtype: '', specialty_eye: '', specialty_service_id: '', specialty_configuration_id: '', specialty_code: '', specialty_referral_source: '', specialty_referred_by: '' };
export function appointmentSpecialtyValue(form: AppointmentSpecialtyForm) { return !form.specialty_enabled ? null : appointmentOphthalmologySchema.parse({ visit_subtype: form.specialty_subtype, affected_eye: form.specialty_eye, service_id: form.specialty_service_id || null, sub_speciality_configuration_id: form.specialty_configuration_id || null, sub_speciality_code: form.specialty_code || null, referral_source: form.specialty_referral_source || null, referred_by: form.specialty_referred_by.trim() || null }); }
export function validateAppointmentSpecialtyForm(form: AppointmentSpecialtyForm, ctx: z.RefinementCtx) {
  if (!form.specialty_enabled) return;
  const result = appointmentOphthalmologySchema.safeParse({ visit_subtype: form.specialty_subtype, affected_eye: form.specialty_eye, service_id: form.specialty_service_id || null, sub_speciality_configuration_id: form.specialty_configuration_id || null, sub_speciality_code: form.specialty_code || null, referral_source: form.specialty_referral_source || null, referred_by: form.specialty_referred_by.trim() || null });
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: ['specialty_subtype'], message: issue.message });
}
