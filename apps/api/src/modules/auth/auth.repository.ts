import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { PasswordResetTokenModel, AuditLogModel } from './auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthAccessContext, AuthUserRecord, AuthUserStatus, PasswordResetTokenRecord, RefreshTokenRecord, RequestMetadata } from './auth.types.js';

import type { IUser } from '../users/user.model.js';

type UserLean = Pick<IUser, 'employeeCode' | 'username' | 'email' | 'fullName' | 'patientId' | 'passwordHash' | 'status' | 'failedLoginAttempts' | 'lockedUntil' | 'passwordChangedAt' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> & { _id: unknown };

const mapUser = (user: UserLean): AuthUserRecord => ({
  id: String(user._id),
  employeeCode: user.employeeCode ?? null,
  username: user.username,
  email: user.email ?? null,
  fullName: user.fullName ?? user.username, // Provide fallback for auth mappings
  patientId: user.patientId?.toString() ?? null,
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
  async getUserAccessContext(userId: string): Promise<AuthAccessContext> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('roleIds branchIds')
      .lean();

    if (!user) {
      return { branches: [], permissions: [], roles: [] };
    }

    const [roles, branches] = await Promise.all([
      RoleModel.find({ _id: { $in: user.roleIds ?? [] }, status: 'active', deletedAt: null })
        .select('_id code name permissionIds')
        .sort({ name: 1 })
        .lean(),
      BranchModel.find({ _id: { $in: user.branchIds ?? [] }, status: 'ACTIVE', deletedAt: null })
        .select('_id code name')
        .sort({ name: 1 })
        .lean(),
    ]);

    const isSuperAdmin = roles.some((role) => role.code === 'SUPER_ADMIN');
    const permissionIds = [...new Set(roles.flatMap((role) => role.permissionIds ?? []).map(String))];
    const permissions = await PermissionModel.find({
      ...(isSuperAdmin ? {} : { _id: { $in: permissionIds } }),
      status: 'active',
      deletedAt: null,
    })
      .select('code module screen action')
      .sort({ module: 1, screen: 1, action: 1 })
      .lean();

    return {
      branches: branches.map((branch) => ({
        id: String(branch._id),
        code: branch.code,
        name: branch.name,
      })),
      permissions: permissions.map((permission) => ({
        code: permission.code,
        module: permission.module,
        screen: permission.screen,
        action: permission.action,
      })),
      roles: roles.map((role) => ({
        id: String(role._id),
        code: role.code,
        name: role.name,
      })),
    };
  }

  async findUserById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).lean();
    return user ? mapUser(user) : null;
  }

  async findUserByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const escapedIdentifier = normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(`^${escapedIdentifier}$`, 'i');
    const normalizedPhone = identifier.trim().replace(/\D/g, '');
    const phoneCandidates = [identifier.trim(), normalizedPhone, `+${normalizedPhone}`];
    
    const user = await UserModel.findOne({
      deletedAt: null,
      $or: [{ username: searchRegex }, { email: searchRegex }, { phone: { $in: phoneCandidates } }]
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
      user.status = 'locked'; // Ensure auth type matches
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
      revokedAt: (token as { revokedAt?: Date }).revokedAt ?? null,
      replacedByTokenId: (token as { replacedByTokenId?: string }).replacedByTokenId ?? null,
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
