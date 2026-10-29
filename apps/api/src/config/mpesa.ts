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

export const parseMpesaReconciliationConfiguration = (values: NodeJS.ProcessEnv) => {
  const parsed = z.object({
    enabled: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    intervalMs: z.coerce.number().int().min(1000).max(300000).default(30000),
    batchSize: z.coerce.number().int().min(1).max(50).default(10),
  }).safeParse({
    enabled: values.MPESA_RECONCILIATION_ENABLED,
    intervalMs: values.MPESA_RECONCILIATION_INTERVAL_MS,
    batchSize: values.MPESA_RECONCILIATION_BATCH_SIZE,
  });
  if (!parsed.success) throw new Error('Invalid M-PESA reconciliation enabled, interval or batch configuration');
  if (parsed.data.enabled && values.MPESA_STK_ENABLED !== 'true') {
    throw new Error('M-PESA reconciliation requires MPESA_STK_ENABLED=true and configured merchant credentials');
  }
  return parsed.data;
};
