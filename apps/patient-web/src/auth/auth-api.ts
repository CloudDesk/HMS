import { apiClient } from '../api/client';
import type { GuardianActivationInput, SignupInput } from './auth-context-value';
import type { AuthSession, AuthUser } from './auth-types';
import {
  authSessionSchema,
  authUserSchema,
  logoutResponseSchema,
  otpRequestResponseSchema,
  otpVerifyResponseSchema,
} from './auth-schemas';

export const authApi = {
  login: (identifier: string, password: string) =>
    apiClient.request<AuthSession>('/auth/login', {
      auth: false,
      method: 'POST',
      body: { identifier, password },
      schema: authSessionSchema,
    }),
  loginWithOtp: (phone: string, otp: string) =>
    apiClient.request<AuthSession>('/patient-portal/login/otp', {
      auth: false,
      method: 'POST',
      body: { phone, otp },
      schema: authSessionSchema,
    }),
  signup: (input: SignupInput) =>
    apiClient.request<AuthSession>('/patient-portal/signup', {
      auth: false,
      method: 'POST',
      body: input,
      schema: authSessionSchema,
    }),
  requestOtp: (phone: string) =>
    apiClient.request<{ success: boolean; resendAvailableAt: string }>(
      '/patient-portal/otp/request',
      {
        auth: false,
        method: 'POST',
        body: { phone },
        schema: otpRequestResponseSchema,
      },
    ),
  verifyOtp: (phone: string, otp: string) =>
    apiClient.request<{ success: boolean; registrationToken: string }>(
      '/patient-portal/otp/verify',
      {
        auth: false,
        method: 'POST',
        body: { phone, otp },
        schema: otpVerifyResponseSchema,
      },
    ),
  activateGuardian: (input: GuardianActivationInput) =>
    apiClient.request<AuthSession>('/patient-portal/guardian-activation', {
      auth: false,
      method: 'POST',
      body: {
        phone: input.phone,
        registration_token: input.registrationToken,
        otp: input.otp,
        full_name: input.fullName,
        email: input.email,
        relationship: input.relationship,
        address: input.address,
        identification: input.identification,
        legal_consent_accepted: input.legalConsentAccepted ?? true,
      },
      schema: authSessionSchema,
    }),
  refresh: () =>
    apiClient.request<AuthSession>('/auth/refresh', {
      auth: false,
      method: 'POST',
      retryOnUnauthorized: false,
      schema: authSessionSchema,
    }),
  logout: () =>
    apiClient.request('/auth/logout', {
      method: 'POST',
      retryOnUnauthorized: false,
      body: {},
      schema: logoutResponseSchema,
    }),
  me: () => apiClient.request<AuthUser>('/auth/me', { schema: authUserSchema }),
};
