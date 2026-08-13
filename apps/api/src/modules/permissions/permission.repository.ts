
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

const mapPermission = (permission: any, roleCount: number): PermissionRecord => ({
  id: permission._id.toString(),
  code: permission.code,
  name: permission.name,
  module: permission.module,
  screen: permission.screen,
  action: permission.action,
  description: permission.description ?? null,
  type: permission.type as PermissionType,
  status: permission.status as PermissionStatus,
  categoryId: permission.categoryId?._id?.toString() ?? permission.categoryId?.toString() ?? null,
  categoryCode: permission.categoryId?.code ?? null,
  categoryName: permission.categoryId?.name ?? null,
  groupId: permission.groupId?._id?.toString() ?? permission.groupId?.toString() ?? null,
  groupCode: permission.groupId?.code ?? null,
  groupName: permission.groupId?.name ?? null,
  roleCount,
  createdAt: permission.createdAt,
  updatedAt: permission.updatedAt,
  deletedAt: permission.deletedAt ?? null,
  createdBy: permission.createdBy?.toString() ?? null,
  updatedBy: permission.updatedBy?.toString() ?? null,
  deletedBy: permission.deletedBy?.toString() ?? null,
});

export class PermissionRepository {
  async findById(id: string) {
    const permission = await PermissionModel.findOne({ _id: id, deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .lean();
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission, roleCount);
  }

  async findByUniqueFields(fields: {
    code?: string;
    module?: string;
    screen?: string;
    action?: string;
    excludePermissionId?: string;
  }) {
    const filter: Record<string, any> = { deletedAt: null };
    if (fields.excludePermissionId) {
      filter._id = { $ne: fields.excludePermissionId };
    }

    const orConditions: any[] = [];
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
    return mapPermission(permission, roleCount);
  }

  async list(query: PermissionListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, any> = { deletedAt: null };
    
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.module) filter.module = new RegExp(`^${query.module}$`, 'i');
    if (query.screen) filter.screen = new RegExp(`^${query.screen}$`, 'i');
    if (query.action) filter.action = new RegExp(`^${query.action}$`, 'i');
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.groupId) filter.groupId = query.groupId;

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
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
      PermissionModel.countDocuments(filter as any),
    ]);

    const permissionsWithCounts = await Promise.all(
      data.map(async (p) => {
        const roleCount = await RoleModel.countDocuments({ permissionIds: p._id, deletedAt: null });
        return mapPermission(p, roleCount);
      })
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
      } as any).then(doc => doc.toObject());
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
      } as any).then(doc => doc.toObject());
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
      categoryId: (group as any).categoryId.toString(),
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
      categoryId: input.categoryId,
      groupId: input.groupId,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    } as any);
    return mapPermission(permission.toObject(), 0);
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
    const updatePayload: any = { updatedBy: input.actorUserId };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key !== 'actorUserId') {
        updatePayload[key] = value;
      }
    }

    const permission = await (PermissionModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload as any },
      { returnDocument: 'after', lean: true }
    ) as any).populate('categoryId').populate('groupId');
    
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission, roleCount);
  }

  async softDelete(id: string, actorUserId: string) {
    const permission = await PermissionModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true }
    ).populate('categoryId').populate('groupId');
    
    if (!permission) return null;
    const roleCount = await RoleModel.countDocuments({ permissionIds: id, deletedAt: null });
    return mapPermission(permission, roleCount);
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
      
    return Promise.all(permissions.map(async p => {
      const roleCount = await RoleModel.countDocuments({ permissionIds: p._id, deletedAt: null });
      return mapPermission(p, roleCount);
    }));
  }

  async getPermissionsByRole(roleId: string) {
    const role = await RoleModel.findOne({ _id: roleId, deletedAt: null }).lean();
    if (!role || !role.permissionIds || role.permissionIds.length === 0) return [];

    const permissions = await PermissionModel.find({ _id: { $in: role.permissionIds }, deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .sort({ module: 1, screen: 1, action: 1 })
      .lean();

    return Promise.all(permissions.map(async p => {
      const roleCount = await RoleModel.countDocuments({ permissionIds: p._id, deletedAt: null });
      return mapPermission(p, roleCount);
    }));
  }

  async getAllActivePermissions() {
    const permissions = await PermissionModel.find({ status: 'active', deletedAt: null })
      .populate('categoryId')
      .populate('groupId')
      .sort({ module: 1, screen: 1, action: 1 })
      .lean();

    return Promise.all(permissions.map(async (permission) => {
      const roleCount = await RoleModel.countDocuments({ permissionIds: permission._id, deletedAt: null });
      return mapPermission(permission, roleCount);
    }));
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
