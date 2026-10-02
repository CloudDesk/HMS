/**
 * Standalone script: Seed Dental Service Catalogue
 *
 * Usage: npm run seed:dental-services --workspace=@hms/api
 *
 * Connects to the database, runs seedDentalServices(), logs results, and exits.
 */

import { closeDatabase, connectDatabase } from '../database/client.js';
import { seedDentalServices } from '../database/seed-dental-services.js';

const run = async () => {
  await connectDatabase();
  console.log('[DentalServiceSeed] Connected to database. Starting seed...');

  const result = await seedDentalServices();

  console.log(
    JSON.stringify({
      departmentId: result.departmentId,
      departmentName: result.departmentName,
      inserted: result.inserted.length,
      insertedCodes: result.inserted,
      skipped: result.skipped.length,
      skippedCodes: result.skipped,
    }, null, 2),
  );
};

run()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error('[DentalServiceSeed] Error:', error);
    process.exitCode = 1;
  });
