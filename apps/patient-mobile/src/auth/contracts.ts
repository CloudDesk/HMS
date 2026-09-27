import { z } from 'zod';

export const phoneSchema = z.string().trim().min(7, 'Enter a valid phone number.').max(32)
  .regex(/^\+?[\d\s()-]+$/, 'Use a phone number, including your country code.')
  .refine((value) => value.replace(/\D/g, '').length >= 7, 'Enter a valid phone number.');
export const phoneFormSchema = z.object({ phone: phoneSchema });
export const otpFormSchema = z.object({ otp: z.string().regex(/^\d{4}$/, 'Enter the four-digit verification code.') });
export const loginSchema = phoneFormSchema.extend({ otp: otpFormSchema.shape.otp,
  installationId: z.uuid(), platform: z.enum(['android', 'ios']), appVersion: z.string().min(1).max(40),
});
const dated = z.iso.datetime({ offset: true });
export const otpResponseSchema = z.object({ success: z.literal(true), resendAvailableAt: dated });
const named = z.object({ id: z.string(), code: z.string(), name: z.string() });
export const userSchema = z.object({
  id: z.string(), username: z.string(), fullName: z.string(), email: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'locked']), lastLoginAt: dated.nullable(),
  branches: z.array(named), roles: z.array(named),
  departments: z.array(named.extend({ hiddenModules: z.array(z.string()) })).optional(),
  permissions: z.array(z.object({ code: z.string(), module: z.string(), screen: z.string(), action: z.string() })),
});
export const refreshProofSchema = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
export const sessionResponseSchema = z.object({
  user: userSchema,
  tokens: z.object({ accessToken: z.string().min(1), refreshToken: refreshProofSchema,
    tokenType: z.literal('Bearer'), expiresIn: z.number().positive(), refreshExpiresIn: z.number().positive() }),
  session: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i), platform: z.enum(['android', 'ios']),
    appVersion: z.string().optional(), createdAt: dated, lastUsedAt: dated, expiresAt: dated }),
});
export const portalLoginResponseSchema = z.object({
  user: userSchema,
  tokens: z.object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().positive(),
  }),
});
export type PortalLoginResponse = z.infer<typeof portalLoginResponseSchema>;
export type NativeSession = z.infer<typeof sessionResponseSchema>;
export type PublicUser = z.infer<typeof userSchema>;
export const savedSessionSchema = z.object({
  refreshToken: refreshProofSchema, sessionId: z.string(), expiresAt: dated,
  installationId: z.uuid(), apiBaseUrl: z.string(), status: z.enum(['ready', 'in-flight', 'uncertain']),
}).strict();
export type SavedSession = z.infer<typeof savedSessionSchema>;
