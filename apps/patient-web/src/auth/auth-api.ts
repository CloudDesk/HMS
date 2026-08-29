import { apiClient } from '../api/client';
import type { AuthSession, AuthUser } from './auth-types';
export const authApi = {
  login: (identifier: string, password: string) => apiClient.request<AuthSession>('/auth/login', { auth: false, method: 'POST', body: { identifier, password }, credentials: 'include' }),
  loginWithOtp: (phone: string, otp: string) => apiClient.request<AuthSession>('/patient-portal/login/otp', { auth: false, method: 'POST', body: { phone, otp }, credentials: 'include' }),
  requestOtp: (phone: string) => apiClient.request<{ success: boolean; resendAvailableAt: string }>('/patient-portal/otp/request', { auth: false, method: 'POST', body: { phone } }),
  activateGuardian: (input: import('./auth-context-value').GuardianActivationInput) => apiClient.request<AuthSession>('/patient-portal/guardian-activation', { auth: false, method: 'POST', body: { phone: input.phone, otp: input.otp, full_name: input.fullName, email: input.email, relationship: input.relationship, address: input.address, identification: input.identification, legal_consent_accepted: input.legalConsentAccepted ?? true }, credentials: 'include' }),
  refresh: () => apiClient.request<AuthSession>('/auth/refresh', { auth: false, method: 'POST', retryOnUnauthorized: false, body: {}, credentials: 'include' }),
  logout: () => apiClient.request('/auth/logout', { method: 'POST', retryOnUnauthorized: false, body: {}, credentials: 'include' }),
  me: () => apiClient.request<AuthUser>('/auth/me'),
};
