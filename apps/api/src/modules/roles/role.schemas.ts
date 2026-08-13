export const roleIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const roleUserParamsSchema = {
  type: 'object',
  required: ['id', 'userId'],
  properties: {
    id: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
  },
} as const;

export const listRolesQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive'] },
    type: { type: 'string', enum: ['system', 'custom'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['name', 'code', 'type', 'status', 'userCount', 'createdAt', 'updatedAt'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createRoleBodySchema = {
  type: 'object',
  required: ['code', 'name'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['custom', 'system'] },
    status: { type: 'string', enum: ['active', 'inactive'] },
    color: { type: ['string', 'null'] },
  },
} as const;

export const updateRoleBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['custom', 'system'] },
    color: { type: ['string', 'null'] },
  },
} as const;

export const updateRoleStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
} as const;

export const assignRoleUserBodySchema = {
  type: 'object',
  required: ['userId'],
  additionalProperties: false,
  properties: {
    userId: { type: 'string', minLength: 1 },
  },
} as const;

export const roleAuditQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
