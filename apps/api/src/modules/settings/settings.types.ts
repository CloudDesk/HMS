export type GeneralSettings = {
  applicationName: string;
  version: string;
  defaultLanguage: 'en' | 'sw';
  dateFormat: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  timeFormat: '12-hour' | '24-hour';
  sessionTimeoutMinutes: number;
  maintenanceMode: boolean;
  darkMode: boolean;
  auditLogging: boolean;
  multiBranchMode: boolean;
};

export type HospitalSettings = {
  hospitalName: string;
  registrationNumber: string;
  hospitalType: 'General' | 'Teaching' | 'Specialist';
  phone: string;
  email: string;
  website: string | null;
  bedCapacity: number;
  address: string;
  logoBlobName: string | null;
  logoContentType: string | null;
};

export type LocalizationSettings = {
  country: 'Kenya' | 'Uganda' | 'Tanzania' | 'Nigeria';
  timezone: 'Africa/Nairobi' | 'Africa/Lagos' | 'Africa/Cairo';
  currency: 'KES' | 'UGX' | 'USD';
  currencySymbol: string;
  numberFormat: '1,000.00' | '1.000,00';
  firstDayOfWeek: 'Monday' | 'Sunday';
};

export type UserPreferenceSettings = {
  defaultRole: 'Nurse' | 'Receptionist' | 'Doctor';
  passwordMinLength: number;
  passwordExpiryDays: number;
  maxFailedLoginAttempts: number;
  requireStrongPasswords: boolean;
  forcePasswordChangeOnFirstLogin: boolean;
  allowUserSelfRegistration: boolean;
};

export type SystemSettings = {
  general: GeneralSettings;
  hospital: HospitalSettings;
  localization: LocalizationSettings;
  userPreferences: UserPreferenceSettings;
  updatedAt: Date;
  updatedBy: string | null;
};

export type SettingsSection = 'general' | 'hospital' | 'localization' | 'userPreferences';

export type AuditAction = 'login' | 'create' | 'edit' | 'delete' | 'export';

export type AuditLogQuery = {
  search?: string;
  action?: AuditAction;
  page?: number;
  limit?: number;
};

export type AuditLogItem = {
  id: string;
  actor: {
    id: string | null;
    name: string;
    profilePhotoUrl: string | null;
  };
  eventType: string;
  action: AuditAction;
  description: string;
  module: string;
  createdAt: Date;
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
