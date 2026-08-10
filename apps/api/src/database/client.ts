import postgres from 'postgres';
import { env } from '../config/env.js';

const shouldRequireSsl =
  env.database.url.includes('sslmode=require') ||
  env.database.url.includes('supabase.com') ||
  env.app.environment === 'prod';

export const sql = postgres(env.database.url, {
  max: env.database.poolSize,
  connect_timeout: env.database.connectTimeoutSeconds,
  ssl: shouldRequireSsl ? 'require' : undefined,
  onnotice: () => undefined,
});

export const closeDatabase = async () => {
  await sql.end({ timeout: 5 });
};
