import { apiClient } from './client';

export type ApiNotificationType = 'REFERRAL' | 'CALL_NEXT_PATIENT' | 'GENERAL';

export type NotificationResponse = {
  id: string;
  recipient_role: string | null;
  recipient_user_id: string | null;
  recipient_branch_id: string | null;
  title: string;
  message: string;
  type: ApiNotificationType;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type ListNotificationsQuery = {
  is_read?: boolean;
  page?: number;
  limit?: number;
};

export const notificationsApi = {
  listMe: async (query?: ListNotificationsQuery): Promise<{ data: NotificationResponse[]; meta: unknown }> => {
    const searchParams = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.set(key, String(value));
      });
    }
    const qs = searchParams.toString();
    return apiClient.request(`/notifications/me${qs ? `?${qs}` : ''}`);
  },

  markAsRead: async (id: string): Promise<NotificationResponse> => {
    return apiClient.request(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },
};
