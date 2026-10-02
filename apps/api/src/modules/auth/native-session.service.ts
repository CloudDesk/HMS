import { createHmac, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { sha256 } from '../../shared/security/hash.js';
import { signJwt, verifyJwt } from '../../shared/security/jwt.js';
import type { PatientPortalService } from '../patient-portal/patient-portal.service.js';
import type { AuthService } from './auth.service.js';
import type { RequestMetadata } from './auth.types.js';
import type { NativeLoginInput } from './native-auth.schemas.js';
import { NativeSessionRepository } from './native-session.repository.js';
import { AuthRateLimitRepository } from './auth-rate-limit.repository.js';

type Identity = NonNullable<Awaited<ReturnType<NativeSessionRepository['findIdentity']>>>;
type SessionRecord = NonNullable<Awaited<ReturnType<NativeSessionRepository['findSession']>>>;
const failure = (code: string, status = 401) => new AppError('Native authentication required', status, code);
const eligible = (user: Identity | null): user is Identity => Boolean(user && user.status === 'active'
  && (user.patientId || user.roles.some((role) => role === 'PATIENT' || role === 'GUARDIAN')));
const sessionView = (root: SessionRecord) => ({
  id: String(root._id), platform: root.native?.session?.platform,
  appVersion: root.native?.session?.appVersion, createdAt: root.createdAt,
  lastUsedAt: root.native?.session?.lastUsedAt, expiresAt: root.expiresAt,
});

export class NativeSessionService {
  constructor(private readonly repository = new NativeSessionRepository(),
    private readonly rateLimits = new AuthRateLimitRepository()) {}

  async login(input: NativeLoginInput, metadata: RequestMetadata,
    auth: AuthService, portal: PatientPortalService) {
    if (!env.auth.patientPortalDemoOtpEnabled || env.auth.patientPortalDemoOtp !== '1234') {
      throw new AppError('Fixed verification mode is required', 503, 'FIXED_OTP_REQUIRED');
    }
    await portal.assertOtpValidForPendingFlow(input.phone, input.otp, metadata);
    if (input.otp !== '1234') throw failure('INVALID_OTP');
    const status = await portal.getUnlinkedPatientLoginStatus(input.phone);
    if (status && status !== 'ACCOUNT_NOT_LINKED') {
      throw new AppError('Complete account setup in Patient Web or contact reception', 409, status);
    }
    const proof = await portal.verifyAndConsumeOtp(input.phone, input.otp);
    if (status === 'ACCOUNT_NOT_LINKED') {
      await portal.activateExistingPatientByPhone(input.phone, metadata);
    }
    let created: Awaited<ReturnType<NativeSessionService['create']>> | undefined;
    const result = await auth.loginPatientAfterOtpVerification(input.phone, proof, metadata, async (user) => {
      created = await this.create(user.id, input, metadata);
      return created.tokens;
    });
    if (!created) throw failure('SESSION_STORE_UNAVAILABLE', 503);
    return { ...result, session: created.session };
  }

  private async create(userId: string, input: NativeLoginInput, metadata: RequestMetadata) {
    return this.repository.transaction(async (transaction) => {
      const user = await this.repository.findIdentity(userId, transaction);
      if (!eligible(user)) throw failure('SESSION_NOT_ALLOWED', 403);
      const now = new Date();
      const id = new Types.ObjectId();
      const expiresAt = new Date(now.getTime() + env.auth.refreshTokenTtlSeconds * 1000);
      const refreshToken = randomBytes(48).toString('base64url');
      await this.repository.insertToken({ id: String(id), userId, token: sha256(refreshToken), expiresAt,
        native: { sessionId: id, session: { installationId: input.installationId,
          platform: input.platform, appVersion: input.appVersion, lastUsedAt: now } },
      }, transaction);
      await this.repository.audit('login', userId, String(id), metadata, transaction);
      return { tokens: this.tokens(user, String(id), expiresAt, refreshToken),
        session: { id: String(id), platform: input.platform, appVersion: input.appVersion,
          createdAt: now, lastUsedAt: now, expiresAt } };
    });
  }

  async refresh(refreshToken: string, metadata: RequestMetadata, auth: AuthService) {
    await this.limit('refresh', refreshToken, metadata);
    const outcome = await this.repository.transaction(async (transaction) => {
      const token = await this.repository.findToken(sha256(refreshToken), transaction);
      if (!token?.native) throw failure('INVALID_REFRESH_TOKEN');
      const now = new Date();
      if (token.expiresAt <= now) throw failure('REFRESH_TOKEN_EXPIRED');
      const id = String(token.native.sessionId);
      const userId = String(token.userId);
      const root = await this.repository.findSession(id, userId, transaction);
      this.assertSession(root, now);
      const user = await this.repository.findIdentity(userId, transaction);
      const denial = !eligible(user) ? 'SESSION_NOT_ALLOWED'
        : token.revokedAt ? 'SESSION_REVOKED' : token.native.replacedBy ? 'REFRESH_TOKEN_REUSED' : null;
      if (denial) {
        await this.repository.revokeSession(id, userId, now, transaction);
        await this.repository.audit(denial === 'REFRESH_TOKEN_REUSED' ? 'refresh.replay' : 'refresh.denied',
          userId, id, metadata, transaction);
        return { error: denial } as const; // Commit revocation BEFORE returning an error.
      }
      if (!eligible(user)) throw failure('SESSION_NOT_ALLOWED', 403);
      const replacementId = new Types.ObjectId();
      if (!await this.repository.replaceToken(String(token._id), String(replacementId), now, transaction)
        || !await this.repository.touchSession(id, now, transaction)) throw failure('SESSION_REVOKED');
      const replacement = randomBytes(48).toString('base64url');
      await this.repository.insertToken({ id: String(replacementId), userId, token: sha256(replacement),
        expiresAt: root.expiresAt, native: { sessionId: token.native.sessionId },
      }, transaction);
      await this.repository.audit('refresh', userId, id, metadata, transaction);
      return { userId, tokens: this.tokens(user, id, root.expiresAt, replacement),
        session: { ...sessionView(root), lastUsedAt: now } } as const;
    });
    if (outcome.error !== undefined) throw failure(outcome.error, outcome.error === 'SESSION_NOT_ALLOWED' ? 403 : 401);
    return { user: await auth.getCurrentUser(outcome.userId), tokens: outcome.tokens, session: outcome.session };
  }

  async authenticate(id: string, userId: string) {
    if (!/^[a-f\d]{24}$/i.test(id) || !/^[a-f\d]{24}$/i.test(userId)) throw failure('INVALID_TOKEN');
    const root = await this.repository.findSession(id, userId);
    this.assertSession(root, new Date());
    if (!eligible(await this.repository.findIdentity(userId))) {
      await this.repository.transaction(async (transaction) => {
        await this.repository.revokeSession(id, userId, new Date(), transaction);
        await this.repository.audit('access.denied', userId, id, {}, transaction);
      });
      throw failure('SESSION_NOT_ALLOWED', 403);
    }
  }

  async logout(refreshToken: string | undefined, bearer: string | undefined, metadata: RequestMetadata) {
    if (!refreshToken && !bearer) throw failure('AUTHENTICATION_REQUIRED');
    await this.limit('logout', refreshToken ?? bearer ?? '', metadata);
    // Refresh proof independently authorizes logout, even if an accompanying access JWT expired.
    let access: { sub: string; sid: string } | undefined;
    if (bearer) {
      try {
        const payload = verifyJwt(bearer, env.auth.accessTokenSecret);
        if (payload.aud !== 'hms-patient-mobile' || !payload.sid) throw failure('INVALID_TOKEN');
        if (!refreshToken) await this.authenticate(payload.sid, payload.sub);
        access = { sub: payload.sub, sid: payload.sid };
      } catch (error) {
        if (!(refreshToken && error instanceof AppError && error.code === 'TOKEN_EXPIRED')) throw error;
      }
    }
    await this.repository.transaction(async (transaction) => {
      const token = refreshToken ? await this.repository.findToken(sha256(refreshToken), transaction) : null;
      if (access && refreshToken && (!token?.native || String(token.userId) !== access.sub
        || String(token.native.sessionId) !== access.sid)) throw failure('SESSION_CREDENTIAL_MISMATCH', 400);
      const id = token?.native ? String(token.native.sessionId) : access?.sid;
      const userId = token ? String(token.userId) : access?.sub;
      if (!id || !userId) return; // Unknown well-formed proof: generic idempotent success.
      await this.repository.revokeSession(id, userId, new Date(), transaction);
      await this.repository.audit('logout', userId, id, metadata, transaction);
    });
    return { ok: true };
  }

  private assertSession(root: SessionRecord | null, now: Date): asserts root is SessionRecord {
    if (!root?.native?.session || root.revokedAt || root.native.session.revokedAt) throw failure('SESSION_REVOKED');
    if (root.expiresAt <= now) throw failure('SESSION_EXPIRED');
  }

  private tokens(user: Identity, id: string, expiresAt: Date, refreshToken: string) {
    const refreshExpiresIn = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    if (refreshExpiresIn < 1) throw failure('SESSION_EXPIRED');
    const expiresIn = Math.min(env.auth.accessTokenTtlSeconds, refreshExpiresIn);
    return { accessToken: signJwt({ sub: user.id, username: user.username,
      aud: 'hms-patient-mobile', sid: id }, env.auth.accessTokenSecret, expiresIn),
    refreshToken, tokenType: 'Bearer' as const, expiresIn, refreshExpiresIn };
  }

  private async limit(action: string, proof: string, metadata: RequestMetadata) {
    const now = new Date();
    const keys = [{ scope: `native-${action}-proof`, value: proof, limit: 30 },
      ...(metadata.ipAddress ? [{ scope: `native-${action}-ip`, value: metadata.ipAddress, limit: 120 }] : [])];
    for (const key of keys) {
      const hash = createHmac('sha256', env.auth.accessTokenSecret).update(key.value).digest('hex');
      if (!await this.rateLimits.consume(key.scope, hash, key.limit, 60, now, { retryInsertRace: true })) {
        throw new AppError('Too many authentication requests. Try again later.', 429, 'AUTH_RATE_LIMITED');
      }
    }
  }
}
