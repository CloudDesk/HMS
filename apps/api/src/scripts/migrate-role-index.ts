import { closeDatabase, connectDatabase } from '../database/client.js';
import { RoleModel } from '../modules/roles/role.model.js';

const migrate = async () => {
  await connectDatabase();

  // Normalize existing documents missing deletedAt field to null
  const cleanupResult = await RoleModel.collection.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } },
  );

  const existingIndexes = await RoleModel.collection.indexes();
  const legacyCodeIndex = existingIndexes.find((idx) => idx.name === 'code_1');

  if (legacyCodeIndex) {
    // If it doesn't have partialFilterExpression or partialFilterExpression is not deletedAt: null, drop it
    const hasPartial = Boolean(legacyCodeIndex.partialFilterExpression);
    if (!hasPartial) {
      await RoleModel.collection.dropIndex('code_1');
      console.log('Dropped legacy unconditional code_1 index');
    }
  }

  await RoleModel.collection.createIndex(
    { code: 1 },
    {
      name: 'code_1',
      unique: true,
      partialFilterExpression: { deletedAt: null },
    },
  );

  console.log(
    JSON.stringify({
      normalizedDeletedAtCount: cleanupResult.modifiedCount,
      index: 'code_1',
      partialFilterExpression: { deletedAt: null },
    }),
  );
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
