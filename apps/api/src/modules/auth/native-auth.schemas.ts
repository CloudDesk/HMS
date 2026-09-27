import { z } from 'zod';
import { apiResponseSchema } from '../../validators/common-schemas.js';
import { authUserResponseDataSchema } from './auth.schemas.js';

const refreshToken = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
export const nativeLoginSchema = z.object({
  phone: z.string().trim().min(7).max(32).regex(/^\+?[\d\s()-]+$/),
  otp: z.string().regex(/^\d{4}$/),
  installationId: z.string().uuid(),
  platform: z.enum(['android', 'ios']),
  appVersion: z.string().trim().min(1).max(40).optional(),
}).strict();
export const nativeRefreshSchema = z.object({ refreshToken }).strict();
export const nativeLogoutSchema = z.object({ refreshToken: refreshToken.optional() }).strict();
export type NativeLoginInput = z.infer<typeof nativeLoginSchema>;

export const nativeSessionResponseSchema = apiResponseSchema({
  type: 'object', required: ['user', 'tokens', 'session'], additionalProperties: false,
  properties: {
    user: authUserResponseDataSchema,
    tokens: {
      type: 'object', additionalProperties: false,
      required: ['accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'refreshExpiresIn'],
      properties: {
        accessToken: { type: 'string' }, refreshToken: { type: 'string' },
        tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'number' }, refreshExpiresIn: { type: 'number' },
      },
    },
    session: {
      type: 'object', additionalProperties: false,
      required: ['id', 'platform', 'createdAt', 'lastUsedAt', 'expiresAt'],
      properties: {
        id: { type: 'string' }, platform: { type: 'string', enum: ['android', 'ios'] },
        appVersion: { type: 'string' }, createdAt: { type: 'string' },
        lastUsedAt: { type: 'string' }, expiresAt: { type: 'string' },
      },
    },
  },
});
