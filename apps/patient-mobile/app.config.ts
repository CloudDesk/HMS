import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig & {
  splash?: {
    image?: string;
    resizeMode?: 'contain' | 'cover' | 'native';
    backgroundColor?: string;
  };
} = {
  name: 'MyCare',
  slug: 'hms-patient-mobile',
  version: '0.1.0',
  owner: 'hmsapps',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android', 'ios'],
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    bundleIdentifier: 'com.hms.patient.dev',
    supportsTablet: true,
    icon: './assets/icon.png',
  },
  android: {
    package: 'com.hms.patient.dev',
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundImage: './assets/adaptive-background.png',
      backgroundColor: '#FFFFFF',
    },
  },
  plugins: [['expo-secure-store', { configureAndroidBackup: true }], 'expo-dev-client'],
  extra: {
    eas: {
      projectId: '07adcdc9-76ef-4b20-a4e7-2392688a4e2c',
    },
  },
};

export default config;
