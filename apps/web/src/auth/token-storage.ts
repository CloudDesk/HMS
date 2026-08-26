import type { AuthTokens } from './auth-types';

// ---------------------------------------------------------------------------
// In-memory access token (never persisted to any browser storage).
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let accessExpiresAt: number | null = null;

/**
 * Tracks whether this browser session has successfully authenticated (either
 * through login or a successful /auth/refresh). This is an optimisation flag
 * only — it is NOT a source of truth for refresh-token validity. The backend
 * is always authoritative.
 *
 * Stored in module memory only. Resets to false on page reload, at which
 * point AuthContext will attempt /auth/refresh and let the server decide.
 */
let sessionKnown = false;

const now = () => Date.now();
const toExpiry = (seconds: number) => now() + seconds * 1000;

// ---------------------------------------------------------------------------
// Public token storage interface
// ---------------------------------------------------------------------------

export const tokenStorage = {
  /**
   * Stores the access token in memory and marks the session as known.
   * The refresh token is never passed here — it lives exclusively in the
   * HttpOnly cookie set by the backend.
   */
  setTokens(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    accessExpiresAt = toExpiry(tokens.expiresIn);
    sessionKnown = true;
  },

  getAccessToken() {
    return accessToken;
  },

  /**
   * Returns true if the current module-memory session is known to be active.
   * On a fresh page load this is always false — AuthContext will call
   * /auth/refresh which lets the backend (via the HttpOnly cookie) decide
   * whether the session can be restored.
   */
  hasRefreshToken() {
    return sessionKnown;
  },

  isAccessTokenExpired(bufferMs = 15_000) {
    return !accessToken || !accessExpiresAt || accessExpiresAt - bufferMs <= now();
  },

  /**
   * Clears all in-memory authentication state.
   * The HttpOnly refresh-token cookie is cleared server-side by the logout
   * endpoint; this method only handles the client-side memory state.
   */
  clear() {
    accessToken = null;
    accessExpiresAt = null;
    sessionKnown = false;
  },
};
