import { useEffect, useState } from 'react';
import { settingsApi, type SystemSettings } from './settings';

let globalSettings: SystemSettings | null = null;
let fetchPromise: Promise<SystemSettings> | null = null;

export function useSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(globalSettings);

  useEffect(() => {
    let isMounted = true;
    if (globalSettings) {
      setSettings(globalSettings);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = settingsApi.get().then((res) => {
        globalSettings = res;
        return res;
      });
    }
    fetchPromise
      .then((res) => {
        if (isMounted) setSettings(res);
      })
      .catch(() => {
        // Handle error if needed
      });
    
    return () => {
      isMounted = false;
    };
  }, []);

  return settings;
}

export function useCurrencyFormatter() {
  const settings = useSettings();
  return (value: number) => {
    const currency = settings?.localization.currency || 'USD';
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };
}
