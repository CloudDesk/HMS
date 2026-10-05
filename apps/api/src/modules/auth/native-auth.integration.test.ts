import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { hashPassword, sha256 } from '../../shared/security/hash.js';
import { signJwt, verifyJwt } from '../../shared/security/jwt.js';
import { PatientModel } from '../patients/patient.model.js';
import { PatientAccessGrantModel } from '../patient-portal/patient-access-grant.model.js';
import { PatientPortalRepository } from '../patient-portal/patient-portal.repository.js';
import { OtpChallengeModel } from '../patient-portal/otp-challenge.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { AuditLogModel } from './auth.model.js';
import { NativeSessionRepository } from './native-session.repository.js';
import { NativeSessionService } from './native-session.service.js';
import { AuthRateLimitRepository } from './auth-rate-limit.repository.js';
import { AuthRateLimitModel } from './auth-rate-limit.model.js';

const prefix = '/api/patient-portal/mobile/auth';
const phone = '27821234567';
type NativeResponse = { data: { user: { id: string }; tokens: {
  accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number;
}; session: { id: string; expiresAt: string } } };

const withFixedClock = async (operation: () => Promise<void>) => {
  // Rate-limit assertions concern one window, not a wall-clock bucket rollover.
  // Keep driver/network timers real while making Date deterministic.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2030-01-01T00:00:05Z'));
  try { await operation(); } finally { vi.useRealTimers(); }
};

describe('native authentication and protected web compatibility (replica set)', () => {
  let mongodb: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let services: Awaited<ReturnType<typeof buildApp>>['services'];
  let userId: string;
  const originalMode = { enabled: env.auth.patientPortalDemoOtpEnabled, otp: env.auth.patientPortalDemoOtp };

  beforeAll(async () => {
    env.auth.patientPortalDemoOtpEnabled = true;
    env.auth.patientPortalDemoOtp = '1234';
    mongodb = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongodb.getUri());
    ({ app, services } = await buildApp());
    await Promise.all([RefreshTokenModel.init(), AuditLogModel.init(), UserModel.init(),
      RoleModel.init(), OtpChallengeModel.init(), PatientAccessGrantModel.init(), PatientModel.init()]);
  });
  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
    env.auth.patientPortalDemoOtpEnabled = originalMode.enabled;
    env.auth.patientPortalDemoOtp = originalMode.otp;
  });
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
    const role = await RoleModel.create({ code: 'PATIENT', name: 'Patient', status: 'active', permissionIds: [] });
    const user = await UserModel.create({ username: 'native-patient', email: 'native@example.test', fullName: 'Native Patient', phone,
      passwordHash: await hashPassword('ValidPassword1!'), roleIds: [role._id], status: 'active' });
    userId = String(user._id);
  });

  const challenge = async () => {
    await OtpChallengeModel.deleteMany({ phone });
    await OtpChallengeModel.create({ phone, otpHash: sha256(`${phone}:1234`),
      expiresAt: new Date(Date.now() + 300_000), resendAvailableAt: new Date(Date.now() + 60_000),
      attempts: 0, verifiedAt: null });
  };
  const login = async () => {
    await challenge();
    const response = await app.inject({ method: 'POST', url: `${prefix}/login/otp`, payload: {
      phone, otp: '1234', installationId: randomUUID(), platform: 'android', appVersion: '1.0.0',
    } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    return response.json<NativeResponse>().data;
  };
  const refresh = (refreshToken: string) => app.inject({ method: 'POST', url: `${prefix}/refresh`, payload: { refreshToken } });
  const me = (accessToken: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${accessToken}` } });
  const logout = (refreshToken: string, accessToken?: string) => app.inject({ method: 'POST', url: `${prefix}/logout`,
    payload: { refreshToken }, ...(accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {}) });

  describe.each(['web', 'native'] as const)('%s OTP user identity resolution', (client) => {
    const attempt = () => app.inject({ method: 'POST',
      url: client === 'web' ? '/api/patient-portal/login/otp' : `${prefix}/login/otp`,
      payload: client === 'web' ? { phone, otp: '1234' }
        : { phone, otp: '1234', installationId: randomUUID(), platform: 'android' },
    });

    it('authenticates the same guardian user with PARENT and SELF patient relationships', async () => {
      const guardianRole = await RoleModel.create({ code: 'GUARDIAN', name: 'Guardian', status: 'active', permissionIds: [] });
      const [child, father] = await PatientModel.create([
        { patientNumber: 'CHILD', firstName: 'Child', lastName: 'Patient', dateOfBirth: new Date('2020-01-01'), gender: 'UNKNOWN', phone, status: 'ACTIVE' },
        { patientNumber: 'FATHER', firstName: 'Father', lastName: 'Patient', dateOfBirth: new Date('1980-01-01'), gender: 'UNKNOWN', phone, status: 'ACTIVE' },
      ]);
      if (!child || !father) throw new Error('Missing test patients');
      await UserModel.updateOne({ _id: userId }, { $set: { patientId: father._id, roleIds: [guardianRole._id] } });
      await PatientAccessGrantModel.create([
        { userId, patientId: child._id, relationship: 'PARENT', status: 'VERIFIED' },
        { userId, patientId: father._id, relationship: 'SELF', status: 'VERIFIED' },
      ]);
      const grantsBefore = await PatientAccessGrantModel.find().sort({ _id: 1 }).lean();
      await challenge();
      const response = await attempt();
      expect(response.statusCode, response.body).toBe(200);
      const result = response.json<NativeResponse>().data;
      expect(result.user.id).toBe(userId);
      expect(verifyJwt(result.tokens.accessToken, env.auth.accessTokenSecret).sub).toBe(userId);
      expect(String((await RefreshTokenModel.findOne().orFail()).userId)).toBe(userId);
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await PatientModel.countDocuments()).toBe(2);
      expect(await PatientAccessGrantModel.find().sort({ _id: 1 }).lean()).toEqual(grantsBefore);
    });

    it.each(['active', 'inactive', 'locked'])('rejects multiple phone owners even when another owner is %s', async (status) => {
      await UserModel.create({ username: 'other-user', email: 'other@example.test', fullName: 'Other User',
        phone: `+${phone}`, passwordHash: 'test-only', status });
      await challenge();
      const response = await attempt();
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
      expect(await UserModel.countDocuments()).toBe(2);
      expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
      expect((await OtpChallengeModel.findOne({ phone }).orFail()).verifiedAt).toBeTruthy();
    });

    it('ignores a username matching the phone and a deleted phone owner', async () => {
      await UserModel.create([
        { username: phone, email: 'username@example.test', fullName: 'Username Match', phone: '27829999999', passwordHash: 'test-only' },
        { username: 'deleted-owner', email: 'deleted@example.test', fullName: 'Deleted User', phone, passwordHash: 'test-only', deletedAt: new Date() },
      ]);
      await challenge();
      const response = await attempt();
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json<NativeResponse>().data.user.id).toBe(userId);
    });

    it('does not authenticate a username-only match after phone verification', async () => {
      await UserModel.updateOne({ _id: userId }, { $set: { username: phone, phone: '27829999999' } });
      await challenge();
      const proof = await services.patientPortal.verifyAndConsumeOtp(phone, '1234');
      await expect(services.auth.loginPatientAfterOtpVerification(phone, proof, {}))
        .rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });
  });

  describe.each(['web', 'native'] as const)('%s age-independent patient login', (client) => {
    const attempt = (otp = '1234') => app.inject({ method: 'POST',
      url: client === 'web' ? '/api/patient-portal/login/otp' : `${prefix}/login/otp`,
      payload: client === 'web' ? { phone, otp }
        : { phone, otp, installationId: randomUUID(), platform: 'android' },
    });
    const patient = async (number = 'AGE-1') => PatientModel.create({
      patientNumber: number, firstName: 'Age', lastName: 'Patient',
      dateOfBirth: new Date('2020-01-01'), gender: 'UNKNOWN', phone,
      status: 'ACTIVE', deletedAt: null,
    });

    it.each(['2020-01-01', '2010-01-01', '1990-01-01'])('activates and logs in DOB %s after OTP', async (dob) => {
      await UserModel.deleteMany({});
      const record = await patient();
      await PatientModel.updateOne({ _id: record._id }, { $set: { dateOfBirth: new Date(dob) } });
      await challenge();
      const response = await attempt();
      expect(response.statusCode, response.body).toBe(200);
      const owner = await UserModel.findOne({ patientId: record._id }).lean();
      expect(owner?.status).toBe('active');
      expect(await PatientAccessGrantModel.findOne({ patientId: record._id, userId: owner?._id }).lean())
        .toMatchObject({ relationship: 'SELF', status: 'VERIFIED', isPrimary: true });
      expect(await PatientModel.countDocuments()).toBe(1);
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await RefreshTokenModel.countDocuments()).toBe(1);
      expect(response.body).not.toContain('MINOR_GUARDIAN_ACCOUNT_REQUIRED');
      if (client === 'native') {
        expect(response.headers['set-cookie']).toBeUndefined();
        const result = response.json<NativeResponse>().data;
        expect(verifyJwt(result.tokens.accessToken, env.auth.accessTokenSecret))
          .toMatchObject({ aud: 'hms-patient-mobile', sid: result.session.id });
      } else {
        expect(String(response.headers['set-cookie'])).toContain('hms-patient-refresh-token=');
        expect(String(response.headers['set-cookie']).toLowerCase()).toContain('httponly');
        expect(response.body).not.toContain('refreshToken');
      }
      expect((await attempt()).statusCode).toBe(401);
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await RefreshTokenModel.countDocuments()).toBe(1);
    });

    it('does not activate without a requested, valid OTP', async () => {
      await UserModel.deleteMany({});
      await patient();
      expect((await attempt()).statusCode).toBe(401);
      await challenge();
      expect((await attempt('9999')).statusCode).toBe(401);
      expect(await UserModel.countDocuments()).toBe(0);
      expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it.each(['expired', 'consumed'] as const)('does not activate with an %s challenge', async (state) => {
      await UserModel.deleteMany({});
      await patient();
      await challenge();
      await OtpChallengeModel.updateOne({ phone }, { $set: state === 'expired'
        ? { expiresAt: new Date(Date.now() - 1000) } : { verifiedAt: new Date() } });
      expect((await attempt()).statusCode).toBe(401);
      expect(await UserModel.countDocuments()).toBe(0);
      expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it('requires an OTP field before activating', async () => {
      await UserModel.deleteMany({});
      await patient();
      await challenge();
      const response = await app.inject({ method: 'POST',
        url: client === 'web' ? '/api/patient-portal/login/otp' : `${prefix}/login/otp`,
        payload: { phone, installationId: randomUUID(), platform: 'android' } });
      expect(response.statusCode).toBe(400);
      expect(await UserModel.countDocuments()).toBe(0);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it.each(['active', 'inactive'] as const)('preserves an existing %s direct owner on another phone', async (status) => {
      const record = await patient();
      await UserModel.updateOne({ _id: userId }, { $set: { phone: '27820000000', patientId: record._id, status } });
      await challenge();
      const response = await attempt();
      expect(response.statusCode).toBe(status === 'active' ? 401 : 409);
      expect(await UserModel.countDocuments()).toBe(1);
      expect(String((await UserModel.findById(userId).lean())?.patientId)).toBe(String(record._id));
      expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it('rejects duplicate patient matches without creating an account', async () => {
      await UserModel.deleteMany({});
      await patient();
      await patient('AGE-2');
      await challenge();
      const response = await attempt();
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'MULTIPLE_PATIENT_MATCHES' } });
      expect(await UserModel.countDocuments()).toBe(0);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it.each(['inactive', 'locked'])('still rejects a %s existing account', async (status) => {
      await UserModel.updateOne({ _id: userId }, { $set: { status } });
      await challenge();
      expect((await attempt()).statusCode).toBe(401);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });

    it('does not take over a patient with an existing guardian grant', async () => {
      const record = await patient();
      await UserModel.updateOne({ _id: userId }, { $set: { phone: '27820000000' } });
      await PatientAccessGrantModel.create({ userId, patientId: record._id,
        relationship: 'PARENT', status: 'VERIFIED' });
      await challenge();
      const response = await attempt();
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'PATIENT_AUTOMATIC_LINK_NOT_AVAILABLE' } });
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await PatientAccessGrantModel.countDocuments()).toBe(1);
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    });
  });

  it('issues hashed credentials without cookies; uses the existing authenticated resource path', async () => {
    const result = await login();
    expect(result.user.id).toBe(userId);
    expect(verifyJwt(result.tokens.accessToken, env.auth.accessTokenSecret)).toMatchObject({
      sub: userId, sid: result.session.id, aud: 'hms-patient-mobile',
    });
    const stored = await RefreshTokenModel.findOne({ token: sha256(result.tokens.refreshToken) }).lean();
    expect(stored?.native?.session?.platform).toBe('android');
    expect(JSON.stringify(stored)).not.toContain(result.tokens.refreshToken);
    expect((await me(result.tokens.accessToken)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/auth/me?token=${result.tokens.accessToken}` })).statusCode).toBe(401);
  });

  it('fixed OTP request never invokes the sender and preserves cooldown', async () => {
    const sender = vi.spyOn(services.sms, 'sendSms').mockRejectedValue(new Error('Must never send'));
    const request = () => app.inject({ method: 'POST', url: '/api/patient-portal/otp/request', payload: { phone } });
    expect((await request()).statusCode).toBe(200);
    expect((await OtpChallengeModel.findOne({ phone }).lean())?.otpHash).toBe(sha256(`${phone}:1234`));
    expect((await request()).statusCode).toBe(429);
    expect(sender).not.toHaveBeenCalled();
  });

  it('rejects wrong, expired, exhausted, reused and never-requested OTPs', async () => {
    const attempt = (otp = '1234') => app.inject({ method: 'POST', url: `${prefix}/login/otp`,
      payload: { phone, otp, installationId: randomUUID(), platform: 'ios' } });
    expect((await attempt()).statusCode).toBe(401);
    await challenge();
    for (let i = 0; i < 3; i++) expect((await attempt('9999')).statusCode).toBe(401);
    expect((await attempt()).json()).toMatchObject({ error: { code: 'MAX_ATTEMPTS_EXCEEDED' } });
    await challenge();
    await OtpChallengeModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await attempt()).statusCode).toBe(401);
    await challenge();
    expect((await attempt()).statusCode).toBe(200);
    expect((await attempt()).statusCode).toBe(401);
    expect(await RefreshTokenModel.countDocuments()).toBe(1);
  });

  it.each(['inactive', 'locked', 'unauthorized', 'unknown'] as const)('denies %s account without issuing tokens', async (state) => {
    await challenge();
    if (state === 'unknown') await UserModel.deleteMany({});
    else if (state === 'unauthorized') await UserModel.updateOne({ _id: userId }, { $set: { roleIds: [] } });
    else await UserModel.updateOne({ _id: userId }, { $set: { status: state } });
    const response = await app.inject({ method: 'POST', url: `${prefix}/login/otp`, payload: {
      phone, otp: '1234', installationId: randomUUID(), platform: 'android',
    } });
    expect(response.statusCode).toBe(state === 'unknown' ? 409 : 401);
    expect(await RefreshTokenModel.countDocuments()).toBe(0);
  });

  it('supports existing guardian identity without changing grants', async () => {
    await RoleModel.updateMany({}, { $set: { code: 'GUARDIAN' } });
    const result = await login();
    expect((await me(result.tokens.accessToken)).statusCode).toBe(200);
    expect(await PatientAccessGrantModel.countDocuments()).toBe(0);
  });

  it('shares OTP verification identity limits across web and native login', async () => withFixedClock(async () => {
    // Invalid challenges still consume the public verification budget.
    for (let attempt = 0; attempt < env.auth.otpVerificationIdentityLimit; attempt++) {
      const response = await app.inject({ method: 'POST',
        url: attempt % 2 ? '/api/patient-portal/login/otp' : `${prefix}/login/otp`,
        payload: attempt % 2 ? { phone, otp: '1234' }
          : { phone, otp: '1234', installationId: randomUUID(), platform: 'ios' },
      });
      expect(response.statusCode).toBe(401);
    }
    await challenge();
    const limited = await app.inject({ method: 'POST', url: `${prefix}/login/otp`, payload: {
      phone, otp: '1234', installationId: randomUUID(), platform: 'ios',
    } });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED' } });
    expect(await RefreshTokenModel.countDocuments()).toBe(0);
  }));

  it('enforces native verification IP limits across different phones', async () => withFixedClock(async () => {
    for (let attempt = 0; attempt <= env.auth.otpVerificationIpLimit; attempt++) {
      const response = await app.inject({ method: 'POST', url: `${prefix}/login/otp`, payload: {
        phone: `2782199${String(attempt).padStart(4, '0')}`, otp: '1234', installationId: randomUUID(), platform: 'ios',
      } });
      expect(response.statusCode).toBe(attempt === env.auth.otpVerificationIpLimit ? 429 : 401);
    }
    expect(await RefreshTokenModel.countDocuments()).toBe(0);
  }));

  it('preserves the complete web OTP, authenticated context, cookie refresh and logout contract', async () => {
    const sender = vi.spyOn(services.sms, 'sendSms').mockRejectedValue(new Error('No delivery'));
    expect((await app.inject({ method: 'POST', url: '/api/patient-portal/otp/request', payload: { phone } })).statusCode).toBe(200);
    const web = await app.inject({ method: 'POST', url: '/api/patient-portal/login/otp', payload: { phone, otp: '1234' } });
    expect(web.statusCode).toBe(200);
    const webData = web.json<{ data: { tokens: { accessToken: string } } }>().data;
    expect(Object.keys(webData.tokens).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
    const jwt = verifyJwt(webData.tokens.accessToken, env.auth.accessTokenSecret);
    expect(jwt.sid).toBeUndefined();
    expect(jwt.aud).toBeUndefined();
    expect((await me(webData.tokens.accessToken)).statusCode).toBe(200);
    const context = await app.inject({ method: 'GET', url: '/api/patient-portal/context', headers: {
      authorization: `Bearer ${webData.tokens.accessToken}`,
    } });
    expect(context.statusCode).toBe(200);
    const native = await login();
    const nativeContext = await app.inject({ method: 'GET', url: '/api/patient-portal/context', headers: {
      authorization: `Bearer ${native.tokens.accessToken}`,
    } });
    expect(nativeContext.statusCode).toBe(200);
    expect(nativeContext.json()).toEqual(context.json());
    const header = web.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header[0] : header)?.split(';')[0] ?? '';
    const rotation = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie }, payload: {} });
    expect(rotation.statusCode).toBe(200);
    expect(rotation.body).not.toContain('refreshToken');
    const newHeader = rotation.headers['set-cookie'];
    const newCookie = (Array.isArray(newHeader) ? newHeader[0] : newHeader)?.split(';')[0] ?? '';
    const accessToken = rotation.json<{ data: { tokens: { accessToken: string } } }>().data.tokens.accessToken;
    const signOut = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: {
      cookie: newCookie, authorization: `Bearer ${accessToken}`,
    }, payload: {} });
    expect(signOut.statusCode).toBe(200);
    expect(String(signOut.headers['set-cookie'])).toContain('Max-Age=0');
    expect((await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: newCookie }, payload: {} })).statusCode).toBe(401);
    expect((await me(native.tokens.accessToken)).statusCode).toBe(200);
    expect(sender).not.toHaveBeenCalled();
  });

  it('rejects native login if fixed-code configuration is not selected', async () => {
    const mode = env.auth.patientPortalDemoOtpEnabled;
    try {
      env.auth.patientPortalDemoOtpEnabled = false;
      const response = await app.inject({ method: 'POST', url: `${prefix}/login/otp`, payload: {
        phone, otp: '1234', installationId: randomUUID(), platform: 'ios',
      } });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: { code: 'FIXED_OTP_REQUIRED' } });
      expect(await RefreshTokenModel.countDocuments()).toBe(0);
    } finally { env.auth.patientPortalDemoOtpEnabled = mode; }
  });

  it('inactive detection revokes the session permanently even if the account is later active', async () => {
    const original = await login();
    await UserModel.updateOne({ _id: userId }, { $set: { status: 'inactive' } });
    expect((await me(original.tokens.accessToken)).statusCode).toBe(403);
    await UserModel.updateOne({ _id: userId }, { $set: { status: 'active' } });
    expect((await refresh(original.tokens.refreshToken)).statusCode).toBe(401);
  });

  it('concurrent logout and refresh cannot leave a usable replacement', async () => {
    const original = await login();
    const [rotation, signOut] = await Promise.all([refresh(original.tokens.refreshToken), logout(original.tokens.refreshToken)]);
    expect(signOut.statusCode).toBe(200);
    expect([200, 401]).toContain(rotation.statusCode);
    expect((await me(original.tokens.accessToken)).statusCode).toBe(401);
    if (rotation.statusCode === 200) expect((await refresh(rotation.json<NativeResponse>().data.tokens.refreshToken)).statusCode).toBe(401);
  });

  it('rotates once, retains absolute expiry and revokes family on replay/lost-response retry', async () => {
    const original = await login();
    const response = await refresh(original.tokens.refreshToken);
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    const next = response.json<NativeResponse>().data;
    expect(next.tokens.refreshToken).not.toBe(original.tokens.refreshToken);
    expect(next.session.id).toBe(original.session.id);
    expect(next.session.expiresAt).toBe(original.session.expiresAt);
    expect((await refresh(original.tokens.refreshToken)).json()).toMatchObject({ error: { code: 'REFRESH_TOKEN_REUSED' } });
    expect((await refresh(next.tokens.refreshToken)).statusCode).toBe(401);
    expect((await me(next.tokens.accessToken)).statusCode).toBe(401);
    const anchor = await RefreshTokenModel.findById(original.session.id).lean();
    expect(anchor?.native?.session?.revokedAt).toBeInstanceOf(Date);
  });

  it('concurrent refresh commits at most one replacement and replay revocation persists', async () => {
    const original = await login();
    const responses = await Promise.all([refresh(original.tokens.refreshToken), refresh(original.tokens.refreshToken)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
    expect(await RefreshTokenModel.countDocuments()).toBe(2);
    expect((await me(original.tokens.accessToken)).statusCode).toBe(401);
    expect(await AuditLogModel.countDocuments({ eventType: 'auth.native.refresh' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'auth.native.refresh.replay' })).toBe(1);
  });

  it('native limiter retries an insert race without allowing an exhausted bucket', async () => {
    const limiter = new AuthRateLimitRepository();
    const now = new Date();
    expect(await limiter.consume('native-test', 'key', 2, 60, now)).toBe(true);
    // The other request has inserted the bucket after our first operation began.
    const update = vi.spyOn(AuthRateLimitModel, 'findOneAndUpdate');
    update.mockRejectedValueOnce(Object.assign(new Error('Concurrent insert'), { code: 11000 }));
    expect(await limiter.consume('native-test', 'key', 2, 60, now, { retryInsertRace: true })).toBe(true);
    expect(await limiter.consume('native-test', 'key', 2, 60, now, { retryInsertRace: true })).toBe(false);
    expect((await AuthRateLimitModel.findOne({ scope: 'native-test' }).lean())?.count).toBe(2);
    update.mockRejectedValueOnce(Object.assign(new Error('Concurrent insert'), { code: 11000 }));
    expect(await limiter.consume('legacy-test', 'key', 2, 60, now)).toBe(false);
  });

  it('transaction failure rolls back consumption, replacement and audit without fallback', async () => {
    const original = await login();
    const repository = new NativeSessionRepository();
    vi.spyOn(repository, 'insertToken').mockRejectedValue(new Error('Injected storage failure'));
    const service = new NativeSessionService(repository);
    await expect(service.refresh(original.tokens.refreshToken, {}, services.auth)).rejects.toMatchObject({ code: 'SESSION_STORE_UNAVAILABLE' });
    expect((await RefreshTokenModel.findById(original.session.id).lean())?.native?.replacedBy).toBeUndefined();
    expect(await RefreshTokenModel.countDocuments()).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'auth.native.refresh' })).toBe(0);
    expect((await refresh(original.tokens.refreshToken)).statusCode).toBe(200);
  });

  it.each(['expired', 'revoked', 'inactive', 'locked', 'roleRemoved'] as const)('denies refresh for %s session/account', async (state) => {
    const original = await login();
    if (state === 'expired') await RefreshTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    else if (state === 'revoked') await logout(original.tokens.refreshToken);
    else if (state === 'roleRemoved') await UserModel.updateOne({ _id: userId }, { $set: { roleIds: [] } });
    else await UserModel.updateOne({ _id: userId }, { $set: { status: state } });
    expect([401, 403]).toContain((await refresh(original.tokens.refreshToken)).statusCode);
    expect(await RefreshTokenModel.countDocuments()).toBe(1);
    expect([401, 403]).toContain((await me(original.tokens.accessToken)).statusCode);
  });

  it('logout revokes current session only; web and other mobile sessions remain valid', async () => {
    const first = await login();
    const second = await login();
    const web = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {
      identifier: 'native-patient', password: 'ValidPassword1!',
    } });
    expect(web.statusCode).toBe(200);
    const header = web.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header[0] : header)?.split(';')[0];
    expect((await logout(first.tokens.refreshToken, first.tokens.accessToken)).statusCode).toBe(200);
    expect((await logout(first.tokens.refreshToken, first.tokens.accessToken)).statusCode).toBe(200);
    expect((await me(first.tokens.accessToken)).statusCode).toBe(401);
    expect((await refresh(second.tokens.refreshToken)).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookie ?? '' }, payload: {} })).statusCode).toBe(200);
  });

  it('valid refresh proof authorizes logout with expired access; old rotated proof also revokes family', async () => {
    const original = await login();
    const rotated = await refresh(original.tokens.refreshToken);
    expect(rotated.statusCode).toBe(200);
    const expired = signJwt({ sub: userId, username: 'native-patient', aud: 'hms-patient-mobile', sid: original.session.id }, env.auth.accessTokenSecret, -1);
    expect((await logout(original.tokens.refreshToken, expired)).statusCode).toBe(200);
    expect((await me(rotated.json<NativeResponse>().data.tokens.accessToken)).statusCode).toBe(401);
  });

  it('enforces proof ownership and denies missing/malformed proof without revoking another session', async () => {
    const first = await login();
    const second = await login();
    expect((await logout(first.tokens.refreshToken, second.tokens.accessToken)).statusCode).toBe(400);
    expect((await logout('a'.repeat(64))).statusCode).toBe(200);
    expect((await logout('invalid')).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `${prefix}/logout`, payload: {} })).statusCode).toBe(401);
    expect((await me(first.tokens.accessToken)).statusCode).toBe(200);
    expect((await me(second.tokens.accessToken)).statusCode).toBe(200);
  });

  it('allows access-only logout and rejects cookie/native refresh interchange', async () => {
    const native = await login();
    expect((await app.inject({ method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: `hms-refresh-token=${native.tokens.refreshToken}` }, payload: {} })).statusCode).toBe(401);
    await challenge();
    const web = await app.inject({ method: 'POST', url: '/api/patient-portal/login/otp', payload: { phone, otp: '1234' } });
    expect(web.statusCode).toBe(200);
    expect(web.body).not.toContain('refreshToken');
    const header = web.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header[0] : header)?.split(';')[0] ?? '';
    const webProof = cookie.slice('hms-refresh-token='.length);
    expect((await refresh(webProof)).statusCode).toBe(401);
    expect((await logout(webProof)).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie }, payload: {} })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `${prefix}/logout`, headers: { authorization: `Bearer ${native.tokens.accessToken}` }, payload: {} })).statusCode).toBe(200);
    expect((await me(native.tokens.accessToken)).statusCode).toBe(401);
  });

  it('preserves legacy schema strictness and honors existing explicit auth revocation', async () => {
    const native = await login();
    expect(RefreshTokenModel.schema.path('revokedAt')).toBeUndefined();
    expect(RefreshTokenModel.schema.path('replacedByTokenId')).toBeUndefined();
    await RefreshTokenModel.updateMany({}, { $set: { revokedAt: new Date() } }, { strict: false });
    expect((await me(native.tokens.accessToken)).statusCode).toBe(401);
    expect((await refresh(native.tokens.refreshToken)).statusCode).toBe(401);
  });

  it('characterizes legacy revoked SELF fallback without changing grant precedence', async () => {
    const patient = await PatientModel.create({ patientNumber: 'NATIVE-TEST', firstName: 'Legacy', lastName: 'Self',
      gender: 'UNKNOWN', status: 'ACTIVE', phone, dateOfBirth: new Date('1990-01-01') });
    await UserModel.updateOne({ _id: userId }, { $set: { patientId: patient._id } });
    await PatientAccessGrantModel.create({ userId, patientId: patient._id, relationship: 'SELF', status: 'REVOKED', revokedAt: new Date() });
    const repository = new PatientPortalRepository();
    expect(await repository.resolveAccessiblePatientId(userId, String(patient._id))).toBe(String(patient._id));
    expect(await repository.resolveAccessiblePatientId(userId, String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
