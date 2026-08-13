import type {
  GeneralSettings,
  HospitalSettings,
  LocalizationSettings,
  UserPreferenceSettings,
} from './settings.types.js';

export const defaultGeneralSettings: GeneralSettings = {
  applicationName: 'Hospital Management System',
  version: '2.4.1',
  defaultLanguage: 'en',
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12-hour',
  sessionTimeoutMinutes: 30,
  maintenanceMode: false,
  darkMode: false,
  auditLogging: true,
  multiBranchMode: true,
};

export const defaultHospitalSettings: HospitalSettings = {
  hospitalName: 'Nairobi General Hospital',
  registrationNumber: 'KE-MH-2001-00412',
  hospitalType: 'Teaching',
  phone: '+254700100200',
  email: 'info@nairobigeneral.co.ke',
  website: 'https://nairobigeneral.co.ke',
  bedCapacity: 350,
  address: 'Kenyatta Avenue, Nairobi, Kenya',
  logoBlobName: null,
  logoContentType: null,
};

export const defaultLocalizationSettings: LocalizationSettings = {
  country: 'Kenya',
  timezone: 'Africa/Nairobi',
  currency: 'KES',
  currencySymbol: 'KES',
  numberFormat: '1,000.00',
  firstDayOfWeek: 'Monday',
};

export const defaultUserPreferenceSettings: UserPreferenceSettings = {
  defaultRole: 'Nurse',
  passwordMinLength: 8,
  passwordExpiryDays: 90,
  maxFailedLoginAttempts: 5,
  requireStrongPasswords: true,
  forcePasswordChangeOnFirstLogin: true,
  allowUserSelfRegistration: false,
};

export const defaultSystemSettings = {
  general: defaultGeneralSettings,
  hospital: defaultHospitalSettings,
  localization: defaultLocalizationSettings,
  userPreferences: defaultUserPreferenceSettings,
};
