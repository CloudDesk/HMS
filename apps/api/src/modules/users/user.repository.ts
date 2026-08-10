import { randomUUID } from 'node:crypto';
import { sql } from '../../database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  AssignmentInput,
  RequestMetadata,
  UserAssignment,
  UserListQuery,
  UserRecord,
  UserStatus,
} from './user.types.js';

type UserRow = {
  id: string;
  employee_code: string | null;
  username: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  employee_type: string | null;
  hire_date: string | null;
  profile_photo_url: string | null;
  address: string | null;
  status: UserStatus;
  failed_login_attempts: number;
  locked_until: Date | null;
  password_changed_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
};

type AssignmentRow = {
  user_id: string;
  id: string;
  name: string | null;
  is_primary: boolean;
};

const mapUser = (row: UserRow): UserRecord => ({
  id: row.id,
  employeeCode: row.employee_code,
  username: row.username,
  email: row.email,
  fullName: row.full_name,
  phone: row.phone,
  jobTitle: row.job_title,
  employeeType: row.employee_type,
  hireDate: row.hire_date,
  profilePhotoUrl: row.profile_photo_url,
  address: row.address,
  status: row.status,
  failedLoginAttempts: row.failed_login_attempts,
  lockedUntil: row.locked_until,
  passwordChangedAt: row.password_changed_at,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  deletedBy: row.deleted_by,
});

const mapAssignment = (row: AssignmentRow): UserAssignment => ({
  id: row.id,
  name: row.name,
  isPrimary: row.is_primary,
});

const sortColumns: Record<UserListQuery['sortBy'], string> = {
  fullName: 'u.full_name',
  username: 'u.username',
  email: 'u.email',
  employeeCode: 'u.employee_code',
  status: 'u.status',
  createdAt: 'u.created_at',
  lastLoginAt: 'u.last_login_at',
};

export class UserRepository {
  async findById(id: string) {
    const [row] = await sql<UserRow[]>`
      select *
      from auth_users
      where id = ${id}
        and deleted_at is null
      limit 1
    `;

    return row ? mapUser(row) : null;
  }

  async findPasswordHashById(id: string) {
    const [row] = await sql<[{ password_hash: string }]>`
      select password_hash
      from auth_users
      where id = ${id}
        and deleted_at is null
      limit 1
    `;

    return row?.password_hash ?? null;
  }

  async findByUniqueFields(fields: {
    username?: string;
    email?: string | null;
    employeeCode?: string | null;
    excludeUserId?: string;
  }) {
    const [row] = await sql<UserRow[]>`
      select *
      from auth_users
      where deleted_at is null
        and (${fields.excludeUserId ?? null}::text is null or id <> ${fields.excludeUserId ?? null})
        and (
          (${fields.username ?? null}::text is not null and lower(username) = lower(${fields.username ?? null}))
          or (${fields.email ?? null}::text is not null and lower(email) = lower(${fields.email ?? null}))
          or (${fields.employeeCode ?? null}::text is not null and employee_code = ${fields.employeeCode ?? null})
        )
      limit 1
    `;

    return row ? mapUser(row) : null;
  }

  async list(query: UserListQuery) {
    const offset = (query.page - 1) * query.limit;
    const sortColumn = sortColumns[query.sortBy];
    const orderDirection = query.sortOrder === 'asc' ? sql`asc` : sql`desc`;
    const search = query.search ? `%${query.search.toLowerCase()}%` : null;

    const rows = await sql<UserRow[]>`
      select distinct u.*
      from auth_users u
      left join user_branch_assignments uba on uba.user_id = u.id
      left join user_department_assignments uda on uda.user_id = u.id
      where u.deleted_at is null
        and (${query.status ?? null}::text is null or u.status = ${query.status ?? null})
        and (${query.branchId ?? null}::text is null or uba.branch_id = ${query.branchId ?? null})
        and (${query.departmentId ?? null}::text is null or uda.department_id = ${query.departmentId ?? null})
        and (
          ${search}::text is null
          or lower(u.username) like ${search}
          or lower(coalesce(u.email, '')) like ${search}
          or lower(u.full_name) like ${search}
          or lower(coalesce(u.employee_code, '')) like ${search}
          or lower(coalesce(u.phone, '')) like ${search}
        )
      order by ${sql.unsafe(sortColumn)} ${orderDirection}, u.id asc
      limit ${query.limit}
      offset ${offset}
    `;

    const [{ count }] = await sql<[{ count: string }]>`
      select count(distinct u.id)::text as count
      from auth_users u
      left join user_branch_assignments uba on uba.user_id = u.id
      left join user_department_assignments uda on uda.user_id = u.id
      where u.deleted_at is null
        and (${query.status ?? null}::text is null or u.status = ${query.status ?? null})
        and (${query.branchId ?? null}::text is null or uba.branch_id = ${query.branchId ?? null})
        and (${query.departmentId ?? null}::text is null or uda.department_id = ${query.departmentId ?? null})
        and (
          ${search}::text is null
          or lower(u.username) like ${search}
          or lower(coalesce(u.email, '')) like ${search}
          or lower(u.full_name) like ${search}
          or lower(coalesce(u.employee_code, '')) like ${search}
          or lower(coalesce(u.phone, '')) like ${search}
        )
    `;

    return {
      users: rows.map(mapUser),
      total: Number.parseInt(count, 10),
    };
  }

  async create(input: {
    employeeCode: string;
    username: string;
    email?: string | null;
    fullName: string;
    phone?: string | null;
    jobTitle?: string | null;
    employeeType?: string | null;
    hireDate?: string | null;
    profilePhotoUrl?: string | null;
    address?: string | null;
    status: UserStatus;
    passwordHash: string;
    actorUserId: string;
  }) {
    const id = randomUUID();
    const [row] = await sql<UserRow[]>`
      insert into auth_users (
        id,
        employee_code,
        username,
        email,
        full_name,
        phone,
        job_title,
        employee_type,
        hire_date,
        profile_photo_url,
        address,
        status,
        password_hash,
        password_changed_at,
        created_by,
        updated_by
      )
      values (
        ${id},
        ${input.employeeCode},
        ${input.username},
        ${input.email ?? null},
        ${input.fullName},
        ${input.phone ?? null},
        ${input.jobTitle ?? null},
        ${input.employeeType ?? null},
        ${input.hireDate ?? null},
        ${input.profilePhotoUrl ?? null},
        ${input.address ?? null},
        ${input.status},
        ${input.passwordHash},
        now(),
        ${input.actorUserId},
        ${input.actorUserId}
      )
      returning *
    `;

    if (!row) {
      throw new AppError('User could not be created', 500, 'USER_CREATE_FAILED');
    }

    return mapUser(row);
  }

  async update(
    id: string,
    input: {
      employeeCode?: string;
      username?: string;
      email?: string | null;
      fullName?: string;
      phone?: string | null;
      jobTitle?: string | null;
      employeeType?: string | null;
      hireDate?: string | null;
      profilePhotoUrl?: string | null;
      address?: string | null;
      actorUserId: string;
    },
  ) {
    const [row] = await sql<UserRow[]>`
      update auth_users
      set
        employee_code = coalesce(${input.employeeCode ?? null}, employee_code),
        username = coalesce(${input.username ?? null}, username),
        email = ${input.email === undefined ? sql`email` : input.email},
        full_name = coalesce(${input.fullName ?? null}, full_name),
        phone = ${input.phone === undefined ? sql`phone` : input.phone},
        job_title = ${input.jobTitle === undefined ? sql`job_title` : input.jobTitle},
        employee_type = ${input.employeeType === undefined ? sql`employee_type` : input.employeeType},
        hire_date = ${input.hireDate === undefined ? sql`hire_date` : input.hireDate},
        profile_photo_url = ${
          input.profilePhotoUrl === undefined ? sql`profile_photo_url` : input.profilePhotoUrl
        },
        address = ${input.address === undefined ? sql`address` : input.address},
        updated_by = ${input.actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *
    `;

    return row ? mapUser(row) : null;
  }

  async updateStatus(id: string, status: UserStatus, actorUserId: string, lockedUntil?: Date | null) {
    const [row] = await sql<UserRow[]>`
      update auth_users
      set
        status = ${status},
        locked_until = ${status === 'locked' ? lockedUntil ?? null : null},
        failed_login_attempts = case when ${status} = 'locked' then failed_login_attempts else 0 end,
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *
    `;

    return row ? mapUser(row) : null;
  }

  async updatePassword(id: string, passwordHash: string, actorUserId: string) {
    const [row] = await sql<UserRow[]>`
      update auth_users
      set
        password_hash = ${passwordHash},
        password_changed_at = now(),
        failed_login_attempts = 0,
        locked_until = null,
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *
    `;

    return row ? mapUser(row) : null;
  }

  async softDelete(id: string, actorUserId: string) {
    const [row] = await sql<UserRow[]>`
      update auth_users
      set
        deleted_at = now(),
        deleted_by = ${actorUserId},
        updated_by = ${actorUserId},
        updated_at = now()
      where id = ${id}
        and deleted_at is null
      returning *
    `;

    return row ? mapUser(row) : null;
  }

  async replaceAssignments(
    userId: string,
    branches: AssignmentInput[],
    departments: AssignmentInput[],
  ) {
    await sql.begin(async (transaction) => {
      await transaction`delete from user_branch_assignments where user_id = ${userId}`;
      for (const branch of branches) {
        await transaction`
          insert into user_branch_assignments (id, user_id, branch_id, branch_name, is_primary)
          values (${randomUUID()}, ${userId}, ${branch.id}, ${branch.name ?? null}, ${Boolean(branch.isPrimary)})
        `;
      }

      await transaction`delete from user_department_assignments where user_id = ${userId}`;
      for (const department of departments) {
        await transaction`
          insert into user_department_assignments (
            id,
            user_id,
            department_id,
            department_name,
            is_primary
          )
          values (
            ${randomUUID()},
            ${userId},
            ${department.id},
            ${department.name ?? null},
            ${Boolean(department.isPrimary)}
          )
        `;
      }
    });
  }

  async getAssignments(userIds: string[]) {
    if (userIds.length === 0) {
      return {
        branchesByUserId: new Map<string, UserAssignment[]>(),
        departmentsByUserId: new Map<string, UserAssignment[]>(),
      };
    }

    const branches = await sql<AssignmentRow[]>`
      select user_id, branch_id as id, branch_name as name, is_primary
      from user_branch_assignments
      where user_id in ${sql(userIds)}
      order by is_primary desc, branch_name asc, branch_id asc
    `;
    const departments = await sql<AssignmentRow[]>`
      select user_id, department_id as id, department_name as name, is_primary
      from user_department_assignments
      where user_id in ${sql(userIds)}
      order by is_primary desc, department_name asc, department_id asc
    `;

    return {
      branchesByUserId: this.groupAssignments(branches),
      departmentsByUserId: this.groupAssignments(departments),
    };
  }

  async revokeRefreshTokens(userId: string) {
    await sql`
      update auth_refresh_tokens
      set revoked_at = now()
      where user_id = ${userId}
        and revoked_at is null
    `;
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
        ${metadata.metadata ? JSON.stringify(metadata.metadata) : null}::jsonb
      )
    `;
  }

  private groupAssignments(rows: AssignmentRow[]) {
    return rows.reduce((map, row) => {
      const current = map.get(row.user_id) ?? [];
      current.push(mapAssignment(row));
      map.set(row.user_id, current);
      return map;
    }, new Map<string, UserAssignment[]>());
  }
}
