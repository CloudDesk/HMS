import { env } from '../../../config/env.js';
import { DhaError } from './dha.errors.js';
import type { DhaConfig, DhaTokenCache, DhaTokenResponse } from './dha.types.js';

export class DhaAuthService {
  private cache: DhaTokenCache | null = null;
  private readonly config: DhaConfig;
  private readonly expiryBufferMs: number;

  constructor(customConfig?: Partial<DhaConfig>, expiryBufferMs = 60000) {
    this.config = {
      enabled: customConfig?.enabled ?? env.dha.enabled,
      baseUrl: customConfig?.baseUrl ?? env.dha.baseUrl,
      tokenUrl: customConfig?.tokenUrl ?? env.dha.tokenUrl,
      clientId: customConfig?.clientId ?? env.dha.clientId,
      clientSecret: customConfig?.clientSecret ?? env.dha.clientSecret,
      timeoutMs: customConfig?.timeoutMs ?? env.dha.timeoutMs,
    };
    this.expiryBufferMs = expiryBufferMs;
  }

  getConfig(): Readonly<DhaConfig> {
    return this.config;
  }

  clearCache(): void {
    this.cache = null;
  }

  isCachedValid(): boolean {
    if (!this.cache) return false;
    return Date.now() < this.cache.expiresAt - this.expiryBufferMs;
  }

  async getAccessToken(): Promise<string> {
    if (!this.config.enabled) {
      throw new DhaError('DHA integration is disabled in configuration', 'DHA_INTEGRATION_DISABLED', 503);
    }

    if (!this.config.tokenUrl || !this.config.clientId || !this.config.clientSecret) {
      throw new DhaError('DHA authentication configuration is incomplete', 'DHA_CONFIGURATION_MISSING', 500);
    }

    if (this.isCachedValid() && this.cache) {
      return this.cache.accessToken;
    }

    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new DhaError('DHA authentication failed with upstream status', 'DHA_AUTHENTICATION_FAILED', 502);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new DhaError('DHA authentication response was not valid JSON', 'DHA_INVALID_TOKEN_RESPONSE', 502);
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof (payload as DhaTokenResponse).access_token !== 'string' ||
        !(payload as DhaTokenResponse).access_token ||
        typeof (payload as DhaTokenResponse).expires_in !== 'number' ||
        (payload as DhaTokenResponse).expires_in <= 0
      ) {
        throw new DhaError('DHA authentication returned invalid token fields', 'DHA_INVALID_TOKEN_RESPONSE', 502);
      }

      const tokenData = payload as DhaTokenResponse;
      const expiresInMs = tokenData.expires_in * 1000;

      this.cache = {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresAt: Date.now() + expiresInMs,
      };

      return this.cache.accessToken;
    } catch (error) {
      if (error instanceof DhaError) {
        throw error;
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (isAbort) {
        throw new DhaError('DHA authentication request timed out', 'DHA_AUTHENTICATION_TIMEOUT', 504);
      }

      throw new DhaError('DHA authentication service is unavailable', 'DHA_AUTHENTICATION_UNAVAILABLE', 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
