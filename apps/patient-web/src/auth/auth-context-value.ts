import { createContext } from 'react';
import type { AuthUser } from './auth-types';
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session-expired';
export type GuardianActivationInput = { phone: string; otp: string; fullName: string; email: string; relationship: 'PARENT' | 'LEGAL_GUARDIAN'; address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postal_code?: string | null }; identification?: { type?: string | null; number?: string | null }; legalConsentAccepted?: boolean };
export type AuthContextValue = { status: AuthStatus; user: AuthUser | null; authError: string | null; login: (identifier: string, password: string) => Promise<void>; loginWithOtp: (phone: string, otp: string) => Promise<void>; activateGuardian: (input: GuardianActivationInput) => Promise<void>; logout: () => Promise<void>; clearAuthError: () => void };
export const AuthContext = createContext<AuthContextValue | null>(null);
