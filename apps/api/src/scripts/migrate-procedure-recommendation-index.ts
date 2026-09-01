import { closeDatabase, connectDatabase } from '../database/client.js';
import { ProcedureRecommendationModel } from '../modules/surgery/surgery.model.js';

const LEGACY_INDEX = 'encounterType_1_encounterId_1_serviceId_1';

const migrate = async () => {
  await connectDatabase();

  const indexes = await ProcedureRecommendationModel.collection.indexes();
  console.log('Existing indexes:', indexes.map((i) => i.name));

  if (indexes.some((index) => index.name === LEGACY_INDEX)) {
    console.log(`Dropping faulty index ${LEGACY_INDEX}...`);
    await ProcedureRecommendationModel.collection.dropIndex(LEGACY_INDEX);
    console.log(`Dropped ${LEGACY_INDEX}`);
  }

  // Create proper unique index on patientId + serviceId for active recommendations
  await ProcedureRecommendationModel.collection.createIndex(
    { patientId: 1, serviceId: 1 },
    {
      name: 'patientId_1_serviceId_1_active_unique',
      unique: true,
      partialFilterExpression: { status: 'ACTIVE' },
    },
  );
  console.log('Created index: patientId_1_serviceId_1_active_unique');

  // Create partial unique index on encounterType + encounterId + serviceId for valid objectId encounterId
  await ProcedureRecommendationModel.collection.createIndex(
    { encounterType: 1, encounterId: 1, serviceId: 1 },
    {
      name: 'encounterType_1_encounterId_1_serviceId_1_opd_unique',
      unique: true,
      partialFilterExpression: { status: 'ACTIVE', encounterId: { $type: 'objectId' } },
    },
  );
  console.log('Created index: encounterType_1_encounterId_1_serviceId_1_opd_unique');

  const finalIndexes = await ProcedureRecommendationModel.collection.indexes();
  console.log('Final indexes on ProcedureRecommendation:', JSON.stringify(finalIndexes, null, 2));
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
