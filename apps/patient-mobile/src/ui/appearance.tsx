import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Appearance, StatusBar } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { getTheme, type Theme } from './theme';
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
  theme: Theme;
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

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const [preference, setStoredPreference] = useState<AppearancePreference>(() => {
    const saved = readPreference();
    Appearance.setColorScheme(saved === 'system' ? 'unspecified' : saved);
    return saved;
  });
  const [systemAppearance, setSystemAppearance] = useState(Appearance.getColorScheme);

  useEffect(() => {
    const syncAppearance = () => setSystemAppearance(Appearance.getColorScheme());
    const appearanceSubscription = Appearance.addChangeListener(syncAppearance);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Refresh RN's cached snapshot if a system change happened in the background.
        if (preference === 'system') Appearance.setColorScheme('unspecified');
        syncAppearance();
      }
    });
    syncAppearance();
    return () => {
      appearanceSubscription.remove();
      appStateSubscription.remove();
    };
  }, [preference]);

  const setPreference = useCallback((nextPreference: AppearancePreference) => {
    const validatedPreference = parseAppearancePreference(nextPreference);
    Appearance.setColorScheme(validatedPreference === 'system' ? 'unspecified' : validatedPreference);
    setStoredPreference(validatedPreference);
    // setColorScheme updates RN's snapshot but does not necessarily emit a change event.
    setSystemAppearance(Appearance.getColorScheme());
    try {
      preferenceFile.write(JSON.stringify({ preference: validatedPreference }));
    } catch {
      // The active preference still applies for this session if local persistence is unavailable.
    }
  }, []);

  const resolvedAppearance = resolveAppearance(preference, systemAppearance);
  const value = useMemo<AppearanceContextValue>(() => ({
    preference,
    resolvedAppearance,
    setPreference,
    theme: getTheme(resolvedAppearance),
  }), [preference, setPreference, resolvedAppearance]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = (): AppearanceContextValue => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used within AppearanceProvider');
  return value;
};

export const useTheme = (): Theme => useAppearance().theme;

export function AppearanceStatusBar() {
  const { resolvedAppearance, theme } = useAppearance();
  return <StatusBar
    barStyle={resolvedAppearance === 'dark' ? 'light-content' : 'dark-content'}
    // Android StatusBar requires a concrete color, not a PlatformColor resource.
    backgroundColor={theme.colors.neutral.background}
  />;
}

export const useThemedStyles = <T,>(createStyles: (theme: Theme) => T): T => {
  const theme = useTheme();
  return useMemo(() => createStyles(theme), [createStyles, theme]);
};
