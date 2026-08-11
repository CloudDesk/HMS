import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './database/client.js';
import { seedDatabase } from './database/seed.js';

const { app, services } = await buildApp();

const closeGracefully = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'Shutting down API');
  await Promise.all([app.close(), closeDatabase()]);
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

try {
  await connectDatabase();
  await seedDatabase();
  const database = await services.database.healthCheck();
  app.log.info(
    {
      database: database.database,
    },
    'Database connection verified',
  );

  await app.listen({ host: env.app.host, port: env.app.port });
} catch (error) {
  app.log.error(error);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
}
