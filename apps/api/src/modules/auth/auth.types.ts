export type AuthUserStatus = 'active' | 'inactive' | 'locked';

export type AuthAccessContext = {
  branches: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  permissions: Array<{
    code: string;
    module: string;
    screen: string;
    action: string;
  }>;
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export type AuthUserRecord = {
  id: string;
  employeeCode: string | null;
  username: string;
  email: string | null;
  fullName: string;
  passwordHash: string;
  status: AuthUserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
