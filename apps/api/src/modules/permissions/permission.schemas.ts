export const permissionIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const rolePermissionParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listPermissionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive'] },
    type: { type: 'string', enum: ['system', 'custom'] },
    module: { type: 'string' },
    screen: { type: 'string' },
    action: { type: 'string' },
    categoryId: { type: 'string' },
    groupId: { type: 'string' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['module', 'screen', 'action', 'name', 'code', 'type', 'status', 'roleCount', 'createdAt'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createPermissionBodySchema = {
  type: 'object',
  required: ['module', 'screen', 'action'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    module: { type: 'string', minLength: 1 },
    screen: { type: 'string', minLength: 1 },
    action: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['system', 'custom'] },
    status: { type: 'string', enum: ['active', 'inactive'] },
    categoryId: { type: ['string', 'null'] },
    categoryName: { type: ['string', 'null'] },
    groupId: { type: ['string', 'null'] },
    groupName: { type: ['string', 'null'] },
  },
} as const;

export const updatePermissionBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    module: { type: 'string', minLength: 1 },
    screen: { type: 'string', minLength: 1 },
    action: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['system', 'custom'] },
    status: { type: 'string', enum: ['active', 'inactive'] },
    categoryId: { type: ['string', 'null'] },
    categoryName: { type: ['string', 'null'] },
    groupId: { type: ['string', 'null'] },
    groupName: { type: ['string', 'null'] },
  },
} as const;

export const replaceRolePermissionsBodySchema = {
  type: 'object',
  required: ['permissionIds'],
  additionalProperties: false,
  properties: {
    permissionIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;
