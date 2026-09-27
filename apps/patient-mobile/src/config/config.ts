import { z } from 'zod';

export const publicConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  apiBaseUrl: z.url().transform((url) => url.replace(/\/+$/, '')),
}).superRefine(({ environment, apiBaseUrl }, context) => {
  const url = new URL(apiBaseUrl);
  if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/api')
    || (url.protocol !== 'https:' && (environment !== 'development' || url.protocol !== 'http:'))) {
    context.addIssue({ code: 'custom', message: 'Provide a public HTTPS API URL ending in /api. HTTP is development-only.' });
  }
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export function readPublicConfig(): PublicConfig {
  const environment = process.env.EXPO_PUBLIC_HMS_ENV ?? 'development';
  return publicConfigSchema.parse({ environment,
    apiBaseUrl: process.env.EXPO_PUBLIC_HMS_API_URL
      ?? (environment === 'development' ? 'http://10.0.2.2:4000/api' : undefined),
  });
}
