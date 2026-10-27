import { createHash } from 'node:crypto';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import type { MpesaCallbackEvent, MpesaReportedOutcome } from './mpesa-callback.model.js';
import type { MpesaCallbackRepository } from './mpesa-callback.repository.js';
import { parseMpesaCallback } from './mpesa-callback.schemas.js';
import type { MpesaAttemptService } from './mpesa-attempt.service.js';

export type MpesaCallbackConfiguration = {
  environment: 'sandbox' | 'production';
  perIpLimit: number;
  globalLimit: number;
};

const storageError = () => new AppError(
  'M-PESA callback storage temporarily unavailable', 503, 'MPESA_CALLBACK_UNAVAILABLE',
);

export const reportedOutcome = (code: number): MpesaReportedOutcome => {
  if (code === 0) return 'SUCCESS';
  if (code === 1032) return 'CANCELLED';
  if (code === 1037) return 'TIMEOUT';
  return 'FAILED';
};

export class MpesaCallbackService {
  constructor(
    private readonly repository: MpesaCallbackRepository,
    private readonly rateLimits: AuthRateLimitRepository,
    private readonly configuration: MpesaCallbackConfiguration,
    private readonly attempts?: Pick<MpesaAttemptService, 'correlate'>,
  ) {}

  async checkRateLimit(ip: string): Promise<void> {
    const now = new Date();
    const hash = createHash('sha256').update(ip).digest('hex');
    let allowed: boolean;
    try {
      allowed = await this.rateLimits.consume('mpesa-callback-global', 'global', this.configuration.globalLimit, 60, now) &&
        await this.rateLimits.consume('mpesa-callback-ip', hash, this.configuration.perIpLimit, 60, now);
    } catch {
      throw storageError();
    }
    if (!allowed) throw new AppError('Too many callback requests; retry later', 429, 'MPESA_CALLBACK_RATE_LIMITED');
  }

  async receive(body: unknown): Promise<void> {
    const callback = parseMpesaCallback(body);
    const items = [...(callback.CallbackMetadata?.Item ?? [])].sort((a, b) =>
      a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0);
    const get = (name: string) => items.find((item) => item.Name === name)?.Value;
    const amount = get('Amount');
    const receipt = get('MpesaReceiptNumber');
    const phone = get('PhoneNumber');
    const date = get('TransactionDate');
    const identity = JSON.stringify([
      this.configuration.environment, callback.MerchantRequestID, callback.CheckoutRequestID,
      callback.ResultCode, callback.ResultDesc,
      items.map((item) => [item.Name, item.Value === undefined ? null : String(item.Value)]),
    ]);
    const event: MpesaCallbackEvent = {
      _id: createHash('sha256').update(identity).digest('hex'),
      environment: this.configuration.environment,
      checkoutRequestId: callback.CheckoutRequestID,
      merchantRequestId: callback.MerchantRequestID,
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc,
      ...(typeof amount === 'number' ? { amount } : {}),
      ...(typeof receipt === 'string' ? { mpesaReceiptNumber: receipt } : {}),
      ...(phone !== undefined ? { phoneNumber: String(phone) } : {}),
      ...(date !== undefined ? { transactionDate: String(date) } : {}),
      receivedAt: new Date(),
      reportedOutcome: reportedOutcome(callback.ResultCode),
      // Persist first; matching never uses free-text billing references.
      processingStatus: 'UNMATCHED',
      verificationStatus: 'UNVERIFIED',
      financialPostingEnabled: false,
    };
    try {
      await this.repository.record(event);
      await this.attempts?.correlate(event._id);
    } catch {
      // Database errors may contain payment data. Do not attach their cause.
      throw storageError();
    }
  }
}
