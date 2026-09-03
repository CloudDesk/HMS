import { authSessionResponseSchema } from '../auth/auth.schemas.js';
import { apiResponseSchema } from '../../validators/common-schemas.js';

const nullableTextProperties = {
  line1: { type: ['string', 'null'] },
  line2: { type: ['string', 'null'] },
  city: { type: ['string', 'null'] },
  state: { type: ['string', 'null'] },
  country: { type: ['string', 'null'] },
  postalCode: { type: ['string', 'null'] },
} as const;

export const patientPortalSessionResponseSchema = authSessionResponseSchema;

export const patientOtpRequestResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['success', 'resendAvailableAt'],
  additionalProperties: false,
  properties: {
    success: { type: 'boolean' },
    resendAvailableAt: { type: 'string' },
  },
});

export const patientOtpVerifyResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['success'],
  additionalProperties: false,
  properties: {
    success: { type: 'boolean' },
  },
});

export const patientPortalContextResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['account', 'patients'],
  additionalProperties: false,
  properties: {
    account: {
      type: 'object',
      required: ['type', 'full_name', 'email', 'phone', 'guardian_profile'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['PATIENT', 'GUARDIAN'] },
        full_name: { type: 'string' },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        guardian_profile: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              required: ['relationship', 'address', 'identification', 'legal_consent_accepted', 'legal_consent_accepted_at'],
              additionalProperties: false,
              properties: {
                relationship: { type: 'string', enum: ['PARENT', 'LEGAL_GUARDIAN'] },
                address: { type: 'object', additionalProperties: false, properties: nullableTextProperties },
                identification: {
                  type: 'object',
                  additionalProperties: false,
                  properties: { type: { type: ['string', 'null'] }, number: { type: ['string', 'null'] } },
                },
                legal_consent_accepted: { type: 'boolean' },
                legal_consent_accepted_at: { type: 'string' },
              },
            },
          ],
        },
      },
    },
    patients: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'patient_number', 'full_name', 'date_of_birth', 'gender', 'relationship', 'is_primary', 'preferred_branch'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          patient_number: { type: 'string' },
          full_name: { type: 'string' },
          date_of_birth: { type: 'string' },
          gender: { type: 'string' },
          relationship: { type: 'string', enum: ['SELF', 'PARENT', 'LEGAL_GUARDIAN'] },
          is_primary: { type: 'boolean' },
          preferred_branch: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                required: ['id', 'name', 'city', 'address'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  city: { type: ['string', 'null'] },
                  address: { type: ['string', 'null'] },
                },
              },
            ],
          },
        },
      },
    },
  },
});

export const patientPortalOverviewResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['patient', 'summary', 'appointments', 'invoices', 'laboratory_results', 'imaging_reports', 'prescriptions', 'purchased_medicines'],
  additionalProperties: false,
  properties: {
    patient: {
      type: 'object',
      required: ['id', 'patient_number', 'first_name', 'last_name', 'date_of_birth', 'gender'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        patient_number: { type: 'string' },
        first_name: { type: 'string' },
        middle_name: { type: ['string', 'null'] },
        last_name: { type: 'string' },
        date_of_birth: { type: 'string' },
        gender: { type: 'string' },
        phone: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        address: { type: 'object', additionalProperties: true },
        emergency_contact: { type: 'object', additionalProperties: true },
        blood_group: { type: ['string', 'null'] },
        status: { type: 'string' },
        created_at: { type: 'string' },
      },
    },
    summary: {
      type: 'object',
      required: ['upcoming_appointments', 'outstanding_invoices', 'verified_lab_results', 'verified_imaging_reports'],
      additionalProperties: false,
      properties: {
        upcoming_appointments: { type: 'integer' },
        outstanding_invoices: { type: 'integer' },
        verified_lab_results: { type: 'integer' },
        verified_imaging_reports: { type: 'integer' },
      },
    },
    appointments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          appointment_number: { type: 'string' },
          doctor_name: { type: 'string' },
          doctor_specialization: { type: 'string' },
          appointment_date: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          visit_type: { type: 'string' },
          status: { type: 'string' },
          reason: { type: ['string', 'null'] },
          branch: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  city: { type: ['string', 'null'] },
                  address: { type: ['string', 'null'] },
                },
              },
            ],
          },
        },
      },
    },
    invoices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string' },
          status: { type: 'string' },
          total_amount: { type: 'number' },
          paid_amount: { type: 'number' },
          balance_amount: { type: 'number' },
        },
      },
    },
    laboratory_results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          result_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                serviceName: { type: 'string' },
                value: { type: 'string' },
                unit: { type: ['string', 'null'] },
                referenceRange: { type: ['string', 'null'] },
                comments: { type: ['string', 'null'] },
              },
            },
          },
          remarks: { type: ['string', 'null'] },
          entered_at: { type: 'string' },
          verified_at: { type: 'string' },
        },
      },
    },
    imaging_reports: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          findings: { type: 'string' },
          impression: { type: 'string' },
          recommendations: { type: ['string', 'null'] },
          entered_at: { type: 'string' },
          verified_at: { type: 'string' },
        },
      },
    },
    prescriptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          doctor_name: { type: 'string' },
          status: { type: 'string' },
          submitted_at: { type: 'string' },
          follow_up_date: { type: ['string', 'null'] },
          doctor_instructions: { type: ['string', 'null'] },
          patient_instructions: { type: ['string', 'null'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                medicine_name: { type: 'string' },
                strength: { type: ['string', 'null'] },
                dosage: { type: 'string' },
                route: { type: 'string' },
                frequency: { type: 'string' },
                duration: { type: 'string' },
                quantity: { type: ['number', 'null'] },
                instructions: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    purchased_medicines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          medicine_name: { type: 'string' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
          total_amount: { type: 'number' },
          purchased_at: { type: 'string' },
          invoice_number: { type: 'string' },
          payment_status: { type: 'string' },
          branch: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  city: { type: ['string', 'null'] },
                },
              },
            ],
          },
        },
      },
    },
  },
});

export const portalAppointmentItemSchema = {
  type: 'object',
  required: ['id', 'appointment_number', 'patient_id', 'doctor_id', 'doctor_name', 'appointment_date', 'start_time', 'end_time', 'status'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    appointment_number: { type: 'string' },
    patient_id: { type: 'string' },
    doctor_id: { type: 'string' },
    doctor_name: { type: 'string' },
    doctor_specialization: { type: 'string' },
    department_id: { type: 'string' },
    appointment_date: { type: 'string' },
    start_time: { type: 'string' },
    end_time: { type: 'string' },
    duration_minutes: { type: 'number' },
    visit_type: { type: 'string' },
    status: { type: 'string' },
    reason: { type: ['string', 'null'] },
    rescheduled_from_id: { type: ['string', 'null'] },
    rescheduled_to_id: { type: ['string', 'null'] },
    branch: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            city: { type: ['string', 'null'] },
            address: { type: ['string', 'null'] },
          },
        },
      ],
    },
  },
} as const;

export const patientPortalAppointmentsResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['data', 'meta'],
  additionalProperties: false,
  properties: {
    data: { type: 'array', items: portalAppointmentItemSchema },
    meta: {
      type: 'object',
      required: ['page', 'limit', 'total', 'total_pages'],
      additionalProperties: false,
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        total_pages: { type: 'integer' },
      },
    },
  },
});

export const patientPortalInvoiceDetailResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['id', 'invoice_number', 'invoice_date', 'status', 'total_amount', 'paid_amount', 'balance_amount'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    invoice_number: { type: 'string' },
    invoice_date: { type: 'string' },
    status: { type: 'string' },
    subtotal: { type: 'number' },
    discount_amount: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    paid_amount: { type: 'number' },
    balance_amount: { type: 'number' },
    patient: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            patient_number: { type: 'string' },
            name: { type: 'string' },
            phone: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            address: { type: 'object', additionalProperties: true },
          },
        },
      ],
    },
    branch: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            phone: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            address: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            state: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            postal_code: { type: ['string', 'null'] },
          },
        },
      ],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          service_name: { type: 'string' },
          service_type: { type: 'string' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
          line_total: { type: 'number' },
        },
      },
    },
    payments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          payment_number: { type: 'string' },
          amount: { type: 'number' },
          payment_method: { type: 'string' },
          payment_date: { type: 'string' },
          reference_number: { type: ['string', 'null'] },
        },
      },
    },
  },
});

export const patientPortalDocumentsResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['data', 'meta'],
  additionalProperties: false,
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          document_type: { type: 'string' },
          title: { type: 'string' },
          file_name: { type: 'string' },
          mime_type: { type: 'string' },
          file_size_bytes: { type: 'number' },
          provider_name: { type: ['string', 'null'] },
          document_date: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          created_at: { type: 'string' },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        total_pages: { type: 'integer' },
      },
    },
  },
});

