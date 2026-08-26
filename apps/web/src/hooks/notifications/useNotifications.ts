import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications';

export const notificationKeys = {
  unread: ['notifications', 'unread'] as const,
};

export function useUnreadNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationsApi.listMe({ is_read: false, limit: 10 }),
    enabled,
    refetchInterval: 5_000,
  });
}
