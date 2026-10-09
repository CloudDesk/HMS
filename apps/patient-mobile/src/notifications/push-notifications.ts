import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SessionManager } from '../auth/session-manager';
import type { MainTab } from '../ui/components/BottomNavBar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushNavigation = (tab: MainTab, entityId?: string) => void;

const notificationTarget = (data: Record<string, unknown>): { tab: MainTab; entityId?: string } => {
  const deepLink = typeof data.deepLink === 'string' ? data.deepLink : '/notifications';
  const entityId = typeof data.entityId === 'string' && data.entityId ? data.entityId : undefined;
  if (deepLink.startsWith('/appointments')) return { tab: 'appointments', entityId };
  if (deepLink.startsWith('/records')) return { tab: 'records', entityId };
  if (deepLink.startsWith('/billing')) return { tab: 'billing', entityId };
  if (deepLink.startsWith('/dental')) return { tab: 'dental', entityId };
  return { tab: 'notifications', entityId };
};

const navigateFromResponse = (
  response: Notifications.NotificationResponse | null,
  onNavigate: PushNavigation,
) => {
  if (!response) return;
  const data = response.notification.request.content.data ?? {};
  const target = notificationTarget(data);
  onNavigate(target.tab, target.entityId);
};

const configureAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  const channels = [
    ['hms_general', 'HMS notifications'],
    ['hms_appointments', 'Appointments'],
    ['hms_clinical', 'Clinical updates'],
    ['hms_billing', 'Billing updates'],
  ] as const;
  await Promise.all(channels.map(([id, name]) => Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  })));
};

const registerCurrentToken = async (manager: SessionManager) => {
  if (!Device.isDevice) return;
  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.status === 'granted'
    ? currentPermission
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await manager.registerPushDevice({
    pushToken: token.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Constants.expoConfig?.version,
    osVersion: Device.osVersion ?? undefined,
  });
};

export const startPushNotifications = async (
  manager: SessionManager,
  onNavigate: PushNavigation,
): Promise<() => void> => {
  await configureAndroidChannels();
  await registerCurrentToken(manager).catch(() => undefined);

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromResponse(response, onNavigate);
  });
  const tokenSubscription = Notifications.addPushTokenListener(() => {
    void registerCurrentToken(manager).catch(() => undefined);
  });

  const initialResponse = await Notifications.getLastNotificationResponseAsync();
  navigateFromResponse(initialResponse, onNavigate);

  return () => {
    responseSubscription.remove();
    tokenSubscription.remove();
  };
};
