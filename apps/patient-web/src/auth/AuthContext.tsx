import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError, getFriendlyAuthMessage } from '../api/api-error';
import { apiClient } from '../api/client';
import { navigate } from '../routing/navigation';
import { authApi } from './auth-api';
import { AuthContext, type AuthContextValue, type AuthStatus, type GuardianActivationInput } from './auth-context-value';
import type { AuthUser } from './auth-types';
import { tokenStorage } from './token-storage';

const isPortalUser = (user: AuthUser) => Boolean(user.patientId || user.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'));

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshRef = useRef<Promise<string | null> | null>(null);
  const clear = useCallback((next: AuthStatus = 'unauthenticated') => { tokenStorage.clear(); setUser(null); setStatus(next); }, []);

  const refresh = useCallback(async () => {
    if (refreshRef.current) return refreshRef.current;
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken || tokenStorage.isRefreshTokenExpired()) { clear('session-expired'); return null; }
    refreshRef.current = authApi.refresh(refreshToken).then((session) => {
      if (!isPortalUser(session.user)) { clear(); return null; }
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated'); return session.tokens.accessToken;
    }).catch(() => { clear('session-expired'); return null; }).finally(() => { refreshRef.current = null; });
    return refreshRef.current;
  }, [clear]);

  useEffect(() => {
    apiClient.setRefreshHandler(refresh);
    apiClient.setUnauthorizedHandler(() => { clear('session-expired'); navigate('/login?reason=session-expired', { replace: true }); });
    void (async () => {
      if (!tokenStorage.hasRefreshToken()) { setStatus('unauthenticated'); return; }
      const token = await refresh();
      if (!token) setStatus('session-expired');
    })();
    return () => { apiClient.setRefreshHandler(null); apiClient.setUnauthorizedHandler(null); };
  }, [clear, refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    setStatus('loading'); setAuthError(null);
    try {
      const session = await authApi.login(identifier, password);
      if (!isPortalUser(session.user)) throw new ApiError('This account belongs to the staff system. Use Staff login.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined); }
  }, [clear]);

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    setStatus('loading'); setAuthError(null);
    try {
      const session = await authApi.loginWithOtp(phone, otp);
      if (!isPortalUser(session.user)) throw new ApiError('This account cannot access the patient portal.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined); }
  }, [clear]);

  const activateGuardian = useCallback(async (input: GuardianActivationInput) => {
    setStatus('loading'); setAuthError(null);
    try {
      const session = await authApi.activateGuardian(input);
      if (!isPortalUser(session.user)) throw new ApiError('This account cannot access the patient portal.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined); }
  }, [clear]);

  const logout = useCallback(async () => {
    try { if (tokenStorage.getAccessToken()) await authApi.logout(tokenStorage.getRefreshToken()); } catch { /* Local sign-out remains authoritative. */ }
    finally { clear(); navigate('/', { replace: true }); }
  }, [clear]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, authError, login, loginWithOtp, activateGuardian, logout, clearAuthError: () => setAuthError(null) }), [activateGuardian, authError, login, loginWithOtp, logout, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
