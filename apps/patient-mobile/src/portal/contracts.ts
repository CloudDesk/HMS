import { z } from 'zod';

export const portalPatientSchema = z.object({
  id: z.string(),
  patient_number: z.string(),
  full_name: z.string(),
  date_of_birth: z.string(),
  gender: z.string(),
  relationship: z.enum(['SELF', 'PARENT', 'LEGAL_GUARDIAN']),
  is_primary: z.boolean(),
  profile_photo_url: z.string().nullable().optional(),
  preferred_branch: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const portalAccountSchema = z.object({
  type: z.enum(['PATIENT', 'GUARDIAN']),
  full_name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  guardian_profile: z
    .object({
      relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
      address: z.record(z.string(), z.string().nullable().optional()).optional(),
      identification: z
        .object({
          type: z.string().nullable().optional(),
          number: z.string().nullable().optional(),
        })
        .optional(),
      legal_consent_accepted: z.boolean(),
      legal_consent_accepted_at: z.string(),
    })
    .nullable()
    .optional(),
});

export const patientPortalContextSchema = z.object({
  account: portalAccountSchema,
  patients: z.array(portalPatientSchema),
});

export const portalPatientDetailSchema = z.object({
  id: z.string(),
  patient_number: z.string(),
  first_name: z.string(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string(),
  date_of_birth: z.string(),
  gender: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.record(z.string(), z.unknown()).nullable().optional(),
  emergency_contact: z
    .object({
      name: z.string().nullable().optional(),
      relationship: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  blood_group: z.string().nullable().optional(),
  profile_photo_url: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string(),
});

export const portalSummarySchema = z.object({
  upcoming_appointments: z.number().default(0),
  outstanding_invoices: z.number().default(0),
  verified_lab_results: z.number().default(0),
  verified_imaging_reports: z.number().default(0),
});

export const patientPortalOverviewSchema = z.object({
  patient: portalPatientDetailSchema,
  summary: portalSummarySchema,
  appointments: z.array(z.record(z.string(), z.unknown())).default([]),
  invoices: z.array(z.record(z.string(), z.unknown())).default([]),
  laboratory_results: z.array(z.record(z.string(), z.unknown())).default([]),
  imaging_reports: z.array(z.record(z.string(), z.unknown())).default([]),
  prescriptions: z.array(z.record(z.string(), z.unknown())).default([]),
  purchased_medicines: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type PortalPatient = z.infer<typeof portalPatientSchema>;
export type PortalAccount = z.infer<typeof portalAccountSchema>;
export type PortalContext = z.infer<typeof patientPortalContextSchema>;
export type PortalPatientDetail = z.infer<typeof portalPatientDetailSchema>;
export type PortalSummary = z.infer<typeof portalSummarySchema>;
export type PortalOverview = z.infer<typeof patientPortalOverviewSchema>;
