import { notificationsApi } from '../api/notifications';

export const notificationsService = {
  listMe: notificationsApi.listMe,
  markAsRead: notificationsApi.markAsRead,
  async markAllRead() {
    // Drain the first unread page; advancing pages would skip removed records.
    const seen = new Set<string>();
    for (;;) {
      const { data } = await notificationsApi.listMe({ is_read: false, page: 1, limit: 100 });
      if (!data.length) return;
      for (const notification of data) {
        if (seen.has(notification.id)) throw new Error('Unread notifications could not be refreshed. Please retry.');
        await notificationsApi.markAsRead(notification.id);
        seen.add(notification.id);
      }
    }
  },
};
