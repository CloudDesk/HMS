import { env } from '../../config/env.js';

export interface SmsService {
  sendSms(phone: string, message: string): Promise<void>;
}

export class MockSmsService implements SmsService {
  async sendSms(phone: string, message: string): Promise<void> {
    console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
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
    } catch (error) {
      console.error('[SMS ERROR] Failed to send SMS via HTTP gateway:', error);
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
