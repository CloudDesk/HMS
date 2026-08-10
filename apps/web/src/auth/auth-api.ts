import { apiClient } from '../api/client';
import type { AuthSession, AuthUser } from './auth-types';

export const authApi = {
  login(identifier: string, password: string) {
    return apiClient.request<AuthSession>('/auth/login', {
      auth: false,
      method: 'POST',
      body: { identifier, password },
    });
  },

  refresh(refreshToken: string) {
    return apiClient.request<AuthSession>('/auth/refresh', {
      auth: false,
      method: 'POST',
      retryOnUnauthorized: false,
      body: { refreshToken },
    });
  },

  logout(refreshToken: string | null) {
    return apiClient.request<{ ok: true }>('/auth/logout', {
      method: 'POST',
      retryOnUnauthorized: false,
      body: refreshToken ? { refreshToken } : {},
    });
  },

  me() {
    return apiClient.request<AuthUser>('/auth/me');
  },
};
