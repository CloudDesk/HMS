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

export const verifyOtpResponseSchema = z.object({
  success: z.literal(true),
  registrationToken: z.string().min(1),
});
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;

export const registrationFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(160),
  email: z.string().trim().email('Enter a valid email address.'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD.'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  preferredBranchId: z.string().min(1, 'Select a hospital branch.'),
  bloodGroup: z.string().trim().max(10).optional(),
  line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(30).optional(),
});
export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export const completeProfileResponseSchema = z.object({
  patientId: z.string(),
});
export type CompleteProfileResponse = z.infer<typeof completeProfileResponseSchema>;
