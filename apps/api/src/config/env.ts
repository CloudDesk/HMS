import os from 'node:os';
import path from 'node:path';

type AppEnv = 'dev' | 'test' | 'prod';

const isServerless = Boolean(
  process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.LAMBDA_TASK_ROOT ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task')),
);

const getDefaultStoragePath = (subDir: string) => {
  if (isServerless) {
    return path.join(os.tmpdir(), 'hms-storage', subDir);
  }

  return `./storage/${subDir}`;
};

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

const parseCorsOrigins = (value: string | undefined) => {
  const defaults = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
  ];
  const userOrigins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([...userOrigins, ...defaults]));
};

const parseDnsServers = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

const parseCsv = (value: string | undefined, fallback: string[]) => {
  const values = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
};

const parseDatabaseUrl = (value: string | undefined) => {
  if (!value) {
    throw new Error('MONGODB_URI or MONGODB_DATABASE_URL is required');
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
    url: parseDatabaseUrl(process.env.MONGODB_URI ?? process.env.MONGODB_DATABASE_URL),
    dnsServers: parseDnsServers(process.env.MONGODB_DNS_SERVERS),
    poolSize: parseInteger(process.env.DATABASE_POOL_SIZE, 10),
    connectTimeoutSeconds: parseInteger(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS, 15),
  },
  storage: {
    provider: process.env.PATIENT_DOCUMENT_STORAGE_PROVIDER ?? 'local',
    localPatientDocumentsPath:
      process.env.LOCAL_PATIENT_DOCUMENT_STORAGE_PATH ?? getDefaultStoragePath('patient-documents'),
    localHospitalLogosPath:
      process.env.LOCAL_HOSPITAL_LOGO_STORAGE_PATH ?? getDefaultStoragePath('hospital-logos'),
    gcpPatientDocumentsBucket: process.env.GCP_PATIENT_DOCUMENTS_BUCKET ?? '',
  },
  upload: {
    patientDocumentMaxFileSizeBytes: parseInteger(
      process.env.PATIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
      10 * 1024 * 1024,
    ),
    patientDocumentAllowedMimeTypes: parseCsv(process.env.PATIENT_DOCUMENT_ALLOWED_MIME_TYPES, [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]),
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
    patientPortalDemoOtp:
      process.env.PATIENT_PORTAL_DEMO_OTP ?? (process.env.APP_ENV === 'prod' ? '' : '1234'),
    passwordPolicy: {
      minLength: parseInteger(process.env.AUTH_PASSWORD_MIN_LENGTH, 8),
      requireUppercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
    },
  },
  patientPortal: {
    rescheduleAllowedStatuses: parseCsv(
      process.env.PATIENT_PORTAL_RESCHEDULE_ALLOWED_STATUSES,
      ['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'],
    ),
    rescheduleMinimumHours: parseInteger(
      process.env.PATIENT_PORTAL_RESCHEDULE_MINIMUM_HOURS,
      2,
    ),
  },
  sms: {
    provider: process.env.SMS_GATEWAY_PROVIDER ?? 'MOCK',
    url: process.env.SMS_GATEWAY_URL ?? '',
    apiKey: process.env.SMS_GATEWAY_API_KEY ?? '',
  },
} as const;

if (!env.auth.accessTokenSecret || !env.auth.refreshTokenSecret) {
  throw new Error('JWT_ACCESS_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET are required');
}

if (env.app.environment === 'prod' && env.auth.patientPortalDemoOtp) {
  throw new Error('PATIENT_PORTAL_DEMO_OTP must not be configured in production');
}
