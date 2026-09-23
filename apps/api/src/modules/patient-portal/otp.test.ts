import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertPatientPortalDemoOtpConfiguration } from '../../config/env.js';
import { createSmsService, type SmsService } from '../../shared/services/sms.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import { RefreshTokenModel } from '../auth/refresh-token.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { hashPassword } from '../../shared/security/hash.js';
import { OtpChallengeModel } from './otp-challenge.model.js';
import { PatientOtpRepository } from './patient-otp.repository.js';
import { PatientOtpService } from './patient-otp.service.js';

const phone = '+27821234567';
const normalizedPhone = '27821234567';
const metadata = { ipAddress: '127.0.0.1', userAgent: 'otp-security-test' };
const otpHash = (value: string) =>
  createHash('sha256').update(`${normalizedPhone}:${value}`).digest('hex');

class CapturedSmsService implements SmsService {
  lastPhone = '';
  lastMessage = '';

  async sendSms(targetPhone: string, message: string) {
    this.lastPhone = targetPhone;
    this.lastMessage = message;
  }
}

const extractOtp = (message: string) => {
  const match = message.match(/code is: (\d{4})/);
  if (!match?.[1]) throw new Error('Captured SMS did not contain an OTP');
  return match[1];
};

const createChallenge = (input?: {
  otp?: string;
  expiresAt?: Date;
  attempts?: number;
  verifiedAt?: Date | null;
  challengePhone?: string;
}) => OtpChallengeModel.create({
  phone: input?.challengePhone ?? normalizedPhone,
  otpHash: otpHash(input?.otp ?? '4821'),
  expiresAt: input?.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
  resendAvailableAt: new Date(Date.now() + 60 * 1000),
  attempts: input?.attempts ?? 0,
  verifiedAt: input?.verifiedAt ?? null,
  ipAddress: null,
  userAgent: null,
});

describe('patient OTP challenge security', () => {
  let mongodb: MongoMemoryServer;
  let sms: CapturedSmsService;
  let service: PatientOtpService;

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    sms = new CapturedSmsService();
    service = new PatientOtpService(
      new PatientOtpRepository(),
      sms,
      { demoEnabled: false, demoOtp: '' },
    );
  });

  it('creates a hashed challenge and sends the generated OTP', async () => {
    const result = await service.request(phone, metadata);
    const challenge = await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean();
    const generatedOtp = extractOtp(sms.lastMessage);

    expect(result.success).toBe(true);
    expect(sms.lastPhone).toBe(phone);
    expect(challenge?.otpHash).toBe(otpHash(generatedOtp));
    expect(challenge?.otpHash).not.toContain(generatedOtp);
    expect(challenge?.attempts).toBe(0);
    expect(challenge?.verifiedAt).toBeNull();
  });

  it('blocks an immediate resend with the server-side cooldown', async () => {
    await service.request(phone, metadata);
    await expect(service.request(phone, metadata)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    });
    expect(await OtpChallengeModel.countDocuments({ phone: normalizedPhone })).toBe(1);
  });

  it('regression: verifies the delivered code for 9999988888 after a rejected duplicate request', async () => {
    await service.request(' 99999 88888 ', metadata);
    const code = extractOtp(sms.lastMessage);
    const challenge = await OtpChallengeModel.findOne({ phone: '9999988888' }).lean();
    expect(challenge?.otpHash).toBe(createHash('sha256').update(`9999988888:${code}`).digest('hex'));
    await expect(service.request('9999988888', metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED' });
    await expect(service.verifyAndConsume('9999988888', code)).resolves.toMatchObject({ phone: '9999988888' });
    await expect(service.verifyAndConsume('9999988888', code)).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('allows only one concurrent OTP request and preserves its delivered code', async () => {
    const results = await Promise.allSettled([
      service.request(phone, metadata), service.request(phone, metadata),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await OtpChallengeModel.countDocuments({ phone: normalizedPhone })).toBe(1);
    await expect(service.verifyAndConsume(phone, extractOtp(sms.lastMessage))).resolves.toMatchObject({ phone: normalizedPhone });
  });

  it('uses the exact TTL boundary independently of timezone notation', async () => {
    let now = new Date('2030-01-01T05:30:00+05:30');
    const timed = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: false, demoOtp: '', ttlSeconds: 300, now: () => now,
    });
    await timed.request(phone, metadata);
    const code = extractOtp(sms.lastMessage);
    const challenge = await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean();
    expect(challenge?.expiresAt.toISOString()).toBe('2030-01-01T00:05:00.000Z');
    now = new Date('2030-01-01T00:04:59.999Z');
    await expect(timed.assertValidForPendingFlow(phone, code)).resolves.toBeUndefined();
    now = new Date('2030-01-01T00:05:00.000Z');
    await expect(timed.verifyAndConsume(phone, code)).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('normalizes formatting but never guesses a country code or merges different identities', async () => {
    await service.request(' +27 82 123 4567 ', metadata);
    const code = extractOtp(sms.lastMessage);
    await expect(service.verifyAndConsume('27821234567', code)).resolves.toMatchObject({ phone: normalizedPhone });
    await service.request('9999988888', metadata);
    await expect(service.verifyAndConsume('+919999988888', extractOtp(sms.lastMessage))).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('does not treat 1234 as a universal test code', async () => {
    await createChallenge({ otp: '4821' });
    await expect(service.verifyAndConsume(phone, '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('allows a resend after the configured cooldown and invalidates the previous challenge', async () => {
    let now = new Date('2030-01-01T00:00:00.000Z');
    const limited = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: false, demoOtp: '', resendCooldownSeconds: 60,
      identityRequestLimit: 5, identityWindowSeconds: 3600,
      ipRequestLimit: 10, ipRequestWindowSeconds: 3600,
      now: () => now,
    });
    await limited.request(phone, metadata);
    now = new Date(now.getTime() + 61_000);
    await expect(limited.request(phone, metadata)).resolves.toMatchObject({ success: true });
    const challenges = await OtpChallengeModel.find({ phone: normalizedPhone }).sort({ createdAt: 1 }).lean();
    expect(challenges).toHaveLength(2);
    expect(challenges[0]?.verifiedAt).toBeInstanceOf(Date);
    expect(challenges[1]?.verifiedAt).toBeNull();
  });

  it('enforces the configured identity request window beyond the resend cooldown', async () => {
    let now = new Date('2030-01-01T00:00:00.000Z');
    const limited = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: false, demoOtp: '', resendCooldownSeconds: 10,
      identityRequestLimit: 2, identityWindowSeconds: 3600,
      ipRequestLimit: 20, ipRequestWindowSeconds: 3600,
      now: () => now,
    });
    await limited.request(phone, metadata);
    now = new Date(now.getTime() + 11_000);
    await limited.request(phone, metadata);
    now = new Date(now.getTime() + 11_000);
    await expect(limited.request(phone, metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED' });
  });

  it('enforces a shared per-IP request limit across different identities', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const limited = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: false, demoOtp: '', resendCooldownSeconds: 60,
      identityRequestLimit: 10, identityWindowSeconds: 3600,
      ipRequestLimit: 2, ipRequestWindowSeconds: 3600,
      now: () => now,
    });
    await limited.request('+27820000001', metadata);
    await limited.request('+27820000002', metadata);
    await expect(limited.request('+27820000003', metadata)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    });
  });

  it('applies the same generic request behavior regardless of account existence', async () => {
    await expect(service.request('+27820000011', metadata)).resolves.toMatchObject({ success: true });
    await expect(service.request('+27820000012', metadata)).resolves.toMatchObject({ success: true });
    await expect(service.request('+27820000011', metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED', message: 'Too many authentication requests. Try again later.' });
    await expect(service.request('+27820000012', metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED', message: 'Too many authentication requests. Try again later.' });
  });

  it('accepts the correct OTP and consumes its challenge', async () => {
    await service.request(phone, metadata);
    const generatedOtp = extractOtp(sms.lastMessage);

    await expect(service.verifyAndConsume(phone, generatedOtp)).resolves.toMatchObject({
      phone: normalizedPhone,
    });
    const challenge = await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean();
    expect(challenge?.verifiedAt).toBeInstanceOf(Date);
  });

  it('rejects an incorrect OTP and increments attempts', async () => {
    await createChallenge();

    await expect(service.verifyAndConsume(phone, '0000')).rejects.toMatchObject({
      code: 'INVALID_OTP',
      statusCode: 401,
    });
    const challenge = await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean();
    expect(challenge?.attempts).toBe(1);
    expect(challenge?.verifiedAt).toBeNull();
  });

  it('rejects an expired OTP', async () => {
    await createChallenge({ expiresAt: new Date(Date.now() - 1_000) });
    await expect(service.verifyAndConsume(phone, '4821')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('rejects an already-consumed OTP', async () => {
    await createChallenge({ verifiedAt: new Date() });
    await expect(service.verifyAndConsume(phone, '4821')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('rejects reuse after a successful verification', async () => {
    await createChallenge();
    await service.verifyAndConsume(phone, '4821');
    await expect(service.verifyAndConsume(phone, '4821')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('binds the OTP to the challenge phone identity', async () => {
    await createChallenge();
    await expect(service.verifyAndConsume('+27829999999', '4821')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('enforces the existing maximum attempt limit', async () => {
    await createChallenge({ attempts: 3 });
    await expect(service.verifyAndConsume(phone, '4821')).rejects.toMatchObject({
      code: 'MAX_ATTEMPTS_EXCEEDED',
      statusCode: 429,
    });
  });

  it('atomically exhausts a challenge after repeated incorrect submissions', async () => {
    await createChallenge();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.verifyAndConsume(phone, '0000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    }
    await expect(service.verifyAndConsume(phone, '4821')).rejects.toMatchObject({
      code: 'MAX_ATTEMPTS_EXCEEDED',
      statusCode: 429,
    });
    expect((await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean())?.attempts).toBe(3);
  });

  it('limits verification traffic by IP without exposing challenge details', async () => {
    const limited = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: false, demoOtp: '', verificationIpLimit: 2, verificationWindowSeconds: 600,
    });
    await createChallenge();
    await expect(limited.assertValidForPendingFlow(phone, '0000', metadata)).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(limited.assertValidForPendingFlow(phone, '0000', metadata)).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(limited.assertValidForPendingFlow(phone, '4821', metadata)).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
      statusCode: 429,
      message: 'Too many authentication requests. Try again later.',
    });
  });

  it('does not authenticate when the OTP is invalid', async () => {
    await createChallenge();
    const auth = new AuthService(new AuthRepository(), service);

    await expect(auth.loginPatientWithOtp({ phone, otp: '0000' }, metadata)).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    expect(await RefreshTokenModel.countDocuments()).toBe(0);
  });

  it('authenticates a patient with the correct OTP and rejects login reuse', async () => {
    const role = await RoleModel.create({
      code: 'PATIENT',
      name: 'Patient',
      permissionIds: [],
      status: 'active',
    });
    await UserModel.create({
      username: 'otp.patient@example.test',
      email: 'otp.patient@example.test',
      fullName: 'OTP Patient',
      phone: normalizedPhone,
      passwordHash: await hashPassword('UnusedPassword1'),
      roleIds: [role._id],
      branchIds: [],
      departmentIds: [],
      status: 'active',
    });
    await createChallenge();
    const auth = new AuthService(new AuthRepository(), service);

    const session = await auth.loginPatientWithOtp({ phone, otp: '4821' }, metadata);
    expect(session.tokens.accessToken).toBeTruthy();
    expect(session.tokens.refreshToken).toBeTruthy();
    expect(session.user.roles).toEqual([
      expect.objectContaining({ code: 'PATIENT' }),
    ]);
    expect(await RefreshTokenModel.countDocuments()).toBe(1);

    await expect(auth.loginPatientWithOtp({ phone, otp: '4821' }, metadata)).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    expect(await RefreshTokenModel.countDocuments()).toBe(1);
  });

  it('persists the configured static code without SMS and verifies it once for the supplied mobile', async () => {
    const demoService = new PatientOtpService(
      new PatientOtpRepository(),
      sms,
      { demoEnabled: true, demoOtp: '1234' },
    );

    await expect(demoService.verifyAndConsume('9999988888', '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await demoService.request('9999988888', metadata);
    const challenge = await OtpChallengeModel.findOne({ phone: '9999988888' }).lean();
    expect(challenge?.otpHash).toBe(createHash('sha256').update('9999988888:1234').digest('hex'));
    expect(sms.lastMessage).toBe('');
    await expect(demoService.verifyAndConsume(phone, '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(demoService.verifyAndConsume('9999988888', '0000')).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    await expect(demoService.verifyAndConsume('9999988888', '1234')).resolves.toMatchObject({ phone: '9999988888', challengeId: String(challenge?._id) });
    await expect(demoService.verifyAndConsume('9999988888', '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('preserves expiry, attempt limits and resend limits in static mode', async () => {
    let now = new Date('2030-01-01T00:00:00Z');
    const staticService = new PatientOtpService(new PatientOtpRepository(), sms, {
      demoEnabled: true, demoOtp: '1234', ttlSeconds: 300, maxVerificationAttempts: 3, now: () => now,
    });
    await staticService.request(phone, metadata);
    await expect(staticService.request(phone, metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(staticService.verifyAndConsume(phone, '0000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    }
    await expect(staticService.verifyAndConsume(phone, '1234')).rejects.toMatchObject({ code: 'MAX_ATTEMPTS_EXCEEDED' });
    now = new Date(now.getTime() + 61_000);
    await staticService.request(phone, metadata);
    now = new Date(now.getTime() + 300_000);
    await expect(staticService.assertValidForPendingFlow(phone, '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(staticService.verifyAndConsume(phone, '1234')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('needs no gateway in static mode but rejects missing gateway configuration in real mode', async () => {
    const unavailableSms = createSmsService({ provider: 'HTTP', url: '', apiKey: '' }, false);
    const staticService = new PatientOtpService(new PatientOtpRepository(), unavailableSms, { demoEnabled: true, demoOtp: '1234' });
    await expect(staticService.request('9999988888', metadata)).resolves.toMatchObject({ success: true });
    const realService = new PatientOtpService(new PatientOtpRepository(), unavailableSms, { demoEnabled: false, demoOtp: '' });
    await expect(realService.request(phone, metadata)).rejects.toMatchObject({ code: 'SMS_NOT_CONFIGURED' });
  });

  it('allows explicitly configured static OTP independently of shared deployment mode', () => {
    expect(() => assertPatientPortalDemoOtpConfiguration({
      enabled: true,
      otp: '1234',
    })).not.toThrow();
    expect(() => assertPatientPortalDemoOtpConfiguration({ enabled: true, otp: '' })).toThrow('exactly four digits');
    expect(() => assertPatientPortalDemoOtpConfiguration({ enabled: true, otp: '12345' })).toThrow('exactly four digits');
  });
});
