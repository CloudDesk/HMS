import { apiResponseSchema } from '../../validators/common-schemas.js';

const addressSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    line1: { type: ['string', 'null'] },
    line2: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    postal_code: { type: ['string', 'null'] },
  },
} as const;

const emergencyContactSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: ['string', 'null'] },
    relationship: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
  },
} as const;

export const patientIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const patientDocumentIdParamsSchema = {
  type: 'object',
  required: ['id', 'documentId'],
  properties: {
    id: { type: 'string', minLength: 1 },
    documentId: { type: 'string', minLength: 1 },
  },
} as const;

export const reviewPatientDocumentBodySchema = {
  type: 'object',
  required: ['review_status'],
  additionalProperties: false,
  properties: {
    review_status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
    review_notes: { type: ['string', 'null'], maxLength: 500 },
  },
} as const;

export const listPatientsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DECEASED'] },
    gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['patient_number', 'first_name', 'last_name', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const listPatientDocumentsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    document_type: { type: 'string', enum: ['IDENTITY', 'INSURANCE', 'CLINICAL', 'CONSENT', 'OTHER'] },
    visit_id: { type: 'string', minLength: 1 },
    admission_id: { type: 'string', minLength: 1 },
    procedure_id: { type: 'string', minLength: 1 },
    context_type: { type: 'string', enum: ['PATIENT', 'PROCEDURE', 'ADMISSION'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const listPatientTimelineQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    event_type: {
      type: 'string',
      enum: ['REGISTRATION', 'PROFILE_UPDATED', 'DOCUMENT_ADDED', 'DOCUMENT_DELETED', 'CONSENT_ADDED', 'CONSENT_VERIFIED', 'OPD_REFERRAL_BOOKED'],
    },
    from: { type: 'string', minLength: 1 },
    to: { type: 'string', minLength: 1 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const createPatientBodySchema = {
  type: 'object',
  required: ['last_name', 'date_of_birth', 'gender', 'phone'],
  additionalProperties: false,
  properties: {
    first_name: { type: ['string', 'null'] },
    middle_name: { type: ['string', 'null'] },
    last_name: { type: 'string', minLength: 1 },
    date_of_birth: { type: 'string', minLength: 1 },
    gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] },
    phone: { type: 'string', minLength: 1 },
    email: { type: ['string', 'null'] },
    address: addressSchema,
    emergency_contact: emergencyContactSchema,
    registration_branch_id: { type: ['string', 'null'] },
    blood_group: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DECEASED'] },
    parent_guardian: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const updatePatientBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    first_name: { type: ['string', 'null'] },
    middle_name: { type: ['string', 'null'] },
    last_name: { type: 'string', minLength: 1 },
    date_of_birth: { type: 'string', minLength: 1 },
    gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    address: addressSchema,
    emergency_contact: emergencyContactSchema,
    registration_branch_id: { type: ['string', 'null'] },
    blood_group: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DECEASED'] },
    parent_guardian: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const createPatientDocumentBodySchema = {
  type: 'object',
  required: ['document_type', 'title', 'file_name', 'mime_type', 'file_size_bytes', 'storage_key'],
  additionalProperties: false,
  properties: {
    document_type: { type: 'string', enum: ['IDENTITY', 'INSURANCE', 'CLINICAL', 'CONSENT', 'OTHER'] },
    title: { type: 'string', minLength: 1 },
    file_name: { type: 'string', minLength: 1 },
    mime_type: { type: 'string', minLength: 1 },
    file_size_bytes: { type: 'integer', minimum: 1 },
    storage_key: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
  },
} as const;

export const patientResponseDataSchema = {
  type: 'object',
  required: [
    'id', 'patient_number', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender',
    'phone', 'email', 'address', 'emergency_contact', 'parent_guardian', 'registration_branch_id',
    'blood_group', 'status', 'notes', 'created_by', 'updated_by', 'created_at', 'updated_at',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    patient_number: { type: 'string' },
    first_name: { type: ['string', 'null'] },
    middle_name: { type: ['string', 'null'] },
    last_name: { type: 'string' },
    date_of_birth: { type: 'string' },
    gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    address: addressSchema,
    emergency_contact: emergencyContactSchema,
    parent_guardian: { type: ['string', 'null'] },
    registration_branch_id: { type: ['string', 'null'] },
    blood_group: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'DECEASED'] },
    notes: { type: ['string', 'null'] },
    created_by: { type: ['string', 'null'] },
    updated_by: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
} as const;

export const patientResponseSchema = apiResponseSchema(patientResponseDataSchema);
export const patientListResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['data', 'meta'],
  additionalProperties: false,
  properties: {
    data: { type: 'array', items: patientResponseDataSchema },
    meta: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages'],
      additionalProperties: false,
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
});

