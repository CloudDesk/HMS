import { apiClient } from './client';
import { z } from 'zod';

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
  phone: string;
  email: string;
  address: string;
  logoBlobName: string | null;
  logoContentType: string | null;
};

export const localizationSchema = z.object({
  country: z.enum(['Kenya', 'Uganda', 'Tanzania', 'Nigeria', 'India']),
  timezone: z.enum(['Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Asia/Kolkata']),
  currency: z.enum(['KES', 'UGX', 'USD', 'TZS', 'NGN', 'INR']),
  currencySymbol: z.string().min(1).max(8),
  numberFormat: z.enum(['1,000.00', '1.000,00']),
  firstDayOfWeek: z.enum(['Monday', 'Sunday']),
});

export type LocalizationSettings = z.infer<typeof localizationSchema>;

export type UserPreferenceSettings = {
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
  updatedAt: string;
  updatedBy: string | null;
};

export type FirstDayOfWeekSettings = Pick<LocalizationSettings, 'firstDayOfWeek'>;

export type AuditAction = 'login' | 'create' | 'edit' | 'delete' | 'export';
export type AuditLogItem = {
  id: string;
  actor: { id: string | null; name: string; profilePhotoUrl: string | null };
  eventType: string;
  action: AuditAction;
  description: string;
  module: string;
  createdAt: string;
};

export type AuditLogList = {
  items: AuditLogItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const queryString = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).length) search.set(key, String(value));
  });
  return search.size ? `?${search.toString()}` : '';
};

export const settingsApi = {
  getFirstDayOfWeek() {
    return apiClient.request<FirstDayOfWeekSettings>('/settings/runtime/first-day-of-week');
  },
  getRuntimeHospital() {
    return apiClient.request<HospitalSettings>('/settings/runtime/hospital');
  },
  get() {
    return apiClient.request<SystemSettings>('/settings');
  },
  updateGeneral(payload: Omit<GeneralSettings, 'version'>) {
    return apiClient.request<GeneralSettings>('/settings/general', { method: 'PATCH', body: payload });
  },
  updateHospital(payload: Omit<HospitalSettings, 'logoBlobName' | 'logoContentType'>) {
    return apiClient.request<HospitalSettings>('/settings/hospital', { method: 'PATCH', body: payload });
  },
  updateLocalization(payload: LocalizationSettings) {
    return apiClient.request<LocalizationSettings>('/settings/localization', { method: 'PATCH', body: payload });
  },
  updateUserPreferences(payload: UserPreferenceSettings) {
    return apiClient.request<UserPreferenceSettings>('/settings/user-preferences', { method: 'PATCH', body: payload });
  },
  reset<T>(section: 'general' | 'hospital' | 'localization' | 'userPreferences') {
    return apiClient.request<T>(`/settings/${section}/reset`, { method: 'POST' });
  },
  listAuditLogs(params: { search?: string; action?: AuditAction; page?: number; limit?: number }) {
    return apiClient.request<AuditLogList>(`/settings/audit-logs${queryString(params)}`);
  },
  exportAuditLogs(params: { search?: string; action?: AuditAction }) {
    return apiClient.requestBlob(`/settings/audit-logs/export${queryString(params)}`);
  },
  uploadLogo(file: File) {
    const body = new FormData();
    body.set('logo', file);
    return apiClient.request<HospitalSettings>('/settings/hospital/logo', { method: 'POST', body });
  },
  deleteLogo() {
    return apiClient.request<HospitalSettings>('/settings/hospital/logo', { method: 'DELETE' });
  },
  getLogo() {
    return apiClient.requestBlob('/settings/hospital/logo');
  },
};
