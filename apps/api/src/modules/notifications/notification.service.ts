import type { NotificationRepository } from './notification.repository.js';
import type { ClientSession } from 'mongoose';
import type { CreateNotificationDTO, NotificationListQuery } from './notification.types.js';

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async createNotification(data: CreateNotificationDTO, session?: ClientSession) {
    return this.repository.create(data, session);
  }

  async listNotifications(query: NotificationListQuery) {
    return this.repository.list(query);
  }

  async listForUser(userId: string, query: Pick<NotificationListQuery, 'is_read' | 'page' | 'limit'>) {
    return this.repository.listForUser(userId, query);
  }

  async markAsRead(id: string, userId: string) {
    return this.repository.markAsReadForUser(id, userId);
  }
}
