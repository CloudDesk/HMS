import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiFailure } from './errors';
import { MobileTransport } from './transport';
import { fetch as xhrFetch } from 'whatwg-fetch';

vi.mock('whatwg-fetch', () => ({ fetch: vi.fn() }));

describe('MobileTransport', () => {
  const config = {
    environment: 'development' as const,
    apiBaseUrl: 'http://10.0.2.2:4000/api',
  };

  it('posts multipart unchanged with bearer authentication and lets native fetch set the boundary', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ data: { success: true } }), { status: 200 },
    ));
    const transport = new MobileTransport(config, fetcher, 45_000, fetcher);
    const form = new FormData();
    form.append('patient_id', 'p-101');
    form.append('file', new Blob(['test image'], { type: 'image/jpeg' }), 'photo.jpg');
    await expect(transport.uploadMultipart('/patient-portal/patients/p-101/profile-photo',
      z.object({ success: z.boolean() }), form, { accessToken: 'test-token' },
    )).resolves.toEqual({ success: true });
    expect(fetcher).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/patient-portal/patients/p-101/profile-photo`,
      expect.objectContaining({ method: 'POST', body: form, headers: {
        Accept: 'application/json', Authorization: 'Bearer test-token',
      } }),
    );
  });

  it('distinguishes a native multipart network rejection from an HTTP upload rejection', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PHOTO_REQUIRED' } }), { status: 400 }));
    const transport = new MobileTransport(config, fetcher, 45_000, fetcher);
    const path = '/patient-portal/patients/p-101/profile-photo';
    await expect(transport.uploadMultipart(path, z.unknown(), new FormData()))
      .rejects.toMatchObject({ category: 'NETWORK_ERROR', code: 'NETWORK_ERROR' });
    await expect(transport.uploadMultipart(path, z.unknown(), new FormData()))
      .rejects.toMatchObject({ category: 'HTTP_400', status: 400, code: 'PHOTO_REQUIRED' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses XHR fetch for uploads without changing the JSON fetcher', async () => {
    const jsonFetcher = vi.fn<typeof fetch>();
    vi.mocked(xhrFetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: { success: true } })));
    const transport = new MobileTransport(config, jsonFetcher);
    await transport.uploadMultipart('/patient-portal/patients/p-101/profile-photo', z.unknown(), new FormData());
    expect(xhrFetch).toHaveBeenCalledTimes(1);
    expect(jsonFetcher).not.toHaveBeenCalled();
  });

  it('reproduces the installed Expo serializer rejecting RN URI file parts even with patient_id', async () => {
    const { convertFormDataAsync } = await vi.importActual<{
      convertFormDataAsync: (form: FormData) => Promise<unknown>;
    }>('expo/src/winter/fetch/convertFormData');
    const form = new FormData();
    // Supply the entries produced by native FormData; Node would stringify the descriptor.
    Object.defineProperty(form, 'entries', { value: function* () {
      yield ['patient_id', 'p-101'];
      yield ['file', { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }];
    } });
    await expect(convertFormDataAsync(form)).rejects.toThrow('Unsupported FormDataPart implementation');
  });

  it('passes the upload body through the actual XHR fetch implementation without Expo serialization', async () => {
    const { fetch: actualXhrFetch } = await vi.importActual<{ fetch: typeof fetch }>('whatwg-fetch');
    const send = vi.fn();
    const setRequestHeader = vi.fn();
    class UploadXHR {
      status = 200;
      statusText = 'OK';
      responseText = JSON.stringify({ data: { success: true } });
      onload: (() => void) | null = null;
      open = vi.fn();
      setRequestHeader = setRequestHeader;
      getAllResponseHeaders() { return 'content-type: application/json'; }
      send(body: unknown) { send(body); this.onload?.(); }
    }
    vi.stubGlobal('XMLHttpRequest', UploadXHR);
    try {
      const form = new FormData();
      const transport = new MobileTransport(config, vi.fn<typeof fetch>(), 45_000, actualXhrFetch);
      await expect(transport.uploadMultipart('/patient-portal/patients/p-101/profile-photo',
        z.object({ success: z.boolean() }), form, { accessToken: 'test-token' },
      )).resolves.toEqual({ success: true });
      expect(send).toHaveBeenCalledExactlyOnceWith(form);
      expect(setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
      expect(setRequestHeader.mock.calls.some(([name]) => String(name).toLowerCase() === 'content-type')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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
