
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

import { PermissionModel, PermissionCategoryModel, PermissionGroupModel } from './permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type {
  PermissionListQuery,
  PermissionRecord,
  PermissionStatus,
  PermissionType,
  RequestMetadata,
} from './permission.types.js';
import type { IPermissionGroup, IPermissionCategory } from './permission.model.js';

type PermissionDoc = {
  _id: unknown;
  code: string;
  name: string;
  module: string;
  screen: string;
  action: string;
  description?: string | null;
  type: string;
  status: string;
  categoryId?: unknown;
  groupId?: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy?: unknown;
  updatedBy?: unknown;
  deletedBy?: unknown;
};

type PermissionRoleCount = {
  _id: unknown;
  count: number;
};

export type EffectiveAuthority = {
  isSuperAdmin: boolean;
  permissionIds: string[];
};

const mapPermission = (
  permission: PermissionDoc,
  roleCount: number
): PermissionRecord => {
  const cat = permission.categoryId as Partial<IPermissionCategory> | undefined;
  const group = permission.groupId as Partial<IPermissionGroup> | undefined;
  return {
  id: String(permission._id),
  code: permission.code,
  name: permission.name,
  module: permission.module,
  screen: permission.screen,
  action: permission.action,
  description: permission.description ?? null,
  type: permission.type as PermissionType,
  status: permission.status as PermissionStatus,
  categoryId: cat?._id?.toString() ?? (typeof permission.categoryId === 'string' || typeof permission.categoryId === 'object' ? permission.categoryId?.toString() : null) ?? null,
  categoryCode: cat?.code ?? null,
  categoryName: cat?.name ?? null,
  groupId: group?._id?.toString() ?? (typeof permission.groupId === 'string' || typeof permission.groupId === 'object' ? permission.groupId?.toString() : null) ?? null,
  groupCode: group?.code ?? null,
  groupName: group?.name ?? null,
  roleCount,
  createdAt: permission.createdAt,
  updatedAt: permission.updatedAt,
  deletedAt: permission.deletedAt ?? null,
  createdBy: permission.createdBy ? String(permission.createdBy) : null,
  updatedBy: permission.updatedBy ? String(permission.updatedBy) : null,
  deletedBy: permission.deletedBy ? String(permission.deletedBy) : null,
};
};

const mapPermissionsWithRoleCounts = async (permissions: PermissionDoc[]) => {
  if (permissions.length === 0) return [];

  const permissionIds = permissions.map((permission) => permission._id);
  const roleCounts = await RoleModel.aggregate<PermissionRoleCount>([
    { $match: { permissionIds: { $in: permissionIds }, deletedAt: null } },
    { $unwind: '$permissionIds' },
    { $match: { permissionIds: { $in: permissionIds } } },
    { $group: { _id: { permissionId: '$permissionIds', roleId: '$_id' } } },
    { $group: { _id: '$_id.permissionId', count: { $sum: 1 } } },
  ]);
  const countByPermissionId = new Map(
    roleCounts.map((entry) => [String(entry._id), entry.count]),
  );

  return permissions.map((permission) =>
    mapPermission(permission, countByPermissionId.get(String(permission._id)) ?? 0));
};

export class PermissionRepository {
  async findById(id: string) {
    const permission = await PermissionModel.findOne({ _id: id, deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .lean();
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission as unknown as PermissionDoc, roleCount);
  }

  async findByUniqueFields(fields: {
    code?: string;
    module?: string;
    screen?: string;
    action?: string;
    excludePermissionId?: string;
  }) {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (fields.excludePermissionId) {
      filter._id = { $ne: fields.excludePermissionId };
    }

    const orConditions: Array<Record<string, unknown>> = [];
    if (fields.code) {
      orConditions.push({ code: new RegExp(`^${fields.code}$`, 'i') });
    }
    if (fields.module && fields.screen && fields.action) {
      orConditions.push({
        module: new RegExp(`^${fields.module}$`, 'i'),
        screen: new RegExp(`^${fields.screen}$`, 'i'),
        action: new RegExp(`^${fields.action}$`, 'i'),
      });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    } else {
      return null;
    }

    const permission = await PermissionModel.findOne(filter)
      .populate('categoryId')
      .populate('groupId')
      .lean();
    if (!permission) return null;
    
    const roleCount = await RoleModel.countDocuments({ permissionIds: permission._id, deletedAt: null });
    return mapPermission(permission as unknown as PermissionDoc, roleCount);
  }

  async list(query: PermissionListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = { deletedAt: null };
    
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.module) filter.module = new RegExp(`^${escapeRegex(query.module)}$`, 'i');
    if (query.screen) filter.screen = new RegExp(`^${escapeRegex(query.screen)}$`, 'i');
    if (query.action) filter.action = new RegExp(`^${escapeRegex(query.action)}$`, 'i');
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.groupId) filter.groupId = query.groupId;

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { code: searchRegex },
        { name: searchRegex },
        { module: searchRegex },
        { screen: searchRegex },
        { action: searchRegex },
        { description: searchRegex },
      ];
    }

    let sortKey = query.sortBy ?? 'createdAt';
    if (sortKey === 'roleCount') sortKey = 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      PermissionModel.find(filter)
        .populate('categoryId')
        .populate('groupId')
        .sort({ [sortKey]: sortOrder, _id: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      PermissionModel.countDocuments(filter),
    ]);

    const permissionsWithCounts = await mapPermissionsWithRoleCounts(
      data as unknown as PermissionDoc[],
    );

    if (query.sortBy === 'roleCount') {
      permissionsWithCounts.sort((a, b) => {
        if (query.sortOrder === 'asc') return a.roleCount - b.roleCount;
        return b.roleCount - a.roleCount;
      });
    }

    return {
      permissions: permissionsWithCounts,
      total: count,
    };
  }

  async ensureCategory(input: {
    code: string;
    name: string;
    description?: string | null;
    actorUserId: string;
  }) {
    let category = await PermissionCategoryModel.findOne({ code: new RegExp(`^${input.code}$`, 'i') }).lean();
    if (!category) {
      category = await PermissionCategoryModel.create({
        code: input.code,
        name: input.name,
        description: input.description,
      } as Partial<IPermissionCategory>).then(doc => doc.toObject());
    }
    return {
      id: category!._id.toString(),
      code: category!.code,
      name: category!.name,
      status: 'active' as PermissionStatus,
    };
  }

  async ensureGroup(input: {
    categoryId: string;
    code: string;
    name: string;
    description?: string | null;
    actorUserId: string;
  }) {
    let group = await PermissionGroupModel.findOne({ 
      categoryId: input.categoryId, 
      code: new RegExp(`^${input.code}$`, 'i') 
    }).lean();
    if (!group) {
      group = await PermissionGroupModel.create({
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        description: input.description,
      } as unknown as Partial<IPermissionGroup>).then(doc => doc.toObject());
    }
    return {
      id: group!._id.toString(),
      categoryId: group!.categoryId.toString(),
      code: group!.code,
      name: group!.name,
      status: 'active' as PermissionStatus,
    };
  }

  async findCategoryById(id: string) {
    const category = await PermissionCategoryModel.findById(id).lean();
    return category ? {
      id: category._id.toString(),
      code: category.code,
      name: category.name,
      status: 'active' as PermissionStatus,
    } : null;
  }

  async findGroupById(id: string) {
    const group = await PermissionGroupModel.findById(id).lean();
    return group ? {
      id: group._id.toString(),
      categoryId: group.categoryId.toString(),
      code: group.code,
      name: group.name,
      status: 'active' as PermissionStatus,
    } : null;
  }

  async create(input: {
    code: string;
    name: string;
    module: string;
    screen: string;
    action: string;
    description?: string | null;
    type: PermissionType;
    status: PermissionStatus;
    categoryId?: string | null;
    groupId?: string | null;
    actorUserId: string;
  }) {
    const permission = await PermissionModel.create({
      code: input.code,
      name: input.name,
      module: input.module,
      screen: input.screen,
      action: input.action,
      description: input.description,
      type: input.type,
      status: input.status,
      categoryId: input.categoryId ?? undefined,
      groupId: input.groupId ?? undefined,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    } as unknown as Partial<import('./permission.model.js').IPermission>);
    return mapPermission(permission.toObject() as unknown as PermissionDoc, 0);
  }

  async update(
    id: string,
    input: {
      code?: string;
      name?: string;
      module?: string;
      screen?: string;
      action?: string;
      description?: string | null;
      type?: PermissionType;
      status?: PermissionStatus;
      categoryId?: string | null;
      groupId?: string | null;
      actorUserId: string;
    },
  ) {
    type PermissionUpdate = {
      updatedBy: string;
      code?: string; name?: string; module?: string; screen?: string; action?: string;
      description?: string | null; type?: string; status?: string;
      categoryId?: string | null; groupId?: string | null;
    };
    const updatePayload: PermissionUpdate = { updatedBy: input.actorUserId };
    if (input.code !== undefined) updatePayload.code = input.code;
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.module !== undefined) updatePayload.module = input.module;
    if (input.screen !== undefined) updatePayload.screen = input.screen;
    if (input.action !== undefined) updatePayload.action = input.action;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.type !== undefined) updatePayload.type = input.type;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.categoryId !== undefined) updatePayload.categoryId = input.categoryId;
    if (input.groupId !== undefined) updatePayload.groupId = input.groupId;

    const permission = await PermissionModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { returnDocument: 'after', lean: true }
    ).populate('categoryId').populate('groupId');
    
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission as unknown as PermissionDoc, roleCount);
  }

  async softDelete(id: string, actorUserId: string) {
    const permission = await PermissionModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true }
    ).populate('categoryId').populate('groupId');
    
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission as unknown as PermissionDoc, roleCount);
  }

  async findRoleById(roleId: string) {
    const role = await RoleModel.findOne({ _id: roleId, deletedAt: null }).lean();
    return role ? {
      id: role._id.toString(),
      code: role.code,
      name: role.name,
      type: role.type,
      status: role.status,
    } : null;
  }

  async findPermissionsByIds(permissionIds: string[]) {
    if (permissionIds.length === 0) return [];
    
    const permissions = await PermissionModel.find({ _id: { $in: permissionIds }, deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .lean();
      
    return mapPermissionsWithRoleCounts(permissions as unknown as PermissionDoc[]);
  }

  async getPermissionsByRole(roleId: string) {
    const role = await RoleModel.findOne({ _id: roleId, deletedAt: null }).lean();
    if (!role || !role.permissionIds || role.permissionIds.length === 0) return [];

    const permissions = await PermissionModel.find({ _id: { $in: role.permissionIds }, deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .sort({ module: 1, screen: 1, action: 1 })
      .lean();

    return mapPermissionsWithRoleCounts(permissions as unknown as PermissionDoc[]);
  }

  async getAllActivePermissions() {
    const permissions = await PermissionModel.find({ status: 'active', deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .sort({ module: 1, screen: 1, action: 1 })
      .lean();

    return mapPermissionsWithRoleCounts(permissions as unknown as PermissionDoc[]);
  }

  async getRolesByPermission(permissionId: string) {
    const roles = await RoleModel.find({ permissionIds: permissionId, deletedAt: null })
      .sort({ name: 1 })
      .lean();

    return roles.map(role => ({
      id: role._id.toString(),
      code: role.code,
      name: role.name,
      type: role.type,
      status: role.status,
      assignedAt: role.updatedAt,
      assignedBy: role.updatedBy?.toString() ?? null,
    }));
  }

  async replaceRolePermissions(roleId: string, permissionIds: string[], actorUserId: string) {
    await RoleModel.updateOne(
      { _id: roleId },
      { $set: { permissionIds, updatedBy: actorUserId, updatedAt: new Date() } }
    );
  }

  async userHasPermission(userId: string, moduleName: string, screen: string, action: string) {
    const permission = await PermissionModel.findOne({
      module: new RegExp(`^${moduleName}$`, 'i'),
      screen: new RegExp(`^${screen}$`, 'i'),
      action: new RegExp(`^${action}$`, 'i'),
      status: 'active',
      deletedAt: null,
    }).lean();

    if (!permission) return false;

    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).lean();
    if (!user || !user.roleIds || user.roleIds.length === 0) return false;

    const role = await RoleModel.findOne({
      _id: { $in: user.roleIds },
      status: 'active',
      deletedAt: null,
      $or: [{ code: 'SUPER_ADMIN' }, { permissionIds: permission._id }],
    }).lean();

    return !!role;
  }

  async userHasActiveRole(userId: string, roleCode: string) {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).lean();
    if (!user || !user.roleIds || user.roleIds.length === 0) return false;

    const role = await RoleModel.findOne({
      _id: { $in: user.roleIds },
      code: roleCode,
      status: 'active',
      deletedAt: null,
    }).lean();

    return !!role;
  }

  async getUserEffectiveAuthority(userId: string, requireActiveUser: boolean) {
    const user = await UserModel.findOne({
      _id: userId,
      ...(requireActiveUser ? { status: 'active' } : {}),
      deletedAt: null,
    }).select('roleIds').lean();

    if (!user) return null;
    return this.getRolesEffectiveAuthority((user.roleIds ?? []).map((roleId) => roleId.toString()));
  }

  async getRolesEffectiveAuthority(roleIds: string[]): Promise<EffectiveAuthority> {
    if (roleIds.length === 0) {
      return { isSuperAdmin: false, permissionIds: [] };
    }

    const roles = await RoleModel.find({
      _id: { $in: roleIds },
      status: 'active',
      deletedAt: null,
    }).select('code permissionIds').lean();

    if (roles.some((role) => role.code === 'SUPER_ADMIN')) {
      return { isSuperAdmin: true, permissionIds: [] };
    }

    const assignedPermissionIds = [
      ...new Set(
        roles.flatMap((role) =>
          (role.permissionIds ?? []).map((permissionId) => permissionId.toString()),
        ),
      ),
    ];
    if (assignedPermissionIds.length === 0) {
      return { isSuperAdmin: false, permissionIds: [] };
    }

    const activePermissionIds = await PermissionModel.distinct('_id', {
      _id: { $in: assignedPermissionIds },
      status: 'active',
      deletedAt: null,
    });

    return {
      isSuperAdmin: false,
      permissionIds: activePermissionIds.map((permissionId) => permissionId.toString()),
    };
  }

  async userHasAllPermissionsById(userId: string, permissionIds: string[]) {
    if (permissionIds.length === 0) return true;

    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).lean();
    if (!user || !user.roleIds || user.roleIds.length === 0) return false;

    const activeRoles = await RoleModel.find({
      _id: { $in: user.roleIds },
      status: 'active',
      deletedAt: null,
    }).lean();

    if (activeRoles.some((role) => role.code === 'SUPER_ADMIN')) {
      return true;
    }

    const allUserPermissionIds = new Set<string>();
    for (const r of activeRoles) {
      if (r.permissionIds) {
        r.permissionIds.forEach(pId => allUserPermissionIds.add(pId.toString()));
      }
    }

    for (const requiredId of permissionIds) {
      if (!allUserPermissionIds.has(requiredId.toString())) {
        return false;
      }
    }
    
    return true;
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
