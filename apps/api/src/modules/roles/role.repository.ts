import { randomUUID } from 'node:crypto';
import { sql } from '../../database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  RequestMetadata,
  RoleAssignedUser,
  RoleListQuery,
  RoleRecord,
  RoleStatus,
  RoleType,
} from './role.types.js';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: RoleType;
  status: RoleStatus;
  color: string | null;
  user_count: number | string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
};

type AssignedUserRow = {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  status: string;
  assigned_at: Date;
  assigned_by: string | null;
};

type UserStatusRow = {
  id: string;
  status: string;
};

const sortColumns: Record<RoleListQuery['sortBy'], string> = {
  name: 'r.name',
  code: 'r.code',
  type: 'r.type',
  status: 'r.status',
  userCount: 'user_count',
  createdAt: 'r.created_at',
  updatedAt: 'r.updated_at',
};

const mapRole = (row: RoleRow): RoleRecord => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  type: row.type,
  status: row.status,
  color: row.color,
  userCount: Number(row.user_count),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  deletedBy: row.deleted_by,
});

const mapAssignedUser = (row: AssignedUserRow): RoleAssignedUser => ({
  id: row.id,
  username: row.username,
  fullName: row.full_name,
  email: row.email,
  status: row.status,
  assignedAt: row.assigned_at,
  assignedBy: row.assigned_by,
});

export class RoleRepository {
  async findById(id: string) {
    const [row] = await sql<RoleRow[]>`
      select r.*, count(assignments.id)::int as user_count
      from roles r
      left join user_role_assignments assignments on assignments.role_id = r.id
      where r.id = ${id}
        and r.deleted_at is null
      group by r.id
      limit 1
    `;

    return row ? mapRole(row) : null;
  }

  async findByUniqueFields(fields: {
    code?: string;
    name?: string;
    excludeRoleId?: string;
  }) {
    const [row] = await sql<RoleRow[]>`
      select r.*, count(assignments.id)::int as user_count
      from roles r
      left join user_role_assignments assignments on assignments.role_id = r.id
      where r.deleted_at is null
        and (${fields.excludeRoleId ?? null}::text is null or r.id <> ${fields.excludeRoleId ?? null})
        and (
          (${fields.code ?? null}::text is not null and lower(r.code) = lower(${fields.code ?? null}))
          or (${fields.name ?? null}::text is not null and lower(r.name) = lower(${fields.name ?? null}))
        )
      group by r.id
      limit 1
    `;

    return row ? mapRole(row) : null;
  }

  async list(query: RoleListQuery) {
    const offset = (query.page - 1) * query.limit;
    const sortColumn = sortColumns[query.sortBy];
    const orderDirection = query.sortOrder === 'asc' ? sql`asc` : sql`desc`;
    const search = query.search ? `%${query.search.toLowerCase()}%` : null;

    const rows = await sql<RoleRow[]>`
      select r.*, count(assignments.id)::int as user_count
      from roles r
      left join user_role_assignments assignments on assignments.role_id = r.id
      where r.deleted_at is null
        and (${query.status ?? null}::text is null or r.status = ${query.status ?? null})
        and (${query.type ?? null}::text is null or r.type = ${query.type ?? null})
        and (
          ${search}::text is null
          or lower(r.code) like ${search}
          or lower(r.name) like ${search}
          or lower(coalesce(r.description, '')) like ${search}
        )
      group by r.id
      order by ${sql.unsafe(sortColumn)} ${orderDirection}, r.id asc
      limit ${query.limit}
      offset ${offset}
    `;

    const [{ count }] = await sql<[{ count: string }]>`
      select count(*)::text as count
      from roles r
      where r.deleted_at is null
        and (${query.status ?? null}::text is null or r.status = ${query.status ?? null})
        and (${query.type ?? null}::text is null or r.type = ${query.type ?? null})
        and (
          ${search}::text is null
          or lower(r.code) like ${search}
          or lower(r.name) like ${search}
          or lower(coalesce(r.description, '')) like ${search}
        )
    `;

    return {
      roles: rows.map(mapRole),
      total: Number.parseInt(count, 10),
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
    const [row] = await sql<RoleRow[]>`
      insert into roles (
        id,
        code,
        name,
        description,
        type,
        status,
        color,
        created_by,
        updated_by
      )
      values (
        ${randomUUID()},
        ${input.code},
        ${input.name},
        ${input.description ?? null},
        ${input.type},
        ${input.status},
        ${input.color ?? null},
        ${input.actorUserId},
        ${input.actorUserId}
      )
      returning *, 0::int as user_count
    `;

    if (!row) {
      throw new AppError('Role could not be created', 500, 'ROLE_CREATE_FAILED');
    }

    return mapRole(row);
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
    const [row] = await sql<RoleRow[]>`
      update roles
      set
        code = coalesce(${input.code ?? null}, code),
        name = coalesce(${input.name ?? null}, name),
        description = ${input.description === undefined ? sql`description` : input.description},
        type = coalesce(${input.type ?? null}, type),
        color = ${input.color === undefined ? sql`color` : input.color},
        updated_by = ${input.actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *, (
        select count(*)::int
        from user_role_assignments assignments
        where assignments.role_id = roles.id
      ) as user_count
    `;

    return row ? mapRole(row) : null;
  }

  async updateStatus(id: string, status: RoleStatus, actorUserId: string) {
    const [row] = await sql<RoleRow[]>`
      update roles
      set
        status = ${status},
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *, (
        select count(*)::int
        from user_role_assignments assignments
        where assignments.role_id = roles.id
      ) as user_count
    `;

    return row ? mapRole(row) : null;
  }

  async softDelete(id: string, actorUserId: string) {
    const [row] = await sql<RoleRow[]>`
      update roles
      set
        deleted_at = now(),
        deleted_by = ${actorUserId},
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *, (
        select count(*)::int
        from user_role_assignments assignments
        where assignments.role_id = roles.id
      ) as user_count
    `;

    return row ? mapRole(row) : null;
  }

  async findUserStatus(userId: string) {
    const [row] = await sql<UserStatusRow[]>`
      select id, status
      from auth_users
      where id = ${userId}
        and deleted_at is null
      limit 1
    `;

    return row ?? null;
  }

  async isUserAssigned(roleId: string, userId: string) {
    const [{ count }] = await sql<[{ count: string }]>`
      select count(*)::text as count
      from user_role_assignments
      where role_id = ${roleId}
        and user_id = ${userId}
    `;

    return Number.parseInt(count, 10) > 0;
  }

  async assignUser(roleId: string, userId: string, actorUserId: string) {
    await sql`
      insert into user_role_assignments (id, user_id, role_id, assigned_by)
      values (${randomUUID()}, ${userId}, ${roleId}, ${actorUserId})
    `;
  }

  async removeUser(roleId: string, userId: string) {
    const rows = await sql`
      delete from user_role_assignments
      where role_id = ${roleId}
        and user_id = ${userId}
      returning id
    `;

    return rows.length > 0;
  }

  async getAssignedUsers(roleId: string) {
    const rows = await sql<AssignedUserRow[]>`
      select
        users.id,
        users.username,
        users.full_name,
        users.email,
        users.status,
        assignments.assigned_at,
        assignments.assigned_by
      from user_role_assignments assignments
      join auth_users users on users.id = assignments.user_id
      where assignments.role_id = ${roleId}
        and users.deleted_at is null
      order by assignments.assigned_at desc, users.full_name asc
    `;

    return rows.map(mapAssignedUser);
  }

  async hasAnyActiveRole(userId: string, roleCodes: string[]) {
    if (roleCodes.length === 0) {
      return false;
    }

    const [{ count }] = await sql<[{ count: string }]>`
      select count(*)::text as count
      from user_role_assignments assignments
      join roles on roles.id = assignments.role_id
      join auth_users users on users.id = assignments.user_id
      where assignments.user_id = ${userId}
        and users.deleted_at is null
        and users.status = 'active'
        and roles.deleted_at is null
        and roles.status = 'active'
        and roles.code in ${sql(roleCodes)}
    `;

    return Number.parseInt(count, 10) > 0;
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
