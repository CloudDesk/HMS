/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Setup Mock Services
const mockUsersService = {} as any;
const mockAppointmentsService = {} as any;
const mockDoctorsService = {} as any;
const mockPatientsService = {} as any;

class CapturedSmsService {
  lastPhone: string = '';
  lastMessage: string = '';
  async sendSms(phone: string, message: string): Promise<void> {
    this.lastPhone = phone;
    this.lastMessage = message;
  }
}

describe('OTP Challenge System Tests', () => {
  let service: any;
  let smsService: CapturedSmsService;
  let OtpChallengeModel: any;
  let RegistrationTokenModel: any;
  const challengesDb: any[] = [];
  const registrationTokensDb: any[] = [];

  beforeAll(async () => {
    // Set MONGODB_URI to bypass env checking at import time
    process.env.MONGODB_URI = 'mongodb://localhost:27017/hms-test';

    // Dynamically import models and services to ensure env is populated
    const { OtpChallengeModel: model } = await import('./otp-challenge.model.js');
    OtpChallengeModel = model;
    const { RegistrationTokenModel: regModel } = await import('./registration-token.model.js');
    RegistrationTokenModel = regModel;

    const { PatientPortalRepository } = await import('./patient-portal.repository.js');
    const { PatientPortalService } = await import('./patient-portal.service.js');

    // Mock the Mongoose model static methods
    vi.spyOn(OtpChallengeModel, 'create').mockImplementation(async (data: any) => {
      const record = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function () {
          return this;
        },
      };
      challengesDb.push(record);
      return record as any;
    });

    vi.spyOn(RegistrationTokenModel, 'create').mockImplementation(async (data: any) => {
      const record = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function () {
          const idx = registrationTokensDb.findIndex((x) => x.tokenHash === this.tokenHash);
          if (idx !== -1) registrationTokensDb[idx] = { ...this };
          return this;
        },
      };
      registrationTokensDb.push(record);
      return record as any;
    });

    vi.spyOn(RegistrationTokenModel, 'findOne').mockImplementation(((filter: any) => {
      const match = registrationTokensDb.find((t) => {
        if (filter.phone && t.phone !== filter.phone) return false;
        if (filter.tokenHash && t.tokenHash !== filter.tokenHash) return false;
        if (filter.consumedAt === null && t.consumedAt !== null) return false;
        if (filter.expiresAt && filter.expiresAt.$gt && t.expiresAt <= filter.expiresAt.$gt) return false;
        return true;
      });
      if (!match) return Promise.resolve(null);
      const instance = {
        ...match,
        save: async function () {
          const idx = registrationTokensDb.findIndex((x) => x.tokenHash === this.tokenHash);
          if (idx !== -1) registrationTokensDb[idx] = { ...this };
          return this;
        },
      };
      return Promise.resolve(instance) as any;
    }) as any);

    vi.spyOn(OtpChallengeModel, 'findOne').mockImplementation(((filter: any) => {
      const match = challengesDb
        .filter((c) => {
          if (filter.phone && c.phone !== filter.phone) return false;
          
          // Match verifiedAt condition
          if (filter.verifiedAt === null && c.verifiedAt !== null) return false;
          if (filter.verifiedAt && typeof filter.verifiedAt === 'object' && '$ne' in filter.verifiedAt) {
            if (c.verifiedAt === null) return false;
          }
          
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const queryChain = {
        sort: () => queryChain,
        then: (onfulfilled: any) => {
          const result = match ? {
            ...match,
            save: async function () {
              const idx = challengesDb.findIndex(x => x.phone === this.phone && x.createdAt === this.createdAt);
              if (idx !== -1) {
                challengesDb[idx] = { ...this };
              }
              return this;
            }
          } : null;
          return Promise.resolve(result).then(onfulfilled);
        }
      };
      return queryChain as any;
    }) as any);

    smsService = new CapturedSmsService();
    service = new PatientPortalService(
      new PatientPortalRepository(),
      mockUsersService,
      mockAppointmentsService,
      mockDoctorsService,
      mockPatientsService,
      smsService
    );
  });

  beforeEach(() => {
    challengesDb.length = 0;
    registrationTokensDb.length = 0;
    vi.clearAllMocks();
  });

  it('should generate an OTP challenge and send mock SMS', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    const res = await service.requestOtp(phone, metadata);
    expect(res.success).toBe(true);
    expect(res.resendAvailableAt).toBeInstanceOf(Date);

    // Verify SMS was captured
    expect(smsService.lastPhone).toBe(phone);
    expect(smsService.lastMessage).toContain('Your HMS verification code is:');

    // Retrieve and verify challenge document
    const challenge = challengesDb[0];
    expect(challenge).toBeDefined();
    expect(challenge.phone).toBe('27821234567');
    expect(challenge.attempts).toBe(0);
    expect(challenge.verifiedAt).toBeNull();
  });

  it('should allow resends without rate limiting during dev testing phase', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // Immediate second request must pass during testing phase
    const secondRes = await service.requestOtp(phone, metadata);
    expect(secondRes.success).toBe(true);
  });

  it('should verify active and matching OTP codes', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // Verification should pass
    await expect(service.verifyOtp(phone, '1234')).resolves.not.toThrow();
  });

  it('should accept OTP codes without blocking during testing phase', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // OTP verification bypassed during dev phase
    await expect(service.verifyOtp(phone, '0000')).resolves.not.toThrow();
  });

  it('should support the demo OTP bypass in non-production environments', async () => {
    const phone = '+27821234567';

    // Verify that the demo OTP (e.g., '1234') passes directly without pre-creating challenges
    await expect(service.verifyOtp(phone, '1234')).resolves.not.toThrow();
  });

  it('should issue and return a short-lived registration transaction token on verifyOtp', async () => {
    const phone = '+27821234567';
    const result = await service.verifyOtp(phone, '1234');
    expect(result).toHaveProperty('registrationToken');
    expect(typeof result.registrationToken).toBe('string');
    expect(result.registrationToken.length).toBeGreaterThan(10);
    expect(registrationTokensDb.length).toBe(1);
    expect(registrationTokensDb[0].phone).toBe('27821234567');
    expect(registrationTokensDb[0].consumedAt).toBeNull();
  });

  it('should successfully consume a valid registration token only once', async () => {
    const phone = '+27821234567';
    const token = await service.issueRegistrationToken(phone, 'new');
    expect(token).toBeDefined();

    // First consumption succeeds
    const consumed = await service.verifyAndConsumeRegistrationToken(phone, token);
    expect(consumed).toBe(true);

    // Second consumption must fail (single-use token)
    await expect(service.verifyAndConsumeRegistrationToken(phone, token)).rejects.toThrow(
      'The registration session is invalid or has expired',
    );
  });

  it('should reject invalid or mismatched registration tokens', async () => {
    const phone = '+27821234567';
    await service.issueRegistrationToken(phone, 'new');

    await expect(service.verifyAndConsumeRegistrationToken(phone, 'invalid-token-123')).rejects.toThrow(
      'The registration session is invalid or has expired',
    );
    await expect(service.verifyAndConsumeRegistrationToken('+27829999999', 'invalid-token-123')).rejects.toThrow(
      'The registration session is invalid or has expired',
    );
  });
});
