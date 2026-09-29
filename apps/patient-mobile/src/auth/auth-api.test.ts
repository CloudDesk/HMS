import { describe, expect, it, vi } from 'vitest';
import { AuthApi } from './auth-api';
import type { MobileTransport } from '../api/transport';

describe('AuthApi', () => {
  const sampleUser = {
    id: 'user-123',
    username: '+919876543210',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    status: 'active' as const,
    lastLoginAt: '2026-09-25T10:00:00.000Z',
    branches: [{ id: 'branch-1', code: 'MAIN', name: 'Main Hospital' }],
    roles: [{ id: 'role-1', code: 'PATIENT', name: 'Patient' }],
    permissions: [{ code: 'portal:read', module: 'portal', screen: 'home', action: 'read' }],
  };

  const sampleSessionResponse = {
    user: sampleUser,
    tokens: {
      accessToken: 'jwt.access.token',
      refreshToken: 'a'.repeat(64),
      tokenType: 'Bearer' as const,
      expiresIn: 900,
      refreshExpiresIn: 604800,
    },
    session: {
      id: '507f1f77bcf86cd799439011',
      platform: 'android' as const,
      appVersion: '1.0.0',
      createdAt: '2026-09-25T10:00:00.000Z',
      lastUsedAt: '2026-09-25T10:00:00.000Z',
      expiresAt: '2026-10-02T10:00:00.000Z',
    },
  };

  it('requestOtp posts to /patient-portal/otp/request with normalized phone', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue({
        success: true,
        resendAvailableAt: '2026-09-25T10:01:00.000Z',
      }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const result = await authApi.requestOtp('+91 98765 43210');

    expect(result.success).toBe(true);
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/otp/request',
      expect.anything(),
      { method: 'POST', body: { phone: '+91 98765 43210' } }
    );
  });

  it('login posts to /patient-portal/mobile/auth/login/otp with valid payload', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue(sampleSessionResponse),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const input = {
      phone: '+919876543210',
      otp: '1234',
      installationId: '123e4567-e89b-12d3-a456-426614174000',
      platform: 'android' as const,
      appVersion: '1.0.0',
    };

    const result = await authApi.login(input);
    expect(result.tokens.accessToken).toBe('jwt.access.token');
    expect(result.session.id).toBe('507f1f77bcf86cd799439011');
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/mobile/auth/login/otp',
      expect.anything(),
      { method: 'POST', body: input }
    );
  });

  it('refresh posts to /patient-portal/mobile/auth/refresh with refreshToken', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue(sampleSessionResponse),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const refreshToken = 'b'.repeat(64);

    const result = await authApi.refresh(refreshToken);
    expect(result.user.id).toBe('user-123');
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/mobile/auth/refresh',
      expect.anything(),
      { method: 'POST', body: { refreshToken }, timeoutMs: 15_000 }
    );
  });

  it('logout posts to /patient-portal/mobile/auth/logout with refreshToken', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const refreshToken = 'c'.repeat(64);

    const result = await authApi.logout(refreshToken);
    expect(result.ok).toBe(true);
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/mobile/auth/logout',
      expect.anything(),
      { method: 'POST', body: { refreshToken } }
    );
  });

  it('login falls back to /patient-portal/login/otp if native endpoint returns 404', async () => {
    const { ApiFailure } = await import('../api/errors');
    const mockTransport = {
      request: vi.fn()
        .mockRejectedValueOnce(new ApiFailure('validation', 404, 'ROUTE_NOT_FOUND'))
        .mockResolvedValueOnce({
          user: sampleUser,
          tokens: {
            accessToken: 'fallback.jwt.token',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const input = {
      phone: '+919876543210',
      otp: '1234',
      installationId: '123e4567-e89b-12d3-a456-426614174000',
      platform: 'android' as const,
      appVersion: '1.0.0',
    };

    const result = await authApi.login(input);
    expect(result.tokens.accessToken).toBe('fallback.jwt.token');
    expect(result.user.id).toBe('user-123');
    expect(mockTransport.request).toHaveBeenCalledTimes(2);
    expect(mockTransport.request).toHaveBeenNthCalledWith(
      2,
      '/patient-portal/login/otp',
      expect.anything(),
      { method: 'POST', body: { phone: '+919876543210', otp: '1234' } }
    );
  });

  it('verifyRegistrationOtp posts to /patient-portal/otp/verify and returns registrationToken', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue({
        success: true,
        registrationToken: 'reg-token-abc-123',
      }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const token = await authApi.verifyRegistrationOtp('+919876543210', '1234');

    expect(token).toBe('reg-token-abc-123');
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/otp/verify',
      expect.anything(),
      { method: 'POST', body: { phone: '+919876543210', otp: '1234' } }
    );
  });

  it('signup posts to /patient-portal/signup with valid payload and constructs native session', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue({
        user: sampleUser,
        tokens: {
          accessToken: 'signup.access.jwt',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const result = await authApi.signup({
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+919876543210',
      registrationToken: 'reg-token-abc-123',
      platform: 'android',
      appVersion: '0.1.0',
    });

    expect(result.user.id).toBe('user-123');
    expect(result.tokens.accessToken).toBe('signup.access.jwt');
    expect(result.session.platform).toBe('android');
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/signup',
      expect.anything(),
      {
        method: 'POST',
        body: {
          account_type: 'PATIENT',
          full_name: 'Rahul Sharma',
          email: 'rahul@example.com',
          phone: '+919876543210',
          registration_token: 'reg-token-abc-123',
        },
      }
    );
  });

  it('completeProfile posts to /patient-portal/profile with bearer token and split names', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue({
        patientId: 'patient-456',
      }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const result = await authApi.completeProfile('signup.access.jwt', {
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      dateOfBirth: '1990-01-15',
      gender: 'MALE',
      preferredBranchId: 'branch-1',
      bloodGroup: 'O+',
      line1: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
    });

    expect(result.patientId).toBe('patient-456');
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/profile',
      expect.anything(),
      {
        method: 'POST',
        accessToken: 'signup.access.jwt',
        body: {
          first_name: 'Rahul',
          last_name: 'Sharma',
          date_of_birth: '1990-01-15',
          gender: 'MALE',
          preferred_branch_id: 'branch-1',
          blood_group: 'O+',
          address: {
            line1: '123 Main St',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400001',
          },
        },
      }
    );
  });

  it('getPublicBranches requests /patient-portal/public/branches', async () => {
    const mockBranches = [
      { id: 'branch-1', name: 'Main Hospital', code: 'MAIN' },
      { id: 'branch-2', name: 'City Clinic', code: 'CITY' },
    ];
    const mockTransport = {
      request: vi.fn().mockResolvedValue({ data: mockBranches }),
    } as unknown as MobileTransport;

    const authApi = new AuthApi(mockTransport);
    const branches = await authApi.getPublicBranches();

    expect(branches).toEqual(mockBranches);
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/public/branches',
      expect.anything(),
      { query: { limit: 50 } }
    );
  });
});
