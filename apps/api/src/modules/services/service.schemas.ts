export const serviceIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listServicesQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    service_type: { type: 'string', enum: ['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE'] },
    department_id: { type: 'string' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['name', 'code', 'service_type', 'status', 'created_at', 'updated_at', 'standard_price'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createServiceBodySchema = {
  type: 'object',
  required: ['code', 'name', 'department_id', 'standard_price', 'duration_minutes'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    service_type: { type: 'string', enum: ['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE'] },
    department_id: { type: 'string', minLength: 1 },
    standard_price: { type: 'number', minimum: 0 },
    duration_minutes: { type: 'integer', minimum: 1 },
    category: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
  },
} as const;

export const updateServiceBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    service_type: { type: 'string', enum: ['GENERAL', 'LAB_TEST', 'IMAGING_SERVICE'] },
    department_id: { type: 'string', minLength: 1 },
    standard_price: { type: 'number', minimum: 0 },
    duration_minutes: { type: 'integer', minimum: 1 },
    category: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
  },
} as const;

export const updateServiceStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } },
} as const;
