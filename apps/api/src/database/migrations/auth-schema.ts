import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { hashPassword } from '../../shared/security/hash.js';
import { sql } from '../client.js';

const seedUsers = [
  {
    username: 'admin',
    email: 'admin@hms.local',
    fullName: 'HMS Admin',
    password: 'Admin123',
    status: 'active',
    lockedUntil: null,
    failedLoginAttempts: 0,
  },
  {
    username: 'inactive.user',
    email: 'inactive@hms.local',
    fullName: 'Inactive User',
    password: 'Inactive123',
    status: 'inactive',
    lockedUntil: null,
    failedLoginAttempts: 0,
  },
  {
    username: 'locked.user',
    email: 'locked@hms.local',
    fullName: 'Locked User',
    password: 'Locked123',
    status: 'locked',
    lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    failedLoginAttempts: env.auth.failedLoginLimit,
  },
] as const;

export const initializeAuthSchema = async () => {
  await sql`
    create table if not exists auth_users (
      id text primary key,
      employee_code text unique,
      username text not null,
      email text,
      full_name text not null,
      password_hash text not null,
      status text not null default 'active',
      failed_login_attempts integer not null default 0,
      locked_until timestamptz,
      password_changed_at timestamptz,
      last_login_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create unique index if not exists auth_users_username_unique on auth_users (lower(username))`;
  await sql`
    create unique index if not exists auth_users_email_unique
    on auth_users (lower(email))
    where email is not null
  `;

  await sql`
    create table if not exists auth_refresh_tokens (
      id text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      revoked_at timestamptz,
      replaced_by_token_id text,
      created_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists auth_refresh_tokens_user_id_idx on auth_refresh_tokens (user_id)`;

  await sql`
    create table if not exists auth_password_reset_tokens (
      id text primary key,
      user_id text not null references auth_users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists auth_password_reset_tokens_user_id_idx
    on auth_password_reset_tokens (user_id)
  `;

  await sql`
    create table if not exists auth_audit_logs (
      id text primary key,
      actor_user_id text references auth_users(id) on delete set null,
      subject_user_id text references auth_users(id) on delete set null,
      event_type text not null,
      ip_address text,
      user_agent text,
      metadata_json jsonb,
      created_at timestamptz not null default now()
    )
  `;

  await seedDevelopmentUsers();
};

const seedDevelopmentUsers = async () => {
  if (env.app.environment === 'prod') {
    return;
  }

  const [{ count }] = await sql<[{ count: string }]>`select count(*)::text as count from auth_users`;

  if (Number.parseInt(count, 10) > 0) {
    return;
  }

  for (const user of seedUsers) {
    await sql`
      insert into auth_users (
        id,
        username,
        email,
        full_name,
        password_hash,
        status,
        locked_until,
        failed_login_attempts,
        password_changed_at
      )
      values (
        ${randomUUID()},
        ${user.username},
        ${user.email},
        ${user.fullName},
        ${await hashPassword(user.password)},
        ${user.status},
        ${user.lockedUntil},
        ${user.failedLoginAttempts},
        now()
      )
    `;
  }
};
