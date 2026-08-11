export const branchIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listBranchesQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['name', 'code', 'status', 'created_at', 'updated_at'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createBranchBodySchema = {
  type: 'object',
  required: ['code', 'name'],
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    short_name: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    postal_code: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
  },
} as const;

export const updateBranchBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    code: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    short_name: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    city: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    postal_code: { type: ['string', 'null'] },
  },
} as const;
