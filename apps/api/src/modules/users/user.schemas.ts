import { apiResponseSchema } from '../../validators/common-schemas.js';

const assignmentSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: ['string', 'null'] },
    isPrimary: { type: 'boolean' },
  },
} as const;

export const userIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const listUsersQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
    branchId: { type: 'string' },
    departmentId: { type: 'string' },
    roleId: { type: 'string' },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    sortBy: {
      type: 'string',
      enum: ['fullName', 'username', 'email', 'employeeCode', 'status', 'createdAt', 'lastLoginAt'],
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'] },
  },
} as const;

export const createUserBodySchema = {
  type: 'object',
  required: ['employeeCode', 'username', 'email', 'fullName', 'password', 'branches', 'departments', 'roleIds'],
  additionalProperties: false,
  properties: {
    employeeCode: { type: 'string', minLength: 1 },
    username: { type: 'string', minLength: 1 },
    email: { type: ['string', 'null'] },
    fullName: { type: 'string', minLength: 1 },
    phone: { type: ['string', 'null'] },
    jobTitle: { type: ['string', 'null'] },
    employeeType: { type: ['string', 'null'] },
    hireDate: { type: ['string', 'null'] },
    profilePhotoUrl: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
    password: { type: 'string', minLength: 1 },
    branches: { type: 'array', minItems: 1, items: assignmentSchema },
    departments: { type: 'array', minItems: 1, items: assignmentSchema },
    roleIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
  },
} as const;

export const updateUserBodySchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    employeeCode: { type: 'string', minLength: 1 },
    username: { type: 'string', minLength: 1 },
    email: { type: ['string', 'null'] },
    fullName: { type: 'string', minLength: 1 },
    phone: { type: ['string', 'null'] },
    jobTitle: { type: ['string', 'null'] },
    employeeType: { type: ['string', 'null'] },
    hireDate: { type: ['string', 'null'] },
    profilePhotoUrl: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    branches: { type: 'array', minItems: 1, items: assignmentSchema },
    departments: { type: 'array', minItems: 1, items: assignmentSchema },
    roleIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
  },
} as const;

export const updateUserStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
    lockedUntil: { type: ['string', 'null'] },
  },
} as const;

export const changeUserPasswordBodySchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  additionalProperties: false,
  properties: {
    currentPassword: { type: 'string', minLength: 1 },
    newPassword: { type: 'string', minLength: 1 },
  },
} as const;

export const resetUserPasswordBodySchema = {
  type: 'object',
  required: ['newPassword'],
  additionalProperties: false,
  properties: {
    newPassword: { type: 'string', minLength: 1 },
  },
} as const;

const userAssignmentResponseSchema = {
  type: 'object',
  required: ['id', 'name', 'isPrimary'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: ['string', 'null'] },
    isPrimary: { type: 'boolean' },
  },
} as const;

const userRoleResponseSchema = {
  type: 'object',
  required: ['id', 'code', 'name', 'status'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive'] },
  },
} as const;

export const userResponseDataSchema = {
  type: 'object',
  required: [
    'id', 'employeeCode', 'username', 'email', 'fullName', 'phone', 'jobTitle', 'employeeType',
    'hireDate', 'profilePhotoUrl', 'address', 'status', 'lockedUntil', 'passwordChangedAt',
    'lastLoginAt', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'deletedBy',
    'roleIds', 'patientId', 'branches', 'departments', 'roles', 'audit',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    employeeCode: { type: ['string', 'null'] },
    username: { type: 'string' },
    email: { type: ['string', 'null'] },
    fullName: { type: 'string' },
    phone: { type: ['string', 'null'] },
    jobTitle: { type: ['string', 'null'] },
    employeeType: { type: ['string', 'null'] },
    hireDate: { type: ['string', 'null'] },
    profilePhotoUrl: { type: ['string', 'null'] },
    address: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
    lockedUntil: { type: ['string', 'null'] },
    passwordChangedAt: { type: ['string', 'null'] },
    lastLoginAt: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    deletedAt: { type: ['string', 'null'] },
    createdBy: { type: ['string', 'null'] },
    updatedBy: { type: ['string', 'null'] },
    deletedBy: { type: ['string', 'null'] },
    roleIds: { type: 'array', items: { type: 'string' } },
    patientId: { type: ['string', 'null'] },
    branches: { type: 'array', items: userAssignmentResponseSchema },
    departments: { type: 'array', items: userAssignmentResponseSchema },
    roles: { type: 'array', items: userRoleResponseSchema },
    audit: {
      type: 'object',
      required: ['createdAt', 'updatedAt', 'lastLoginAt', 'passwordChangedAt', 'createdBy', 'updatedBy'],
      additionalProperties: false,
      properties: {
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        lastLoginAt: { type: ['string', 'null'] },
        passwordChangedAt: { type: ['string', 'null'] },
        createdBy: { type: ['string', 'null'] },
        updatedBy: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const userResponseSchema = apiResponseSchema(userResponseDataSchema);
export const userListResponseSchema = apiResponseSchema({
  type: 'object',
  required: ['items', 'meta'],
  additionalProperties: false,
  properties: {
    items: { type: 'array', items: userResponseDataSchema },
    meta: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages'],
      additionalProperties: false,
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
});
