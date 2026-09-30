import type { SessionManager } from '../auth/session-manager';
import {
  portalNotificationSchema,
  portalNotificationsListResponseSchema,
  type PortalNotification,
  type PortalNotificationsListResponse,
} from './contracts';

export class NotificationsApi {
  constructor(private readonly sessionManager: SessionManager) {}

  async listNotifications(
    isRead?: boolean,
    page = 1,
    limit = 50,
    patientId?: string | null
  ): Promise<PortalNotificationsListResponse> {
    const query: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (isRead !== undefined) {
      query.is_read = String(isRead);
    }
    if (patientId) {
      query.patient_id = patientId;
    }

    const response = await this.sessionManager.authenticatedRequest(
      '/notifications/me',
      portalNotificationsListResponseSchema,
      { query }
    );

    return portalNotificationsListResponseSchema.parse(response);
  }

  async getUnreadCount(patientId?: string | null): Promise<number> {
    const query: Record<string, string> = {
      is_read: 'false',
      limit: '1',
    };
    if (patientId) {
      query.patient_id = patientId;
    }

    const response = await this.sessionManager.authenticatedRequest(
      '/notifications/me',
      portalNotificationsListResponseSchema,
      { query }
    );

    const parsed = portalNotificationsListResponseSchema.parse(response);
    return parsed.meta.total;
  }

  async markAsRead(notificationId: string): Promise<PortalNotification> {
    const response = await this.sessionManager.authenticatedRequest(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      portalNotificationSchema,
      {
        method: 'PATCH',
      }
    );

    return portalNotificationSchema.parse(response);
  }
}
