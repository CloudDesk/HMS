import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const decimalDigits = (length: number) => z.union([
  z.string().regex(new RegExp(`^\\d{${length}}$`)),
  z.number().int().safe().nonnegative().refine((value) => String(value).length === length),
]).transform(String);

const transactionDate = decimalDigits(14).refine((value) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && month >= 1 && month <= 12 && day >= 1 &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day &&
    Number(value.slice(8, 10)) < 24 && Number(value.slice(10, 12)) < 60 &&
    Number(value.slice(12, 14)) < 60;
});

const metadata = z.strictObject({
  Item: z.array(z.strictObject({
    Name: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9]*$/),
    Value: z.union([z.string().max(256), z.number().finite()]).optional(),
  })).max(20),
}).superRefine(({ Item }, ctx) => {
  const names = new Set<string>();
  for (const item of Item) {
    if (names.has(item.Name)) ctx.addIssue({ code: 'custom', message: 'Duplicate metadata name' });
    names.add(item.Name);
    const schema = item.Name === 'Amount' ? z.number().positive().max(Number.MAX_SAFE_INTEGER)
      : item.Name === 'PhoneNumber' ? decimalDigits(12)
        : item.Name === 'TransactionDate' ? transactionDate
          : item.Name === 'MpesaReceiptNumber' ? z.string().min(1).max(32).regex(/^[A-Za-z0-9]+$/)
            : undefined;
    if (schema && !schema.safeParse(item.Value).success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid payment metadata' });
    }
  }
});

export const mpesaCallbackSchema = z.strictObject({
  Body: z.strictObject({
    stkCallback: z.strictObject({
      MerchantRequestID: identifier,
      CheckoutRequestID: identifier,
      ResultCode: z.number().int().nonnegative().max(2147483647),
      ResultDesc: z.string().min(1).max(1024),
      CallbackMetadata: metadata.optional(),
    }),
  }),
});

export type MpesaCallback = z.infer<typeof mpesaCallbackSchema>['Body']['stkCallback'];

export const parseMpesaCallback = (body: unknown): MpesaCallback => {
  const parsed = mpesaCallbackSchema.safeParse(body);
  if (!parsed.success) {
    // Do not echo values, property names, or provider-controlled descriptions.
    throw new AppError('Invalid M-PESA callback payload', 400, 'MPESA_CALLBACK_INVALID');
  }
  return parsed.data.Body.stkCallback;
};
