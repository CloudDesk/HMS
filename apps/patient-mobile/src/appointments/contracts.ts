import { z } from 'zod';

export const portalAppointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
  'SKIPPED',
  'COMPLETED',
] as const;

export const portalAppointmentSchema = z.object({
  id: z.string(),
  appointment_number: z.string(),
  patient_id: z.string(),
  doctor_id: z.string(),
  doctor_name: z.string(),
  doctor_specialization: z.string().optional().default('General Medicine'),
  department_id: z.string().optional().default(''),
  appointment_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number().optional().default(15),
  visit_type: z.string(),
  status: z.enum(portalAppointmentStatuses),
  reason: z.string().nullable().optional(),
  rescheduled_from_id: z.string().nullable().optional(),
  rescheduled_to_id: z.string().nullable().optional(),
  branch: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number().optional(),
  total_pages: z.number().optional(),
}).transform((val) => ({
  page: val.page,
  limit: val.limit,
  total: val.total,
  totalPages: val.totalPages ?? val.total_pages ?? 1,
}));

export const portalAppointmentsResponseSchema = z.object({
  data: z.array(portalAppointmentSchema),
  meta: paginationMetaSchema,
});

export const publicBranchSchema = z.object({
  id: z.string(),
  code: z.string().optional().default(''),
  name: z.string(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const publicDepartmentSchema = z.object({
  id: z.string(),
  code: z.string().optional().default(''),
  name: z.string(),
  description: z.string().nullable().optional(),
  branch: z
    .object({
      id: z.string(),
      name: z.string().optional().default(''),
      city: z.string().nullable().optional(),
    })
    .optional(),
});

export const publicDoctorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  specialization: z.string(),
  qualification: z.string().nullable().optional(),
  experience_years: z.number().nullable().optional(),
  consultation_room: z.string().nullable().optional(),
  available_days: z.array(z.string()).optional().default([]),
  branch: z
    .object({
      id: z.string(),
      name: z.string().optional().default(''),
      city: z.string().nullable().optional(),
    })
    .optional(),
  department: z
    .object({
      id: z.string(),
      name: z.string().optional().default(''),
    })
    .optional(),
});

export const slotItemSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  available: z.boolean().optional(),
  is_available: z.boolean().optional(),
  reason: z.string().optional(),
});

export const publicDoctorSlotsSchema = z.object({
  doctor_id: z.string(),
  date: z.string(),
  is_available: z.boolean(),
  unavailable_reason: z.string().nullable().optional(),
  slots: z.array(slotItemSchema).default([]),
});

export const bookAppointmentInputSchema = z.object({
  patient_id: z.string().min(1, 'Select a patient.'),
  doctor_id: z.string().min(1, 'Select a doctor.'),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD is required.'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Valid start time HH:MM is required.'),
  duration_minutes: z.number().int().min(5).max(240).default(15),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
  reason: z.string().min(3, 'Provide a reason (minimum 3 characters).').max(500),
  utc_datetime: z.string().optional(),
  clinical_history: z
    .object({
      chief_complaint: z.string().trim().max(500).optional(),
      history_present_illness: z.string().trim().max(500).optional(),
      past_medical_history: z.string().trim().max(500).optional(),
      family_history: z.string().trim().max(500).optional(),
      allergies: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export const appointmentCreatedSchema = z.object({
  id: z.string(),
  appointment_number: z.string(),
  status: z.string(),
});

export const rescheduleEligibilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.string().nullable().optional(),
  minimum_notice_hours: z.number().optional().default(2),
});

export const rescheduleAppointmentInputSchema = z.object({
  doctor_id: z.string().min(1, 'Select a doctor.'),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD is required.'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Valid start time HH:MM is required.'),
  duration_minutes: z.number().int().min(5).max(240).default(15),
});

export const clinicalHistorySchema = z.object({
  chiefComplaint: z.string().max(500).default(''),
  historyPresentIllness: z.string().max(500).default(''),
  pastMedicalHistory: z.string().max(500).default(''),
  familyHistory: z.string().max(500).default(''),
  allergies: z.string().max(500).default(''),
});

export type ClinicalHistoryFormState = z.infer<typeof clinicalHistorySchema>;

export const emptyClinicalHistory: ClinicalHistoryFormState = {
  chiefComplaint: '',
  historyPresentIllness: '',
  pastMedicalHistory: '',
  familyHistory: '',
  allergies: '',
};

export type PortalAppointment = z.infer<typeof portalAppointmentSchema>;
export type PortalAppointmentsResponse = z.infer<typeof portalAppointmentsResponseSchema>;
export type PublicBranch = z.infer<typeof publicBranchSchema>;
export type PublicDepartment = z.infer<typeof publicDepartmentSchema>;
export type PublicDoctor = z.infer<typeof publicDoctorSchema>;
export type SlotItem = z.infer<typeof slotItemSchema>;
export type PublicDoctorSlots = z.infer<typeof publicDoctorSlotsSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentInputSchema>;
export type AppointmentCreated = z.infer<typeof appointmentCreatedSchema>;
export type RescheduleEligibility = z.infer<typeof rescheduleEligibilitySchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentInputSchema>;

