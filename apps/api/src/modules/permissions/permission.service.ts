import { AppError } from '../../shared/errors/app-error.js';
import { PermissionRepository } from './permission.repository.js';
import type {
  PermissionListQuery,
  PermissionRecord,
  PermissionResponse,
  PermissionStatus,
  PermissionType,
  RequestMetadata,
} from './permission.types.js';
import { getPermissionDisplayMetadata } from './permission-display.js';

type CreatePermissionInput = {
  code?: string;
  name?: string;
  module: string;
  screen: string;
  action: string;
  description?: string | null;
  type?: PermissionType;
  status?: PermissionStatus;
  categoryId?: string | null;
  categoryName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
};

type UpdatePermissionInput = Partial<CreatePermissionInput>;

type ReplaceRolePermissionsInput = {
  permissionIds: string[];
  expectedRoleUpdatedAt: string;
};

const codePattern = /^[A-Z][A-Z0-9_]{1,127}$/;

const normalizeText = (value: string) => value.trim();

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeCode = (value: string) =>
  value
    .trim()
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

const permissionCode = (moduleName: string, screen: string, action: string) =>
  normalizeCode(`${moduleName}_${screen}_${action}`);

export class PermissionService {
  constructor(private readonly repository: PermissionRepository) {}

  async assertCanAssignRoles(actorUserId: string, roleIds: string[]) {
    const [actorAuthority, assignedAuthority] = await Promise.all([
      this.repository.getUserEffectiveAuthority(actorUserId, true),
      this.repository.getRolesEffectiveAuthority(roleIds),
    ]);

    if (!actorAuthority) {
      throw new AppError('Role assignment is not authorized', 403, 'ROLE_ASSIGNMENT_FORBIDDEN');
    }
    if (actorAuthority.isSuperAdmin) return;
    if (assignedAuthority.isSuperAdmin) {
      throw new AppError(
        'Only a Super Administrator may assign the Super Administrator role',
        403,
        'SUPER_ADMIN_ASSIGNMENT_FORBIDDEN',
      );
    }

    const actorPermissionIds = new Set(actorAuthority.permissionIds);
    if (assignedAuthority.permissionIds.some((permissionId) => !actorPermissionIds.has(permissionId))) {
      throw new AppError(
        'Cannot assign roles outside your current authority',
        403,
        'ROLE_ASSIGNMENT_EXCEEDS_AUTHORITY',
      );
    }
  }

  async assertCanManageRoles(actorUserId: string, roleIds: string[]) {
    const [actorAuthority, targetAuthority] = await Promise.all([
      this.repository.getUserEffectiveAuthority(actorUserId, true),
      this.repository.getRolesEffectiveAuthority(roleIds),
    ]);

    if (!actorAuthority) {
      throw new AppError('Role modification is not authorized', 403, 'PRIVILEGED_ROLE_MODIFICATION_FORBIDDEN');
    }
    if (actorAuthority.isSuperAdmin) return;

    const actorPermissionIds = new Set(actorAuthority.permissionIds);
    if (
      targetAuthority.isSuperAdmin ||
      targetAuthority.permissionIds.some((permissionId) => !actorPermissionIds.has(permissionId))
    ) {
      throw new AppError(
        'Cannot modify a role outside your current authority',
        403,
        'PRIVILEGED_ROLE_MODIFICATION_FORBIDDEN',
      );
    }
  }

  async assertCanManageUser(
    actorUserId: string,
    targetUserId: string,
    options: { allowEqualAuthority: boolean; errorCode: string },
  ) {
    const [actorAuthority, targetAuthority] = await Promise.all([
      this.repository.getUserEffectiveAuthority(actorUserId, true),
      this.repository.getUserEffectiveAuthority(targetUserId, false),
    ]);

    if (!actorAuthority || !targetAuthority) {
      throw new AppError('User modification is not authorized', 403, options.errorCode);
    }
    if (actorAuthority.isSuperAdmin) return;
    if (targetAuthority.isSuperAdmin) {
      throw new AppError('Cannot modify a higher-privileged user', 403, options.errorCode);
    }

    const actorBranchIds = new Set(actorAuthority.branchIds);
    if (
      actorBranchIds.size === 0 ||
      !targetAuthority.branchIds.some((branchId) => actorBranchIds.has(branchId))
    ) {
      throw new AppError('Cannot modify a user outside your authorized branch scope', 403, 'BRANCH_SCOPE_VIOLATION');
    }

    const actorPermissionIds = new Set(actorAuthority.permissionIds);
    const targetIsWithinAuthority = targetAuthority.permissionIds.every((permissionId) =>
      actorPermissionIds.has(permissionId),
    );
    const hasEqualAuthority =
      targetIsWithinAuthority && actorPermissionIds.size === targetAuthority.permissionIds.length;

    if (!targetIsWithinAuthority || (!options.allowEqualAuthority && hasEqualAuthority)) {
      throw new AppError('Cannot modify a higher-privileged user', 403, options.errorCode);
    }
  }

  async userHasPermission(userId: string, moduleName: string, screen: string, action: string) {
    return this.repository.userHasPermission(userId, moduleName, screen, action);
  }

  async auditDeniedAccess(
    userId: string,
    moduleName: string,
    screen: string,
    action: string,
    metadata: RequestMetadata,
  ) {
    await this.repository.audit('auth.permission.denied', {
      ...metadata,
      actorUserId: userId,
      subjectUserId: userId,
      metadata: {
        module: moduleName,
        screen,
        action,
      },
    });
  }

  async list(query: Partial<PermissionListQuery>) {
    const normalizedQuery: PermissionListQuery = {
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status,
      type: query.type,
      module: normalizeOptionalText(query.module) ?? undefined,
      screen: normalizeOptionalText(query.screen) ?? undefined,
      action: normalizeOptionalText(query.action) ?? undefined,
      categoryId: normalizeOptionalText(query.categoryId) ?? undefined,
      groupId: normalizeOptionalText(query.groupId) ?? undefined,
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 20))),
      sortBy: query.sortBy ?? 'module',
      sortOrder: query.sortOrder ?? 'asc',
    };
    const { permissions, total } = await this.repository.list(normalizedQuery);

    return {
      items: permissions.map((permission) => this.toResponse(permission)),
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / normalizedQuery.limit)),
      },
    };
  }

  async getById(id: string) {
    const permission = await this.requirePermissionRecord(id);
    return this.toResponse(permission);
  }

  async getRolesByPermission(id: string) {
    await this.requirePermissionRecord(id);
    return {
      items: await this.repository.getRolesByPermission(id),
    };
  }

  async create(input: CreatePermissionInput, actorUserId: string, metadata: RequestMetadata) {
    const normalized = this.normalizeCreateInput(input);

    if (normalized.type === 'system') {
      throw new AppError('System permissions are managed by the platform', 400, 'SYSTEM_PERMISSION_RESTRICTED');
    }

    await this.assertUniqueFields({
      code: normalized.code,
      module: normalized.module,
      screen: normalized.screen,
      action: normalized.action,
    });

    const { categoryId, groupId } = await this.resolveCategoryAndGroup(normalized, actorUserId);
    const permission = await this.repository.create({
      ...normalized,
      categoryId,
      groupId,
      actorUserId,
    });

    await this.audit('permission.created', actorUserId, undefined, metadata, {
      permissionId: permission.id,
      code: permission.code,
      module: permission.module,
      screen: permission.screen,
      action: permission.action,
    });

    return this.getById(permission.id);
  }

  async update(id: string, input: UpdatePermissionInput, actorUserId: string, metadata: RequestMetadata) {
    const existing = await this.requirePermissionRecord(id);
    const normalized = this.normalizeUpdateInput(input, existing);

    if (
      existing.type === 'system' &&
      (normalized.code ||
        normalized.module ||
        normalized.screen ||
        normalized.action ||
        normalized.type ||
        normalized.status)
    ) {
      throw new AppError('System permission identity and status cannot be changed', 400, 'SYSTEM_PERMISSION_RESTRICTED');
    }

    if (existing.type === 'custom' && normalized.type === 'system') {
      throw new AppError('Custom permissions cannot be converted to system permissions', 400, 'SYSTEM_PERMISSION_RESTRICTED');
    }

    await this.assertUniqueFields({
      code: normalized.code,
      module: normalized.module ?? existing.module,
      screen: normalized.screen ?? existing.screen,
      action: normalized.action ?? existing.action,
      excludePermissionId: id,
    });

    const assignmentTarget = await this.resolveCategoryAndGroup(
      {
        module: normalized.module ?? existing.module,
        screen: normalized.screen ?? existing.screen,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        groupId: normalized.groupId,
        groupName: normalized.groupName,
      },
      actorUserId,
    );

    const permission = await this.repository.update(id, {
      ...normalized,
      categoryId: assignmentTarget.categoryId,
      groupId: assignmentTarget.groupId,
      actorUserId,
    });

    if (!permission) {
      throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
    }

    await this.audit('permission.updated', actorUserId, undefined, metadata, {
      permissionId: id,
      code: permission.code,
      module: permission.module,
      screen: permission.screen,
      action: permission.action,
    });

    return this.getById(id);
  }

  async delete(id: string, actorUserId: string, metadata: RequestMetadata) {
    const permission = await this.requirePermissionRecord(id);

    if (permission.type === 'system') {
      throw new AppError('System permissions cannot be deleted', 400, 'SYSTEM_PERMISSION_RESTRICTED');
    }

    if (permission.status === 'active') {
      throw new AppError('Only inactive permissions can be deleted', 400, 'ACTIVE_PERMISSION_DELETE_RESTRICTED');
    }

    if (permission.roleCount > 0) {
      throw new AppError('Permission cannot be deleted while assigned to roles', 400, 'PERMISSION_ASSIGNED_TO_ROLES');
    }

    const deleted = await this.repository.softDelete(id, actorUserId);

    if (!deleted) {
      throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
    }

    await this.audit('permission.deleted', actorUserId, undefined, metadata, {
      permissionId: id,
      code: permission.code,
      module: permission.module,
      screen: permission.screen,
      action: permission.action,
    });

    return { ok: true };
  }

  async getPermissionsByRole(roleId: string) {
    const role = await this.requireRole(roleId);
    const permissions = role.code === 'SUPER_ADMIN'
      ? await this.repository.getAllActivePermissions()
      : await this.repository.getPermissionsByRole(roleId);

    return {
      items: permissions.map((permission) =>
        this.toResponse(permission),
      ),
    };
  }

  async replaceRolePermissions(
    roleId: string,
    input: ReplaceRolePermissionsInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const role = await this.requireRole(roleId);

    if (role.code === 'SUPER_ADMIN') {
      throw new AppError(
        'Super Administrator always has every active permission',
        409,
        'SUPER_ADMIN_PERMISSIONS_IMMUTABLE',
      );
    }

    await this.assertCanManageRoles(actorUserId, [roleId]);

    const uniquePermissionIds = [...new Set(input.permissionIds.map((id) => normalizeText(id)))];

    if (uniquePermissionIds.some((id) => id.length === 0)) {
      throw new AppError('Permission id is required', 400, 'PERMISSION_ID_REQUIRED');
    }

    const permissions = await this.repository.findPermissionsByIds(uniquePermissionIds);

    if (permissions.length !== uniquePermissionIds.length) {
      throw new AppError('One or more permissions were not found', 400, 'INVALID_PERMISSION_ASSIGNMENT');
    }

    if (permissions.some((permission) => permission.status !== 'active')) {
      throw new AppError('Inactive permissions cannot be assigned to roles', 400, 'INACTIVE_PERMISSION_ASSIGNMENT');
    }

    if (!(await this.repository.userHasActiveRole(actorUserId, 'SUPER_ADMIN'))) {
      const actorHasAll = await this.repository.userHasAllPermissionsById(actorUserId, uniquePermissionIds);
      if (!actorHasAll) {
        throw new AppError('Cannot assign permissions outside your current access', 403, 'PERMISSION_ESCALATION_FORBIDDEN');
      }
    }

    const expectedRoleUpdatedAt = new Date(input.expectedRoleUpdatedAt);
    if (Number.isNaN(expectedRoleUpdatedAt.getTime())) {
      throw new AppError('Role version is invalid', 400, 'INVALID_ROLE_VERSION');
    }
    const replaced = await this.repository.replaceRolePermissions(
      roleId,
      uniquePermissionIds,
      actorUserId,
      expectedRoleUpdatedAt,
    );
    if (!replaced) {
      throw new AppError(
        'This role changed after you opened it. Refresh and review the latest permissions before saving again.',
        409,
        'STALE_ROLE_PERMISSIONS',
      );
    }
    await this.audit('role.permissions.updated', actorUserId, undefined, metadata, {
      roleId,
      roleCode: role.code,
      permissionIds: uniquePermissionIds,
    });

    return this.getPermissionsByRole(roleId);
  }

  private async requirePermissionRecord(id: string) {
    const permission = await this.repository.findById(id);

    if (!permission) {
      throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
    }

    return permission;
  }

  private async requireRole(roleId: string) {
    const role = await this.repository.findRoleById(roleId);

    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    return role;
  }

  private normalizeCreateInput(input: CreatePermissionInput): Required<Pick<CreatePermissionInput, 'code' | 'name' | 'module' | 'screen' | 'action' | 'type' | 'status'>> &
    Pick<CreatePermissionInput, 'description' | 'categoryId' | 'categoryName' | 'groupId' | 'groupName'> {
    const moduleName = normalizeText(input.module);
    const screen = normalizeText(input.screen);
    const action = normalizeText(input.action);
    const display = getPermissionDisplayMetadata(moduleName, screen, action);
    const normalized = {
      code: input.code ? normalizeCode(input.code) : permissionCode(moduleName, screen, action),
      name: input.name ? normalizeText(input.name) : display.name,
      module: moduleName,
      screen,
      action,
      description: normalizeOptionalText(input.description) ?? display.description,
      type: input.type ?? 'custom',
      status: input.status ?? 'active',
      categoryId: normalizeOptionalText(input.categoryId),
      categoryName: normalizeOptionalText(input.categoryName),
      groupId: normalizeOptionalText(input.groupId),
      groupName: normalizeOptionalText(input.groupName),
    };

    this.validatePermission(normalized);
    return normalized;
  }

  private normalizeUpdateInput(input: UpdatePermissionInput, existing: PermissionRecord): UpdatePermissionInput {
    const normalized: UpdatePermissionInput = {
      code: input.code === undefined ? undefined : normalizeCode(input.code),
      name: input.name === undefined ? undefined : normalizeText(input.name),
      module: input.module === undefined ? undefined : normalizeText(input.module),
      screen: input.screen === undefined ? undefined : normalizeText(input.screen),
      action: input.action === undefined ? undefined : normalizeText(input.action),
      description: normalizeOptionalText(input.description),
      type: input.type,
      status: input.status,
      categoryId: normalizeOptionalText(input.categoryId),
      categoryName: normalizeOptionalText(input.categoryName),
      groupId: normalizeOptionalText(input.groupId),
      groupName: normalizeOptionalText(input.groupName),
    };

    this.validatePermission({
      ...normalized,
      module: normalized.module ?? existing.module,
      screen: normalized.screen ?? existing.screen,
      action: normalized.action ?? existing.action,
    });

    return normalized;
  }

  private validatePermission(input: Partial<CreatePermissionInput>) {
    if (input.module !== undefined && input.module.length === 0) {
      throw new AppError('Permission module is required', 400, 'PERMISSION_MODULE_REQUIRED');
    }

    if (input.screen !== undefined && input.screen.length === 0) {
      throw new AppError('Permission screen is required', 400, 'PERMISSION_SCREEN_REQUIRED');
    }

    if (input.action !== undefined && input.action.length === 0) {
      throw new AppError('Permission action is required', 400, 'PERMISSION_ACTION_REQUIRED');
    }

    if (input.code && !codePattern.test(input.code)) {
      throw new AppError('Permission code format is invalid', 400, 'INVALID_PERMISSION_CODE');
    }

    if (input.name !== undefined && input.name.length === 0) {
      throw new AppError('Permission name is required', 400, 'PERMISSION_NAME_REQUIRED');
    }

    if (input.type && !['system', 'custom'].includes(input.type)) {
      throw new AppError('Permission type is invalid', 400, 'INVALID_PERMISSION_TYPE');
    }

    if (input.status && !['active', 'inactive'].includes(input.status)) {
      throw new AppError('Permission status is invalid', 400, 'INVALID_PERMISSION_STATUS');
    }
  }

  private async resolveCategoryAndGroup(
    input: {
      module: string;
      screen: string;
      categoryId?: string | null;
      categoryName?: string | null;
      groupId?: string | null;
      groupName?: string | null;
    },
    actorUserId: string,
  ) {
    let categoryId = input.categoryId;

    if (categoryId) {
      const category = await this.repository.findCategoryById(categoryId);
      if (!category || category.status !== 'active') {
        throw new AppError('Permission category is invalid', 400, 'INVALID_PERMISSION_CATEGORY');
      }
    } else {
      const categoryName = input.categoryName ?? input.module;
      const category = await this.repository.ensureCategory({
        code: normalizeCode(categoryName),
        name: categoryName,
        actorUserId,
      });
      categoryId = category.id;
    }

    let groupId = input.groupId;

    if (groupId) {
      const group = await this.repository.findGroupById(groupId);
      if (!group || group.status !== 'active' || group.categoryId !== categoryId) {
        throw new AppError('Permission group is invalid', 400, 'INVALID_PERMISSION_GROUP');
      }
    } else {
      const groupName = input.groupName ?? input.screen;
      const group = await this.repository.ensureGroup({
        categoryId,
        code: normalizeCode(groupName),
        name: groupName,
        actorUserId,
      });
      groupId = group.id;
    }

    return { categoryId, groupId };
  }

  private async assertUniqueFields(input: {
    code?: string;
    module?: string;
    screen?: string;
    action?: string;
    excludePermissionId?: string;
  }) {
    const duplicate = await this.repository.findByUniqueFields(input);

    if (!duplicate) {
      return;
    }

    if (input.code && duplicate.code.toLowerCase() === input.code.toLowerCase()) {
      throw new AppError('Permission code already exists', 409, 'DUPLICATE_PERMISSION_CODE');
    }

    if (
      input.module &&
      input.screen &&
      input.action &&
      duplicate.module.toLowerCase() === input.module.toLowerCase() &&
      duplicate.screen.toLowerCase() === input.screen.toLowerCase() &&
      duplicate.action.toLowerCase() === input.action.toLowerCase()
    ) {
      throw new AppError('Permission already exists for this module, screen and action', 409, 'DUPLICATE_PERMISSION');
    }
  }

  private toResponse(permission: PermissionRecord): PermissionResponse {
    return {
      ...permission,
      audit: {
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
        createdBy: permission.createdBy,
        updatedBy: permission.updatedBy,
      },
    };
  }

  private async audit(
    eventType: string,
    actorUserId: string,
    subjectUserId: string | undefined,
    metadata: RequestMetadata,
    eventMetadata?: Record<string, unknown>,
  ) {
    await this.repository.audit(eventType, {
      ...metadata,
      actorUserId,
      subjectUserId,
      metadata: eventMetadata,
    });
  }
}
