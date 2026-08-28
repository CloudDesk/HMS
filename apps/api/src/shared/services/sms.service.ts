import { env } from '../../config/env.js';

export interface SmsService {
  sendSms(phone: string, message: string): Promise<void>;
}

export class MockSmsService implements SmsService {
  async sendSms(phone: string): Promise<void> {
    const suffix = phone.replace(/\D/g, '').slice(-4);
    console.log(`[SMS MOCK] Verification message queued for phone ending ${suffix}`);
  }
}

export class HttpSmsService implements SmsService {
  private url: string;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    this.url = url;
    this.apiKey = apiKey;
  }

  async sendSms(phone: string, message: string): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ to: phone, message }),
      });
      if (!response.ok) {
        throw new Error(`SMS gateway returned status ${response.status}`);
      }
    } catch {
      throw new Error('SMS verification code could not be delivered');
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
