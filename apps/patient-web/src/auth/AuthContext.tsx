import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getFriendlyAuthMessage } from '../api/api-error';
import { apiClient } from '../api/client';
import { navigate } from '../routing/navigation';
import { authApi } from './auth-api';
import { AuthContext, type AuthContextValue, type AuthStatus, type GuardianActivationInput, type SignupInput } from './auth-context-value';
import type { AuthUser } from './auth-types';
import { tokenStorage } from './token-storage';

const isPortalUser = (user: AuthUser) => Boolean(user.patientId || user.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'));

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshRef = useRef<Promise<string | null> | null>(null);
  const clear = useCallback((next: AuthStatus = 'unauthenticated') => {
    tokenStorage.clear();
    queryClient.clear();
    setUser(null);
    setStatus(next);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (refreshRef.current) return refreshRef.current;
    refreshRef.current = authApi.refresh().then(async (session) => {
      if (!isPortalUser(session.user)) {
        tokenStorage.setTokens(session.tokens);
        try { await authApi.logout(); } catch { /* The local portal session still remains denied. */ }
        clear();
        return null;
      }
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated'); return session.tokens.accessToken;
    }).catch(() => { clear('unauthenticated'); return null; }).finally(() => { refreshRef.current = null; });
    return refreshRef.current;
  }, [clear]);

  useEffect(() => {
    tokenStorage.clearLegacyRefreshStorage();
    apiClient.setRefreshHandler(refresh);
    apiClient.setUnauthorizedHandler(() => { clear('session-expired'); navigate('/login?reason=session-expired', { replace: true }); });
    void (async () => {
      const token = await refresh();
      if (!token) setStatus('unauthenticated');
    })();
    return () => { apiClient.setRefreshHandler(null); apiClient.setUnauthorizedHandler(null); };
  }, [clear, refresh]);

  const restoreSession = useCallback(async () => {
    const token = await refresh();
    if (!token) throw new ApiError('Your secure session could not be restored.', 401, 'INVALID_REFRESH_TOKEN');
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    setStatus('loading'); setAuthError(null); queryClient.clear();
    try {
      const session = await authApi.login(identifier, password);
      if (!isPortalUser(session.user)) {
        tokenStorage.setTokens(session.tokens);
        try { await authApi.logout(); } catch { /* The local portal session still remains denied. */ }
        throw new ApiError('This account belongs to the staff system. Use Staff login.', 403);
      }
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined, error instanceof ApiError ? error.details : undefined); }
  }, [clear, queryClient]);

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    setStatus('loading'); setAuthError(null); queryClient.clear();
    try {
      const session = await authApi.loginWithOtp(phone, otp);
      if (!isPortalUser(session.user)) throw new ApiError('This account cannot access the patient portal.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined, error instanceof ApiError ? error.details : undefined); }
  }, [clear, queryClient]);

  const signup = useCallback(async (input: SignupInput) => {
    setStatus('loading'); setAuthError(null); queryClient.clear();
    try {
      const session = await authApi.signup(input);
      if (!isPortalUser(session.user)) throw new ApiError('This account cannot access the patient portal.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) {
      clear();
      const message = getFriendlyAuthMessage(error);
      setAuthError(message);
      throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined, error instanceof ApiError ? error.details : undefined);
    }
  }, [clear, queryClient]);

  const activateGuardian = useCallback(async (input: GuardianActivationInput) => {
    setStatus('loading'); setAuthError(null); queryClient.clear();
    try {
      const session = await authApi.activateGuardian(input);
      if (!isPortalUser(session.user)) throw new ApiError('This account cannot access the patient portal.', 403);
      tokenStorage.setTokens(session.tokens); setUser(session.user); setStatus('authenticated');
    } catch (error) { clear(); const message = getFriendlyAuthMessage(error); setAuthError(message); throw new ApiError(message, error instanceof ApiError ? error.status : 400, error instanceof ApiError ? error.code : undefined, error instanceof ApiError ? error.details : undefined); }
  }, [clear, queryClient]);

  const logout = useCallback(async () => {
    try { if (tokenStorage.getAccessToken()) await authApi.logout(); } catch { /* Local sign-out remains authoritative. */ }
    finally { clear(); navigate('/', { replace: true }); }
  }, [clear]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, authError, login, loginWithOtp, signup, activateGuardian, restoreSession, logout, clearAuthError: () => setAuthError(null) }), [activateGuardian, authError, login, loginWithOtp, logout, restoreSession, signup, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
