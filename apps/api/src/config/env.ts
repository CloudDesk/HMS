type AppEnv = 'dev' | 'test' | 'prod';

const parseInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseCorsOrigins = (value: string | undefined) =>
  (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const parseDatabaseUrl = (value: string | undefined) => {
  if (!value) {
    throw new Error('DATABASE_URL is required');
  }

  return value;
};

export const env = {
  app: {
    name: process.env.APP_NAME ?? 'hms-api',
    environment: (process.env.APP_ENV ?? 'dev') as AppEnv,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInteger(process.env.PORT, 4000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  database: {
    url: parseDatabaseUrl(process.env.DATABASE_URL),
    poolSize: parseInteger(process.env.DATABASE_POOL_SIZE, 10),
    connectTimeoutSeconds: parseInteger(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS, 15),
  },
  auth: {
    accessTokenSecret:
      process.env.JWT_ACCESS_TOKEN_SECRET ??
      (process.env.APP_ENV === 'prod' ? '' : 'dev-access-token-secret-change-me'),
    refreshTokenSecret:
      process.env.JWT_REFRESH_TOKEN_SECRET ??
      (process.env.APP_ENV === 'prod' ? '' : 'dev-refresh-token-secret-change-me'),
    accessTokenTtlSeconds: parseInteger(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS, 900),
    refreshTokenTtlSeconds: parseInteger(process.env.JWT_REFRESH_TOKEN_TTL_SECONDS, 604_800),
    failedLoginLimit: parseInteger(process.env.AUTH_FAILED_LOGIN_LIMIT, 5),
    lockoutMinutes: parseInteger(process.env.AUTH_LOCKOUT_MINUTES, 15),
    passwordResetTtlMinutes: parseInteger(process.env.AUTH_PASSWORD_RESET_TTL_MINUTES, 30),
    passwordPolicy: {
      minLength: parseInteger(process.env.AUTH_PASSWORD_MIN_LENGTH, 8),
      requireUppercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
    },
  },
} as const;

if (!env.auth.accessTokenSecret || !env.auth.refreshTokenSecret) {
  throw new Error('JWT_ACCESS_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET are required');
}
