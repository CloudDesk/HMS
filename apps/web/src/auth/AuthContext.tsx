import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError, getFriendlyAuthMessage } from '../api/api-error';
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
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback((nextStatus: Extract<AuthStatus, 'unauthenticated' | 'session-expired'>) => {
    tokenStorage.clear();
    setUser(null);
    setStatus(nextStatus);
  }, []);

  const handleInvalidSession = useCallback(() => {
    clearSession('session-expired');
    redirectToLogin('session-expired');
  }, [clearSession]);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken || tokenStorage.isRefreshTokenExpired()) {
      clearSession('session-expired');
      return null;
    }

    refreshPromiseRef.current = (async () => {
      const session = await authApi.refresh(refreshToken);
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
      if (!tokenStorage.hasRefreshToken()) {
        if (isMounted) {
          setStatus('unauthenticated');
        }

        return;
      }

      try {
        if (tokenStorage.isAccessTokenExpired()) {
          // Refresh already returns a database-backed user access context. Avoid a
          // second /me request after rotating the one-time refresh token.
          const accessToken = await refreshSession();
          if (!accessToken && isMounted) {
            setStatus('session-expired');
          }
          return;
        }

        const accessToken = tokenStorage.getAccessToken();

        if (!accessToken) {
          if (isMounted) {
            setStatus('session-expired');
          }

          return;
        }

        const currentUser = await authApi.me();

        if (isMounted) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession('session-expired');
          return;
        }

        // A temporary API/network failure must not destroy a still-valid refresh
        // token. Keep the provider in its restoration state so focus/reload can retry.
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
    const refreshToken = tokenStorage.getRefreshToken();

    try {
      if (tokenStorage.getAccessToken()) {
        await authApi.logout(refreshToken);
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
