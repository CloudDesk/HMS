import Fastify from 'fastify';
import { env } from '../config/env.js';
import { loggerConfig } from '../config/logger.js';
import { closeDatabase, connectDatabase } from '../database/client.js';

// Do not import buildApp, models or seedDatabase: this command must not write data.
const verifier = Fastify({ logger: loggerConfig });

try {
  if (!env.database.expectedHost || !env.database.expectedDatabase) {
    throw new Error('MONGODB_EXPECTED_HOST and MONGODB_EXPECTED_DATABASE are required for target verification');
  }
  await connectDatabase();
  verifier.log.info(
    { database: env.database.expectedDatabase },
    'MongoDB target verified; no application startup, seeding or data writes were performed',
  );
} catch (error) {
  verifier.log.error(
    { errorName: error instanceof Error ? error.name : 'UnknownError' },
    'MongoDB target verification failed; check connection settings, expected target and network access',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
  await verifier.close();
}
