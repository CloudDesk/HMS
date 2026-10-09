import { describe, expect, it } from 'vitest';
import { parseAppearancePreference, resolveAppearance } from './appearance-preference';

describe('appearance preference', () => {
  it('accepts supported values and safely defaults invalid persisted values', () => {
    expect(parseAppearancePreference('light')).toBe('light');
    expect(parseAppearancePreference('dark')).toBe('dark');
    expect(parseAppearancePreference('system')).toBe('system');
    expect(parseAppearancePreference('sepia')).toBe('system');
  });

  it('keeps explicit preferences independent from the device appearance', () => {
    expect(resolveAppearance('light', 'dark')).toBe('light');
    expect(resolveAppearance('dark', 'light')).toBe('dark');
  });

  it('resolves system preference whenever the device appearance changes', () => {
    expect(resolveAppearance('system', 'dark')).toBe('dark');
    expect(resolveAppearance('system', 'light')).toBe('light');
    expect(resolveAppearance('system', 'unspecified')).toBe('light');
  });
});
