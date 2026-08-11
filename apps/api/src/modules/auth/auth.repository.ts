import { UserModel } from '../users/user.model.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { PasswordResetTokenModel, AuditLogModel } from './auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthUserRecord, AuthUserStatus, PasswordResetTokenRecord, RefreshTokenRecord, RequestMetadata } from './auth.types.js';

const mapUser = (user: any): AuthUserRecord => ({
  id: user._id.toString(),
  employeeCode: user.employeeCode ?? null,
  username: user.username,
  email: user.email ?? null,
  fullName: user.fullName ?? user.username, // Provide fallback for auth mappings
  passwordHash: user.passwordHash,
  status: user.status as AuthUserStatus,
  failedLoginAttempts: user.failedLoginAttempts ?? 0,
  lockedUntil: user.lockedUntil ?? null,
  passwordChangedAt: user.passwordChangedAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class AuthRepository {
  async findUserById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).lean();
    return user ? mapUser(user) : null;
  }

  async findUserByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const searchRegex = new RegExp(`^${normalizedIdentifier}$`, 'i');
    
    const user = await UserModel.findOne({
      deletedAt: null,
      $or: [{ username: searchRegex }, { email: searchRegex }]
    }).lean();

    return user ? mapUser(user) : null;
  }

  async incrementFailedLogin(userId: string, failedLoginLimit: number, lockedUntil: Date) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const attempts = (user.get('failedLoginAttempts') as number || 0) + 1;
    const shouldLock = attempts >= failedLoginLimit;

    user.set('failedLoginAttempts', attempts);
    if (shouldLock) {
      user.status = 'locked' as any; // Ensure auth type matches
      user.set('lockedUntil', lockedUntil);
    }

    await user.save();
    return mapUser(user.toObject());
  }

  async clearFailedLogin(userId: string) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        }
      }
    );
    // Un-lock if locked
    await UserModel.updateOne(
      { _id: userId, status: 'locked' },
      { $set: { status: 'active' } }
    );
  }

  async updatePassword(userId: string, passwordHash: string) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }
      }
    );
    await UserModel.updateOne(
      { _id: userId, status: 'locked' },
      { $set: { status: 'active' } }
    );
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    const token = await RefreshTokenModel.create({
      userId,
      token: tokenHash,
      expiresAt,
    });
    return token._id.toString();
  }

  async findRefreshTokenByHash(tokenHash: string) {
    const token = await RefreshTokenModel.findOne({ token: tokenHash }).lean();
    if (!token) return null;
    return {
      id: token._id.toString(),
      userId: token.userId.toString(),
      tokenHash: token.token,
      expiresAt: token.expiresAt,
      revokedAt: (token as any).revokedAt ?? null,
      replacedByTokenId: (token as any).replacedByTokenId ?? null,
      createdAt: token.createdAt,
    } as RefreshTokenRecord;
  }

  async revokeRefreshToken(id: string, replacedByTokenId?: string) {
    await RefreshTokenModel.updateOne(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: new Date(), replacedByTokenId: replacedByTokenId ?? null } },
      { strict: false }
    );
  }

  async revokeAllRefreshTokensForUser(userId: string) {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { strict: false }
    );
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    await PasswordResetTokenModel.create({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  async findPasswordResetTokenByHash(tokenHash: string) {
    const token = await PasswordResetTokenModel.findOne({ tokenHash }).lean();
    if (!token) return null;
    return {
      id: token._id.toString(),
      userId: token.userId.toString(),
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt ?? null,
      createdAt: token.createdAt,
    } as PasswordResetTokenRecord;
  }

  async markPasswordResetTokenUsed(id: string) {
    await PasswordResetTokenModel.updateOne(
      { _id: id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );
  }

  async audit(
    eventType: string,
    metadata: RequestMetadata & {
      actorUserId?: string;
      subjectUserId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await AuditLogModel.create({
      eventType,
      actorUserId: metadata.actorUserId,
      subjectUserId: metadata.subjectUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: metadata.metadata,
    });
  }
}
