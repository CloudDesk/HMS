import type { NotificationRepository } from './notification.repository.js';
import type { CreateNotificationDTO, NotificationListQuery } from './notification.types.js';

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async createNotification(data: CreateNotificationDTO) {
    return this.repository.create(data);
  }

  async listNotifications(query: NotificationListQuery) {
    return this.repository.list(query);
  }

  async markAsRead(id: string) {
    return this.repository.markAsRead(id);
  }
}
