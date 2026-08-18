export type NotificationType = 'REFERRAL' | 'CALL_NEXT_PATIENT' | 'GENERAL';

export type Notification = {
  id: string;
  recipient_role: string | null;
  recipient_user_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CreateNotificationDTO = {
  recipient_role?: string | null;
  recipient_user_id?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  related_entity_id?: string | null;
};

export type NotificationListQuery = {
  recipient_role?: string;
  recipient_user_id?: string;
  is_read?: boolean;
  page?: number;
  limit?: number;
};
