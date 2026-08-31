import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { HttpSmsService, MockSmsService, maskPhoneNumber, type SmsService } from './sms.service.js';
import { PatientOtpService } from '../../modules/patient-portal/patient-otp.service.js';
import type { PatientOtpRepository } from '../../modules/patient-portal/patient-otp.repository.js';
import type { AuthRateLimitRepository } from '../../modules/auth/auth-rate-limit.repository.js';

describe('M-014: SMS Logging and Failure Handling', () => {
  describe('maskPhoneNumber', () => {
    it('masks full phone numbers without exposing full sequence', () => {
      expect(maskPhoneNumber('+27821234567')).toBe('+27***567');
      expect(maskPhoneNumber('1234567890')).toBe('123***890');
      expect(maskPhoneNumber('0712345678')).toBe('071***678');
      expect(maskPhoneNumber('1234')).toBe('***');
      expect(maskPhoneNumber('')).toBe('[empty]');
    });
  });

  describe('MockSmsService', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('does not log OTP values or full message body', async () => {
      const mock = new MockSmsService();
      const otp = '9482';
      const phone = '+27821234567';
      const message = `Your HMS verification code is: ${otp}. It is valid for 5 minutes.`;

      await mock.sendSms(phone, message);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const logOutput = logSpy.mock.calls[0][0];

      expect(logOutput).not.toContain(otp);
      expect(logOutput).not.toContain('verification code');
      expect(logOutput).not.toContain('valid for 5 minutes');
      expect(logOutput).toContain('content redacted');
    });

    it('does not log full phone numbers', async () => {
      const mock = new MockSmsService();
      const phone = '+27821234567';
      await mock.sendSms(phone, 'test code');

      const logOutput = logSpy.mock.calls[0][0];
      expect(logOutput).not.toContain(phone);
      expect(logOutput).toContain('+27***567');
    });

    it('stores sent messages in memory for test inspections without logging', async () => {
      const mock = new MockSmsService();
      await mock.sendSms('+27821234567', 'test message 1');
      await mock.sendSms('+27829876543', 'test message 2');

      expect(mock.getSentMessages()).toHaveLength(2);
      expect(mock.getLastMessage()?.phone).toBe('+27829876543');
      expect(mock.getLastMessage()?.message).toBe('test message 2');

      mock.clear();
      expect(mock.getSentMessages()).toHaveLength(0);
    });
  });

  describe('HttpSmsService', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    const gatewayUrl = 'https://sms-gateway.test/v1/send';
    const apiKey = 'secret-sms-api-key';

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    it('sends SMS successfully when HTTP gateway responds with 200 OK', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'DELIVERED' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const service = new HttpSmsService(gatewayUrl, apiKey);
      await expect(service.sendSms('+27821234567', 'Your code is 1234')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        gatewayUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ to: '+27821234567', message: 'Your code is 1234' }),
        }),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('propagates an AppError when HTTP gateway returns non-2xx status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      vi.stubGlobal('fetch', fetchMock);

      const service = new HttpSmsService(gatewayUrl, apiKey);
      const promise = service.sendSms('+27821234567', 'Your code is 1234');

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 502,
        code: 'SMS_DELIVERY_FAILED',
        message: 'Failed to deliver SMS verification code. Please try again later.',
      });

      expect(errorSpy).toHaveBeenCalled();
      const errorLog = errorSpy.mock.calls[0][0];
      expect(errorLog).not.toContain('+27821234567');
      expect(errorLog).not.toContain('1234');
      expect(errorLog).not.toContain(apiKey);
    });

    it('propagates an AppError on gateway timeout', async () => {
      const fetchMock = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          options.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const service = new HttpSmsService(gatewayUrl, apiKey, 50);
      const promise = service.sendSms('+27821234567', 'Your code is 1234');

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 502,
        code: 'SMS_DELIVERY_FAILED',
      });
    });

    it('propagates an AppError on network error', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      vi.stubGlobal('fetch', fetchMock);

      const service = new HttpSmsService(gatewayUrl, apiKey);
      const promise = service.sendSms('+27821234567', 'Your code is 1234');

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 502,
        code: 'SMS_DELIVERY_FAILED',
      });
    });
  });

  describe('OTP Request Flow on SMS Failure', () => {
    it('does not report successful delivery when SMS sending fails', async () => {
      const failingSms: SmsService = {
        sendSms: vi.fn().mockRejectedValue(new AppError('Failed to deliver SMS verification code.', 502, 'SMS_DELIVERY_FAILED')),
      };

      const mockRepo = {
        findLatest: vi.fn().mockResolvedValue(null),
        invalidateActive: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({
          id: 'challenge-1',
          resendAvailableAt: new Date(Date.now() + 60_000),
        }),
      } as unknown as PatientOtpRepository;

      const rateLimitMock = {
        consume: vi.fn().mockResolvedValue(true),
      };

      const otpService = new PatientOtpService(
        mockRepo,
        failingSms,
        { demoEnabled: false, demoOtp: '', resendCooldownSeconds: 60 },
        rateLimitMock as unknown as AuthRateLimitRepository,
      );

      const resultPromise = otpService.request('+27821234567', { ipAddress: '127.0.0.1' });

      await expect(resultPromise).rejects.toThrow(AppError);
      await expect(resultPromise).rejects.toMatchObject({
        statusCode: 502,
        code: 'SMS_DELIVERY_FAILED',
      });
    });
  });
});

