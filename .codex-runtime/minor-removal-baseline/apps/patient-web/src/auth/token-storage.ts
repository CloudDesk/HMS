import type { AuthTokens } from './auth-types';

let accessToken: string | null = null;
let accessExpiresAt = 0;

const removeLegacyRefreshStorage = () => {
  for (const key of ['hms.patient.refreshToken', 'hms.patient.refreshExpiresAt']) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
};

export const tokenStorage = {
  setTokens(tokens: Pick<AuthTokens, 'accessToken' | 'expiresIn'>) { accessToken = tokens.accessToken; accessExpiresAt = Date.now() + tokens.expiresIn * 1000; },
  getAccessToken: () => accessToken,
  isAccessTokenExpired: (thresholdMs = 15_000) => !accessToken || accessExpiresAt - thresholdMs <= Date.now(),
  clearLegacyRefreshStorage: removeLegacyRefreshStorage,
  clear() { accessToken = null; accessExpiresAt = 0; removeLegacyRefreshStorage(); },
};
