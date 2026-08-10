import { AppError } from '../../shared/errors/app-error.js';
import { RoleRepository } from './role.repository.js';
import type { RequestMetadata, RoleListQuery, RoleRecord, RoleResponse, RoleStatus, RoleType } from './role.types.js';

type CreateRoleInput = {
  code: string;
  name: string;
  description?: string | null;
  type?: RoleType;
  status?: RoleStatus;
  color?: string | null;
};

type UpdateRoleInput = Partial<Omit<CreateRoleInput, 'status'>>;

type StatusInput = {
  status: RoleStatus;
};

type AssignUserInput = {
  userId: string;
};

const roleManagerCodes = ['SUPER_ADMIN', 'ADMINISTRATOR', 'BRANCH_ADMIN'];
const protectedSystemRoleCodes = ['SUPER_ADMIN'];
const roleCodePattern = /^[A-Z][A-Z0-9_]{1,63}$/;
const colorPattern = /^#[0-9A-Fa-f]{6}$/;

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

const normalizeCode = (value: string) => normalizeText(value).toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');

const eventForStatus = (status: RoleStatus) => (status === 'active' ? 'role.activated' : 'role.deactivated');

export class RoleService {
  constructor(private readonly repository: RoleRepository) {}

  async requireRoleManagementAccess(userId: string) {
    const allowed = await this.repository.hasAnyActiveRole(userId, roleManagerCodes);

    if (!allowed) {
      throw new AppError('Role management permission required', 403, 'ROLE_MANAGEMENT_FORBIDDEN');
    }
  }

  async list(query: Partial<RoleListQuery>) {
    const normalizedQuery: RoleListQuery = {
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status,
      type: query.type,
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 20))),
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    };
    const { roles, total } = await this.repository.list(normalizedQuery);

    return {
      items: roles.map((role) => this.toResponse(role)),
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / normalizedQuery.limit)),
      },
    };
  }

  async getById(id: string) {
    const role = await this.requireRole(id);
    const users = await this.repository.getAssignedUsers(id);
    return this.toResponse(role, users);
  }

  async create(input: CreateRoleInput, actorUserId: string, metadata: RequestMetadata) {
    const normalized = this.normalizeCreateInput(input);

    if (normalized.type === 'system') {
      throw new AppError('System roles are managed by the platform', 400, 'SYSTEM_ROLE_RESTRICTED');
    }

    await this.assertUniqueFields({
      code: normalized.code,
      name: normalized.name,
    });

    const role = await this.repository.create({
      ...normalized,
      type: normalized.type ?? 'custom',
      status: normalized.status ?? 'active',
      actorUserId,
    });

    await this.audit('role.created', actorUserId, undefined, metadata, {
      roleId: role.id,
      code: role.code,
      name: role.name,
    });

    return this.getById(role.id);
  }

  async update(id: string, input: UpdateRoleInput, actorUserId: string, metadata: RequestMetadata) {
    const existing = await this.requireRole(id);
    const normalized = this.normalizeUpdateInput(input);

    if (existing.type === 'system' && (normalized.code || normalized.type)) {
      throw new AppError('System role code and type cannot be changed', 400, 'SYSTEM_ROLE_RESTRICTED');
    }

    if (existing.type === 'custom' && normalized.type === 'system') {
      throw new AppError('Custom roles cannot be converted to system roles', 400, 'SYSTEM_ROLE_RESTRICTED');
    }

    if (normalized.code || normalized.name) {
      await this.assertUniqueFields({
        code: normalized.code,
        name: normalized.name,
        excludeRoleId: id,
      });
    }

    const role = await this.repository.update(id, {
      ...normalized,
      actorUserId,
    });

    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    await this.audit('role.updated', actorUserId, undefined, metadata, {
      roleId: id,
      code: role.code,
      name: role.name,
    });

    return this.getById(id);
  }

  async updateStatus(id: string, input: StatusInput, actorUserId: string, metadata: RequestMetadata) {
    const existing = await this.requireRole(id);

    if (input.status === 'inactive' && protectedSystemRoleCodes.includes(existing.code)) {
      throw new AppError('Protected system role cannot be deactivated', 400, 'SYSTEM_ROLE_RESTRICTED');
    }

    const role = await this.repository.updateStatus(id, input.status, actorUserId);

    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    await this.audit(eventForStatus(input.status), actorUserId, undefined, metadata, {
      roleId: id,
      code: role.code,
      status: input.status,
    });

    return this.getById(id);
  }

  async assignUser(id: string, input: AssignUserInput, actorUserId: string, metadata: RequestMetadata) {
    const role = await this.requireRole(id);

    if (role.status !== 'active') {
      throw new AppError('Inactive role cannot be assigned', 400, 'INACTIVE_ROLE_ASSIGNMENT');
    }

    const user = await this.repository.findUserStatus(input.userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.status !== 'active') {
      throw new AppError('Inactive or locked user cannot be assigned a role', 400, 'INACTIVE_USER_ASSIGNMENT');
    }

    if (await this.repository.isUserAssigned(id, input.userId)) {
      throw new AppError('User is already assigned to this role', 409, 'ROLE_USER_ALREADY_ASSIGNED');
    }

    await this.repository.assignUser(id, input.userId, actorUserId);
    await this.audit('role.user.assigned', actorUserId, input.userId, metadata, {
      roleId: id,
      code: role.code,
    });

    return this.getById(id);
  }

  async removeUser(id: string, userId: string, actorUserId: string, metadata: RequestMetadata) {
    const role = await this.requireRole(id);
    const removed = await this.repository.removeUser(id, userId);

    if (!removed) {
      throw new AppError('Role assignment not found', 404, 'ROLE_ASSIGNMENT_NOT_FOUND');
    }

    await this.audit('role.user.removed', actorUserId, userId, metadata, {
      roleId: id,
      code: role.code,
    });

    return this.getById(id);
  }

  async delete(id: string, actorUserId: string, metadata: RequestMetadata) {
    const role = await this.requireRole(id);

    if (role.type === 'system') {
      throw new AppError('System roles cannot be deleted', 400, 'SYSTEM_ROLE_RESTRICTED');
    }

    if (role.status === 'active') {
      throw new AppError('Only inactive roles can be deleted', 400, 'ACTIVE_ROLE_DELETE_RESTRICTED');
    }

    if (role.userCount > 0) {
      throw new AppError('Role cannot be deleted while users are assigned', 400, 'ROLE_HAS_ASSIGNED_USERS');
    }

    const deleted = await this.repository.softDelete(id, actorUserId);

    if (!deleted) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    await this.audit('role.deleted', actorUserId, undefined, metadata, {
      roleId: id,
      code: role.code,
      name: role.name,
    });

    return { ok: true };
  }

  private async requireRole(id: string) {
    const role = await this.repository.findById(id);

    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    return role;
  }

  private normalizeCreateInput(input: CreateRoleInput): Required<Omit<CreateRoleInput, 'description' | 'color'>> & {
    description?: string | null;
    color?: string | null;
  } {
    const normalized = {
      code: normalizeCode(input.code),
      name: normalizeText(input.name),
      description: normalizeOptionalText(input.description),
      type: input.type ?? 'custom',
      status: input.status ?? 'active',
      color: normalizeOptionalText(input.color),
    };

    this.validateRole(normalized);
    return normalized;
  }

  private normalizeUpdateInput(input: UpdateRoleInput): UpdateRoleInput {
    const normalized: UpdateRoleInput = {
      code: input.code === undefined ? undefined : normalizeCode(input.code),
      name: input.name === undefined ? undefined : normalizeText(input.name),
      description: normalizeOptionalText(input.description),
      type: input.type,
      color: normalizeOptionalText(input.color),
    };

    this.validateRole(normalized);
    return normalized;
  }

  private validateRole(input: Partial<CreateRoleInput>) {
    if (input.code !== undefined && input.code.length === 0) {
      throw new AppError('Role code is required', 400, 'ROLE_CODE_REQUIRED');
    }

    if (input.code && !roleCodePattern.test(input.code)) {
      throw new AppError('Role code format is invalid', 400, 'INVALID_ROLE_CODE');
    }

    if (input.name !== undefined && input.name.length === 0) {
      throw new AppError('Role name is required', 400, 'ROLE_NAME_REQUIRED');
    }

    if (input.type && !['system', 'custom'].includes(input.type)) {
      throw new AppError('Role type is invalid', 400, 'INVALID_ROLE_TYPE');
    }

    if (input.status && !['active', 'inactive'].includes(input.status)) {
      throw new AppError('Role status is invalid', 400, 'INVALID_ROLE_STATUS');
    }

    if (input.color && !colorPattern.test(input.color)) {
      throw new AppError('Role color must be a hex color', 400, 'INVALID_ROLE_COLOR');
    }
  }

  private async assertUniqueFields(input: {
    code?: string;
    name?: string;
    excludeRoleId?: string;
  }) {
    const duplicate = await this.repository.findByUniqueFields(input);

    if (!duplicate) {
      return;
    }

    if (input.code && duplicate.code.toLowerCase() === input.code.toLowerCase()) {
      throw new AppError('Role code already exists', 409, 'DUPLICATE_ROLE_CODE');
    }

    if (input.name && duplicate.name.toLowerCase() === input.name.toLowerCase()) {
      throw new AppError('Role name already exists', 409, 'DUPLICATE_ROLE_NAME');
    }
  }

  private toResponse(role: RoleRecord, users?: RoleResponse['users']): RoleResponse {
    return {
      ...role,
      users,
      audit: {
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        createdBy: role.createdBy,
        updatedBy: role.updatedBy,
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
