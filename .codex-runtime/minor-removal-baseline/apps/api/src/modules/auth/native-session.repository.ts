import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { UserModel } from '../users/user.model.js';
import { RoleModel } from '../roles/role.model.js';
import { AuditLogModel } from './auth.model.js';
import { RefreshTokenModel, type NativeRefreshMetadata } from './refresh-token.model.js';
import type { RequestMetadata } from './auth.types.js';

export class NativeSessionRepository {
  // Deliberately does not use executeTransaction: its standalone fallback is unsafe here.
  async transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => operation(session), {
        readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Native session storage is unavailable', 503, 'SESSION_STORE_UNAVAILABLE');
    } finally {
      await session.endSession();
    }
  }

  findToken(hash: string, session?: ClientSession) {
    return RefreshTokenModel.findOne({ token: hash, 'native.sessionId': { $exists: true } })
      .session(session ?? null).lean();
  }

  findSession(id: string, userId?: string, session?: ClientSession) {
    return RefreshTokenModel.findOne({
      _id: id, 'native.sessionId': id, 'native.session': { $exists: true },
      ...(userId ? { userId } : {}),
    }).session(session ?? null).lean();
  }

  async findIdentity(userId: string, session?: ClientSession) {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null })
      .select('username status patientId roleIds').session(session ?? null).lean();
    if (!user) return null;
    const roles = await RoleModel.find({
      _id: { $in: user.roleIds }, status: 'active', deletedAt: null,
    }).select('code').session(session ?? null).lean();
    return { id: String(user._id), username: user.username, status: user.status,
      patientId: user.patientId, roles: roles.map((role) => role.code) };
  }

  async insertToken(input: {
    id: string; userId: string; token: string; expiresAt: Date; native: NativeRefreshMetadata;
  }, session: ClientSession) {
    await RefreshTokenModel.create([{ _id: input.id, userId: input.userId,
      token: input.token, expiresAt: input.expiresAt, native: input.native }], { session });
  }

  async replaceToken(id: string, replacementId: string, now: Date, session: ClientSession) {
    const result = await RefreshTokenModel.updateOne({
      _id: id, 'native.replacedBy': null, revokedAt: null, expiresAt: { $gt: now },
    }, { $set: { 'native.replacedBy': new Types.ObjectId(replacementId) } }, { session });
    return result.matchedCount === 1;
  }

  async touchSession(id: string, now: Date, session: ClientSession) {
    const result = await RefreshTokenModel.updateOne({
      _id: id, 'native.session.revokedAt': null, revokedAt: null, expiresAt: { $gt: now },
    }, { $set: { 'native.session.lastUsedAt': now } }, { session });
    return result.matchedCount === 1;
  }

  async revokeSession(id: string, userId: string, now: Date, session: ClientSession) {
    await RefreshTokenModel.updateOne({
      _id: id, userId, 'native.session': { $exists: true }, 'native.session.revokedAt': null,
    }, { $set: { 'native.session.revokedAt': now } }, { session });
  }

  async audit(event: string, userId: string, sessionId: string,
    metadata: RequestMetadata, session: ClientSession) {
    await AuditLogModel.create([{
      eventType: `auth.native.${event}`, actorUserId: userId, subjectUserId: userId,
      ipAddress: metadata.ipAddress, userAgent: metadata.userAgent,
      metadataJson: { sessionId },
    }], { session });
  }
}
