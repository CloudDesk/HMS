import { apiResponseSchema } from '../../validators/common-schemas.js';

const authBranchSchema = {
  type: 'object',
  required: ['id', 'code', 'name'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
  },
} as const;

const authPermissionSchema = {
  type: 'object',
  required: ['code', 'module', 'screen', 'action'],
  additionalProperties: false,
  properties: {
    code: { type: 'string' },
    module: { type: 'string' },
    screen: { type: 'string' },
    action: { type: 'string' },
  },
} as const;

const authRoleSchema = {
  type: 'object',
  required: ['id', 'code', 'name'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
  },
} as const;

export const authUserResponseDataSchema = {
  type: 'object',
  required: ['id', 'username', 'email', 'fullName', 'status', 'lastLoginAt', 'branches', 'permissions', 'roles'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: ['string', 'null'] },
    fullName: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
    lastLoginAt: { type: ['string', 'null'] },
    branches: { type: 'array', items: authBranchSchema },
    permissions: { type: 'array', items: authPermissionSchema },
    roles: { type: 'array', items: authRoleSchema },
  },
} as const;

export const authSessionResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['user', 'tokens'],
  additionalProperties: false,
  properties: {
    user: authUserResponseDataSchema,
    tokens: {
      type: 'object',
      required: ['accessToken', 'tokenType', 'expiresIn'],
      additionalProperties: false,
      properties: {
        accessToken: { type: 'string' },
        tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'number' },
      },
    },
  },
});

export const currentUserResponseSchema = apiResponseSchema(authUserResponseDataSchema);

export const loginBodySchema = {
  type: 'object',
  required: ['identifier', 'password'],
  additionalProperties: false,
  properties: {
    identifier: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
} as const;

// Refresh token is no longer supplied in the request body.
// The browser sends it automatically via the HttpOnly hms-refresh-token cookie.
export const refreshBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

export const logoutBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

export const changePasswordBodySchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  additionalProperties: false,
  properties: {
    currentPassword: { type: 'string', minLength: 1 },
    newPassword: { type: 'string', minLength: 1 },
  },
} as const;

export const passwordResetRequestBodySchema = {
  type: 'object',
  required: ['identifier'],
  additionalProperties: false,
  properties: {
    identifier: { type: 'string', minLength: 1 },
  },
} as const;

export const passwordResetConfirmBodySchema = {
  type: 'object',
  required: ['resetToken', 'newPassword'],
  additionalProperties: false,
  properties: {
    resetToken: { type: 'string', minLength: 1 },
    newPassword: { type: 'string', minLength: 1 },
  },
} as const;
