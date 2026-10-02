const nonEmptyString = { type: 'string', minLength: 1, maxLength: 200 } as const;

export const generalSettingsBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'applicationName',
    'defaultLanguage',
    'dateFormat',
    'timeFormat',
    'sessionTimeoutMinutes',
    'maintenanceMode',
    'darkMode',
    'auditLogging',
    'multiBranchMode',
  ],
  properties: {
    applicationName: nonEmptyString,
    defaultLanguage: { type: 'string', enum: ['en', 'sw'] },
    dateFormat: { type: 'string', enum: ['DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'] },
    timeFormat: { type: 'string', enum: ['12-hour', '24-hour'] },
    sessionTimeoutMinutes: { type: 'integer', minimum: 5, maximum: 480 },
    maintenanceMode: { type: 'boolean' },
    darkMode: { type: 'boolean' },
    auditLogging: { type: 'boolean' },
    multiBranchMode: { type: 'boolean' },
  },
} as const;

export const hospitalSettingsBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'hospitalName',
    'phone',
    'email',
    'address',
  ],
  properties: {
    hospitalName: nonEmptyString,
    phone: { type: 'string', pattern: '^\\+?[0-9\\s().-]{7,20}$' },
    email: { type: 'string', format: 'email', maxLength: 254 },
    address: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;

export const localizationSettingsBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['country', 'timezone', 'currency', 'currencySymbol', 'numberFormat', 'firstDayOfWeek'],
  properties: {
    country: { type: 'string', enum: ['Kenya', 'Uganda', 'Tanzania', 'Nigeria', 'India'] },
    timezone: { type: 'string', enum: ['Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Asia/Kolkata'] },
    currency: { type: 'string', enum: ['KES', 'UGX', 'USD', 'TZS', 'NGN', 'INR'] },
    currencySymbol: { type: 'string', minLength: 1, maxLength: 8 },
    numberFormat: { type: 'string', enum: ['1,000.00', '1.000,00'] },
    firstDayOfWeek: { type: 'string', enum: ['Monday', 'Sunday'] },
  },
} as const;

export const userPreferencesBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'passwordMinLength',
    'passwordExpiryDays',
    'maxFailedLoginAttempts',
    'requireStrongPasswords',
    'forcePasswordChangeOnFirstLogin',
    'allowUserSelfRegistration',
  ],
  properties: {
    passwordMinLength: { type: 'integer', minimum: 6, maximum: 32 },
    passwordExpiryDays: { type: 'integer', minimum: 0, maximum: 3650 },
    maxFailedLoginAttempts: { type: 'integer', minimum: 1, maximum: 20 },
    requireStrongPasswords: { type: 'boolean' },
    forcePasswordChangeOnFirstLogin: { type: 'boolean' },
    allowUserSelfRegistration: { type: 'boolean' },
  },
} as const;

export const settingsSectionParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['section'],
  properties: {
    section: { type: 'string', enum: ['general', 'hospital', 'localization', 'userPreferences'] },
  },
} as const;

export const auditLogQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string', maxLength: 200 },
    action: { type: 'string', enum: ['login', 'create', 'edit', 'delete', 'export'] },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;
