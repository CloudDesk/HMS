import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword, sha256, verifyPassword } from '../../shared/security/hash.js';
import { signJwt, verifyJwt } from '../../shared/security/jwt.js';
import {
  assertPasswordPolicy,
  getEffectivePasswordPolicy,
} from '../../shared/security/password-policy.js';
import type { AuthenticatedUser } from '../../shared/types/auth.js';
import type { PatientOtpService, PatientOtpVerification } from '../patient-portal/patient-otp.service.js';
import { isPatientOtpVerificationForPhone } from '../patient-portal/patient-otp.service.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthUserRecord, RequestMetadata } from './auth.types.js';
import { AuthRateLimitRepository } from './auth-rate-limit.repository.js';
import type { SettingsService } from '../settings/settings.service.js';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

type LoginInput = {
  identifier: string;
  password: string;
};

type PatientOtpLoginInput = {
  phone: string;
  otp: string;
};

type RefreshInput = {
  refreshToken: string;
};

type ChangePasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};

type PasswordResetRequestInput = {
  identifier: string;
};

type PasswordResetConfirmInput = {
  resetToken: string;
  newPassword: string;
};

const createOpaqueToken = () => randomBytes(48).toString('base64url');

const addSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000);

const addMinutes = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);

const toAuthUser = (user: AuthUserRecord): AuthenticatedUser => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  email: user.email,
  status: user.status,
  patientId: user.patientId,
});

const isLocked = (user: AuthUserRecord) =>
  user.status === 'locked' && (!user.lockedUntil || user.lockedUntil.getTime() > Date.now());

type AuthRateLimitOptions = {
  ipLimit?: number;
  identityLimit?: number;
  windowSeconds?: number;
  now?: () => Date;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly patientOtp: PatientOtpService,
    private readonly rateLimits = new AuthRateLimitRepository(),
    private readonly rateLimitOptions: AuthRateLimitOptions = {},
    private readonly settings?: Pick<SettingsService, 'getRuntimeUserPreferences'>,
  ) {}

  async getPasswordPolicy() {
    return getEffectivePasswordPolicy(await this.getRuntimeUserPreferences());
  }

  async login(input: LoginInput, metadata: RequestMetadata) {
    await this.enforcePublicAuthRateLimits('staff-login', input.identifier, metadata);
    const user = await this.repository.findUserByIdentifier(input.identifier);

    if (!user) {
      await this.repository.audit('auth.login.failed', {
        ...metadata,
        metadata: { reason: 'unknown_user' },
      });
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'inactive') {
      await this.repository.audit('auth.login.denied', {
        ...metadata,
        subjectUserId: user.id,
        metadata: { reason: 'inactive_user' },
      });
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    if (isLocked(user)) {
      await this.repository.audit('auth.login.denied', {
        ...metadata,
        subjectUserId: user.id,
        metadata: { reason: 'locked_user' },
      });
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      const lockedUntil = addMinutes(env.auth.lockoutMinutes);
      const preferences = await this.getRuntimeUserPreferences();
      const configuredLimit = preferences?.maxFailedLoginAttempts;
      const failedLoginLimit = Number.isInteger(configuredLimit)
        && configuredLimit !== undefined
        && configuredLimit >= 1
        && configuredLimit <= 20
        ? configuredLimit
        : env.auth.failedLoginLimit;
      const updatedUser = await this.repository.incrementFailedLogin(
        user.id,
        failedLoginLimit,
        lockedUntil,
      );
      await this.repository.audit('auth.login.failed', {
        ...metadata,
        subjectUserId: user.id,
        metadata: {
          reason: 'invalid_password',
          failedLoginAttempts: updatedUser.failedLoginAttempts,
          locked: updatedUser.status === 'locked',
        },
      });
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    await this.repository.clearFailedLogin(user.id);
    const freshUser = (await this.repository.findUserById(user.id)) ?? user;
    const tokens = await this.issueTokenPair(freshUser);

    await this.repository.audit('auth.login.succeeded', {
      ...metadata,
      actorUserId: user.id,
      subjectUserId: user.id,
    });

    return {
      user: await this.publicUser(freshUser),
      tokens,
    };
  }

  async loginPatientWithOtp(input: PatientOtpLoginInput, metadata: RequestMetadata) {
    await this.patientOtp.assertValidForPendingFlow(input.phone, input.otp, metadata);
    const verification = await this.patientOtp.verifyAndConsume(input.phone, input.otp);
    return this.loginPatientAfterOtpVerification(input.phone, verification, metadata);
  }

  private async enforcePublicAuthRateLimits(prefix: string, identifier: string, metadata: RequestMetadata) {
    const now = this.rateLimitOptions.now?.() ?? new Date();
    const windowSeconds = this.rateLimitOptions.windowSeconds ?? env.auth.loginWindowSeconds;
    const keys = [
      { scope: `${prefix}-identity`, value: identifier.trim().toLowerCase(), limit: this.rateLimitOptions.identityLimit ?? env.auth.loginIdentityLimit },
      ...(metadata.ipAddress ? [{ scope: `${prefix}-ip`, value: metadata.ipAddress, limit: this.rateLimitOptions.ipLimit ?? env.auth.loginIpLimit }] : []),
    ];
    for (const item of keys) {
      const keyHash = createHmac('sha256', env.auth.accessTokenSecret).update(item.value).digest('hex');
      if (await this.rateLimits.consume(item.scope, keyHash, item.limit, windowSeconds, now)) continue;
      if (await this.rateLimits.consume(`monitor:${item.scope}`, keyHash, 1, windowSeconds, now)) {
        await this.repository.audit('auth.rate_limited', {
          ...metadata,
          metadata: { scope: item.scope, keyHash },
        });
      }
      throw new AppError('Too many authentication requests. Try again later.', 429, 'AUTH_RATE_LIMITED');
    }
  }

  async loginPatientAfterOtpVerification(
    phone: string,
    verification: PatientOtpVerification,
    metadata: RequestMetadata,
  ) {
    const invalidCredentials = (message = 'Invalid mobile number or verification code') => new AppError(
      message,
      401,
      'INVALID_CREDENTIALS',
    );
    if (!isPatientOtpVerificationForPhone(verification, phone)) throw invalidCredentials();

    const user = await this.repository.findUserByIdentifier(phone);

    if (!user) {
      await this.repository.audit('auth.patient_otp.failed', {
        ...metadata,
        subjectUserId: undefined,
        metadata: { reason: 'unknown_phone' },
      });
      throw invalidCredentials();
    }

    if (user.status === 'inactive' || isLocked(user)) {
      await this.repository.audit('auth.patient_otp.denied', {
        ...metadata,
        subjectUserId: user.id,
        metadata: { reason: user.status === 'inactive' ? 'inactive_user' : 'locked_user' },
      });
      throw invalidCredentials();
    }

    const publicUser = await this.publicUser(user);
    const isPatientPortalUser = Boolean(
      user.patientId || publicUser.roles.some((role) => role.code === 'PATIENT' || role.code === 'GUARDIAN'),
    );
    if (!isPatientPortalUser) {
      await this.repository.audit('auth.patient_otp.denied', {
        ...metadata,
        subjectUserId: user.id,
        metadata: { reason: 'not_patient_portal_user' },
      });
      throw invalidCredentials();
    }

    await this.repository.clearFailedLogin(user.id);
    const freshUser = (await this.repository.findUserById(user.id)) ?? user;
    const tokens = await this.issueTokenPair(freshUser);

    await this.repository.audit('auth.patient_otp.succeeded', {
      ...metadata,
      actorUserId: user.id,
      subjectUserId: user.id,
    });

    return { user: await this.publicUser(freshUser), tokens };
  }

  async refresh(input: RefreshInput, metadata: RequestMetadata) {
    const tokenHash = sha256(input.refreshToken);
    const refreshToken = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!refreshToken || refreshToken.revokedAt || refreshToken.expiresAt.getTime() <= Date.now()) {
      await this.repository.audit('auth.refresh.failed', {
        ...metadata,
        metadata: { reason: 'invalid_refresh_token' },
      });
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.repository.findUserById(refreshToken.userId);

    if (!user || user.status === 'inactive' || isLocked(user)) {
      await this.repository.revokeRefreshToken(refreshToken.id);
      throw new AppError('Account cannot refresh session', 403, 'SESSION_NOT_ALLOWED');
    }

    const tokens = await this.issueTokenPair(user);
    const replacement = await this.repository.findRefreshTokenByHash(sha256(tokens.refreshToken));
    await this.repository.revokeRefreshToken(refreshToken.id, replacement?.id);

    await this.repository.audit('auth.refresh.succeeded', {
      ...metadata,
      actorUserId: user.id,
      subjectUserId: user.id,
    });

    return {
      user: await this.publicUser(user),
      tokens,
    };
  }

  async logout(userId: string, refreshToken: string | undefined, metadata: RequestMetadata) {
    if (refreshToken) {
      const record = await this.repository.findRefreshTokenByHash(sha256(refreshToken));
      if (record?.userId === userId) {
        await this.repository.revokeRefreshToken(record.id);
      }
    } else {
      await this.repository.revokeAllRefreshTokensForUser(userId);
    }

    await this.repository.audit('auth.logout.succeeded', {
      ...metadata,
      actorUserId: userId,
      subjectUserId: userId,
    });

    return { ok: true };
  }

  async authenticateAccessToken(token: string) {
    const payload = verifyJwt(token, env.auth.accessTokenSecret);
    const user = await this.repository.findUserById(payload.sub);

    if (!user || user.status === 'inactive' || isLocked(user)) {
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    return toAuthUser(user);
  }

  async getCurrentUser(userId: string) {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return this.publicUser(user);
  }

  async changePassword(input: ChangePasswordInput, metadata: RequestMetadata) {
    const user = await this.repository.findUserById(input.userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const currentPasswordMatches = await verifyPassword(input.currentPassword, user.passwordHash);

    if (!currentPasswordMatches) {
      throw new AppError('Current password is invalid', 400, 'INVALID_CURRENT_PASSWORD');
    }

    assertPasswordPolicy(input.newPassword, await this.getPasswordPolicy());
    await this.repository.updatePassword(user.id, await hashPassword(input.newPassword));
    await this.repository.revokeAllRefreshTokensForUser(user.id);
    await this.repository.audit('auth.password.changed', {
      ...metadata,
      actorUserId: user.id,
      subjectUserId: user.id,
    });

    return { ok: true };
  }

  async requestPasswordReset(input: PasswordResetRequestInput, metadata: RequestMetadata) {
    await this.enforcePublicAuthRateLimits('password-reset-request', input.identifier, metadata);
    const user = await this.repository.findUserByIdentifier(input.identifier);

    if (user && user.status === 'active') {
      const resetToken = createOpaqueToken();
      await this.repository.createPasswordResetToken(
        user.id,
        sha256(resetToken),
        addMinutes(env.auth.passwordResetTtlMinutes),
      );
      await this.repository.audit('auth.password_reset.requested', {
        ...metadata,
        subjectUserId: user.id,
      });
    }

    return {
      message: 'If the account exists, password reset instructions will be sent.',
    };
  }

  async confirmPasswordReset(input: PasswordResetConfirmInput, metadata: RequestMetadata) {
    await this.enforcePublicAuthRateLimits('password-reset-confirm', input.resetToken, metadata);
    assertPasswordPolicy(input.newPassword, await this.getPasswordPolicy());

    const record = await this.repository.findPasswordResetTokenByHash(sha256(input.resetToken));

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    await this.repository.updatePassword(record.userId, await hashPassword(input.newPassword));
    await this.repository.markPasswordResetTokenUsed(record.id);
    await this.repository.revokeAllRefreshTokensForUser(record.userId);
    await this.repository.audit('auth.password_reset.confirmed', {
      ...metadata,
      subjectUserId: record.userId,
    });

    return { ok: true };
  }

  private async issueTokenPair(user: AuthUserRecord): Promise<TokenPair> {
    const accessToken = signJwt(
      {
        sub: user.id,
        username: user.username,
      },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
    const refreshToken = createOpaqueToken();

    await this.repository.createRefreshToken(
      user.id,
      sha256(refreshToken),
      addSeconds(env.auth.refreshTokenTtlSeconds),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: env.auth.accessTokenTtlSeconds,
      refreshExpiresIn: env.auth.refreshTokenTtlSeconds,
    };
  }

  private async getRuntimeUserPreferences() {
    return this.settings?.getRuntimeUserPreferences() ?? null;
  }

  private async publicUser(user: AuthUserRecord) {
    const access = await this.repository.getUserAccessContext(user.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      ...access,
    };
  }

}
