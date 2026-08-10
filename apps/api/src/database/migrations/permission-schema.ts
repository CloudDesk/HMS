import { sql } from '../client.js';

const systemPermissions = [
  ['Administration', 'Users', 'View'],
  ['Administration', 'Users', 'Create'],
  ['Administration', 'Users', 'Edit'],
  ['Administration', 'Users', 'Delete'],
  ['Administration', 'Users', 'ChangePassword'],
  ['Administration', 'Users', 'ResetPassword'],
  ['Administration', 'Roles', 'View'],
  ['Administration', 'Roles', 'Create'],
  ['Administration', 'Roles', 'Edit'],
  ['Administration', 'Roles', 'Delete'],
  ['Administration', 'Roles', 'Assign'],
  ['Administration', 'Permissions', 'View'],
  ['Administration', 'Permissions', 'Create'],
  ['Administration', 'Permissions', 'Edit'],
  ['Administration', 'Permissions', 'Delete'],
  ['Administration', 'Permissions', 'Assign'],
] as const;

const normalizeCode = (value: string) =>
  value
    .trim()
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

const permissionCode = (module: string, screen: string, action: string) =>
  normalizeCode(`${module}_${screen}_${action}`);

const stablePermissionId = (module: string, screen: string, action: string) =>
  `perm-${permissionCode(module, screen, action).toLowerCase().replaceAll('_', '-')}`;

export const initializePermissionManagementSchema = async () => {
  await sql`
    create table if not exists permission_categories (
      id text primary key,
      code text not null,
      name text not null,
      description text,
      type text not null default 'custom',
      status text not null default 'active',
      created_by text references auth_users(id) on delete set null,
      updated_by text references auth_users(id) on delete set null,
      deleted_by text references auth_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      constraint permission_categories_type_check check (type in ('system', 'custom')),
      constraint permission_categories_status_check check (status in ('active', 'inactive'))
    )
  `;

  await sql`
    create unique index if not exists permission_categories_code_unique
    on permission_categories (lower(code))
    where deleted_at is null
  `;

  await sql`
    create unique index if not exists permission_categories_name_unique
    on permission_categories (lower(name))
    where deleted_at is null
  `;

  await sql`
    create table if not exists permission_groups (
      id text primary key,
      category_id text not null references permission_categories(id) on delete restrict,
      code text not null,
      name text not null,
      description text,
      type text not null default 'custom',
      status text not null default 'active',
      created_by text references auth_users(id) on delete set null,
      updated_by text references auth_users(id) on delete set null,
      deleted_by text references auth_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      constraint permission_groups_type_check check (type in ('system', 'custom')),
      constraint permission_groups_status_check check (status in ('active', 'inactive'))
    )
  `;

  await sql`
    create unique index if not exists permission_groups_category_code_unique
    on permission_groups (category_id, lower(code))
    where deleted_at is null
  `;

  await sql`
    create table if not exists permissions (
      id text primary key,
      category_id text references permission_categories(id) on delete set null,
      group_id text references permission_groups(id) on delete set null,
      code text not null,
      name text not null,
      module text not null,
      screen text not null,
      action text not null,
      description text,
      type text not null default 'custom',
      status text not null default 'active',
      created_by text references auth_users(id) on delete set null,
      updated_by text references auth_users(id) on delete set null,
      deleted_by text references auth_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      constraint permissions_type_check check (type in ('system', 'custom')),
      constraint permissions_status_check check (status in ('active', 'inactive'))
    )
  `;

  await sql`
    create unique index if not exists permissions_code_unique
    on permissions (lower(code))
    where deleted_at is null
  `;

  await sql`
    create unique index if not exists permissions_module_screen_action_unique
    on permissions (lower(module), lower(screen), lower(action))
    where deleted_at is null
  `;

  await sql`
    create index if not exists permissions_category_id_idx
    on permissions (category_id)
  `;

  await sql`
    create index if not exists permissions_group_id_idx
    on permissions (group_id)
  `;

  await sql`
    create table if not exists role_permissions (
      id text primary key,
      role_id text not null references roles(id) on delete cascade,
      permission_id text not null references permissions(id) on delete cascade,
      assigned_by text references auth_users(id) on delete set null,
      assigned_at timestamptz not null default now(),
      unique (role_id, permission_id)
    )
  `;

  await sql`
    create index if not exists role_permissions_role_id_idx
    on role_permissions (role_id)
  `;

  await sql`
    create index if not exists role_permissions_permission_id_idx
    on role_permissions (permission_id)
  `;

  await sql`
    insert into permission_categories (id, code, name, description, type, status)
    values (
      'permission-category-administration',
      'ADMINISTRATION',
      'Administration',
      'Administration, user, role and permission management.',
      'system',
      'active'
    )
    on conflict do nothing
  `;

  await sql`
    insert into permission_groups (id, category_id, code, name, description, type, status)
    values
      (
        'permission-group-administration-users',
        'permission-category-administration',
        'USERS',
        'Users',
        'User account and profile administration.',
        'system',
        'active'
      ),
      (
        'permission-group-administration-roles',
        'permission-category-administration',
        'ROLES',
        'Roles',
        'Role lifecycle and user assignment administration.',
        'system',
        'active'
      ),
      (
        'permission-group-administration-permissions',
        'permission-category-administration',
        'PERMISSIONS',
        'Permissions',
        'Permission catalog and role permission assignment administration.',
        'system',
        'active'
      )
    on conflict do nothing
  `;

  for (const [moduleName, screen, action] of systemPermissions) {
    const groupId = `permission-group-${normalizeCode(moduleName).toLowerCase()}-${normalizeCode(screen).toLowerCase()}`;
    await sql`
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
        status
      )
      values (
        ${stablePermissionId(moduleName, screen, action)},
        'permission-category-administration',
        ${groupId},
        ${permissionCode(moduleName, screen, action)},
        ${`${screen} ${action}`},
        ${moduleName},
        ${screen},
        ${action},
        ${`${action} access for ${screen} in ${moduleName}.`},
        'system',
        'active'
      )
      on conflict do nothing
    `;
  }

  await sql`
    insert into role_permissions (id, role_id, permission_id, assigned_by)
    select 'role-permission-' || lower(roles.code) || '-' || lower(permissions.code),
      roles.id,
      permissions.id,
      users.id
    from roles
    cross join permissions
    left join auth_users users on lower(users.username) = 'admin' and users.deleted_at is null
    where roles.code in ('SUPER_ADMIN', 'ADMINISTRATOR')
      and roles.deleted_at is null
      and roles.status = 'active'
      and permissions.deleted_at is null
      and permissions.status = 'active'
      and permissions.module = 'Administration'
      and not exists (
        select 1
        from role_permissions existing
        where existing.role_id = roles.id
          and existing.permission_id = permissions.id
      )
  `;
};
