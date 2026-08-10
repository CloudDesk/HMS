import { randomUUID } from 'node:crypto';
import { sql } from '../../database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  AuthUserRecord,
  AuthUserStatus,
  PasswordResetTokenRecord,
  RefreshTokenRecord,
  RequestMetadata,
} from './auth.types.js';

type AuthUserRow = {
  id: string;
  employee_code: string | null;
  username: string;
  email: string | null;
  full_name: string;
  password_hash: string;
  status: AuthUserStatus;
  failed_login_attempts: number;
  locked_until: Date | null;
  password_changed_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_id: string | null;
  created_at: Date;
};

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

const mapUser = (row: AuthUserRow): AuthUserRecord => ({
  id: row.id,
  employeeCode: row.employee_code,
  username: row.username,
  email: row.email,
  fullName: row.full_name,
  passwordHash: row.password_hash,
  status: row.status,
  failedLoginAttempts: row.failed_login_attempts,
  lockedUntil: row.locked_until,
  passwordChangedAt: row.password_changed_at,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRefreshToken = (row: RefreshTokenRow): RefreshTokenRecord => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  replacedByTokenId: row.replaced_by_token_id,
  createdAt: row.created_at,
});

const mapPasswordResetToken = (row: PasswordResetTokenRow): PasswordResetTokenRecord => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  usedAt: row.used_at,
  createdAt: row.created_at,
});

export class AuthRepository {
  async findUserById(id: string) {
    const [row] = await sql<AuthUserRow[]>`
      select *
      from auth_users
      where id = ${id}
        and deleted_at is null
      limit 1
    `;

    return row ? mapUser(row) : null;
  }

  async findUserByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const [row] = await sql<AuthUserRow[]>`
      select *
      from auth_users
      where deleted_at is null
        and (
          lower(username) = ${normalizedIdentifier}
          or lower(email) = ${normalizedIdentifier}
        )
      limit 1
    `;

    return row ? mapUser(row) : null;
  }

  async incrementFailedLogin(userId: string, failedLoginLimit: number, lockedUntil: Date) {
    const [row] = await sql<AuthUserRow[]>`
      update auth_users
      set
        failed_login_attempts = failed_login_attempts + 1,
        status = case
          when failed_login_attempts + 1 >= ${failedLoginLimit} then 'locked'
          else status
        end,
        locked_until = case
          when failed_login_attempts + 1 >= ${failedLoginLimit} then ${lockedUntil}
          else locked_until
        end,
        updated_at = now()
      where id = ${userId}
      returning *
    `;

    if (!row) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return mapUser(row);
  }

  async clearFailedLogin(userId: string) {
    await sql`
      update auth_users
      set
        failed_login_attempts = 0,
        locked_until = null,
        status = case when status = 'locked' then 'active' else status end,
        last_login_at = now(),
        updated_at = now()
      where id = ${userId}
    `;
  }

  async updatePassword(userId: string, passwordHash: string) {
    await sql`
      update auth_users
      set
        password_hash = ${passwordHash},
        password_changed_at = now(),
        failed_login_attempts = 0,
        locked_until = null,
        status = case when status = 'locked' then 'active' else status end,
        updated_at = now()
      where id = ${userId}
    `;
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    const id = randomUUID();
    await sql`
      insert into auth_refresh_tokens (id, user_id, token_hash, expires_at)
      values (${id}, ${userId}, ${tokenHash}, ${expiresAt})
    `;

    return id;
  }

  async findRefreshTokenByHash(tokenHash: string) {
    const [row] = await sql<RefreshTokenRow[]>`
      select *
      from auth_refresh_tokens
      where token_hash = ${tokenHash}
      limit 1
    `;

    return row ? mapRefreshToken(row) : null;
  }

  async revokeRefreshToken(id: string, replacedByTokenId?: string) {
    await sql`
      update auth_refresh_tokens
      set
        revoked_at = now(),
        replaced_by_token_id = ${replacedByTokenId ?? null}
      where id = ${id}
        and revoked_at is null
    `;
  }

  async revokeAllRefreshTokensForUser(userId: string) {
    await sql`
      update auth_refresh_tokens
      set revoked_at = now()
      where user_id = ${userId}
        and revoked_at is null
    `;
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    await sql`
      insert into auth_password_reset_tokens (id, user_id, token_hash, expires_at)
      values (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt})
    `;
  }

  async findPasswordResetTokenByHash(tokenHash: string) {
    const [row] = await sql<PasswordResetTokenRow[]>`
      select *
      from auth_password_reset_tokens
      where token_hash = ${tokenHash}
      limit 1
    `;

    return row ? mapPasswordResetToken(row) : null;
  }

  async markPasswordResetTokenUsed(id: string) {
    await sql`
      update auth_password_reset_tokens
      set used_at = now()
      where id = ${id}
        and used_at is null
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
}
