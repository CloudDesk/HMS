import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError, getFriendlyAuthMessage } from '../api/api-error';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { isPublicRoute, navigate } from '../routing/navigation';
import { authApi } from './auth-api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context-value';
import type { AuthUser } from './auth-types';
import { tokenStorage } from './token-storage';
import { canAccessRoute } from './access-control';

const redirectToLogin = (reason?: string) => {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams();

  if (reason) {
    params.set('reason', reason);
  }

  if (!isPublicRoute(window.location.pathname)) {
    params.set('redirect', next);
  }

  navigate(`/login${params.size ? `?${params.toString()}` : ''}`, { replace: true });
};

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback((nextStatus: Extract<AuthStatus, 'unauthenticated' | 'session-expired'>) => {
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
    setStatus(nextStatus);
  }, [queryClient]);

  const handleInvalidSession = useCallback(() => {
    clearSession('session-expired');
    redirectToLogin('session-expired');
  }, [clearSession]);

  /**
   * Refreshes the session by calling /auth/refresh.
   *
   * The browser automatically sends the HttpOnly refresh-token cookie so
   * this function does not need to read or supply the token itself.
   * The backend validates the token, rotates it, and sets a new cookie.
   */
  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const session = await authApi.refresh();
      tokenStorage.setTokens(session.tokens);
      setUser(session.user);
      setStatus('authenticated');
      setAuthError(null);

      return session.tokens.accessToken;
    })()
      .catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession('session-expired');
          return null;
        }

        setAuthError(getFriendlyAuthMessage(error));
        throw error;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [clearSession]);

  /**
   * Re-fetches the current user profile from /auth/me to pick up any
   * permission, role, or branch changes that occurred since the last sync.
   *
   * The `hasRefreshToken()` guard is an optimisation: skip the call when
   * module memory has no active session (e.g. immediately after logout or on
   * a cold page load before the first refresh attempt succeeds).
   */
  const refreshCurrentUser = useCallback(async () => {
    if (!tokenStorage.hasRefreshToken()) {
      return;
    }

    const currentUser = await authApi.me();
    setUser(currentUser);
    setStatus('authenticated');
    setAuthError(null);
  }, []);

  useEffect(() => {
    apiClient.setRefreshHandler(refreshSession);
    apiClient.setUnauthorizedHandler(handleInvalidSession);

    return () => {
      apiClient.setRefreshHandler(null);
      apiClient.setUnauthorizedHandler(null);
    };
  }, [handleInvalidSession, refreshSession]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      /**
       * With the HttpOnly cookie architecture, the frontend cannot inspect
       * the cookie to determine whether a session exists. We therefore always
       * attempt /auth/refresh on page load and let the backend decide:
       *
       *   Valid cookie   → new access token → status: authenticated
       *   Missing/expired cookie → 401      → status: unauthenticated
       *
       * If the access token is still valid in memory (e.g. in-page navigation
       * that triggers a remount), skip the refresh and use /auth/me instead.
       */
      try {
        if (tokenStorage.isAccessTokenExpired()) {
          // Access token absent or expired — call /auth/refresh via cookie.
          const accessToken = await refreshSession();

          if (!accessToken && isMounted) {
            // refreshSession already called clearSession('session-expired').
            // Set to unauthenticated for a cleaner first-visit experience.
            setStatus('unauthenticated');
          }

          return;
        }

        // In-memory access token is still valid; re-verify the user profile.
        const currentUser = await authApi.me();

        if (isMounted) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch (error) {
        if (!isMounted) return;

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession('unauthenticated');
          return;
        }

        // A temporary API/network failure must not destroy a still-valid
        // session. Retain the loading/restoration state so that focus/reload
        // can retry.
        setAuthError(getFriendlyAuthMessage(error));
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession, refreshSession]);

  useEffect(() => {
    const synchronizeAccess = () => {
      if (status !== 'authenticated' || document.visibilityState !== 'visible') return;
      void refreshCurrentUser().catch(() => {
        // The API client handles a real 401 by expiring the session. Transient
        // failures retain the last verified access context until the next sync.
      });
    };

    window.addEventListener('focus', synchronizeAccess);
    document.addEventListener('visibilitychange', synchronizeAccess);
    const intervalId = window.setInterval(synchronizeAccess, 60_000);
    return () => {
      window.removeEventListener('focus', synchronizeAccess);
      document.removeEventListener('visibilitychange', synchronizeAccess);
      window.clearInterval(intervalId);
    };
  }, [refreshCurrentUser, status]);

  const login = useCallback(async (identifier: string, password: string) => {
    setAuthError(null);
    setStatus('loading');

    try {
      const session = await authApi.login(identifier, password);
      const isPatientAccount = session.user.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN');
      if (isPatientAccount) {
        throw new ApiError('Patient and guardian accounts must sign in through the patient website.', 403);
      }
      tokenStorage.setTokens(session.tokens);
      setUser(session.user);
      setStatus('authenticated');

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');

      let finalRedirect = '/dashboard';
      if (redirect && redirect.startsWith('/')) {
        if (canAccessRoute(redirect, session.user.permissions ?? [], session.user.roles ?? [])) {
          finalRedirect = redirect;
        }
      }

      navigate(finalRedirect, { replace: true });
    } catch (error) {
      tokenStorage.clear();
      setUser(null);
      setStatus('unauthenticated');

      const message = getFriendlyAuthMessage(error);
      setAuthError(message);
      throw new ApiError(message, error instanceof ApiError ? error.status : 400);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (tokenStorage.getAccessToken()) {
        // Cookie is sent automatically via credentials: 'include' in authApi.logout().
        await authApi.logout();
      }
    } catch {
      // Local sign out should still complete if the server already rejected the session.
    } finally {
      clearSession('unauthenticated');
      navigate('/login', { replace: true });
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      authError,
      login,
      logout,
      refreshCurrentUser,
      clearAuthError: () => setAuthError(null),
    }),
    [authError, login, logout, refreshCurrentUser, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
