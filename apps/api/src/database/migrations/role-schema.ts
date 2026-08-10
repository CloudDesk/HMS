import { randomUUID } from 'node:crypto';
import { sql } from '../client.js';

const systemRoles = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full system access across all modules and branches.',
    color: '#0f172a',
  },
  {
    code: 'ADMINISTRATOR',
    name: 'Administrator',
    description: 'Administrative access with user, role and settings management.',
    color: '#2563eb',
  },
  {
    code: 'BRANCH_ADMIN',
    name: 'Branch Admin',
    description: 'Branch-level configuration, users and operational visibility.',
    color: '#0d9488',
  },
  {
    code: 'DOCTOR',
    name: 'Doctor',
    description: 'Clinical staff with access to patient records and prescriptions.',
    color: '#16a34a',
  },
  {
    code: 'NURSE_TRIAGE',
    name: 'Nurse / Triage User',
    description: 'Nursing and triage workflows across OPD, Emergency and IPD.',
    color: '#0891b2',
  },
  {
    code: 'EMERGENCY_USER',
    name: 'Emergency Department User',
    description: 'Emergency queue, triage and care coordination workflows.',
    color: '#ea580c',
  },
  {
    code: 'WARD_NURSE_IPD',
    name: 'Ward Nurse / IPD User',
    description: 'Inpatient ward nursing and admission support workflows.',
    color: '#7c3aed',
  },
  {
    code: 'PHARMACY_USER',
    name: 'Pharmacy User',
    description: 'Medication dispensing, pharmacy queue and inventory visibility.',
    color: '#dc2626',
  },
  {
    code: 'LAB_USER',
    name: 'Lab User',
    description: 'Laboratory order, result entry and verification workflows.',
    color: '#b45309',
  },
  {
    code: 'IMAGING_USER',
    name: 'Imaging User',
    description: 'Imaging orders, scans and report workflows.',
    color: '#9333ea',
  },
  {
    code: 'INVENTORY_STORE_USER',
    name: 'Inventory / Store User',
    description: 'Store inventory, stock usage and low-stock visibility.',
    color: '#475569',
  },
  {
    code: 'MANAGEMENT_USER',
    name: 'Management User',
    description: 'Operational dashboards, reports and management visibility.',
    color: '#64748b',
  },
  {
    code: 'AUDIT_COMPLIANCE_USER',
    name: 'Audit / Compliance User',
    description: 'Audit, access and activity log review workflows.',
    color: '#334155',
  },
] as const;

export const initializeRoleManagementSchema = async () => {
  await sql`
    create table if not exists roles (
      id text primary key,
      code text not null,
      name text not null,
      description text,
      type text not null default 'custom',
      status text not null default 'active',
      color text,
      created_by text references auth_users(id) on delete set null,
      updated_by text references auth_users(id) on delete set null,
      deleted_by text references auth_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      constraint roles_type_check check (type in ('system', 'custom')),
      constraint roles_status_check check (status in ('active', 'inactive'))
    )
  `;

  await sql`
    create unique index if not exists roles_code_unique
    on roles (lower(code))
    where deleted_at is null
  `;

  await sql`
    create unique index if not exists roles_name_unique
    on roles (lower(name))
    where deleted_at is null
  `;

  await sql`
    create table if not exists user_role_assignments (
      id text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      role_id text not null references roles(id) on delete cascade,
      assigned_by text references auth_users(id) on delete set null,
      assigned_at timestamptz not null default now(),
      unique (user_id, role_id)
    )
  `;

  await sql`
    create index if not exists user_role_assignments_user_id_idx
    on user_role_assignments (user_id)
  `;

  await sql`
    create index if not exists user_role_assignments_role_id_idx
    on user_role_assignments (role_id)
  `;

  for (const role of systemRoles) {
    await sql`
      insert into roles (id, code, name, description, type, status, color)
      select
        ${`role-${role.code.toLowerCase().replaceAll('_', '-')}`},
        ${role.code},
        ${role.name},
        ${role.description},
        'system',
        'active',
        ${role.color}
      where not exists (
        select 1
        from roles
        where lower(code) = lower(${role.code})
          and deleted_at is null
      )
    `;
  }

  await sql`
    insert into user_role_assignments (id, user_id, role_id, assigned_by)
    select ${randomUUID()}, users.id, roles.id, users.id
    from auth_users users
    cross join roles
    where lower(users.username) = 'admin'
      and users.deleted_at is null
      and roles.code = 'SUPER_ADMIN'
      and roles.deleted_at is null
      and not exists (
        select 1
        from user_role_assignments assignments
        where assignments.user_id = users.id
          and assignments.role_id = roles.id
      )
  `;
};
