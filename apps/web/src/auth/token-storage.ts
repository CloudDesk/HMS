import type { AuthTokens } from './auth-types';

const refreshTokenKey = 'hms.auth.refreshToken';
const refreshExpiresAtKey = 'hms.auth.refreshExpiresAt';

let accessToken: string | null = null;
let accessExpiresAt: number | null = null;

const now = () => Date.now();
const toExpiry = (seconds: number) => now() + seconds * 1000;

const getSessionValue = (key: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(key);
};

const setSessionValue = (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(key, value);
  }
};

const removeSessionValue = (key: string) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key);
  }
};

export const tokenStorage = {
  setTokens(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    accessExpiresAt = toExpiry(tokens.expiresIn);
    setSessionValue(refreshTokenKey, tokens.refreshToken);
    setSessionValue(refreshExpiresAtKey, String(toExpiry(tokens.refreshExpiresIn)));
  },

  getAccessToken() {
    return accessToken;
  },

  getRefreshToken() {
    return getSessionValue(refreshTokenKey);
  },

  hasRefreshToken() {
    return Boolean(getSessionValue(refreshTokenKey));
  },

  isAccessTokenExpired(bufferMs = 15_000) {
    return !accessToken || !accessExpiresAt || accessExpiresAt - bufferMs <= now();
  },

  isRefreshTokenExpired(bufferMs = 15_000) {
    const expiresAt = Number(getSessionValue(refreshExpiresAtKey));

    return !expiresAt || expiresAt - bufferMs <= now();
  },

  clear() {
    accessToken = null;
    accessExpiresAt = null;
    removeSessionValue(refreshTokenKey);
    removeSessionValue(refreshExpiresAtKey);
  },
};
