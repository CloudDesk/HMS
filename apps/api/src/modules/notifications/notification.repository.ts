import { Types } from 'mongoose';
import { NotificationModel, type NotificationDocumentFields } from './notification.model.js';
import type { CreateNotificationDTO, Notification, NotificationListQuery } from './notification.types.js';

type NotificationLean = NotificationDocumentFields & { _id: Types.ObjectId };

const toNotification = (doc: NotificationLean): Notification => ({
  id: doc._id.toString(),
  recipient_role: doc.recipientRole ?? null,
  recipient_user_id: doc.recipientUserId?.toString() ?? null,
  title: doc.title,
  message: doc.message,
  type: doc.type,
  related_entity_id: doc.relatedEntityId?.toString() ?? null,
  is_read: doc.isRead,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class NotificationRepository {
  async create(data: CreateNotificationDTO): Promise<Notification> {
    const created = await NotificationModel.create({
      recipientRole: data.recipient_role ?? null,
      recipientUserId: data.recipient_user_id ? new Types.ObjectId(data.recipient_user_id) : null,
      title: data.title,
      message: data.message,
      type: data.type,
      relatedEntityId: data.related_entity_id ? new Types.ObjectId(data.related_entity_id) : null,
    });
    return toNotification(created.toObject<NotificationLean>());
  }

  async list(query: NotificationListQuery): Promise<{ data: Notification[]; meta: any }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.recipient_role) {
      filter.recipientRole = query.recipient_role;
    }
    if (query.recipient_user_id) {
      filter.recipientUserId = new Types.ObjectId(query.recipient_user_id);
    }
    if (query.is_read !== undefined) {
      filter.isRead = query.is_read;
    }

    // If both are provided, we should probably do an OR condition so a user sees role-based AND user-based notifications
    if (query.recipient_role && query.recipient_user_id) {
      delete filter.recipientRole;
      delete filter.recipientUserId;
      filter.$or = [
        { recipientRole: query.recipient_role },
        { recipientUserId: new Types.ObjectId(query.recipient_user_id) },
      ];
    }

    const [data, count] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean<NotificationLean[]>(),
      NotificationModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toNotification),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findById(id).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }

  async markAsRead(id: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true, lean: true }
    ).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }
}
