import type { LocalizationSettings } from '../api/settings';
import { formatInTimeZone } from 'date-fns-tz';

export type RegionalConfig = {
  timezones: LocalizationSettings['timezone'][];
  defaultTimezone: LocalizationSettings['timezone'];
  defaultCurrency: LocalizationSettings['currency'];
  symbol: string;
};

export const regionalConfig: Record<LocalizationSettings['country'], RegionalConfig> = {
  Kenya: {
    timezones: ['Africa/Nairobi'],
    defaultTimezone: 'Africa/Nairobi',
    defaultCurrency: 'KES',
    symbol: 'KES',
  },
  Uganda: {
    timezones: ['Africa/Kampala'],
    defaultTimezone: 'Africa/Kampala',
    defaultCurrency: 'UGX',
    symbol: 'UGX',
  },
  Tanzania: {
    timezones: ['Africa/Dar_es_Salaam'],
    defaultTimezone: 'Africa/Dar_es_Salaam',
    defaultCurrency: 'TZS',
    symbol: 'TSh',
  },
  Nigeria: {
    timezones: ['Africa/Lagos'],
    defaultTimezone: 'Africa/Lagos',
    defaultCurrency: 'NGN',
    symbol: '₦',
  },
  India: {
    timezones: ['Asia/Kolkata'],
    defaultTimezone: 'Asia/Kolkata',
    defaultCurrency: 'INR',
    symbol: '₹',
  },
};

export const currencySymbolMap: Record<LocalizationSettings['currency'], string> = {
  KES: 'KES',
  UGX: 'UGX',
  TZS: 'TSh',
  NGN: '₦',
  INR: '₹',
  USD: '$',
};

export const formatRegionalDate = (value: string | Date | null | undefined, timezone: string, formatStr = 'dd MMM yyyy') => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  if (!timezone) return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  return formatInTimeZone(date, timezone, formatStr);
};

export const formatRegionalDateTime = (value: string | Date | null | undefined, timezone: string) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  if (!timezone) return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  return formatInTimeZone(date, timezone, 'dd MMM yyyy HH:mm');
};
