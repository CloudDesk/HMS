const availabilityDayEnum = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const availabilityItemSchema = {
  type: 'object',
  required: ['day_of_week', 'is_available', 'start_time', 'end_time', 'slot_duration_minutes'],
  additionalProperties: false,
  properties: {
    day_of_week: { type: 'string', enum: availabilityDayEnum },
    is_available: { type: 'boolean' },
    start_time: { type: 'string', minLength: 5, maxLength: 5 },
    end_time: { type: 'string', minLength: 5, maxLength: 5 },
    break_start_time: { type: ['string', 'null'], minLength: 5, maxLength: 5 },
    break_end_time: { type: ['string', 'null'], minLength: 5, maxLength: 5 },
    slot_duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
  },
} as const;

export const doctorIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listDoctorsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
    branch_id: { type: 'string', minLength: 1 },
    department_id: { type: 'string', minLength: 1 },
    specialization: { type: 'string' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['doctor_number', 'display_name', 'specialization', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createDoctorBodySchema = {
  type: 'object',
  required: ['first_name', 'last_name', 'specialization', 'branch_id', 'department_id'],
  additionalProperties: false,
  properties: {
    first_name: { type: 'string', minLength: 1 },
    last_name: { type: 'string', minLength: 1 },
    user_id: { type: ['string', 'null'] },
    specialization: { type: 'string', minLength: 1 },
    qualification: { type: ['string', 'null'] },
    registration_number: { type: ['string', 'null'] },
    experience_years: { type: ['integer', 'null'], minimum: 0, maximum: 80 },
    branch_id: { type: 'string', minLength: 1 },
    department_id: { type: 'string', minLength: 1 },
    consultation_room: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
    notes: { type: ['string', 'null'] },
  },
} as const;

export const updateDoctorBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: createDoctorBodySchema.properties,
} as const;

export const saveDoctorAvailabilityBodySchema = {
  type: 'object',
  required: ['availability'],
  additionalProperties: false,
  properties: {
    availability: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: availabilityItemSchema,
    },
  },
} as const;
