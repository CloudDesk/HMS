export type AuthUser = { id: string; username: string; email: string; fullName: string; status: 'active' | 'inactive' | 'locked'; patientId: string | null; roles: Array<{ id: string; code: string; name: string }> };
export type AuthTokens = { accessToken: string; tokenType: 'Bearer'; expiresIn: number };
export type AuthSession = { user: AuthUser; tokens: AuthTokens };
