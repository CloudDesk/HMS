import { createContext } from 'react';
import type { AuthUser } from './auth-types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'session-expired';

export type GuardianActivationInput = {
  phone: string;
  registrationToken?: string;
  otp?: string;
  fullName: string;
  email: string;
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  };
  identification?: {
    type?: string | null;
    number?: string | null;
  };
  legalConsentAccepted?: boolean;
};

export type SignupInput = {
  account_type: 'PATIENT' | 'GUARDIAN';
  full_name: string;
  email: string;
  phone: string;
  registration_token?: string;
  otp?: string;
  guardian_profile?: {
    relationship: 'PARENT' | 'LEGAL_GUARDIAN';
    address?: Record<string, string | null>;
    identification?: { type?: string | null; number?: string | null };
    legal_consent_accepted: true;
  };
  initial_dependent?: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    preferred_branch_id: string;
    blood_group?: string | null;
    address?: Record<string, string | null>;
    relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  };
};

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  authError: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  activateGuardian: (input: GuardianActivationInput) => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
};
export const AuthContext = createContext<AuthContextValue | null>(null);
