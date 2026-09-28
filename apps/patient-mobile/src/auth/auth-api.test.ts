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
});
