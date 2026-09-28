import { z } from 'zod';
import { ApiFailure } from '../api/errors';
import { MobileTransport } from '../api/transport';
import {
  loginSchema,
  otpResponseSchema,
  phoneSchema,
  portalLoginResponseSchema,
  sessionResponseSchema,
  type NativeSession,
} from './contracts';

const prefix = '/patient-portal/mobile/auth';
export class AuthApi {
  constructor(private readonly transport: MobileTransport) {}
  requestOtp(phone: string) {
    return this.transport.request('/patient-portal/otp/request', otpResponseSchema,
      { method: 'POST', body: { phone: phoneSchema.parse(phone) } });
  }
  async login(input: z.infer<typeof loginSchema>): Promise<NativeSession> {
    try {
      return await this.transport.request(`${prefix}/login/otp`, sessionResponseSchema,
        { method: 'POST', body: loginSchema.parse(input) });
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 404) {
        const portalRes = await this.transport.request('/patient-portal/login/otp', portalLoginResponseSchema,
          { method: 'POST', body: { phone: phoneSchema.parse(input.phone), otp: input.otp } });
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dummyProof = '0'.repeat(64);
        return {
          user: portalRes.user,
          tokens: {
            accessToken: portalRes.tokens.accessToken,
            refreshToken: dummyProof,
            tokenType: 'Bearer',
            expiresIn: portalRes.tokens.expiresIn,
            refreshExpiresIn: 7 * 24 * 60 * 60,
          },
          session: {
            id: portalRes.user.id,
            platform: input.platform,
            appVersion: input.appVersion,
            createdAt: now.toISOString(),
            lastUsedAt: now.toISOString(),
            expiresAt: expires.toISOString(),
          },
        };
      }
      throw error;
    }
  }
  async refresh(refreshToken: string): Promise<NativeSession> {
    try {
      return await this.transport.request(`${prefix}/refresh`, sessionResponseSchema, {
        method: 'POST',
        body: { refreshToken },
        timeoutMs: 15_000,
      });
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 404) {
        throw new ApiFailure('auth', 401, 'INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }
  async logout(refreshToken: string) {
    try {
      return await this.transport.request(`${prefix}/logout`, z.object({ ok: z.literal(true) }), { method: 'POST', body: { refreshToken } });
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 404) {
        return { ok: true as const };
      }
      throw error;
    }
  }
}
