import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DhaAuthService } from './dha-auth.service.js';
import { DhaHttpClient } from './dha-http.client.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig } from './dha.types.js';

describe('DHA Authentication & Shared API Client Foundation', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  const validConfig: DhaConfig = {
    enabled: true,
    baseUrl: 'https://dha.example.gov/api/v1',
    tokenUrl: 'https://auth.dha.example.gov/oauth/token',
    clientId: 'test-client-id-123',
    clientSecret: 'super-secret-key-xyz',
    timeoutMs: 5000,
  };

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Enablement', () => {
    it('1. DHA configuration loads correctly', () => {
      const auth = new DhaAuthService(validConfig);
      const config = auth.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBe('https://dha.example.gov/api/v1');
      expect(config.tokenUrl).toBe('https://auth.dha.example.gov/oauth/token');
      expect(config.clientId).toBe('test-client-id-123');
      expect(config.timeoutMs).toBe(5000);
    });

    it('2. Missing required DHA configuration is detected safely', async () => {
      const auth = new DhaAuthService({
        enabled: true,
        tokenUrl: '',
        clientId: '',
        clientSecret: '',
      });

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_CONFIGURATION_MISSING',
        statusCode: 500,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('18. Integration disabled prevents network calls', async () => {
      const auth = new DhaAuthService({ ...validConfig, enabled: false });
      const client = new DhaHttpClient(auth);

      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_INTEGRATION_DISABLED',
        statusCode: 503,
      });

      await expect(client.get('/health')).rejects.toMatchObject({
        code: 'DHA_INTEGRATION_DISABLED',
        statusCode: 503,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('2. Authentication Request & Token Lifecycle', () => {
    it('3, 4, 5. Authentication request uses configured client ID, secret, and parses access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          access_token: 'mock-access-token-abc-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      const auth = new DhaAuthService(validConfig);
      const token = await auth.getAccessToken();

      expect(token).toBe('mock-access-token-abc-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [callUrl, callInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callUrl).toBe('https://auth.dha.example.gov/oauth/token');
      expect(callInit.method).toBe('POST');
      expect((callInit.headers as Record<string, string>)['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      );

      const bodyParams = new URLSearchParams(callInit.body as string);
      expect(bodyParams.get('client_id')).toBe('test-client-id-123');
      expect(bodyParams.get('client_secret')).toBe('super-secret-key-xyz');
      expect(bodyParams.get('grant_type')).toBe('client_credentials');
    });

    it('6, 7. Token is cached and reused for subsequent requests while valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          access_token: 'cached-token-111',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      const auth = new DhaAuthService(validConfig);

      const token1 = await auth.getAccessToken();
      const token2 = await auth.getAccessToken();
      const token3 = await auth.getAccessToken();

      expect(token1).toBe('cached-token-111');
      expect(token2).toBe('cached-token-111');
      expect(token3).toBe('cached-token-111');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('8. Expired token causes a new authentication request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({
            access_token: 'token-initial',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({
            access_token: 'token-refreshed',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });

      const auth = new DhaAuthService(validConfig);
      const token1 = await auth.getAccessToken();
      expect(token1).toBe('token-initial');

      // Clear cache simulating expiration
      auth.clearCache();

      const token2 = await auth.getAccessToken();
      expect(token2).toBe('token-refreshed');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Shared DHA HTTP Client Operations', () => {
    it('9. DHA API request receives Bearer token', async () => {
      // 1. Auth token call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          access_token: 'bearer-xyz-888',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // 2. API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ status: 'UP', message: 'DHA Gateway Online' }),
      });

      const auth = new DhaAuthService(validConfig);
      const client = new DhaHttpClient(auth);

      const res = await client.get<{ status: string }>('/health', { correlationId: 'corr-123' });

      expect(res.status).toBe(200);
      expect(res.data.status).toBe('UP');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [apiUrl, apiInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(apiUrl).toBe('https://dha.example.gov/api/v1/health');
      const headers = apiInit.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer bearer-xyz-888');
      expect(headers.get('X-Correlation-Id')).toBe('corr-123');
    });

    it('10. 401 response causes exactly one token refresh and retry', async () => {
      // 1. First token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          access_token: 'stale-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // 2. API call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'invalid_token' }),
      });

      // 3. New token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          access_token: 'fresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // 4. Retried API call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      });

      const auth = new DhaAuthService(validConfig);
      const client = new DhaHttpClient(auth);

      const response = await client.get<{ success: boolean }>('/status');
      expect(response.data.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Verify second API call used fresh token
      const [, retryApiInit] = mockFetch.mock.calls[3] as [string, RequestInit];
      expect((retryApiInit.headers as Headers).get('Authorization')).toBe('Bearer fresh-token');
    });

    it('10b. If retry also returns 401, it fails with DHA_AUTHENTICATION_FAILED without infinite loop', async () => {
      // 1. Token 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ access_token: 't1', token_type: 'Bearer', expires_in: 3600 }),
      });
      // 2. API call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'unauthorized' }),
      });
      // 3. Token 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ access_token: 't2', token_type: 'Bearer', expires_in: 3600 }),
      });
      // 4. Retried API call still returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'still_unauthorized' }),
      });

      const auth = new DhaAuthService(validConfig);
      const client = new DhaHttpClient(auth);

      await expect(client.get('/secure-resource')).rejects.toMatchObject({
        code: 'DHA_AUTHENTICATION_FAILED',
        statusCode: 401,
      });

      // Exactly 4 calls: token1 -> api1(401) -> token2 -> api2(401) -> stop!
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('4. Error Handling & Security Invariants', () => {
    it('11. Authentication failure is handled safely', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'invalid_client' }),
      });

      const auth = new DhaAuthService(validConfig);
      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_AUTHENTICATION_FAILED',
        statusCode: 502,
      });
    });

    it('12. Authentication timeout is handled safely', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const auth = new DhaAuthService(validConfig);
      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_AUTHENTICATION_TIMEOUT',
        statusCode: 504,
      });
    });

    it('13. DHA request timeout is handled safely', async () => {
      // 1. Auth token succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ access_token: 'valid-token', token_type: 'Bearer', expires_in: 3600 }),
      });

      // 2. Request aborts/times out
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const auth = new DhaAuthService(validConfig);
      const client = new DhaHttpClient(auth);

      await expect(client.get('/resource')).rejects.toMatchObject({
        code: 'DHA_REQUEST_TIMEOUT',
        statusCode: 504,
      });
    });

    it('14. Network failure is handled safely', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND dha.example.gov'));

      const auth = new DhaAuthService(validConfig);
      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_AUTHENTICATION_UNAVAILABLE',
        statusCode: 502,
      });
    });

    it('15. Invalid token response is handled safely', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ unexpected_field: 'no token here' }),
      });

      const auth = new DhaAuthService(validConfig);
      await expect(auth.getAccessToken()).rejects.toMatchObject({
        code: 'DHA_INVALID_TOKEN_RESPONSE',
        statusCode: 502,
      });
    });

    it('16, 17. Client secret and Authorization tokens never appear in error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ message: 'Internal server error' }),
      });

      const auth = new DhaAuthService(validConfig);

      try {
        await auth.getAccessToken();
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(DhaError);
        const error = err as DhaError;
        expect(error.message).not.toContain(validConfig.clientSecret);
        expect(error.message).not.toContain('Bearer');
      }
    });

    it('19. No mock/fake DHA response is returned by production code when integration fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ message: 'Service Unavailable' }),
      });

      const auth = new DhaAuthService(validConfig);
      const client = new DhaHttpClient(auth);

      // Must fail closed with error, NEVER return fallback fake data
      await expect(client.get('/upstream-service')).rejects.toMatchObject({
        code: 'DHA_REQUEST_FAILED',
        statusCode: 503,
      });
    });
  });
});
