const opdVisitStatusEnum = [
  'CHECKED_IN',
  'WAITING_FOR_VITALS',
  'READY_FOR_CONSULTATION',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

const opdVisitTypeEnum = [
  'NEW_CONSULTATION',
  'FOLLOW_UP',
  'PROCEDURE',
  'EMERGENCY',
  'WALK_IN',
  'REVIEW',
];

const opdVisitPriorityEnum = ['ROUTINE', 'URGENT', 'EMERGENCY'];

export const opdVisitIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listOpdVisitsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: opdVisitStatusEnum },
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
      enum: ['visit_number', 'visit_date', 'check_in_time', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createOpdVisitBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    appointment_id: { type: ['string', 'null'], minLength: 1 },
    patient_id: { type: 'string', minLength: 1 },
    doctor_id: { type: 'string', minLength: 1 },
    visit_type: { type: 'string', enum: opdVisitTypeEnum },
    priority: { type: 'string', enum: opdVisitPriorityEnum },
    reason: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const updateOpdVisitStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: opdVisitStatusEnum },
    notes: { type: ['string', 'null'] },
  },
} as const;
