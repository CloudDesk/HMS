import { z } from 'zod';

const schema = z.object({
  consumerKey: z.string().min(1), consumerSecret: z.string().min(1), passkey: z.string().min(1),
  businessShortCode: z.string().regex(/^\d{5,7}$/), partyB: z.string().regex(/^\d{5,7}$/),
  transactionType: z.enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline']),
  callbackUrl: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/api/payments/mpesa/callback' && url.hostname !== 'localhost';
  }),
  branchIds: z.array(z.string().regex(/^[a-fA-F0-9]{24}$/)).min(1),
});
export type MpesaMerchant = z.infer<typeof schema>;

// Only static names and guidance are logged; never include configured values
// or raw Zod issues, which can contain credentials or other sensitive inputs.
const configurationHints: Record<string, string> = {
  consumerKey: 'MPESA_CONSUMER_KEY must be set',
  consumerSecret: 'MPESA_CONSUMER_SECRET must be set',
  passkey: 'MPESA_PASSKEY must be set',
  businessShortCode: 'MPESA_BUSINESS_SHORT_CODE must contain 5 to 7 digits',
  partyB: 'MPESA_PARTY_B must contain 5 to 7 digits',
  transactionType: 'MPESA_TRANSACTION_TYPE must be CustomerPayBillOnline or CustomerBuyGoodsOnline',
  callbackUrl: 'MPESA_CALLBACK_URL must use a public HTTPS host (not localhost), path /api/payments/mpesa/callback, and no credentials, query or fragment',
  branchIds: 'MPESA_BRANCH_IDS must contain comma-separated 24-character hexadecimal branch ObjectIds',
};

export const parseMpesaOutboundConfiguration = (values: NodeJS.ProcessEnv): MpesaMerchant | undefined => {
  if (values.MPESA_STK_ENABLED === undefined || values.MPESA_STK_ENABLED === 'false') return undefined;
  if (values.MPESA_STK_ENABLED !== 'true') throw new Error('MPESA_STK_ENABLED must be true or false');
  const parsed = schema.safeParse({
    consumerKey: values.MPESA_CONSUMER_KEY, consumerSecret: values.MPESA_CONSUMER_SECRET,
    passkey: values.MPESA_PASSKEY, businessShortCode: values.MPESA_BUSINESS_SHORT_CODE,
    partyB: values.MPESA_PARTY_B, transactionType: values.MPESA_TRANSACTION_TYPE,
    callbackUrl: values.MPESA_CALLBACK_URL,
    branchIds: values.MPESA_BRANCH_IDS?.split(',').map((id) => id.trim().toLowerCase()),
  });
  if (!parsed.success) {
    const hints = [...new Set(parsed.error.issues.map((issue) =>
      configurationHints[String(issue.path[0])] ?? 'Check M-PESA outbound settings'))];
    throw new Error(`Invalid or incomplete M-PESA outbound configuration: ${hints.join('; ')}`);
  }
  return parsed.data;
};
