import type { AuthTokens } from './auth-types';

let accessToken: string | null = null;
let accessExpiresAt = 0;

export const tokenStorage = {
  setTokens(tokens: Pick<AuthTokens, 'accessToken' | 'expiresIn'>) {
    accessToken = tokens.accessToken;
    accessExpiresAt = Date.now() + tokens.expiresIn * 1000;
  },
  getAccessToken: () => accessToken,
  isAccessTokenExpired: (bufferMs = 15_000) => !accessToken || accessExpiresAt - bufferMs <= Date.now(),
  clear() {
    accessToken = null;
    accessExpiresAt = 0;
  },
};
