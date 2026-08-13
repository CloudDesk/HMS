const availabilityDayEnum = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const doctorStatusEnum = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
const dateOnlyPattern = '^\\d{4}-\\d{2}-\\d{2}$';
const timePattern = '^([01]\\d|2[0-3]):[0-5]\\d$';

const workingBlockSchema = {
  type: 'object',
  required: ['start_time', 'end_time'],
  additionalProperties: false,
  properties: {
    start_time: { type: 'string', pattern: timePattern },
    end_time: { type: 'string', pattern: timePattern },
  },
} as const;

const availabilityItemSchema = {
  type: 'object',
  required: ['day_of_week', 'is_available', 'working_blocks', 'slot_duration_minutes'],
  additionalProperties: false,
  properties: {
    day_of_week: { type: 'string', enum: availabilityDayEnum },
    is_available: { type: 'boolean' },
    working_blocks: { type: 'array', maxItems: 8, items: workingBlockSchema },
    slot_duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
  },
} as const;

export const doctorIdParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 1 } },
} as const;

export const doctorChildIdParamsSchema = {
  type: 'object',
  required: ['id', 'childId'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    childId: { type: 'string', minLength: 1 },
  },
} as const;

export const listDoctorsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: doctorStatusEnum },
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

const editableDoctorProperties = {
  first_name: { type: 'string', minLength: 1 },
  last_name: { type: 'string', minLength: 1 },
  specialization: { type: 'string', minLength: 1 },
  qualification: { type: ['string', 'null'] },
  registration_number: { type: ['string', 'null'] },
  experience_years: { type: ['integer', 'null'], minimum: 0, maximum: 80 },
  branch_id: { type: 'string', minLength: 1 },
  department_id: { type: 'string', minLength: 1 },
  consultation_room: { type: ['string', 'null'] },
  phone: { type: ['string', 'null'] },
  email: { type: ['string', 'null'] },
  notes: { type: ['string', 'null'] },
} as const;

export const createDoctorBodySchema = {
  type: 'object',
  required: [
    'first_name',
    'last_name',
    'specialization',
    'branch_id',
    'department_id',
    'availability',
    'account_access',
  ],
  additionalProperties: false,
  properties: {
    ...editableDoctorProperties,
    status: { type: 'string', enum: doctorStatusEnum },
    availability: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: availabilityItemSchema,
    },
    account_access: {
      type: 'object',
      required: ['create_login_account'],
      additionalProperties: false,
      properties: {
        create_login_account: { type: 'boolean' },
        employee_code: { type: 'string', minLength: 1 },
        username: { type: 'string', minLength: 1 },
        email: { type: 'string', minLength: 1 },
        temporary_password: { type: 'string', minLength: 1 },
      },
      if: {
        properties: { create_login_account: { const: true } },
        required: ['create_login_account'],
      },
      then: {
        required: ['employee_code', 'username', 'email', 'temporary_password'],
      },
      else: {
        not: {
          anyOf: [
            { required: ['employee_code'] },
            { required: ['username'] },
            { required: ['email'] },
            { required: ['temporary_password'] },
          ],
        },
      },
    },
  },
} as const;

export const updateDoctorBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: editableDoctorProperties,
} as const;

export const updateDoctorStatusBodySchema = {
  type: 'object',
  required: ['status', 'reason'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: doctorStatusEnum },
    reason: { type: 'string', minLength: 3, maxLength: 500 },
  },
} as const;

export const mapDoctorUserBodySchema = {
  type: 'object',
  required: ['user_id'],
  additionalProperties: false,
  properties: { user_id: { type: ['string', 'null'] } },
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

export const listDoctorLeavesQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ACTIVE', 'CANCELLED'] },
    date_from: { type: 'string', pattern: dateOnlyPattern },
    date_to: { type: 'string', pattern: dateOnlyPattern },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const createDoctorLeaveBodySchema = {
  type: 'object',
  required: ['start_date', 'end_date', 'reason'],
  additionalProperties: false,
  properties: {
    start_date: { type: 'string', pattern: dateOnlyPattern },
    end_date: { type: 'string', pattern: dateOnlyPattern },
    reason: { type: 'string', minLength: 3, maxLength: 500 },
  },
} as const;

export const listDoctorExceptionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date_from: { type: 'string', pattern: dateOnlyPattern },
    date_to: { type: 'string', pattern: dateOnlyPattern },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

export const saveDoctorExceptionBodySchema = {
  type: 'object',
  required: ['date', 'is_available', 'working_blocks', 'slot_duration_minutes', 'reason'],
  additionalProperties: false,
  properties: {
    date: { type: 'string', pattern: dateOnlyPattern },
    is_available: { type: 'boolean' },
    working_blocks: { type: 'array', maxItems: 8, items: workingBlockSchema },
    slot_duration_minutes: { type: 'integer', minimum: 5, maximum: 240 },
    reason: { type: 'string', minLength: 3, maxLength: 500 },
  },
} as const;

export const availableSlotsQuerySchema = {
  type: 'object',
  required: ['date'],
  additionalProperties: false,
  properties: { date: { type: 'string', pattern: dateOnlyPattern } },
} as const;
