import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './database/client.js';
import { initializeAuthSchema } from './database/migrations/auth-schema.js';
import { initializePermissionManagementSchema } from './database/migrations/permission-schema.js';
import { initializeRoleManagementSchema } from './database/migrations/role-schema.js';
import { initializeUserManagementSchema } from './database/migrations/user-schema.js';

const { app, services } = await buildApp();

const closeGracefully = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'Shutting down API');
  await Promise.all([app.close(), closeDatabase()]);
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

try {
  const database = await services.database.healthCheck();
  app.log.info(
    {
      database: database.database,
      user: database.user,
    },
    'Database connection verified',
  );

  await initializeAuthSchema();
  app.log.info('Authentication schema initialized');

  await initializeUserManagementSchema();
  app.log.info('User management schema initialized');

  await initializeRoleManagementSchema();
  app.log.info('Role management schema initialized');

  await initializePermissionManagementSchema();
  app.log.info('Permission management schema initialized');

  await app.listen({ host: env.app.host, port: env.app.port });
} catch (error) {
  app.log.error(error);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
}
