export type AppearancePreference = 'light' | 'dark' | 'system';
export type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;
export type SystemAppearance = 'light' | 'dark' | 'unspecified' | null | undefined;

export const parseAppearancePreference = (value: unknown): AppearancePreference => {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
};

export const resolveAppearance = (
  preference: AppearancePreference,
  systemAppearance: SystemAppearance,
): ResolvedAppearance => preference === 'system'
  ? (systemAppearance === 'dark' ? 'dark' : 'light')
  : preference;
