import { DhaAuthService } from './dha-auth.service.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig, DhaRequestOptions, DhaResponse } from './dha.types.js';

export class DhaHttpClient {
  constructor(private readonly authService: DhaAuthService = new DhaAuthService()) {}

  get config(): Readonly<DhaConfig> {
    return this.authService.getConfig();
  }

  async get<T = unknown>(path: string, options?: DhaRequestOptions): Promise<DhaResponse<T>> {
    return this.request<T>(path, { method: 'GET' }, options);
  }

  async post<T = unknown>(path: string, body?: unknown, options?: DhaRequestOptions): Promise<DhaResponse<T>> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  async request<T = unknown>(
    path: string,
    init: RequestInit = {},
    options: DhaRequestOptions = {},
  ): Promise<DhaResponse<T>> {
    return this.executeRequest<T>(path, init, options, false);
  }

  private async executeRequest<T>(
    path: string,
    init: RequestInit,
    options: DhaRequestOptions,
    isRetry: boolean,
  ): Promise<DhaResponse<T>> {
    if (!this.config.enabled) {
      throw new DhaError('DHA integration is disabled in configuration', 'DHA_INTEGRATION_DISABLED', 503);
    }

    if (!this.config.baseUrl) {
      throw new DhaError('DHA base URL configuration is missing', 'DHA_CONFIGURATION_MISSING', 500);
    }

    const headers = new Headers(init.headers || {});
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    if (!options.skipAuth) {
      const token = await this.authService.getAccessToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.correlationId) {
      headers.set('X-Correlation-Id', options.correlationId);
    }

    const url = `${this.config.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: options.signal ?? controller.signal,
      });

      // Handle 401 with exactly one token refresh retry
      if (response.status === 401 && !options.skipAuth) {
        if (!isRetry) {
          this.authService.clearCache();
          return this.executeRequest<T>(path, init, options, true);
        }
        throw new DhaError('DHA authentication failed after token refresh retry', 'DHA_AUTHENTICATION_FAILED', 401);
      }

      if (!response.ok) {
        throw new DhaError(
          `DHA request failed with HTTP ${response.status}`,
          'DHA_REQUEST_FAILED',
          response.status,
        );
      }

      let data: T;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          data = (await response.json()) as T;
        } catch {
          throw new DhaError('DHA response body could not be parsed as JSON', 'DHA_REQUEST_FAILED', 502);
        }
      } else {
        data = (await response.text()) as unknown as T;
      }

      return {
        status: response.status,
        data,
        headers: response.headers,
      };
    } catch (error) {
      if (error instanceof DhaError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (isAbort) {
        throw new DhaError('DHA API request timed out', 'DHA_REQUEST_TIMEOUT', 504);
      }

      throw new DhaError('DHA API request failed due to a network communication error', 'DHA_REQUEST_FAILED', 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
