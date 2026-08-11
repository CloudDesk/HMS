export const departmentIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listDepartmentsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    branch_id: { type: 'string' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['name', 'code', 'status', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createDepartmentBodySchema = {
  type: 'object',
  required: ['code', 'name', 'branch_id'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    branch_id: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
  },
} as const;

export const updateDepartmentBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    branch_id: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
  },
} as const;
