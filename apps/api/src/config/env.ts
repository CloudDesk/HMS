type AppEnv = 'dev' | 'test' | 'prod';

const appEnvironment = process.env.APP_ENV ?? 'dev';
if (!['dev', 'test', 'prod'].includes(appEnvironment)) {
  throw new Error('APP_ENV must be one of dev, test, or prod');
}

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

const parsePositiveInteger = (name: string, value: string | undefined, fallback: number) => {
  const parsed = parseInteger(value, fallback);
  if (parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

const patientPortalDemoOtpEnabled = parseBoolean(
  process.env.PATIENT_PORTAL_DEMO_OTP_ENABLED,
  false,
);
const patientPortalDemoOtp = process.env.PATIENT_PORTAL_DEMO_OTP?.trim() ?? '';
const productionEnvironment = appEnvironment === 'prod' || process.env.NODE_ENV === 'production';
const cookieSecure = parseBoolean(process.env.COOKIE_SECURE, productionEnvironment);
const cookieSameSiteValue = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();

if (!['lax', 'strict', 'none'].includes(cookieSameSiteValue)) {
  throw new Error('COOKIE_SAME_SITE must be one of lax, strict, or none');
}

const cookieSameSite = cookieSameSiteValue as 'lax' | 'strict' | 'none';

export const assertRefreshCookieConfiguration = (input: {
  production: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}) => {
  if (input.production && !input.secure) {
    throw new Error('COOKIE_SECURE must be enabled in production');
  }
  if (input.sameSite === 'none' && !input.secure) {
    throw new Error('COOKIE_SECURE must be enabled when COOKIE_SAME_SITE is none');
  }
};

assertRefreshCookieConfiguration({
  production: productionEnvironment,
  secure: cookieSecure,
  sameSite: cookieSameSite,
});

export const assertPatientPortalDemoOtpConfiguration = (input: {
  enabled: boolean;
  otp: string;
  production: boolean;
}) => {
  if (input.enabled && !/^\d{4}$/.test(input.otp)) {
    throw new Error('PATIENT_PORTAL_DEMO_OTP must be exactly four digits when demo OTP is enabled');
  }
  if (input.production && (input.enabled || input.otp)) {
    throw new Error('Patient portal demo OTP configuration is not allowed in production');
  }
};

assertPatientPortalDemoOtpConfiguration({
  enabled: patientPortalDemoOtpEnabled,
  otp: patientPortalDemoOtp,
  production: productionEnvironment,
});

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
    environment: appEnvironment as AppEnv,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInteger(process.env.PORT, 4000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  http: {
    trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  },
  database: {
    url: parseDatabaseUrl(process.env.MONGODB_URI ?? process.env.MONGODB_DATABASE_URL),
    dnsServers: parseDnsServers(process.env.MONGODB_DNS_SERVERS),
    poolSize: parseInteger(process.env.DATABASE_POOL_SIZE, 10),
    connectTimeoutSeconds: parseInteger(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS, 15),
  },
  storage: {
    provider: process.env.PATIENT_DOCUMENT_STORAGE_PROVIDER ?? 'local',
    localPatientDocumentsPath: process.env.LOCAL_PATIENT_DOCUMENT_STORAGE_PATH ?? './storage/patient-documents',
    localHospitalLogosPath: process.env.LOCAL_HOSPITAL_LOGO_STORAGE_PATH ?? './storage/hospital-logos',
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
    patientPortalDemoOtpEnabled,
    patientPortalDemoOtp,
    otpTtlSeconds: parsePositiveInteger('AUTH_OTP_TTL_SECONDS', process.env.AUTH_OTP_TTL_SECONDS, 300),
    otpResendCooldownSeconds: parsePositiveInteger('AUTH_OTP_RESEND_COOLDOWN_SECONDS', process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS, 60),
    otpMaxVerificationAttempts: parsePositiveInteger('AUTH_OTP_MAX_VERIFICATION_ATTEMPTS', process.env.AUTH_OTP_MAX_VERIFICATION_ATTEMPTS, 3),
    otpIdentityRequestLimit: parsePositiveInteger('AUTH_OTP_IDENTITY_REQUEST_LIMIT', process.env.AUTH_OTP_IDENTITY_REQUEST_LIMIT, 5),
    otpIdentityWindowSeconds: parsePositiveInteger('AUTH_OTP_IDENTITY_WINDOW_SECONDS', process.env.AUTH_OTP_IDENTITY_WINDOW_SECONDS, 3600),
    otpIpRequestLimit: parsePositiveInteger('AUTH_OTP_IP_REQUEST_LIMIT', process.env.AUTH_OTP_IP_REQUEST_LIMIT, 20),
    otpIpRequestWindowSeconds: parsePositiveInteger('AUTH_OTP_IP_REQUEST_WINDOW_SECONDS', process.env.AUTH_OTP_IP_REQUEST_WINDOW_SECONDS, 600),
    otpVerificationIpLimit: parsePositiveInteger('AUTH_OTP_VERIFICATION_IP_LIMIT', process.env.AUTH_OTP_VERIFICATION_IP_LIMIT, 30),
    otpVerificationIdentityLimit: parsePositiveInteger('AUTH_OTP_VERIFICATION_IDENTITY_LIMIT', process.env.AUTH_OTP_VERIFICATION_IDENTITY_LIMIT, 10),
    otpVerificationWindowSeconds: parsePositiveInteger('AUTH_OTP_VERIFICATION_WINDOW_SECONDS', process.env.AUTH_OTP_VERIFICATION_WINDOW_SECONDS, 600),
    loginIpLimit: parsePositiveInteger('AUTH_LOGIN_IP_LIMIT', process.env.AUTH_LOGIN_IP_LIMIT, 20),
    loginIdentityLimit: parsePositiveInteger('AUTH_LOGIN_IDENTITY_LIMIT', process.env.AUTH_LOGIN_IDENTITY_LIMIT, 10),
    loginWindowSeconds: parsePositiveInteger('AUTH_LOGIN_WINDOW_SECONDS', process.env.AUTH_LOGIN_WINDOW_SECONDS, 900),
    passwordPolicy: {
      minLength: parseInteger(process.env.AUTH_PASSWORD_MIN_LENGTH, 8),
      requireUppercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: parseBoolean(process.env.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
    },
    cookie: {
      // In production, cookies must be Secure (HTTPS). In dev (HTTP localhost), false is acceptable.
      secure: cookieSecure,
      // Optional domain scoping (e.g. ".hms.example.com"). Leave unset for same-origin/same-site.
      domain: process.env.COOKIE_DOMAIN,
      // SameSite=Lax blocks cross-site POST requests (the CSRF attack vector for cookie-based auth)
      // while allowing same-site requests. Correct for same-site frontend/API deployments.
      sameSite: cookieSameSite,
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
