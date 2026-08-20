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
  const challengesDb: any[] = [];

  beforeAll(async () => {
    // Set MONGODB_URI to bypass env checking at import time
    process.env.MONGODB_URI = 'mongodb://localhost:27017/hms-test';

    // Dynamically import models and services to ensure env is populated
    const { OtpChallengeModel: model } = await import('./otp-challenge.model.js');
    OtpChallengeModel = model;

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

  it('should enforce 60-second rate limiting cooldown on resends', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // Mock that the resendAvailableAt is in the future
    challengesDb[0].resendAvailableAt = new Date(Date.now() + 30000);

    // Immediate second request must throw throttling error
    await expect(service.requestOtp(phone, metadata)).rejects.toThrowError(
      'Please wait before requesting another verification code.'
    );
  });

  it('should verify active and matching OTP codes', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // Extract OTP code from the captured SMS
    const match = smsService.lastMessage.match(/is:\s*(\d{4})/);
    expect(match).not.toBeNull();
    const code = match![1]!;

    // Verification should pass
    await expect(service.verifyOtp(phone, code)).resolves.not.toThrow();

    // Verify document was updated as verified
    const challenge = challengesDb[0];
    expect(challenge.verifiedAt).not.toBeNull();
  });

  it('should increment attempt counter on wrong OTP input and block after 3 attempts', async () => {
    const phone = '+27821234567';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

    await service.requestOtp(phone, metadata);

    // Submit wrong OTP multiple times
    await expect(service.verifyOtp(phone, '0000')).rejects.toThrowError('The verification code is invalid');
    await expect(service.verifyOtp(phone, '0000')).rejects.toThrowError('The verification code is invalid');
    await expect(service.verifyOtp(phone, '0000')).rejects.toThrowError('The verification code is invalid');

    // 4th verification attempt must throw attempts exceeded lockout error
    await expect(service.verifyOtp(phone, '0000')).rejects.toThrowError(
      'Too many failed verification attempts. Please request a new code.'
    );
  });

  it('should support the demo OTP bypass in non-production environments', async () => {
    const phone = '+27821234567';

    // Verify that the demo OTP (e.g., '1234') passes directly without pre-creating challenges
    await expect(service.verifyOtp(phone, '1234')).resolves.not.toThrow();
  });
});
