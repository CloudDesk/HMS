import { z } from 'zod';
import { ApiFailure } from '../api/errors';
import type { MobileTransport } from '../api/transport';
import {
  completeProfileResponseSchema,
  loginSchema,
  otpResponseSchema,
  phoneSchema,
  portalLoginResponseSchema,
  sessionResponseSchema,
  verifyOtpResponseSchema,
  type CompleteProfileResponse,
  type NativeSession,
  type RegistrationFormValues,
} from './contracts';

const prefix = '/patient-portal/mobile/auth';
export class AuthApi {
  constructor(private readonly transport: MobileTransport) {}
  requestOtp(phone: string) {
    return this.transport.request('/patient-portal/otp/request', otpResponseSchema,
      { method: 'POST', body: { phone: phoneSchema.parse(phone) } });
  }
  async verifyRegistrationOtp(phone: string, otp: string): Promise<string> {
    const res = await this.transport.request(
      '/patient-portal/otp/verify',
      verifyOtpResponseSchema,
      { method: 'POST', body: { phone: phoneSchema.parse(phone), otp } }
    );
    return res.registrationToken;
  }
  async getPublicBranches(): Promise<Array<{ id: string; name: string; code: string }>> {
    const schema = z.object({
      data: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          code: z.string(),
        })
      ),
    });
    const res = await this.transport.request('/patient-portal/public/branches', schema, {
      query: { limit: 50 },
    });
    return res.data;
  }
  async signup(input: {
    fullName: string;
    email: string;
    phone: string;
    registrationToken: string;
    platform: 'android' | 'ios';
    appVersion: string;
  }): Promise<NativeSession> {
    const portalRes = await this.transport.request(
      '/patient-portal/signup',
      portalLoginResponseSchema,
      {
        method: 'POST',
        body: {
          account_type: 'PATIENT',
          full_name: input.fullName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: phoneSchema.parse(input.phone),
          registration_token: input.registrationToken,
        },
      }
    );
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
  async completeProfile(accessToken: string, input: RegistrationFormValues): Promise<CompleteProfileResponse> {
    const names = input.fullName.trim().split(/\s+/);
    const firstName = names[0] || input.fullName.trim();
    const lastName = names.slice(1).join(' ') || '.';
    return this.transport.request(
      '/patient-portal/profile',
      completeProfileResponseSchema,
      {
        method: 'POST',
        accessToken,
        body: {
          first_name: firstName,
          last_name: lastName,
          date_of_birth: input.dateOfBirth,
          gender: input.gender,
          preferred_branch_id: input.preferredBranchId,
          blood_group: input.bloodGroup || null,
          address: {
            line1: input.line1 || null,
            city: input.city || null,
            state: input.state || null,
            postal_code: input.postalCode || null,
          },
        },
      }
    );
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
