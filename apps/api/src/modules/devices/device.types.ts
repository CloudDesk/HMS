export type DevicePlatform = 'android' | 'ios';

export type MobileDevice = {
  id: string;
  userId: string;
  installationId: string;
  deviceId?: string;
  platform: DevicePlatform;
  pushToken: string;
  appVersion?: string;
  osVersion?: string;
  isActive: boolean;
  lastRegisteredAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterDeviceDTO = {
  installationId: string;
  deviceId?: string;
  platform: DevicePlatform;
  pushToken: string;
  appVersion?: string;
  osVersion?: string;
};

export type UnregisterDeviceDTO = {
  installationId?: string;
  pushToken?: string;
};

export type RefreshPushTokenDTO = {
  installationId: string;
  pushToken: string;
};
