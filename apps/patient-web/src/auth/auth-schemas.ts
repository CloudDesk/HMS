import { z } from 'zod';

export const authRoleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

export const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  fullName: z.string(),
  status: z.enum(['active', 'inactive', 'locked']),
  patientId: z.string().nullable().optional().transform((val) => val ?? null),
  roles: z.array(authRoleSchema),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional().default(''),
  tokenType: z.literal('Bearer').default('Bearer'),
  expiresIn: z.number(),
  refreshExpiresIn: z.number().optional().default(0),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});

export const otpRequestResponseSchema = z.object({
  success: z.boolean(),
  resendAvailableAt: z.string(),
});

export const otpVerifyResponseSchema = z.object({
  success: z.boolean(),
  registrationToken: z.string(),
});

export const logoutResponseSchema = z.object({
  success: z.boolean().optional(),
}).optional();
