import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './database/client.js';
import { seedDatabase } from './database/seed.js';
import { MpesaReconciliationWorker } from './modules/mpesa/mpesa-reconciliation.worker.js';

const { app, services } = await buildApp();
let dashboardRefreshTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;
const mpesaReconciliation = new MpesaReconciliationWorker(services.mpesaAttempts, env.mpesaReconciliation, () => {
  app.log.error({ code: 'MPESA_RECONCILIATION_FAILED' }, 'M-PESA reconciliation sweep failed');
});

const closeGracefully = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down API');
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
  }
  await mpesaReconciliation.stop();
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

try {
  await connectDatabase();
  await seedDatabase();
  await services.administrationDashboard.refresh();
  dashboardRefreshTimer = setInterval(() => {
    services.administrationDashboard.refresh().catch((error: unknown) => {
      app.log.error({ error }, 'Administration dashboard snapshot refresh failed');
    });
  }, 300_000);
  dashboardRefreshTimer.unref();
  const database = await services.database.healthCheck();
  app.log.info(
    {
      database: database.database,
    },
    'Database connection verified',
  );

  await app.listen({ host: env.app.host, port: env.app.port });
  mpesaReconciliation.start();
} catch (error) {
  app.log.error(error);
  await mpesaReconciliation.stop();
  await closeDatabase().catch(() => undefined);
  process.exit(1);
}
