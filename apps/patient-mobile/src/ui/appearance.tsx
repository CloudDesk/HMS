import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { File, Paths } from 'expo-file-system';
import {
  parseAppearancePreference,
  resolveAppearance,
  type AppearancePreference,
  type ResolvedAppearance,
} from './appearance-preference';

export type { AppearancePreference, ResolvedAppearance } from './appearance-preference';

type AppearanceContextValue = {
  preference: AppearancePreference;
  resolvedAppearance: ResolvedAppearance;
  setPreference: (preference: AppearancePreference) => void;
};

const preferenceFile = new File(Paths.document, 'hms-appearance.json');

const readPreference = (): AppearancePreference => {
  try {
    if (!preferenceFile.exists) return 'system';
    const parsed = JSON.parse(preferenceFile.textSync()) as { preference?: unknown };
    return parseAppearancePreference(parsed.preference);
  } catch {
    return 'system';
  }
};

const initialPreference = readPreference();
Appearance.setColorScheme(initialPreference === 'system' ? 'unspecified' : initialPreference);

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const systemAppearance = useColorScheme();
  const [preference, setStoredPreference] = useState<AppearancePreference>(initialPreference);

  const setPreference = useCallback((nextPreference: AppearancePreference) => {
    const validatedPreference = parseAppearancePreference(nextPreference);
    Appearance.setColorScheme(validatedPreference === 'system' ? 'unspecified' : validatedPreference);
    setStoredPreference(validatedPreference);
    try {
      preferenceFile.write(JSON.stringify({ preference: validatedPreference }));
    } catch {
      // The active preference still applies for this session if local persistence is unavailable.
    }
  }, []);

  const value = useMemo<AppearanceContextValue>(() => ({
    preference,
    resolvedAppearance: resolveAppearance(preference, systemAppearance),
    setPreference,
  }), [preference, setPreference, systemAppearance]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = (): AppearanceContextValue => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used within AppearanceProvider');
  return value;
};
