import { apiClient } from '../api/client';
import type { AuthPasswordPolicy, AuthSession, AuthUser } from './auth-types';

export const authApi = {
  /**
   * Authenticates the user. `credentials: 'include'` is required so the
   * browser stores the HttpOnly refresh-token cookie set by the Set-Cookie
   * response header.
   */
  login(identifier: string, password: string) {
    return apiClient.request<AuthSession>('/auth/login', {
      auth: false,
      method: 'POST',
      body: { identifier, password },
      credentials: 'include',
    });
  },

  /**
   * Rotates the session. No body is required — the browser automatically
   * sends the HttpOnly refresh-token cookie. `credentials: 'include'` is
   * required for that automatic transmission to work.
   */
  refresh() {
    return apiClient.request<AuthSession>('/auth/refresh', {
      auth: false,
      method: 'POST',
      body: {}, // Send empty object so backend schema validation succeeds
      retryOnUnauthorized: false,
      credentials: 'include',
    });
  },

  /**
   * Logs out the current user. The backend reads the refresh token from the
   * HttpOnly cookie and revokes it, then clears the cookie.
   * `credentials: 'include'` is required so the cookie is sent.
   */
  logout() {
    return apiClient.request<{ ok: true }>('/auth/logout', {
      method: 'POST',
      body: {}, // Send empty object so backend schema validation succeeds
      retryOnUnauthorized: false,
      credentials: 'include',
    });
  },

  me() {
    return apiClient.request<AuthUser>('/auth/me');
  },

  passwordPolicy() {
    return apiClient.request<AuthPasswordPolicy>('/auth/password-policy');
  },
};
