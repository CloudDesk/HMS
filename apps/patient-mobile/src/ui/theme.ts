import { Platform } from 'react-native';
import type { ResolvedAppearance } from './appearance-preference';

/**
 * HMS Patient Mobile — Centralized Design System & Theme Tokens
 *
 * Visual Language:
 * - Refined white/light healthcare theme
 * - Trustworthy sky blue primary brand
 * - Subtle elevation, clean borders, spacious padding
 * - High readability and contrast
 */

const createColors = (appearance: ResolvedAppearance) => ({
  // Brand Palette
  brand: {
    primary: (appearance === 'dark' ? '#38BDF8' : '#0284C7'),
    primaryDark: (appearance === 'dark' ? '#7DD3FC' : '#0369A1'),
    primaryDeep: (appearance === 'dark' ? '#BAE6FD' : '#0C4A6E'),
    primaryLight: (appearance === 'dark' ? '#123247' : '#E0F2FE'),
    primarySubtle: (appearance === 'dark' ? '#0D2637' : '#F0F9FF'),
    accent: (appearance === 'dark' ? '#38BDF8' : '#38BDF8'),
  },

  // Neutral Palette
  neutral: {
    background: (appearance === 'dark' ? '#0B1220' : '#F8FAFC'),
    surface: (appearance === 'dark' ? '#111827' : '#FFFFFF'),
    surfaceSubtle: (appearance === 'dark' ? '#1E293B' : '#F1F5F9'),
    surfaceMuted: (appearance === 'dark' ? '#334155' : '#E2E8F0'),
  },

  // Text Hierarchy
  text: {
    primary: (appearance === 'dark' ? '#F8FAFC' : '#0F172A'),
    secondary: (appearance === 'dark' ? '#CBD5E1' : '#475569'),
    muted: (appearance === 'dark' ? '#94A3B8' : '#94A3B8'),
    inverse: (appearance === 'dark' ? '#08111F' : '#FFFFFF'),
    brand: (appearance === 'dark' ? '#7DD3FC' : '#0284C7'),
  },

  // Border & Dividers
  border: {
    default: (appearance === 'dark' ? '#334155' : '#E2E8F0'),
    subtle: (appearance === 'dark' ? '#1E293B' : '#F1F5F9'),
    focused: (appearance === 'dark' ? '#38BDF8' : '#0284C7'),
    error: (appearance === 'dark' ? '#F87171' : '#FCA5A5'),
  },

  // Semantic Status Colors
  status: {
    success: (appearance === 'dark' ? '#4ADE80' : '#16A34A'),
    successBg: (appearance === 'dark' ? '#123421' : '#DCFCE7'),
    successBorder: (appearance === 'dark' ? '#166534' : '#86EFAC'),

    warning: (appearance === 'dark' ? '#FBBF24' : '#D97706'),
    warningBg: (appearance === 'dark' ? '#3B2A0A' : '#FEF3C7'),
    warningBorder: (appearance === 'dark' ? '#92400E' : '#FDE68A'),

    danger: (appearance === 'dark' ? '#F87171' : '#DC2626'),
    dangerBg: (appearance === 'dark' ? '#3F171B' : '#FEE2E2'),
    dangerBorder: (appearance === 'dark' ? '#991B1B' : '#FCA5A5'),

    info: (appearance === 'dark' ? '#60A5FA' : '#2563EB'),
    infoBg: (appearance === 'dark' ? '#172554' : '#DBEAFE'),
    infoBorder: (appearance === 'dark' ? '#1E40AF' : '#BFDBFE'),
  },
});

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  // Font Families
  fontFamily: {
    sans: undefined, // Native system default (San Francisco on iOS, Roboto on Android)
    mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Font Sizes
  size: {
    micro: 10,
    xs: 11,
    caption: 12,
    sm: 13,
    base: 14,
    md: 15,
    subtitle: 16,
    lg: 17,
    title: 18,
    xl: 20,
    h2: 22,
    xxl: 24,
    h1: 26,
    display: 28,
    hero: 32,
  },

  // Font Weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  // Line Heights
  lineHeight: {
    micro: 12,
    compact: 14,
    tight: 16,
    snug: 18,
    normal: 20,
    moderate: 22,
    relaxed: 24,
    spacious: 26,
    heading: 28,
    title: 30,
    display: 34,
    hero: 40,
  },

  // Letter Spacings
  letterSpacing: {
    tighter: -0.4,
    tight: -0.3,
    snug: -0.2,
    normal: 0,
    wide: 0.2,
    wider: 0.4,
    widest: 0.5,
  },

  // Semantic Presets / Composite Variants
  presets: {
    display: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 34,
      letterSpacing: -0.3,
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 26,
      letterSpacing: -0.3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      lineHeight: 22,
      letterSpacing: -0.2,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '500' as const,
      lineHeight: 20,
    },
    bodyStrong: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    bodySmallMedium: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
    },
    bodySmallStrong: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
    },
    label: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
    },
    caption: {
      fontSize: 11,
      fontWeight: '400' as const,
      lineHeight: 14,
    },
    captionMedium: {
      fontSize: 11,
      fontWeight: '500' as const,
      lineHeight: 14,
    },
    captionStrong: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
    },
    micro: {
      fontSize: 10,
      fontWeight: '600' as const,
      lineHeight: 12,
    },
    button: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0.2,
    },
    buttonSmall: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    code: {
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      lineHeight: 16,
    },
  },
};

const createShadows = (appearance: ResolvedAppearance) => ({
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: (appearance === 'dark' ? '#000000' : '#0F172A'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: (appearance === 'dark' ? '#000000' : '#0F172A'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: (appearance === 'dark' ? '#000000' : '#0F172A'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
});

export type ThemeColors = ReturnType<typeof createColors>;
export type Theme = { colors: ThemeColors; shadows: ReturnType<typeof createShadows> };
const themes: Record<ResolvedAppearance, Theme> = {
  light: { colors: createColors('light'), shadows: createShadows('light') },
  dark: { colors: createColors('dark'), shadows: createShadows('dark') },
};
export const getTheme = (appearance: ResolvedAppearance): Theme => themes[appearance];
