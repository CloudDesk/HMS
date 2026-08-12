const appointmentStatusEnum = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
  'SKIPPED',
  'COMPLETED',
];
const appointmentVisitTypeEnum = ['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'EMERGENCY', 'TELEMEDICINE'];
const appointmentPriorityEnum = ['ROUTINE', 'URGENT', 'EMERGENCY'];

export const appointmentIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listAppointmentsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: appointmentStatusEnum },
    doctor_id: { type: 'string', minLength: 1 },
    patient_id: { type: 'string', minLength: 1 },
    branch_id: { type: 'string', minLength: 1 },
    department_id: { type: 'string', minLength: 1 },
    date_from: { type: 'string', minLength: 10, maxLength: 10 },
    date_to: { type: 'string', minLength: 10, maxLength: 10 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['appointment_number', 'appointment_date', 'start_time', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createAppointmentBodySchema = {
  type: 'object',
  required: ['patient_id', 'doctor_id', 'appointment_date', 'start_time', 'duration_minutes', 'visit_type'],
  additionalProperties: false,
  properties: {
    patient_id: { type: 'string', minLength: 1 },
    doctor_id: { type: 'string', minLength: 1 },
    appointment_date: { type: 'string', minLength: 10, maxLength: 10 },
    start_time: { type: 'string', minLength: 5, maxLength: 5 },
    duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
    visit_type: { type: 'string', enum: appointmentVisitTypeEnum },
    priority: { type: 'string', enum: appointmentPriorityEnum },
    reason: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const updateAppointmentBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    doctor_id: { type: 'string', minLength: 1 },
    appointment_date: { type: 'string', minLength: 10, maxLength: 10 },
    start_time: { type: 'string', minLength: 5, maxLength: 5 },
    duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
    visit_type: { type: 'string', enum: appointmentVisitTypeEnum },
    priority: { type: 'string', enum: appointmentPriorityEnum },
    reason: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const updateAppointmentStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: appointmentStatusEnum },
    notes: { type: ['string', 'null'] },
  },
} as const;
