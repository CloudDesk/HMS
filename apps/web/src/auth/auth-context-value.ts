import { createContext } from 'react';
import type { AuthUser } from './auth-types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session-expired';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  authError: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
