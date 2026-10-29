import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
import type { MpesaMerchant } from '../../config/mpesa-outbound.js';
import type { MpesaAttempt } from './mpesa-attempt.model.js';

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const resultCode = z.union([
  z.number().int().nonnegative().max(2147483647),
  z.string().max(10).regex(/^(0|[1-9]\d*)$/).transform(Number)
    .pipe(z.number().int().nonnegative().max(2147483647)),
]);
const acceptedSchema = z.object({
  ResponseCode: z.union([z.literal('0'), z.literal(0)]),
  MerchantRequestID: identifier,
  CheckoutRequestID: identifier,
});

export type StkSubmission =
  | { state: 'PENDING'; merchantRequestId: string; checkoutRequestId: string }
  | { state: 'REJECTED' | 'UNKNOWN'; error: string };

export type StkQueryState = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'PENDING' | 'UNKNOWN';

export type StkQueryResult =
  | {
      state: 'SUCCESS' | 'CANCELLED' | 'TIMEOUT' | 'FAILED';
      resultCode: number;
      resultDesc: string;
      merchantRequestId: string;
      checkoutRequestId: string;
    }
  | {
      state: 'PENDING';
      resultDesc?: string;
      merchantRequestId?: string;
      checkoutRequestId?: string;
    }
  | {
      state: 'UNKNOWN';
      error: string;
    };

export class MpesaDarajaClient {
  constructor(private readonly http: typeof fetch = fetch) {}

  private base(environment: string) {
    return environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }

  async token(merchant: MpesaMerchant, environment: string): Promise<string | undefined> {
    try {
      const response = await this.http(`${this.base(environment)}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${merchant.consumerKey}:${merchant.consumerSecret}`).toString('base64')}`,
        },
      });
      if (!response.ok) return undefined;
      const parsed = z.object({ access_token: z.string().min(1).max(8192) }).safeParse(await response.json());
      return parsed.success ? parsed.data.access_token : undefined;
    } catch {
      return undefined;
    }
  }

  async submit(
    merchant: MpesaMerchant,
    attempt: Pick<MpesaAttempt, '_id' | 'environment' | 'businessShortCode' | 'transactionType' | 'amount' | 'payerPhone' | 'partyB'>,
    token: string,
  ): Promise<StkSubmission> {
    const timestamp = formatInTimeZone(new Date(), 'Africa/Nairobi', 'yyyyMMddHHmmss');
    try {
      const response = await this.http(`${this.base(attempt.environment)}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: attempt.businessShortCode,
          Password: Buffer.from(`${attempt.businessShortCode}${merchant.passkey}${timestamp}`).toString('base64'),
          Timestamp: timestamp,
          TransactionType: attempt.transactionType,
          Amount: attempt.amount,
          PartyA: attempt.payerPhone,
          PartyB: attempt.partyB,
          PhoneNumber: attempt.payerPhone,
          CallBackURL: merchant.callbackUrl,
          AccountReference: attempt._id.slice(0, 12),
          TransactionDesc: 'HMS payment',
        }),
      });

      // 5xx, ambiguous bodies, timeouts and redirects may follow acceptance.
      if (response.status >= 500 || response.status === 408) return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
      const body: unknown = await response.json();
      const accepted = acceptedSchema.safeParse(body);
      if (response.ok && accepted.success) {
        return {
          state: 'PENDING',
          merchantRequestId: accepted.data.MerchantRequestID,
          checkoutRequestId: accepted.data.CheckoutRequestID,
        };
      }
      const rejected = z.object({ errorCode: z.string().min(1), errorMessage: z.string() }).safeParse(body);
      if (response.status >= 400 && response.status < 500 && rejected.success) {
        return { state: 'REJECTED', error: 'PROVIDER_REJECTED' };
      }
      return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    } catch {
      return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    }
  }

  async query(
    merchant: MpesaMerchant,
    attempt: Pick<MpesaAttempt, 'environment' | 'businessShortCode' | 'checkoutRequestId'>,
    token: string,
  ): Promise<StkQueryResult> {
    if (!attempt.checkoutRequestId) {
      return { state: 'UNKNOWN', error: 'MISSING_CHECKOUT_REQUEST_ID' };
    }
    const timestamp = formatInTimeZone(new Date(), 'Africa/Nairobi', 'yyyyMMddHHmmss');
    try {
      const response = await this.http(`${this.base(attempt.environment)}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: attempt.businessShortCode,
          Password: Buffer.from(`${attempt.businessShortCode}${merchant.passkey}${timestamp}`).toString('base64'),
          Timestamp: timestamp,
          CheckoutRequestID: attempt.checkoutRequestId,
        }),
      });

      const body: unknown = await response.json().catch(() => null);

      // This code is shared with credential and merchant errors. Only the
      // explicit processing response is pending; query errors never prove failure.
      const processing = z.object({
        errorCode: z.literal('500.001.1001'),
        errorMessage: z.string().max(1024),
      }).safeParse(body);
      if ((response.status === 200 || response.status === 500) && processing.success &&
        !Object.prototype.hasOwnProperty.call(body, 'ResultCode') &&
        /^the transaction is being processed\.?$/i.test(processing.data.errorMessage.trim())) {
        return { state: 'PENDING', resultDesc: 'The transaction is being processed' };
      }

      if (response.status >= 500 || response.status === 408) {
        return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
      }

      const querySchema = z.object({
        ResponseCode: z.union([z.literal('0'), z.literal(0)]),
        MerchantRequestID: identifier,
        CheckoutRequestID: identifier,
        ResultCode: resultCode,
        ResultDesc: z.string().min(1).max(1024),
      });

      const parsed = querySchema.safeParse(body);
      if (response.ok && parsed.success) {
        const { ResultCode, ResultDesc, MerchantRequestID, CheckoutRequestID } = parsed.data;
        if (ResultCode === 0) {
          return {
            state: 'SUCCESS',
            resultCode: 0,
            resultDesc: ResultDesc,
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
          };
        }
        if (ResultCode === 1032) {
          return {
            state: 'CANCELLED',
            resultCode: 1032,
            resultDesc: ResultDesc,
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
          };
        }
        if (ResultCode === 1037) {
          return {
            state: 'TIMEOUT',
            resultCode: 1037,
            resultDesc: ResultDesc,
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
          };
        }
        return {
          state: 'FAILED',
          resultCode: ResultCode,
          resultDesc: ResultDesc,
          merchantRequestId: MerchantRequestID,
          checkoutRequestId: CheckoutRequestID,
        };
      }

      const rejected = z.object({ errorCode: z.string().min(1), errorMessage: z.string() }).safeParse(body);
      if (response.status >= 400 && response.status < 500 && rejected.success) {
        // Rejection of a status query says nothing about payment settlement.
        return { state: 'UNKNOWN', error: 'PROVIDER_QUERY_REJECTED' };
      }

      return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    } catch {
      return { state: 'UNKNOWN', error: 'PROVIDER_UNCERTAIN' };
    }
  }
}
