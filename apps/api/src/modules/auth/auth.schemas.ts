export const loginBodySchema = {
  type: 'object',
  required: ['identifier', 'password'],
  additionalProperties: false,
  properties: {
    identifier: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
} as const;

export const refreshBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;

export const logoutBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
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
