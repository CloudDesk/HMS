import { z } from 'zod';

export const publicPaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export function createPublicListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: publicPaginationMetaSchema,
  });
}

export const publicBranchSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  short_name: z.string().nullable().optional().transform((v) => v ?? null),
  email: z.string().nullable().optional().transform((v) => v ?? null),
  phone: z.string().nullable().optional().transform((v) => v ?? null),
  address: z.string().nullable().optional().transform((v) => v ?? null),
  city: z.string().nullable().optional().transform((v) => v ?? null),
  state: z.string().nullable().optional().transform((v) => v ?? null),
  country: z.string().nullable().optional().transform((v) => v ?? null),
  postal_code: z.string().nullable().optional().transform((v) => v ?? null),
});

export const publicDepartmentSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  branch: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string().nullable().optional().transform((v) => v ?? null),
  }),
});

export const publicServiceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  service_type: z.enum(['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE']),
  category: z.string().nullable().optional().transform((v) => v ?? null),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  standard_price: z.number(),
  department: z.object({
    id: z.string(),
    name: z.string(),
  }),
  branch: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string().nullable().optional().transform((v) => v ?? null),
  }),
});

export const publicDoctorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  specialization: z.string(),
  qualification: z.string().nullable().optional().transform((v) => v ?? null),
  experience_years: z.number().nullable().optional().transform((v) => v ?? null),
  consultation_room: z.string().nullable().optional().transform((v) => v ?? null),
  available_days: z.array(z.string()),
  branch: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string().nullable().optional().transform((v) => v ?? null),
  }),
  department: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const publicDoctorSlotsSchema = z.object({
  doctor_id: z.string(),
  date: z.string(),
  is_available: z.boolean(),
  unavailable_reason: z.string().nullable().optional().transform((v) => v ?? null),
  slots: z.array(
    z.object({
      start_time: z.string(),
      end_time: z.string(),
      available: z.boolean().optional(),
      is_available: z.boolean().optional(),
      reason: z.string().optional(),
    }),
  ),
});

export const patientPortalContextSchema = z.object({
  account: z.object({
    type: z.enum(['PATIENT', 'GUARDIAN']),
    full_name: z.string(),
    email: z.string().nullable().optional().transform((v) => v ?? null),
    phone: z.string().nullable().optional().transform((v) => v ?? null),
    guardian_profile: z
      .object({
        relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
        address: z.record(z.string(), z.string().nullable().optional().transform((v) => v ?? null)),
        identification: z.object({
          type: z.string().nullable().optional().transform((v) => v ?? null),
          number: z.string().nullable().optional().transform((v) => v ?? null),
        }),
        legal_consent_accepted: z.boolean(),
        legal_consent_accepted_at: z.string(),
      })
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  }),
  patients: z.array(
    z.object({
      id: z.string(),
      patient_number: z.string(),
      full_name: z.string(),
      date_of_birth: z.string(),
      gender: z.string(),
      relationship: z.enum(['SELF', 'PARENT', 'LEGAL_GUARDIAN']),
      is_primary: z.boolean(),
      preferred_branch: z
        .object({
          id: z.string(),
          name: z.string(),
          city: z.string().nullable().optional().transform((v) => v ?? null),
          address: z.string().nullable().optional().transform((v) => v ?? null),
        })
        .nullable()
        .optional()
        .transform((v) => v ?? null),
    }),
  ),
});

export const portalAppointmentSchema = z.object({
  id: z.string(),
  appointment_number: z.string(),
  patient_id: z.string(),
  doctor_id: z.string(),
  doctor_name: z.string(),
  doctor_specialization: z.string(),
  department_id: z.string(),
  appointment_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number(),
  visit_type: z.string(),
  status: z.enum([
    'SCHEDULED',
    'CONFIRMED',
    'CHECKED_IN',
    'CANCELLED',
    'RESCHEDULED',
    'NO_SHOW',
    'SKIPPED',
    'COMPLETED',
  ]),
  reason: z.string().nullable().optional().transform((v) => v ?? null),
  rescheduled_from_id: z.string().nullable().optional().transform((v) => v ?? null),
  rescheduled_to_id: z.string().nullable().optional().transform((v) => v ?? null),
  branch: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable().optional().transform((v) => v ?? null),
      address: z.string().nullable().optional().transform((v) => v ?? null),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const portalDocumentSchema = z.object({
  id: z.string(),
  patient_id: z.string(),
  document_type: z.enum(['INSURANCE', 'CLINICAL', 'OTHER']),
  title: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.number(),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  source: z.enum(['HOSPITAL', 'PATIENT', 'GUARDIAN']),
  review_status: z.enum(['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED']),
  document_date: z.string().nullable().optional().transform((v) => v ?? null),
  provider_name: z.string().nullable().optional().transform((v) => v ?? null),
  created_at: z.string(),
});

export const portalInvoiceDetailsSchema = z.object({
  id: z.string(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']),
  subtotal: z.number(),
  discount_amount: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  paid_amount: z.number(),
  balance_amount: z.number(),
  patient: z
    .object({
      id: z.string(),
      patient_number: z.string(),
      name: z.string(),
      phone: z.string().nullable().optional().transform((v) => v ?? null),
      email: z.string().nullable().optional().transform((v) => v ?? null),
      address: z.record(z.string(), z.string().nullable().optional().transform((v) => v ?? null)),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  branch: z
    .object({
      id: z.string(),
      name: z.string(),
      phone: z.string().nullable().optional().transform((v) => v ?? null),
      email: z.string().nullable().optional().transform((v) => v ?? null),
      address: z.string().nullable().optional().transform((v) => v ?? null),
      city: z.string().nullable().optional().transform((v) => v ?? null),
      state: z.string().nullable().optional().transform((v) => v ?? null),
      country: z.string().nullable().optional().transform((v) => v ?? null),
      postal_code: z.string().nullable().optional().transform((v) => v ?? null),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  items: z.array(
    z.object({
      id: z.string(),
      service_name: z.string(),
      service_type: z.enum(['CONSULTATION', 'LAB_TEST', 'IMAGING_SERVICE', 'PHARMACY']),
      quantity: z.number(),
      unit_price: z.number(),
      line_total: z.number(),
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string(),
      payment_number: z.string(),
      payment_date: z.string(),
      amount: z.number(),
      payment_method: z.string(),
      reference_number: z.string().nullable().optional().transform((v) => v ?? null),
    }),
  ),
});

export const patientPortalOverviewSchema = z.object({
  patient: z.object({
    id: z.string(),
    patient_number: z.string(),
    first_name: z.string(),
    middle_name: z.string().nullable().optional().transform((v) => v ?? null),
    last_name: z.string(),
    date_of_birth: z.string(),
    gender: z.string(),
    phone: z.string().nullable().optional().transform((v) => v ?? null),
    email: z.string().nullable().optional().transform((v) => v ?? null),
    address: z.record(z.string(), z.string().nullable().optional().transform((v) => v ?? null)),
    emergency_contact: z.object({
      name: z.string().nullable().optional().transform((v) => v ?? null),
      relationship: z.string().nullable().optional().transform((v) => v ?? null),
      phone: z.string().nullable().optional().transform((v) => v ?? null),
    }),
    blood_group: z.string().nullable().optional().transform((v) => v ?? null),
    status: z.string(),
    created_at: z.string(),
  }),
  summary: z.object({
    upcoming_appointments: z.number(),
    outstanding_invoices: z.number(),
    verified_lab_results: z.number(),
    verified_imaging_reports: z.number(),
  }),
  appointments: z.array(
    z.object({
      id: z.string(),
      appointment_number: z.string(),
      doctor_name: z.string(),
      doctor_specialization: z.string(),
      appointment_date: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      visit_type: z.string(),
      status: z.string(),
      reason: z.string().nullable().optional().transform((v) => v ?? null),
      branch: z
        .object({
          id: z.string(),
          name: z.string(),
          city: z.string().nullable().optional().transform((v) => v ?? null),
          address: z.string().nullable().optional().transform((v) => v ?? null),
        })
        .nullable()
        .optional()
        .transform((v) => v ?? null),
    }),
  ),
  invoices: z.array(
    z.object({
      id: z.string(),
      invoice_number: z.string(),
      invoice_date: z.string(),
      status: z.string(),
      total_amount: z.number(),
      paid_amount: z.number(),
      balance_amount: z.number(),
    }),
  ),
  laboratory_results: z.array(
    z.object({
      id: z.string(),
      result_items: z.array(
        z.object({
          serviceName: z.string(),
          value: z.string(),
          unit: z.string().nullable().optional().transform((v) => v ?? null),
          referenceRange: z.string().nullable().optional().transform((v) => v ?? null),
          comments: z.string().nullable().optional().transform((v) => v ?? null),
        }),
      ),
      remarks: z.string().nullable().optional().transform((v) => v ?? null),
      entered_at: z.string(),
      verified_at: z.string(),
    }),
  ),
  imaging_reports: z.array(
    z.object({
      id: z.string(),
      findings: z.string(),
      impression: z.string(),
      recommendations: z.string().nullable().optional().transform((v) => v ?? null),
      entered_at: z.string(),
      verified_at: z.string(),
    }),
  ),
  prescriptions: z.array(
    z.object({
      id: z.string(),
      doctor_name: z.string(),
      status: z.enum(['SUBMITTED', 'DISPENSED']),
      submitted_at: z.string(),
      follow_up_date: z.string().nullable().optional().transform((v) => v ?? null),
      doctor_instructions: z.string().nullable().optional().transform((v) => v ?? null),
      patient_instructions: z.string().nullable().optional().transform((v) => v ?? null),
      items: z.array(
        z.object({
          id: z.string(),
          medicine_name: z.string(),
          strength: z.string().nullable().optional().transform((v) => v ?? null),
          dosage: z.string(),
          route: z.string(),
          frequency: z.string(),
          duration: z.string(),
          quantity: z.number().nullable().optional().transform((v) => v ?? null),
          instructions: z.string().nullable().optional().transform((v) => v ?? null),
        }),
      ),
    }),
  ),
  purchased_medicines: z.array(
    z.object({
      id: z.string(),
      medicine_name: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total_amount: z.number(),
      purchased_at: z.string(),
      invoice_number: z.string(),
      payment_status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID']),
      branch: z
        .object({
          id: z.string(),
          name: z.string(),
          city: z.string().nullable().optional().transform((v) => v ?? null),
        })
        .nullable()
        .optional()
        .transform((v) => v ?? null),
    }),
  ),
});

export const appointmentCreatedSchema = z.object({
  id: z.string(),
  appointment_number: z.string(),
  status: z.string(),
});

export const patientSavedSchema = z.object({
  patientId: z.string(),
  patientNumber: z.string().optional(),
});

export const guardianUpdatedSchema = z.object({
  patientId: z.string(),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
});

export const rescheduleEligibilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.string().nullable().optional().transform((v) => v ?? null),
  minimum_notice_hours: z.number(),
});

export const provisionAccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  status: z.string(),
});
