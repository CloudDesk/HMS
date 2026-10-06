import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi, type SystemSettings } from './settings';

let globalSettings: SystemSettings | null = null;

export function useSettings() {
  const { data } = useQuery({
    queryKey: ['settings', 'detail'],
    queryFn: () => settingsApi.get(),
  });
  useEffect(() => {
    if (data) globalSettings = data;
  }, [data]);

  return data ?? null;
}

export function useCurrencyFormatter() {
  const settings = useSettings();
  return (value: number) => {
    const currency = settings?.localization.currency;
    const numberFormat = settings?.localization.numberFormat || '1,000.00';
    
    // Choose a locale that enforces the correct thousands and decimal separators
    const locale = numberFormat === '1.000,00' ? 'de-DE' : 'en-US';

    if (!currency) return new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(value);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };
}

export function useTimezone() {
  const settings = useSettings();
  return settings?.localization.timezone || 'Africa/Nairobi';
}

/** Returns the configured dateFormat token (e.g. 'DD MMM YYYY') from the module-level singleton.
 *  Plain function (not a hook) so pure date utilities can call it without React context. */
export function getGlobalDateFormat(): string {
  return globalSettings?.general.dateFormat ?? 'DD MMM YYYY';
}

/** Hook version of getGlobalDateFormat — reactive to settings load. */
export function useDateFormat() {
  const settings = useSettings();
  return settings?.general.dateFormat ?? 'DD MMM YYYY';
}
