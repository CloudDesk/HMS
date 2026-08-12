
import { RoleModel } from './role.model.js';
import { UserModel } from '../users/user.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import type {
  RequestMetadata,
  RoleListQuery,
  RoleRecord,
  RoleStatus,
  RoleType,
} from './role.types.js';

const mapRole = (role: any, userCount: number): RoleRecord => ({
  id: role._id.toString(),
  code: role.code,
  name: role.name,
  description: role.description ?? null,
  type: role.type as RoleType,
  status: role.status as RoleStatus,
  color: role.color ?? null,
  userCount,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
  deletedAt: role.deletedAt ?? null,
  createdBy: role.createdBy?.toString() ?? null,
  updatedBy: role.updatedBy?.toString() ?? null,
  deletedBy: role.deletedBy?.toString() ?? null,
});

export class RoleRepository {
  async findById(id: string) {
    const role = await RoleModel.findOne({ _id: id, deletedAt: null }).lean();
    if (!role) return null;
    const userCount = await UserModel.countDocuments({ roleIds: id, deletedAt: null });
    return mapRole(role, userCount);
  }

  async findByUniqueFields(fields: {
    code?: string;
    name?: string;
    excludeRoleId?: string;
  }) {
    const filter: Record<string, any> = { deletedAt: null };
    if (fields.excludeRoleId) {
      filter._id = { $ne: fields.excludeRoleId };
    }

    const orConditions: any[] = [];
    if (fields.code) {
      orConditions.push({ code: new RegExp(`^${fields.code}$`, 'i') });
    }
    if (fields.name) {
      orConditions.push({ name: new RegExp(`^${fields.name}$`, 'i') });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    } else {
      return null;
    }

    const role = await RoleModel.findOne(filter).lean();
    if (!role) return null;
    
    const userCount = await UserModel.countDocuments({ roleIds: role._id, deletedAt: null });
    return mapRole(role, userCount);
  }

  async list(query: RoleListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, any> = { deletedAt: null };
    
    if (query.status) {
      filter.status = query.status;
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { code: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
      ];
    }

    let sortKey = query.sortBy ?? 'createdAt';
    if (sortKey === 'userCount') {
      sortKey = 'createdAt'; // We will sort manually or rely on memory if userCount sort is strictly needed. Given typical requirements, we can default back or do a complex aggregate. For simplicity in this rewrite, we will map userCount after.
    }
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      RoleModel.find(filter)
        .sort({ [sortKey]: sortOrder, _id: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      RoleModel.countDocuments(filter as any),
    ]);

    const rolesWithCounts = await Promise.all(
      data.map(async (role) => {
        const userCount = await UserModel.countDocuments({ roleIds: role._id, deletedAt: null });
        return mapRole(role, userCount);
      })
    );

    if (query.sortBy === 'userCount') {
      rolesWithCounts.sort((a, b) => {
        if (query.sortOrder === 'asc') return a.userCount - b.userCount;
        return b.userCount - a.userCount;
      });
    }

    return {
      roles: rolesWithCounts,
      total: count,
    };
  }

  async create(input: {
    code: string;
    name: string;
    description?: string | null;
    type: RoleType;
    status: RoleStatus;
    color?: string | null;
    actorUserId: string;
  }) {
    const role = await RoleModel.create({
      code: input.code,
      name: input.name,
      description: input.description,
      type: input.type,
      status: input.status,
      color: input.color,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    } as any);
    
    return mapRole(role.toObject(), 0);
  }

  async update(
    id: string,
    input: {
      code?: string;
      name?: string;
      description?: string | null;
      type?: RoleType;
      color?: string | null;
      actorUserId: string;
    },
  ) {
    const updatePayload: any = { updatedBy: input.actorUserId };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key !== 'actorUserId') {
        updatePayload[key] = value;
      }
    }

    const role = await RoleModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload as any },
      { returnDocument: 'after', lean: true }
    );
    
    if (!role) return null;
    const userCount = await UserModel.countDocuments({ roleIds: id, deletedAt: null });
    return mapRole(role, userCount);
  }

  async updateStatus(id: string, status: RoleStatus, actorUserId: string) {
    const role = await RoleModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { status, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true }
    );
    
    if (!role) return null;
    const userCount = await UserModel.countDocuments({ roleIds: id, deletedAt: null });
    return mapRole(role, userCount);
  }

  async softDelete(id: string, actorUserId: string) {
    const role = await RoleModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true }
    );
    
    if (!role) return null;
    const userCount = await UserModel.countDocuments({ roleIds: id, deletedAt: null });
    return mapRole(role, userCount);
  }

  async findUserStatus(userId: string) {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).select('status').lean();
    return user ? { id: user._id.toString(), status: user.status } : null;
  }

  async isUserAssigned(roleId: string, userId: string) {
    const user = await UserModel.findOne({ _id: userId, roleIds: roleId }).lean();
    return !!user;
  }

  async assignUser(roleId: string, userId: string, actorUserId: string) {
    await UserModel.updateOne(
      { _id: userId },
      { $addToSet: { roleIds: roleId }, $set: { updatedBy: actorUserId } }
    );
  }

  async removeUser(roleId: string, userId: string) {
    const result = await UserModel.updateOne(
      { _id: userId },
      { $pull: { roleIds: roleId } }
    );
    return result.modifiedCount > 0;
  }

  async getAssignedUsers(roleId: string) {
    const users = await UserModel.find({ roleIds: roleId, deletedAt: null })
      .sort({ fullName: 1 })
      .lean();
      
    return users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName ?? user.username,
      email: user.email ?? null,
      status: user.status,
      assignedAt: user.updatedAt, // Approximate since we don't have junction table
      assignedBy: user.updatedBy?.toString() ?? null,
    }));
  }

  async listAuditLogs(roleId: string, page: number, limit: number) {
    const filter = { 'metadataJson.roleId': roleId };
    const [records, total] = await Promise.all([
      AuditLogModel.find(filter)
        .select('_id actorUserId eventType createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    const actorIds = [...new Set(records.map((record) => record.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await UserModel.find({ _id: { $in: actorIds } }).select('_id fullName').lean()
      : [];
    const actorNames = new Map(actors.map((actor) => [String(actor._id), actor.fullName]));
    return {
      items: records.map((record) => ({
        id: String(record._id),
        actorName: record.actorUserId ? actorNames.get(record.actorUserId) ?? 'System' : 'System',
        eventType: record.eventType,
        createdAt: record.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async hasAnyActiveRole(userId: string, roleCodes: string[]) {
    if (roleCodes.length === 0) return false;

    const activeRoles = await RoleModel.find({
      code: { $in: roleCodes },
      status: 'active',
      deletedAt: null,
    }).select('_id').lean();

    const roleIds = activeRoles.map(r => r._id);
    if (roleIds.length === 0) return false;

    const user = await UserModel.findOne({
      _id: userId,
      status: 'active',
      deletedAt: null,
      roleIds: { $in: roleIds },
    }).lean();

    return !!user;
  }

  async audit(
    eventType: string,
    metadata: RequestMetadata & {
      actorUserId?: string;
      subjectUserId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const { AuditLogModel } = await import('../auth/auth.model.js');
    await AuditLogModel.create({
      eventType,
      actorUserId: metadata.actorUserId,
      subjectUserId: metadata.subjectUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: metadata.metadata,
    });
  }
}
