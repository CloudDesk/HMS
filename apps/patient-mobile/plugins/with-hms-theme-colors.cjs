/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads local config plugins as CommonJS. */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const light = {
  hms_brand_primary: '#0284C7',
  hms_brand_primary_dark: '#0369A1',
  hms_brand_primary_deep: '#0C4A6E',
  hms_brand_primary_light: '#E0F2FE',
  hms_brand_primary_subtle: '#F0F9FF',
  hms_brand_accent: '#38BDF8',
  hms_neutral_background: '#F8FAFC',
  hms_neutral_surface: '#FFFFFF',
  hms_neutral_surface_subtle: '#F1F5F9',
  hms_neutral_surface_muted: '#E2E8F0',
  hms_text_primary: '#0F172A',
  hms_text_secondary: '#475569',
  hms_text_muted: '#94A3B8',
  hms_text_inverse: '#FFFFFF',
  hms_text_brand: '#0284C7',
  hms_border_default: '#E2E8F0',
  hms_border_subtle: '#F1F5F9',
  hms_border_focused: '#0284C7',
  hms_border_error: '#FCA5A5',
  hms_status_success: '#16A34A',
  hms_status_success_bg: '#DCFCE7',
  hms_status_success_border: '#86EFAC',
  hms_status_warning: '#D97706',
  hms_status_warning_bg: '#FEF3C7',
  hms_status_warning_border: '#FDE68A',
  hms_status_danger: '#DC2626',
  hms_status_danger_bg: '#FEE2E2',
  hms_status_danger_border: '#FCA5A5',
  hms_status_info: '#2563EB',
  hms_status_info_bg: '#DBEAFE',
  hms_status_info_border: '#BFDBFE',
  hms_shadow: '#0F172A',
};

const dark = {
  hms_brand_primary: '#38BDF8',
  hms_brand_primary_dark: '#7DD3FC',
  hms_brand_primary_deep: '#BAE6FD',
  hms_brand_primary_light: '#123247',
  hms_brand_primary_subtle: '#0D2637',
  hms_brand_accent: '#38BDF8',
  hms_neutral_background: '#0B1220',
  hms_neutral_surface: '#111827',
  hms_neutral_surface_subtle: '#1E293B',
  hms_neutral_surface_muted: '#334155',
  hms_text_primary: '#F8FAFC',
  hms_text_secondary: '#CBD5E1',
  hms_text_muted: '#94A3B8',
  hms_text_inverse: '#08111F',
  hms_text_brand: '#7DD3FC',
  hms_border_default: '#334155',
  hms_border_subtle: '#1E293B',
  hms_border_focused: '#38BDF8',
  hms_border_error: '#F87171',
  hms_status_success: '#4ADE80',
  hms_status_success_bg: '#123421',
  hms_status_success_border: '#166534',
  hms_status_warning: '#FBBF24',
  hms_status_warning_bg: '#3B2A0A',
  hms_status_warning_border: '#92400E',
  hms_status_danger: '#F87171',
  hms_status_danger_bg: '#3F171B',
  hms_status_danger_border: '#991B1B',
  hms_status_info: '#60A5FA',
  hms_status_info_bg: '#172554',
  hms_status_info_border: '#1E40AF',
  hms_shadow: '#000000',
};

const render = (values) => {
  const items = Object.entries(values)
    .map(([name, value]) => `  <color name="${name}">${value}</color>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${items}\n</resources>\n`;
};

module.exports = (config) => withDangerousMod(config, ['android', async (mod) => {
  const resourceRoot = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
  const lightDirectory = path.join(resourceRoot, 'values');
  const darkDirectory = path.join(resourceRoot, 'values-night');
  await fs.mkdir(lightDirectory, { recursive: true });
  await fs.mkdir(darkDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(lightDirectory, 'hms-theme-colors.xml'), render(light), 'utf8'),
    fs.writeFile(path.join(darkDirectory, 'hms-theme-colors.xml'), render(dark), 'utf8'),
  ]);
  return mod;
}]);
