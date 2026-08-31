import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsService } from '../../shared/services/sms.service.js';
import { MockSmsService } from '../../shared/services/sms.service.js';
import { hashPassword } from '../../shared/security/hash.js';
import { PatientOtpRepository } from '../patient-portal/patient-otp.repository.js';
import { PatientOtpService } from '../patient-portal/patient-otp.service.js';
import { UserModel } from '../users/user.model.js';
import { AuthRateLimitRepository } from './auth-rate-limit.repository.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

const sms: SmsService = { sendSms: async () => {} };

describe('M-006 public staff login rate limiting', () => {
  let mongodb: MongoMemoryServer;
  let now: Date;

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
    now = new Date('2030-01-01T00:00:00.000Z');
  });

  const createAuth = (input: { ipLimit?: number; identityLimit?: number } = {}) => {
    const rateLimits = new AuthRateLimitRepository();
    const otp = new PatientOtpService(new PatientOtpRepository(), sms, { demoEnabled: false, demoOtp: '' }, rateLimits);
    return new AuthService(new AuthRepository(), otp, rateLimits, {
      ipLimit: input.ipLimit ?? 10,
      identityLimit: input.identityLimit ?? 10,
      windowSeconds: 60,
      now: () => now,
    });
  };

  it('blocks excessive login attempts by normalized identity', async () => {
    const auth = createAuth({ identityLimit: 2 });
    const metadata = { ipAddress: '192.0.2.1', userAgent: 'rate-limit-test' };
    await expect(auth.login({ identifier: 'missing@example.test', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: ' MISSING@example.test ', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'missing@example.test', password: 'wrong' }, metadata)).rejects.toMatchObject({ statusCode: 429, code: 'AUTH_RATE_LIMITED' });
  });

  it('blocks excessive login attempts by IP across different identities', async () => {
    const auth = createAuth({ ipLimit: 2 });
    const metadata = { ipAddress: '192.0.2.2', userAgent: 'rate-limit-test' };
    await expect(auth.login({ identifier: 'first@example.test', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'second@example.test', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'third@example.test', password: 'wrong' }, metadata)).rejects.toMatchObject({ statusCode: 429, code: 'AUTH_RATE_LIMITED' });
  });

  it('allows legitimate authentication after the configured window expires', async () => {
    await UserModel.create({ username: 'window-user', email: 'window@example.test', fullName: 'Window User', passwordHash: await hashPassword('CorrectPassword1'), status: 'active', roleIds: [], branchIds: [], departmentIds: [] });
    const auth = createAuth({ identityLimit: 2, ipLimit: 10 });
    const metadata = { ipAddress: '192.0.2.3', userAgent: 'rate-limit-test' };
    await expect(auth.login({ identifier: 'window-user', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'window-user', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'window-user', password: 'CorrectPassword1' }, metadata)).rejects.toMatchObject({ code: 'AUTH_RATE_LIMITED' });
    now = new Date(now.getTime() + 61_000);
    await expect(auth.login({ identifier: 'window-user', password: 'CorrectPassword1' }, metadata)).resolves.toMatchObject({ user: { username: 'window-user' } });
  });

  it('redacts OTP recipients and message contents from mock delivery logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await new MockSmsService().sendSms('+27821234567', 'Your verification code is 4821');
      const output = log.mock.calls.flat().join(' ');
      expect(output).not.toContain('+27821234567');
      expect(output).not.toContain('4821');
      expect(output).toContain('redacted');
    } finally {
      log.mockRestore();
    }
  });
});
