import { Platform } from 'react-native';

/**
 * HMS Patient Mobile — Centralized Design System & Theme Tokens
 *
 * Visual Language:
 * - Refined white/light healthcare theme
 * - Trustworthy sky blue primary brand
 * - Subtle elevation, clean borders, spacious padding
 * - High readability and contrast
 */

export const colors = {
  // Brand Palette
  brand: {
    primary: '#0284C7',       // Sky 600 - Main action color
    primaryDark: '#0369A1',   // Sky 700 - Hover / pressed / active
    primaryDeep: '#0C4A6E',   // Sky 900 - High-contrast headers
    primaryLight: '#E0F2FE',  // Sky 100 - Subtle badges / icon backgrounds
    primarySubtle: '#F0F9FF', // Sky 50 - Card highlights / selected state
    accent: '#38BDF8',        // Sky 400 - Focus / rings
  },

  // Neutral Palette
  neutral: {
    background: '#F8FAFC',    // Slate 50 - Main screen background
    surface: '#FFFFFF',       // Card / modal surface
    surfaceSubtle: '#F1F5F9', // Slate 100 - Inset panels / chips
    surfaceMuted: '#E2E8F0',  // Slate 200 - Disabled / placeholder
  },

  // Text Hierarchy
  text: {
    primary: '#0F172A',       // Slate 900 - Headings & main body
    secondary: '#475569',     // Slate 600 - Supportive text & labels
    muted: '#94A3B8',         // Slate 400 - Placeholders & timestamps
    inverse: '#FFFFFF',       // On dark buttons / badges
    brand: '#0284C7',         // Interactive links
  },

  // Border & Dividers
  border: {
    default: '#E2E8F0',       // Slate 200 - Card / input borders
    subtle: '#F1F5F9',        // Slate 100 - Row dividers
    focused: '#0284C7',       // Sky 600 - Focused inputs
    error: '#FCA5A5',         // Red 300 - Invalid fields
  },

  // Semantic Status Colors
  status: {
    success: '#16A34A',       // Green 600
    successBg: '#DCFCE7',     // Green 100
    successBorder: '#86EFAC', // Green 300

    warning: '#D97706',       // Amber 600
    warningBg: '#FEF3C7',     // Amber 100
    warningBorder: '#FDE68A', // Amber 300

    danger: '#DC2626',        // Red 600
    dangerBg: '#FEE2E2',      // Red 100
    dangerBorder: '#FCA5A5',  // Red 300

    info: '#2563EB',          // Blue 600
    infoBg: '#DBEAFE',        // Blue 100
    infoBorder: '#BFDBFE',    // Blue 300
  },
} as const;

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

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};
