import { describe, expect, it } from 'vitest';
import { resolveJwtSecrets } from './env.js';

describe('JWT secret configuration safety', () => {
  it('fails configuration when Production + missing access secret', () => {
    expect(() =>
      resolveJwtSecrets({
        accessTokenSecretEnv: undefined,
        refreshTokenSecretEnv: 'valid-refresh-secret',
        production: true,
      }),
    ).toThrow(/JWT_ACCESS_TOKEN_SECRET is required/i);
  });

  it('fails configuration when Production + missing refresh secret', () => {
    expect(() =>
      resolveJwtSecrets({
        accessTokenSecretEnv: 'valid-access-secret',
        refreshTokenSecretEnv: undefined,
        production: true,
      }),
    ).toThrow(/JWT_REFRESH_TOKEN_SECRET is required/i);
  });

  it('succeeds configuration when Production + valid secrets', () => {
    const secrets = resolveJwtSecrets({
      accessTokenSecretEnv: 'prod-access-secret-12345',
      refreshTokenSecretEnv: 'prod-refresh-secret-12345',
      production: true,
    });

    expect(secrets.accessTokenSecret).toBe('prod-access-secret-12345');
    expect(secrets.refreshTokenSecret).toBe('prod-refresh-secret-12345');
  });

  it('preserves valid development behavior with defaults when not in production', () => {
    const secrets = resolveJwtSecrets({
      accessTokenSecretEnv: undefined,
      refreshTokenSecretEnv: undefined,
      production: false,
    });

    expect(secrets.accessTokenSecret).toBe('dev-access-token-secret-change-me');
    expect(secrets.refreshTokenSecret).toBe('dev-refresh-token-secret-change-me');
  });

  it('fails configuration when NODE_ENV=production with missing APP_ENV and missing secrets', () => {
    const productionEnvironment = true; // NODE_ENV=production or APP_ENV=prod

    expect(() =>
      resolveJwtSecrets({
        accessTokenSecretEnv: '',
        refreshTokenSecretEnv: '',
        production: productionEnvironment,
      }),
    ).toThrow(/JWT_ACCESS_TOKEN_SECRET is required/i);
  });
});
