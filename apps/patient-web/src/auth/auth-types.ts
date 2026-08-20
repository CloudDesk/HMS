export type AuthUser = { id: string; username: string; email: string; fullName: string; status: 'active' | 'inactive' | 'locked'; patientId: string | null; roles: Array<{ id: string; code: string; name: string }> };
export type AuthTokens = { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number; refreshExpiresIn: number };
export type AuthSession = { user: AuthUser; tokens: AuthTokens };
