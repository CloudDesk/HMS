import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { AuthState, SessionManager } from '../auth/session-manager';

interface AuthContextValue {
  state: AuthState;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  backToPhone: () => void;
  retry: () => Promise<void>;
  logout: () => Promise<void>;
  manager: SessionManager;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  manager,
  children,
}: {
  manager: SessionManager;
  children: React.ReactNode;
}) {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  useEffect(() => {
    void manager.start();
  }, [manager]);

  const value: AuthContextValue = {
    state,
    requestOtp: (phone: string) => manager.requestOtp(phone),
    verifyOtp: (otp: string) => manager.verifyOtp(otp),
    backToPhone: () => manager.backToPhone(),
    retry: () => manager.retry(),
    logout: () => manager.logout(),
    manager,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
