import type { NotificationRepository } from './notification.repository.js';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { CreateNotificationDTO, NotificationListQuery } from './notification.types.js';

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async createNotification(data: CreateNotificationDTO, session?: ClientSession) {
    return this.repository.create(data, session);
  }

  async createGlobalNotification(data: CreateNotificationDTO, actorUserId: string) {
    this.validateIdentifiers(data);
    if (!data.recipient_role && !data.recipient_user_id) {
      throw new AppError('A recipient role or user is required', 400, 'NOTIFICATION_RECIPIENT_REQUIRED');
    }

    const branchScope = await this.repository.resolveActorBranchScope(actorUserId);
    const targetBranchId = data.recipient_branch_id ?? null;
    if (targetBranchId) {
      if (!(await this.repository.activeBranchExists(targetBranchId))) {
        throw new AppError('Recipient branch not found', 404, 'BRANCH_NOT_FOUND');
      }
      if (branchScope && !branchScope.includes(targetBranchId)) {
        throw new AppError('Recipient branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      }
    } else if (branchScope) {
      throw new AppError(
        'A recipient branch within your assigned scope is required',
        403,
        'BRANCH_SCOPE_REQUIRED',
      );
    }

    if (data.recipient_role && !(await this.repository.activeRecipientRoleExists(data.recipient_role))) {
      throw new AppError('Recipient role not found', 404, 'RECIPIENT_ROLE_NOT_FOUND');
    }

    if (data.recipient_user_id) {
      const recipientBranchIds = await this.repository.getActiveRecipientUserBranchIds(data.recipient_user_id);
      if (!recipientBranchIds) {
        throw new AppError('Recipient user not found', 404, 'RECIPIENT_USER_NOT_FOUND');
      }
      if (targetBranchId && !recipientBranchIds.includes(targetBranchId)) {
        throw new AppError(
          'Recipient user is outside the selected branch',
          403,
          'RECIPIENT_USER_BRANCH_ACCESS_DENIED',
        );
      }
    }

    return this.repository.create(data, undefined, actorUserId);
  }

  async listNotifications(query: NotificationListQuery, actorUserId: string) {
    this.validateListIdentifiers(query);
    const branchScope = await this.repository.resolveActorBranchScope(actorUserId);
    if (query.recipient_branch_id) {
      if (!(await this.repository.activeBranchExists(query.recipient_branch_id))) {
        throw new AppError('Recipient branch not found', 404, 'BRANCH_NOT_FOUND');
      }
      if (branchScope && !branchScope.includes(query.recipient_branch_id)) {
        throw new AppError('Recipient branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      }
      return this.repository.list(query, [query.recipient_branch_id]);
    }
    return this.repository.list(query, branchScope);
  }

  async listForUser(userId: string, query: Pick<NotificationListQuery, 'is_read' | 'page' | 'limit'>) {
    return this.repository.listForUser(userId, query);
  }

  async markAsRead(id: string, userId: string) {
    return this.repository.markAsReadForUser(id, userId);
  }

  private validateIdentifiers(data: CreateNotificationDTO) {
    for (const [value, message] of [
      [data.recipient_user_id, 'Recipient user id is invalid'],
      [data.recipient_branch_id, 'Recipient branch id is invalid'],
      [data.related_entity_id, 'Related entity id is invalid'],
    ] as const) {
      if (value && !Types.ObjectId.isValid(value)) {
        throw new AppError(message, 400, 'VALIDATION_ERROR');
      }
    }
  }

  private validateListIdentifiers(query: NotificationListQuery) {
    for (const [value, message] of [
      [query.recipient_user_id, 'Recipient user id is invalid'],
      [query.recipient_branch_id, 'Recipient branch id is invalid'],
    ] as const) {
      if (value && !Types.ObjectId.isValid(value)) {
        throw new AppError(message, 400, 'VALIDATION_ERROR');
      }
    }
  }
}
