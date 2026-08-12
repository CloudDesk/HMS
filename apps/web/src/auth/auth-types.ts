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
  branches: AuthBranch[];
  permissions: AuthPermission[];
  roles: AuthRole[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};
