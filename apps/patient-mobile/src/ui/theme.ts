import { DynamicColorIOS, Platform, PlatformColor, type ColorValue } from 'react-native';

/**
 * HMS Patient Mobile — Centralized Design System & Theme Tokens
 *
 * Visual Language:
 * - Refined white/light healthcare theme
 * - Trustworthy sky blue primary brand
 * - Subtle elevation, clean borders, spacious padding
 * - High readability and contrast
 */

const adaptiveColor = (resource: string, light: string, dark: string): ColorValue => {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  if (Platform.OS === 'android') return PlatformColor(`@color/${resource}`);
  return light;
};

export const colors = {
  // Brand Palette
  brand: {
    primary: adaptiveColor('hms_brand_primary', '#0284C7', '#38BDF8'),
    primaryDark: adaptiveColor('hms_brand_primary_dark', '#0369A1', '#7DD3FC'),
    primaryDeep: adaptiveColor('hms_brand_primary_deep', '#0C4A6E', '#BAE6FD'),
    primaryLight: adaptiveColor('hms_brand_primary_light', '#E0F2FE', '#123247'),
    primarySubtle: adaptiveColor('hms_brand_primary_subtle', '#F0F9FF', '#0D2637'),
    accent: adaptiveColor('hms_brand_accent', '#38BDF8', '#38BDF8'),
  },

  // Neutral Palette
  neutral: {
    background: adaptiveColor('hms_neutral_background', '#F8FAFC', '#0B1220'),
    surface: adaptiveColor('hms_neutral_surface', '#FFFFFF', '#111827'),
    surfaceSubtle: adaptiveColor('hms_neutral_surface_subtle', '#F1F5F9', '#1E293B'),
    surfaceMuted: adaptiveColor('hms_neutral_surface_muted', '#E2E8F0', '#334155'),
  },

  // Text Hierarchy
  text: {
    primary: adaptiveColor('hms_text_primary', '#0F172A', '#F8FAFC'),
    secondary: adaptiveColor('hms_text_secondary', '#475569', '#CBD5E1'),
    muted: adaptiveColor('hms_text_muted', '#94A3B8', '#94A3B8'),
    inverse: adaptiveColor('hms_text_inverse', '#FFFFFF', '#08111F'),
    brand: adaptiveColor('hms_text_brand', '#0284C7', '#7DD3FC'),
  },

  // Border & Dividers
  border: {
    default: adaptiveColor('hms_border_default', '#E2E8F0', '#334155'),
    subtle: adaptiveColor('hms_border_subtle', '#F1F5F9', '#1E293B'),
    focused: adaptiveColor('hms_border_focused', '#0284C7', '#38BDF8'),
    error: adaptiveColor('hms_border_error', '#FCA5A5', '#F87171'),
  },

  // Semantic Status Colors
  status: {
    success: adaptiveColor('hms_status_success', '#16A34A', '#4ADE80'),
    successBg: adaptiveColor('hms_status_success_bg', '#DCFCE7', '#123421'),
    successBorder: adaptiveColor('hms_status_success_border', '#86EFAC', '#166534'),

    warning: adaptiveColor('hms_status_warning', '#D97706', '#FBBF24'),
    warningBg: adaptiveColor('hms_status_warning_bg', '#FEF3C7', '#3B2A0A'),
    warningBorder: adaptiveColor('hms_status_warning_border', '#FDE68A', '#92400E'),

    danger: adaptiveColor('hms_status_danger', '#DC2626', '#F87171'),
    dangerBg: adaptiveColor('hms_status_danger_bg', '#FEE2E2', '#3F171B'),
    dangerBorder: adaptiveColor('hms_status_danger_border', '#FCA5A5', '#991B1B'),

    info: adaptiveColor('hms_status_info', '#2563EB', '#60A5FA'),
    infoBg: adaptiveColor('hms_status_info_bg', '#DBEAFE', '#172554'),
    infoBorder: adaptiveColor('hms_status_info_border', '#BFDBFE', '#1E40AF'),
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
    shadowColor: adaptiveColor('hms_shadow', '#0F172A', '#000000'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: adaptiveColor('hms_shadow', '#0F172A', '#000000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: adaptiveColor('hms_shadow', '#0F172A', '#000000'),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};
