import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { RegistrationFormValues } from '../auth/contracts';
import type { AuthState, SessionManager } from '../auth/session-manager';

interface AuthContextValue {
  state: AuthState;
  requestOtp: (phone: string, mode?: 'login' | 'register') => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  verifyRegistrationOtp: (otp: string) => Promise<void>;
  registerPatient: (values: RegistrationFormValues) => Promise<void>;
  setAuthMode: (mode: 'login' | 'register') => void;
  cancelRegistration: () => void;
  getPublicBranches: () => Promise<Array<{ id: string; name: string; code: string }>>;
  backToPhone: () => void;
  clearError: () => void;
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
    requestOtp: (phone: string, mode?: 'login' | 'register') => manager.requestOtp(phone, mode),
    verifyOtp: (otp: string) => manager.verifyOtp(otp),
    verifyRegistrationOtp: (otp: string) => manager.verifyRegistrationOtp(otp),
    registerPatient: (values: RegistrationFormValues) => manager.registerPatient(values),
    setAuthMode: (mode: 'login' | 'register') => manager.setAuthMode(mode),
    cancelRegistration: () => manager.cancelRegistration(),
    getPublicBranches: () => manager.getPublicBranches(),
    backToPhone: () => manager.backToPhone(),
    clearError: () => manager.clearError(),
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
