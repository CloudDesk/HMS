export type AuthUserStatus = 'active' | 'inactive' | 'locked';

export type AuthBranch = {
  id: string;
  code: string;
  name: string;
};

export type AuthPermission = {
  code: string;
  module: string;
  screen: string;
  action: string;
};

export type AuthRole = {
  id: string;
  code: string;
  name: string;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: AuthUserStatus;
  lastLoginAt?: string | null;
  patientId: string | null;
  branches: AuthBranch[];
  permissions: AuthPermission[];
  roles: AuthRole[];
};

export type AuthTokens = {
  accessToken: string;
  // refreshToken is intentionally absent: it is stored in an HttpOnly cookie
  // by the backend and is never exposed to frontend JavaScript.
  tokenType: 'Bearer';
  expiresIn: number;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type AuthPasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
};
