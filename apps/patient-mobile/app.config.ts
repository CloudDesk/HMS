import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'HMS Patient', slug: 'hms-patient-mobile', version: '0.1.0',
  owner: 'hmsapps',
  orientation: 'portrait', userInterfaceStyle: 'light', platforms: ['android', 'ios'],
  ios: { bundleIdentifier: 'com.hms.patient.dev', supportsTablet: true },
  android: { package: 'com.hms.patient.dev', allowBackup: false },
  plugins: [['expo-secure-store', { configureAndroidBackup: true }], 'expo-dev-client'],
  extra: {
    eas: {
      projectId: '07adcdc9-76ef-4b20-a4e7-2392688a4e2c',
    },
  },
};
export default config;
