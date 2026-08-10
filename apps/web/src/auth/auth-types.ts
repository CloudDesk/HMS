export type AuthUserStatus = 'active' | 'inactive' | 'locked';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: AuthUserStatus;
  lastLoginAt?: string | null;
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
