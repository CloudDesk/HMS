import { z } from 'zod';

export const parseMpesaConfiguration = (values: NodeJS.ProcessEnv) => {
  const result = z.object({
    environment: z.enum(['sandbox', 'production']).default('sandbox'),
    perIpLimit: z.coerce.number().int().min(1).max(10000).default(120),
    globalLimit: z.coerce.number().int().min(1).max(100000).default(600),
  }).safeParse({
    environment: values.MPESA_ENVIRONMENT,
    perIpLimit: values.MPESA_CALLBACK_PER_IP_LIMIT,
    globalLimit: values.MPESA_CALLBACK_GLOBAL_LIMIT,
  });
  if (!result.success) throw new Error('Invalid M-PESA environment or callback rate-limit configuration');
  return result.data;
};
