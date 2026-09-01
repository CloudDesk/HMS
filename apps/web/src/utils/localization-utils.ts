import type { LocalizationSettings } from '../api/settings';
import { getGlobalDateFormat } from '../api/useSettings';
import { format } from 'date-fns';
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

/**
 * Converts a GeneralSettings dateFormat token to a date-fns format string.
 * 'DD MMM YYYY' → 'dd MMM yyyy'
 * 'YYYY-MM-DD'  → 'yyyy-MM-dd'
 * 'MM/DD/YYYY'  → 'MM/dd/yyyy'
 */
export function toDateFnsFormat(token: string): string {
  if (token === 'YYYY-MM-DD') return 'yyyy-MM-dd';
  if (token === 'MM/DD/YYYY') return 'MM/dd/yyyy';
  return 'dd MMM yyyy'; // default: 'DD MMM YYYY'
}

export const formatRegionalDate = (value: string | Date | null | undefined, timezone: string, formatStr?: string) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  const fmt = formatStr ?? toDateFnsFormat(getGlobalDateFormat());
  if (!timezone) return format(date, fmt);
  return formatInTimeZone(date, timezone, fmt);
};

export const formatRegionalDateTime = (value: string | Date | null | undefined, timezone: string) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  const dtFmt = `${toDateFnsFormat(getGlobalDateFormat())} HH:mm`;
  if (!timezone) return format(date, dtFmt);
  return formatInTimeZone(date, timezone, dtFmt);
};


