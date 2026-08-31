import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface SmsService {
  sendSms(phone: string, message: string): Promise<void>;
}

export const maskPhoneNumber = (phone: string): string => {
  const trimmed = phone.trim();
  if (!trimmed) return '[empty]';
  if (trimmed.length <= 4) return '***';
  const visible = Math.min(3, Math.floor(trimmed.length / 3));
  const prefix = trimmed.slice(0, visible);
  const suffix = trimmed.slice(-visible);
  return `${prefix}***${suffix}`;
};

export class MockSmsService implements SmsService {
  private sentMessages: Array<{ phone: string; message: string; timestamp: Date }> = [];

  async sendSms(phone: string, message: string): Promise<void> {
    this.sentMessages.push({ phone, message, timestamp: new Date() });
    const masked = maskPhoneNumber(phone);
    console.log(`[SMS MOCK] Message accepted for delivery to ${masked}; content redacted.`);
  }

  getSentMessages() {
    return [...this.sentMessages];
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clear() {
    this.sentMessages = [];
  }
}

export class HttpSmsService implements SmsService {
  private url: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(url: string, apiKey: string, timeoutMs = 10_000) {
    this.url = url;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async sendSms(phone: string, message: string): Promise<void> {
    const masked = maskPhoneNumber(phone);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ to: phone, message }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`[SMS ERROR] HTTP gateway responded with status ${response.status} for ${masked}`);
        throw new AppError('Failed to deliver SMS verification code. Please try again later.', 502, 'SMS_DELIVERY_FAILED');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const isTimeout = (error as Error)?.name === 'AbortError';
      const reason = isTimeout ? 'Gateway request timed out' : 'Network/gateway error';
      console.error(`[SMS ERROR] Failed to send SMS to ${masked}: ${reason}`);
      throw new AppError('Failed to deliver SMS verification code. Please try again later.', 502, 'SMS_DELIVERY_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createSmsService = (): SmsService => {
  const provider = env.sms?.provider ?? 'MOCK';
  const url = env.sms?.url ?? '';
  const apiKey = env.sms?.apiKey ?? '';

  if (provider === 'HTTP' && url) {
    return new HttpSmsService(url, apiKey);
  }
  return new MockSmsService();
};
