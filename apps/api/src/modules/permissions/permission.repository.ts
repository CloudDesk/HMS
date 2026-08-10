import { randomUUID } from 'node:crypto';
import { sql } from '../../database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  PermissionListQuery,
  PermissionRecord,
  PermissionStatus,
  PermissionType,
  RequestMetadata,
  RolePermissionSummary,
} from './permission.types.js';

type PermissionRow = {
  id: string;
  code: string;
  name: string;
  module: string;
  screen: string;
  action: string;
  description: string | null;
  type: PermissionType;
  status: PermissionStatus;
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  group_id: string | null;
  group_code: string | null;
  group_name: string | null;
  role_count: number | string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
};

type RolePermissionRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  assigned_at: Date;
  assigned_by: string | null;
};

type RoleRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
};

type CategoryRow = {
  id: string;
  code: string;
  name: string;
  status: PermissionStatus;
};

type GroupRow = CategoryRow & {
  category_id: string;
};

const sortColumns: Record<PermissionListQuery['sortBy'], string> = {
  module: 'p.module',
  screen: 'p.screen',
  action: 'p.action',
  name: 'p.name',
  code: 'p.code',
  type: 'p.type',
  status: 'p.status',
  roleCount: 'role_count',
  createdAt: 'p.created_at',
};

const mapPermission = (row: PermissionRow): PermissionRecord => ({
  id: row.id,
  code: row.code,
  name: row.name,
  module: row.module,
  screen: row.screen,
  action: row.action,
  description: row.description,
  type: row.type,
  status: row.status,
  categoryId: row.category_id,
  categoryCode: row.category_code,
  categoryName: row.category_name,
  groupId: row.group_id,
  groupCode: row.group_code,
  groupName: row.group_name,
  roleCount: Number(row.role_count),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  deletedBy: row.deleted_by,
});

const mapRolePermission = (row: RolePermissionRow): RolePermissionSummary => ({
  id: row.id,
  code: row.code,
  name: row.name,
  type: row.type,
  status: row.status,
  assignedAt: row.assigned_at,
  assignedBy: row.assigned_by,
});

const selectPermission = sql`
  p.*,
  categories.code as category_code,
  categories.name as category_name,
  groups.code as group_code,
  groups.name as group_name,
  count(role_permissions.id)::int as role_count
`;

export class PermissionRepository {
  async findById(id: string) {
    const [row] = await sql<PermissionRow[]>`
      select ${selectPermission}
      from permissions p
      left join permission_categories categories on categories.id = p.category_id
      left join permission_groups groups on groups.id = p.group_id
      left join role_permissions on role_permissions.permission_id = p.id
      where p.id = ${id}
        and p.deleted_at is null
      group by p.id, categories.code, categories.name, groups.code, groups.name
      limit 1
    `;

    return row ? mapPermission(row) : null;
  }

  async findByUniqueFields(fields: {
    code?: string;
    module?: string;
    screen?: string;
    action?: string;
    excludePermissionId?: string;
  }) {
    const [row] = await sql<PermissionRow[]>`
      select ${selectPermission}
      from permissions p
      left join permission_categories categories on categories.id = p.category_id
      left join permission_groups groups on groups.id = p.group_id
      left join role_permissions on role_permissions.permission_id = p.id
      where p.deleted_at is null
        and (${fields.excludePermissionId ?? null}::text is null or p.id <> ${fields.excludePermissionId ?? null})
        and (
          (${fields.code ?? null}::text is not null and lower(p.code) = lower(${fields.code ?? null}))
          or (
            ${fields.module ?? null}::text is not null
            and ${fields.screen ?? null}::text is not null
            and ${fields.action ?? null}::text is not null
            and lower(p.module) = lower(${fields.module ?? null})
            and lower(p.screen) = lower(${fields.screen ?? null})
            and lower(p.action) = lower(${fields.action ?? null})
          )
        )
      group by p.id, categories.code, categories.name, groups.code, groups.name
      limit 1
    `;

    return row ? mapPermission(row) : null;
  }

  async list(query: PermissionListQuery) {
    const offset = (query.page - 1) * query.limit;
    const sortColumn = sortColumns[query.sortBy];
    const orderDirection = query.sortOrder === 'asc' ? sql`asc` : sql`desc`;
    const search = query.search ? `%${query.search.toLowerCase()}%` : null;

    const rows = await sql<PermissionRow[]>`
      select ${selectPermission}
      from permissions p
      left join permission_categories categories on categories.id = p.category_id
      left join permission_groups groups on groups.id = p.group_id
      left join role_permissions on role_permissions.permission_id = p.id
      where p.deleted_at is null
        and (${query.status ?? null}::text is null or p.status = ${query.status ?? null})
        and (${query.type ?? null}::text is null or p.type = ${query.type ?? null})
        and (${query.module ?? null}::text is null or lower(p.module) = lower(${query.module ?? null}))
        and (${query.screen ?? null}::text is null or lower(p.screen) = lower(${query.screen ?? null}))
        and (${query.action ?? null}::text is null or lower(p.action) = lower(${query.action ?? null}))
        and (${query.categoryId ?? null}::text is null or p.category_id = ${query.categoryId ?? null})
        and (${query.groupId ?? null}::text is null or p.group_id = ${query.groupId ?? null})
        and (
          ${search}::text is null
          or lower(p.code) like ${search}
          or lower(p.name) like ${search}
          or lower(p.module) like ${search}
          or lower(p.screen) like ${search}
          or lower(p.action) like ${search}
          or lower(coalesce(p.description, '')) like ${search}
        )
      group by p.id, categories.code, categories.name, groups.code, groups.name
      order by ${sql.unsafe(sortColumn)} ${orderDirection}, p.id asc
      limit ${query.limit}
      offset ${offset}
    `;

    const [{ count }] = await sql<[{ count: string }]>`
      select count(*)::text as count
      from permissions p
      where p.deleted_at is null
        and (${query.status ?? null}::text is null or p.status = ${query.status ?? null})
        and (${query.type ?? null}::text is null or p.type = ${query.type ?? null})
        and (${query.module ?? null}::text is null or lower(p.module) = lower(${query.module ?? null}))
        and (${query.screen ?? null}::text is null or lower(p.screen) = lower(${query.screen ?? null}))
        and (${query.action ?? null}::text is null or lower(p.action) = lower(${query.action ?? null}))
        and (${query.categoryId ?? null}::text is null or p.category_id = ${query.categoryId ?? null})
        and (${query.groupId ?? null}::text is null or p.group_id = ${query.groupId ?? null})
        and (
          ${search}::text is null
          or lower(p.code) like ${search}
          or lower(p.name) like ${search}
          or lower(p.module) like ${search}
          or lower(p.screen) like ${search}
          or lower(p.action) like ${search}
          or lower(coalesce(p.description, '')) like ${search}
        )
    `;

    return {
      permissions: rows.map(mapPermission),
      total: Number.parseInt(count, 10),
    };
  }

  async ensureCategory(input: {
    code: string;
    name: string;
    description?: string | null;
    actorUserId: string;
  }) {
    const [existing] = await sql<CategoryRow[]>`
      select id, code, name, status
      from permission_categories
      where lower(code) = lower(${input.code})
        and deleted_at is null
      limit 1
    `;

    if (existing) {
      return existing;
    }

    const [created] = await sql<CategoryRow[]>`
      insert into permission_categories (id, code, name, description, type, status, created_by, updated_by)
      values (
        ${randomUUID()},
        ${input.code},
        ${input.name},
        ${input.description ?? null},
        'custom',
        'active',
        ${input.actorUserId},
        ${input.actorUserId}
      )
      returning id, code, name, status
    `;

    if (!created) {
      throw new AppError('Permission category could not be created', 500, 'PERMISSION_CATEGORY_CREATE_FAILED');
    }

    return created;
  }

  async ensureGroup(input: {
    categoryId: string;
    code: string;
    name: string;
    description?: string | null;
    actorUserId: string;
  }) {
    const [existing] = await sql<GroupRow[]>`
      select id, category_id, code, name, status
      from permission_groups
      where category_id = ${input.categoryId}
        and lower(code) = lower(${input.code})
        and deleted_at is null
      limit 1
    `;

    if (existing) {
      return existing;
    }

    const [created] = await sql<GroupRow[]>`
      insert into permission_groups (id, category_id, code, name, description, type, status, created_by, updated_by)
      values (
        ${randomUUID()},
        ${input.categoryId},
        ${input.code},
        ${input.name},
        ${input.description ?? null},
        'custom',
        'active',
        ${input.actorUserId},
        ${input.actorUserId}
      )
      returning id, category_id, code, name, status
    `;

    if (!created) {
      throw new AppError('Permission group could not be created', 500, 'PERMISSION_GROUP_CREATE_FAILED');
    }

    return created;
  }

  async findCategoryById(id: string) {
    const [row] = await sql<CategoryRow[]>`
      select id, code, name, status
      from permission_categories
      where id = ${id}
        and deleted_at is null
      limit 1
    `;

    return row ?? null;
  }

  async findGroupById(id: string) {
    const [row] = await sql<GroupRow[]>`
      select id, category_id, code, name, status
      from permission_groups
      where id = ${id}
        and deleted_at is null
      limit 1
    `;

    return row ?? null;
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
    const [row] = await sql<PermissionRow[]>`
      insert into permissions (
        id,
        category_id,
        group_id,
        code,
        name,
        module,
        screen,
        action,
        description,
        type,
        status,
        created_by,
        updated_by
      )
      values (
        ${randomUUID()},
        ${input.categoryId ?? null},
        ${input.groupId ?? null},
        ${input.code},
        ${input.name},
        ${input.module},
        ${input.screen},
        ${input.action},
        ${input.description ?? null},
        ${input.type},
        ${input.status},
        ${input.actorUserId},
        ${input.actorUserId}
      )
      returning *,
        null::text as category_code,
        null::text as category_name,
        null::text as group_code,
        null::text as group_name,
        0::int as role_count
    `;

    if (!row) {
      throw new AppError('Permission could not be created', 500, 'PERMISSION_CREATE_FAILED');
    }

    return mapPermission(row);
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
    const [row] = await sql<PermissionRow[]>`
      update permissions
      set
        code = coalesce(${input.code ?? null}, code),
        name = coalesce(${input.name ?? null}, name),
        module = coalesce(${input.module ?? null}, module),
        screen = coalesce(${input.screen ?? null}, screen),
        action = coalesce(${input.action ?? null}, action),
        description = ${input.description === undefined ? sql`description` : input.description},
        type = coalesce(${input.type ?? null}, type),
        status = coalesce(${input.status ?? null}, status),
        category_id = ${input.categoryId === undefined ? sql`category_id` : input.categoryId},
        group_id = ${input.groupId === undefined ? sql`group_id` : input.groupId},
        updated_by = ${input.actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *,
        (select code from permission_categories where id = permissions.category_id) as category_code,
        (select name from permission_categories where id = permissions.category_id) as category_name,
        (select code from permission_groups where id = permissions.group_id) as group_code,
        (select name from permission_groups where id = permissions.group_id) as group_name,
        (select count(*)::int from role_permissions where permission_id = permissions.id) as role_count
    `;

    return row ? mapPermission(row) : null;
  }

  async softDelete(id: string, actorUserId: string) {
    const [row] = await sql<PermissionRow[]>`
      update permissions
      set
        deleted_at = now(),
        deleted_by = ${actorUserId},
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *,
        (select code from permission_categories where id = permissions.category_id) as category_code,
        (select name from permission_categories where id = permissions.category_id) as category_name,
        (select code from permission_groups where id = permissions.group_id) as group_code,
        (select name from permission_groups where id = permissions.group_id) as group_name,
        (select count(*)::int from role_permissions where permission_id = permissions.id) as role_count
    `;

    return row ? mapPermission(row) : null;
  }

  async findRoleById(roleId: string) {
    const [row] = await sql<RoleRow[]>`
      select id, code, name, type, status
      from roles
      where id = ${roleId}
        and deleted_at is null
      limit 1
    `;

    return row ?? null;
  }

  async findPermissionsByIds(permissionIds: string[]) {
    if (permissionIds.length === 0) {
      return [];
    }

    const rows = await sql<PermissionRow[]>`
      select ${selectPermission}
      from permissions p
      left join permission_categories categories on categories.id = p.category_id
      left join permission_groups groups on groups.id = p.group_id
      left join role_permissions on role_permissions.permission_id = p.id
      where p.id in ${sql(permissionIds)}
        and p.deleted_at is null
      group by p.id, categories.code, categories.name, groups.code, groups.name
    `;

    return rows.map(mapPermission);
  }

  async getPermissionsByRole(roleId: string) {
    const rows = await sql<PermissionRow[]>`
      select
        p.*,
        categories.code as category_code,
        categories.name as category_name,
        groups.code as group_code,
        groups.name as group_name,
        (select count(*)::int from role_permissions where permission_id = p.id) as role_count
      from role_permissions assignments
      join permissions p on p.id = assignments.permission_id
      left join permission_categories categories on categories.id = p.category_id
      left join permission_groups groups on groups.id = p.group_id
      where assignments.role_id = ${roleId}
        and p.deleted_at is null
      order by p.module asc, p.screen asc, p.action asc
    `;

    return rows.map(mapPermission);
  }

  async getRolesByPermission(permissionId: string) {
    const rows = await sql<RolePermissionRow[]>`
      select
        roles.id,
        roles.code,
        roles.name,
        roles.type,
        roles.status,
        assignments.assigned_at,
        assignments.assigned_by
      from role_permissions assignments
      join roles on roles.id = assignments.role_id
      where assignments.permission_id = ${permissionId}
        and roles.deleted_at is null
      order by assignments.assigned_at desc, roles.name asc
    `;

    return rows.map(mapRolePermission);
  }

  async replaceRolePermissions(roleId: string, permissionIds: string[], actorUserId: string) {
    await sql.begin(async (transaction) => {
      await transaction`delete from role_permissions where role_id = ${roleId}`;
      for (const permissionId of permissionIds) {
        await transaction`
          insert into role_permissions (id, role_id, permission_id, assigned_by)
          values (${randomUUID()}, ${roleId}, ${permissionId}, ${actorUserId})
        `;
      }
    });
  }

  async userHasPermission(userId: string, moduleName: string, screen: string, action: string) {
    const [{ count }] = await sql<[{ count: string }]>`
      select count(distinct permissions.id)::text as count
      from auth_users users
      join user_role_assignments user_roles on user_roles.user_id = users.id
      join roles on roles.id = user_roles.role_id
      join role_permissions role_permissions on role_permissions.role_id = roles.id
      join permissions on permissions.id = role_permissions.permission_id
      where users.id = ${userId}
        and users.deleted_at is null
        and users.status = 'active'
        and roles.deleted_at is null
        and roles.status = 'active'
        and permissions.deleted_at is null
        and permissions.status = 'active'
        and lower(permissions.module) = lower(${moduleName})
        and lower(permissions.screen) = lower(${screen})
        and lower(permissions.action) = lower(${action})
    `;

    return Number.parseInt(count, 10) > 0;
  }

  async userHasActiveRole(userId: string, roleCode: string) {
    const [{ count }] = await sql<[{ count: string }]>`
      select count(*)::text as count
      from auth_users users
      join user_role_assignments assignments on assignments.user_id = users.id
      join roles on roles.id = assignments.role_id
      where users.id = ${userId}
        and users.deleted_at is null
        and users.status = 'active'
        and roles.deleted_at is null
        and roles.status = 'active'
        and roles.code = ${roleCode}
    `;

    return Number.parseInt(count, 10) > 0;
  }

  async userHasAllPermissionsById(userId: string, permissionIds: string[]) {
    if (permissionIds.length === 0) {
      return true;
    }

    const [{ count }] = await sql<[{ count: string }]>`
      select count(distinct permissions.id)::text as count
      from auth_users users
      join user_role_assignments user_roles on user_roles.user_id = users.id
      join roles on roles.id = user_roles.role_id
      join role_permissions role_permissions on role_permissions.role_id = roles.id
      join permissions on permissions.id = role_permissions.permission_id
      where users.id = ${userId}
        and users.deleted_at is null
        and users.status = 'active'
        and roles.deleted_at is null
        and roles.status = 'active'
        and permissions.deleted_at is null
        and permissions.status = 'active'
        and permissions.id in ${sql(permissionIds)}
    `;

    return Number.parseInt(count, 10) === new Set(permissionIds).size;
  }

  async audit(
    eventType: string,
    metadata: RequestMetadata & {
      actorUserId?: string;
      subjectUserId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await sql`
      insert into auth_audit_logs (
        id,
        actor_user_id,
        subject_user_id,
        event_type,
        ip_address,
        user_agent,
        metadata_json
      )
      values (
        ${randomUUID()},
        ${metadata.actorUserId ?? null},
        ${metadata.subjectUserId ?? null},
        ${eventType},
        ${metadata.ipAddress ?? null},
        ${metadata.userAgent ?? null},
        ${metadata.metadata ? sql.json(metadata.metadata as Parameters<typeof sql.json>[0]) : null}
      )
    `;
  }
}
