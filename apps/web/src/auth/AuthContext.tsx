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

      return session.tokens.accessToken;
    })()
      .catch(() => {
        clearSession('session-expired');
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [clearSession]);

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
        const accessToken = tokenStorage.isAccessTokenExpired()
          ? await refreshSession()
          : tokenStorage.getAccessToken();

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
      } catch {
        if (isMounted) {
          clearSession('session-expired');
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession, refreshSession]);

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
      navigate(redirect && redirect.startsWith('/') ? redirect : '/dashboard', { replace: true });
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
      clearAuthError: () => setAuthError(null),
    }),
    [authError, login, logout, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
