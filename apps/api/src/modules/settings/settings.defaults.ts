import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  GeneralSettings,
  HospitalSettings,
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
  hospitalName: 'Hospital not configured',
  phone: '',
  email: '',
  address: '',
  logoBlobName: null,
  logoContentType: null,
};

export const defaultUserPreferenceSettings: UserPreferenceSettings = {
  passwordMinLength: 8,
  passwordExpiryDays: 90,
  maxFailedLoginAttempts: 5,
  requireStrongPasswords: true,
  forcePasswordChangeOnFirstLogin: true,
  allowUserSelfRegistration: false,
};

// Validate only when initializing an absent settings document. Established
// deployments must not depend on bootstrap environment variables remaining set.
const initialSettingsSchema = z.object({
  hospitalName: z.string().trim().min(1).max(200),
  phone: z.string().trim().regex(/^\+?[0-9\s().-]{7,20}$/),
  email: z.string().trim().email().max(254),
  address: z.string().trim().min(1).max(1000),
  country: z.enum(['Kenya', 'Uganda', 'Tanzania', 'Nigeria', 'India']),
  timezone: z.enum(['Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Asia/Kolkata']),
  currency: z.enum(['KES', 'UGX', 'USD', 'TZS', 'NGN', 'INR']),
  currencySymbol: z.string().trim().min(1).max(8),
});

export const getInitialSystemSettings = () => {
  const result = initialSettingsSchema.safeParse(env.initialSettings);
  if (!result.success) {
    throw new AppError(
      'Initial hospital and localization settings are required. Configure the HMS_INITIAL_* environment variables before first use.',
      503,
      'SETTINGS_SETUP_REQUIRED',
    );
  }
  const { hospitalName, phone, email, address, country, timezone, currency, currencySymbol } = result.data;
  return {
    general: defaultGeneralSettings,
    hospital: { hospitalName, phone, email: email.toLowerCase(), address, logoBlobName: null, logoContentType: null },
    localization: { country, timezone, currency, currencySymbol, numberFormat: '1,000.00' as const, firstDayOfWeek: 'Monday' as const },
    userPreferences: defaultUserPreferenceSettings,
  };
};
