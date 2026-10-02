import { closeDatabase, connectDatabase } from '../database/client.js';
import { PharmacyDispensingModel } from '../modules/pharmacy-dispensing/pharmacy-dispensing.model.js';

const LEGACY_CONFIRM_INDEX = 'confirmIdempotencyKey_1';
const LEGACY_REVERSE_INDEX = 'reverseIdempotencyKey_1';

const dropIndexIfPresent = async (name: string) => {
  const indexes = await PharmacyDispensingModel.collection.indexes();
  if (indexes.some((index) => index.name === name)) {
    await PharmacyDispensingModel.collection.dropIndex(name);
  }
};

const migrate = async () => {
  await connectDatabase();

  const confirmCleanup = await PharmacyDispensingModel.collection.updateMany(
    { confirmIdempotencyKey: { $type: 'null' } },
    { $unset: { confirmIdempotencyKey: '' } },
  );
  const reverseCleanup = await PharmacyDispensingModel.collection.updateMany(
    { reverseIdempotencyKey: { $type: 'null' } },
    { $unset: { reverseIdempotencyKey: '' } },
  );

  await PharmacyDispensingModel.collection.createIndex(
    { confirmIdempotencyKey: 1 },
    {
      name: 'confirmIdempotencyKey_unique_string',
      unique: true,
      partialFilterExpression: { confirmIdempotencyKey: { $type: 'string' } },
    },
  );
  await PharmacyDispensingModel.collection.createIndex(
    { reverseIdempotencyKey: 1 },
    {
      name: 'reverseIdempotencyKey_unique_string',
      unique: true,
      partialFilterExpression: { reverseIdempotencyKey: { $type: 'string' } },
    },
  );

  await dropIndexIfPresent(LEGACY_CONFIRM_INDEX);
  await dropIndexIfPresent(LEGACY_REVERSE_INDEX);

  console.log(JSON.stringify({
    confirmNullFieldsRemoved: confirmCleanup.modifiedCount,
    reverseNullFieldsRemoved: reverseCleanup.modifiedCount,
    indexes: [
      'confirmIdempotencyKey_unique_string',
      'reverseIdempotencyKey_unique_string',
    ],
  }));
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
