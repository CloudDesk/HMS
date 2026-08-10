import { sql } from '../client.js';

export const initializeUserManagementSchema = async () => {
  await sql`alter table auth_users add column if not exists phone text`;
  await sql`alter table auth_users add column if not exists job_title text`;
  await sql`alter table auth_users add column if not exists employee_type text`;
  await sql`alter table auth_users add column if not exists hire_date date`;
  await sql`alter table auth_users add column if not exists profile_photo_url text`;
  await sql`alter table auth_users add column if not exists address text`;
  await sql`alter table auth_users add column if not exists created_by text references auth_users(id) on delete set null`;
  await sql`alter table auth_users add column if not exists updated_by text references auth_users(id) on delete set null`;
  await sql`alter table auth_users add column if not exists deleted_by text references auth_users(id) on delete set null`;
  await sql`alter table auth_users add column if not exists deleted_at timestamptz`;

  await sql`
    create table if not exists user_branch_assignments (
      id text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      branch_id text not null,
      branch_name text,
      is_primary boolean not null default false,
      created_at timestamptz not null default now(),
      unique (user_id, branch_id)
    )
  `;

  await sql`
    create table if not exists user_department_assignments (
      id text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      department_id text not null,
      department_name text,
      is_primary boolean not null default false,
      created_at timestamptz not null default now(),
      unique (user_id, department_id)
    )
  `;

  await sql`
    create index if not exists user_branch_assignments_user_id_idx
    on user_branch_assignments (user_id)
  `;

  await sql`
    create index if not exists user_department_assignments_user_id_idx
    on user_department_assignments (user_id)
  `;

  await sql`
    create index if not exists auth_users_deleted_at_idx
    on auth_users (deleted_at)
  `;
};
