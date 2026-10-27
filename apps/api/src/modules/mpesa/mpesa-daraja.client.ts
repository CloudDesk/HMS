import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import type { MpesaAttempt } from './mpesa-attempt.model.js';

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const acceptedSchema = z.object({ ResponseCode: z.union([z.literal('0'), z.literal(0)]),
  MerchantRequestID: identifier, CheckoutRequestID: identifier });
export type StkSubmission =
  | { state: 'PENDING'; merchantRequestId: string; checkoutRequestId: string }
  | { state: 'REJECTED' | 'UNKNOWN'; error: string };

export class MpesaDarajaClient {
  constructor(private readonly http: typeof fetch = fetch) {}
  private base(environment: string) {
    return environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }
  async token(merchant: MpesaMerchant, environment: string): Promise<string | undefined> {
    try {
      const response = await this.http(`${this.base(environment)}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Basic ${Buffer.from(`${merchant.consumerKey}:${merchant.consumerSecret}`).toString('base64')}` },
      });
      if (!response.ok) return undefined;
      const parsed = z.object({ access_token: z.string().min(1).max(8192) }).safeParse(await response.json());
      return parsed.success ? parsed.data.access_token : undefined;
    } catch { return undefined; }
  }
  async submit(merchant: MpesaMerchant, attempt: Pick<MpesaAttempt, '_id' | 'environment' | 'businessShortCode' | 'transactionType' | 'amount' | 'payerPhone' | 'partyB'>, token: string): Promise<StkSubmission> {
    const timestamp = formatInTimeZone(new Date(), 'Africa/Nairobi', 'yyyyMMddHHmmss');
    try {
      const response = await this.http(`${this.base(attempt.environment)}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: attempt.businessShortCode,
          Password: Buffer.from(`${attempt.businessShortCode}${merchant.passkey}${timestamp}`).toString('base64'),
          Timestamp: timestamp, TransactionType: attempt.transactionType, Amount: attempt.amount,
          PartyA: attempt.payerPhone, PartyB: attempt.partyB, PhoneNumber: attempt.payerPhone,
          CallBackURL: merchant.callbackUrl, AccountReference: attempt._id.slice(0, 12), TransactionDesc: 'HMS payment',
        }),
      });
      // 5xx, ambiguous bodies, timeouts and redirects may follow acceptance.
      if (response.status >= 500 || response.status === 408) return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
      const body: unknown = await response.json();
      const accepted = acceptedSchema.safeParse(body);
      if (response.ok && accepted.success) return { state: 'PENDING',
        merchantRequestId: accepted.data.MerchantRequestID, checkoutRequestId: accepted.data.CheckoutRequestID };
      const rejected = z.object({ errorCode: z.string().min(1), errorMessage: z.string() }).safeParse(body);
      if (response.status >= 400 && response.status < 500 && rejected.success) {
        return { state: 'REJECTED', error: 'PROVIDER_REJECTED' };
      }
      return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    } catch { return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' }; }
  }
}
