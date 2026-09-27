import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiFailure } from './errors';
import { MobileTransport } from './transport';

describe('MobileTransport', () => {
  const config = {
    environment: 'development' as const,
    apiBaseUrl: 'http://10.0.2.2:4000/api',
  };

  it('rejects invalid URL paths that attempt to smuggle queries or traversal', async () => {
    const transport = new MobileTransport(config);
    await expect(
      transport.request('/patient-portal/profile?token=secret', z.unknown())
    ).rejects.toThrow(ApiFailure);

    await expect(
      transport.request('//attacker.com/api', z.unknown())
    ).rejects.toThrow(ApiFailure);
  });

  it('adds Authorization Bearer header and omits cookies on valid requests', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { message: 'hello' } }),
    });

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    const result = await transport.request(
      '/patient-portal/profile',
      z.object({ message: z.string() }),
      { accessToken: 'mock-access-token' }
    );

    expect(result).toEqual({ message: 'hello' });
    expect(mockFetcher).toHaveBeenCalledWith(
      'http://10.0.2.2:4000/api/patient-portal/profile',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer mock-access-token',
        },
      })
    );
  });

  it('throws ApiFailure with auth kind on 401 response and parses error code and requestId', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: (name: string) => (name.toLowerCase() === 'x-request-id' ? 'req-server-401' : null) },
      json: async () => ({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid', requestId: 'req-server-401' },
      }),
    });

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    try {
      await transport.request('/patient-portal/mobile/auth/refresh', z.unknown(), {
        method: 'POST',
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.kind).toBe('auth');
      expect(failure.category).toBe('HTTP_401');
      expect(failure.status).toBe(401);
      expect(failure.code).toBe('INVALID_CREDENTIALS');
      expect(failure.requestId).toBe('req-server-401');
      expect(failure.endpoint).toBe('/patient-portal/mobile/auth/refresh');
      expect(failure.method).toBe('POST');
      expect(failure.diagnosticId).toMatch(/^MOB-[0-9A-F]{6}$/);
    }
  });

  it('throws ApiFailure with HTTP_429 and rate limit message on 429 response', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => 'req-rl-429' },
      json: async () => ({
        error: { code: 'AUTH_RATE_LIMITED', message: 'Too many requests' },
      }),
    });

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    try {
      await transport.request('/patient-portal/mobile/auth/login', z.unknown(), {
        method: 'POST',
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.category).toBe('HTTP_429');
      expect(failure.status).toBe(429);
      expect(failure.code).toBe('AUTH_RATE_LIMITED');
      expect(failure.retryable).toBe(true);
      expect(failure.userMessage).toBe('Too many attempts. Please wait before trying again.');
    }
  });

  it('throws ApiFailure with contract kind when response data does not match schema', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { invalidShape: 123 } }),
    });

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    try {
      await transport.request(
        '/patient-portal/profile',
        z.object({ expectedField: z.string() })
      );
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.kind).toBe('contract');
      expect(failure.category).toBe('INVALID_RESPONSE');
      expect(failure.code).toBe('CONTRACT_MISMATCH');
    }
  });

  it('throws ApiFailure with network kind on network exception', async () => {
    const mockFetcher = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    try {
      await transport.request('/patient-portal/profile', z.unknown());
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.kind).toBe('network');
      expect(failure.category).toBe('NETWORK_ERROR');
      expect(failure.retryable).toBe(true);
    }
  });

  it('distinguishes AbortError / timeout from standard network errors', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const mockFetcher = vi.fn().mockRejectedValue(abortErr);

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch, 100);
    try {
      await transport.request('/patient-portal/appointments', z.unknown());
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.category).toBe('TIMEOUT');
      expect(failure.code).toBe('TIMEOUT');
      expect(failure.retryable).toBe(true);
      expect(failure.userMessage).toContain('taking longer than expected');
    }
  });

  it('extracts request ID from header if payload does not have one', async () => {
    const mockFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: (name: string) => (name === 'x-request-id' ? 'header-req-123' : null) },
      json: async () => ({
        error: { message: 'Internal error' },
      }),
    });

    const transport = new MobileTransport(config, mockFetcher as unknown as typeof fetch);
    try {
      await transport.request('/patient-portal/appointments', z.unknown());
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiFailure);
      const failure = err as ApiFailure;
      expect(failure.category).toBe('HTTP_5XX');
      expect(failure.requestId).toBe('header-req-123');
    }
  });
});
