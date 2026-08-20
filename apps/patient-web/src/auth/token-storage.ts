import type { AuthTokens } from './auth-types';

const refreshKey = 'hms.patient.refreshToken';
const refreshExpiryKey = 'hms.patient.refreshExpiresAt';
let accessToken: string | null = null;
let accessExpiresAt = 0;
export const tokenStorage = {
  setTokens(tokens: AuthTokens) { accessToken = tokens.accessToken; accessExpiresAt = Date.now() + tokens.expiresIn * 1000; sessionStorage.setItem(refreshKey, tokens.refreshToken); sessionStorage.setItem(refreshExpiryKey, String(Date.now() + tokens.refreshExpiresIn * 1000)); },
  getAccessToken: () => accessToken,
  getRefreshToken: () => sessionStorage.getItem(refreshKey),
  hasRefreshToken: () => Boolean(sessionStorage.getItem(refreshKey)),
  isAccessTokenExpired: () => !accessToken || accessExpiresAt - 15_000 <= Date.now(),
  isRefreshTokenExpired: () => Number(sessionStorage.getItem(refreshExpiryKey) ?? 0) - 15_000 <= Date.now(),
  clear() { accessToken = null; accessExpiresAt = 0; sessionStorage.removeItem(refreshKey); sessionStorage.removeItem(refreshExpiryKey); },
};
