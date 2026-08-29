import { Types, type ClientSession } from 'mongoose';
import { NotificationModel, type NotificationDocumentFields } from './notification.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { CreateNotificationDTO, Notification, NotificationListQuery } from './notification.types.js';

type NotificationLean = NotificationDocumentFields & { _id: Types.ObjectId };

const toNotification = (doc: NotificationLean): Notification => ({
  id: doc._id.toString(),
  recipient_role: doc.recipientRole ?? null,
  recipient_user_id: doc.recipientUserId?.toString() ?? null,
  recipient_branch_id: doc.recipientBranchId?.toString() ?? null,
  title: doc.title,
  message: doc.message,
  type: doc.type,
  related_entity_id: doc.relatedEntityId?.toString() ?? null,
  is_read: doc.isRead,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class NotificationRepository {
  private async recipientFilter(userId: string): Promise<Record<string, unknown>> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('roleIds branchIds')
      .lean<{ roleIds: Types.ObjectId[]; branchIds: Types.ObjectId[] }>();
    if (!user) return { recipientUserId: new Types.ObjectId(userId) };

    const roles = await RoleModel.find({ _id: { $in: user.roleIds }, status: 'active', deletedAt: null })
      .select('code')
      .lean<Array<{ code: string }>>();
    return {
      $or: [
        { recipientUserId: new Types.ObjectId(userId) },
        {
          recipientRole: { $in: roles.map((role) => role.code) },
          $or: [
            { recipientBranchId: null },
            { recipientBranchId: { $in: user.branchIds } },
          ],
        },
      ],
    };
  }

  async resolveActorBranchScope(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');

    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }));
    if (isSuperAdmin) return undefined;

    const branches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] },
      status: 'ACTIVE',
      deletedAt: null,
    }).select('_id').lean();
    return branches.map((branch) => branch._id.toString());
  }

  async activeBranchExists(branchId: string) {
    return Boolean(await BranchModel.exists({
      _id: branchId,
      status: 'ACTIVE',
      deletedAt: null,
    }));
  }

  async activeRecipientRoleExists(roleCode: string) {
    return Boolean(await RoleModel.exists({
      code: roleCode,
      status: 'active',
      deletedAt: null,
    }));
  }

  async getActiveRecipientUserBranchIds(userId: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds')
      .lean();
    return user ? (user.branchIds ?? []).map((branchId) => branchId.toString()) : null;
  }

  async create(
    data: CreateNotificationDTO,
    session?: ClientSession,
    actorUserId?: string,
  ): Promise<Notification> {
    const records = await NotificationModel.create([{
      recipientRole: data.recipient_role ?? null,
      recipientUserId: data.recipient_user_id ? new Types.ObjectId(data.recipient_user_id) : null,
      recipientBranchId: data.recipient_branch_id ? new Types.ObjectId(data.recipient_branch_id) : null,
      title: data.title,
      message: data.message,
      type: data.type,
      relatedEntityId: data.related_entity_id ? new Types.ObjectId(data.related_entity_id) : null,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : null,
    }], session ? { session } : undefined);
    const created = records[0];
    if (!created) throw new AppError('Notification could not be created', 500, 'NOTIFICATION_CREATE_FAILED');
    return toNotification(created.toObject<NotificationLean>());
  }

  async listForUser(userId: string, query: Pick<NotificationListQuery, 'is_read' | 'page' | 'limit'>) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      ...(query.is_read !== undefined ? { isRead: query.is_read } : {}),
      ...await this.recipientFilter(userId),
    };
    const [data, count] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<NotificationLean[]>(),
      NotificationModel.countDocuments(filter),
    ]);
    return { data: data.map(toNotification), meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 } };
  }

  async list(query: NotificationListQuery, branchIds?: string[]): Promise<{
    data: Notification[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (branchIds) {
      filter.recipientBranchId = { $in: branchIds.map((branchId) => new Types.ObjectId(branchId)) };
    }

    if (query.recipient_role) {
      filter.recipientRole = query.recipient_role;
    }
    if (query.recipient_user_id) {
      filter.recipientUserId = new Types.ObjectId(query.recipient_user_id);
    }
    if (query.recipient_branch_id) {
      filter.recipientBranchId = new Types.ObjectId(query.recipient_branch_id);
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

  async markAsReadForUser(id: string, userId: string): Promise<Notification | undefined> {
    const doc = await NotificationModel.findOneAndUpdate(
      { _id: id, ...await this.recipientFilter(userId) },
      { $set: { isRead: true } },
      { new: true, lean: true },
    ).lean<NotificationLean>();
    return doc ? toNotification(doc) : undefined;
  }
}
