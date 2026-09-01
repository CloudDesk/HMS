import { closeDatabase, connectDatabase } from '../database/client.js';
import { BillingInvoiceModel } from '../modules/billing/billing.model.js';

const LEGACY_CONTEXT_INDEX = 'contextType_1_contextId_1';

const migrate = async () => {
  await connectDatabase();

  const contextIdCleanup = await BillingInvoiceModel.collection.updateMany(
    { contextId: { $type: 'null' } },
    { $unset: { contextId: '' } },
  );
  const contextTypeCleanup = await BillingInvoiceModel.collection.updateMany(
    { contextType: { $type: 'null' } },
    { $unset: { contextType: '' } },
  );

  await BillingInvoiceModel.collection.createIndex(
    { contextType: 1, contextId: 1 },
    {
      name: 'contextType_contextId_unique_objectId',
      unique: true,
      partialFilterExpression: { contextId: { $type: 'objectId' } },
    },
  );

  const indexes = await BillingInvoiceModel.collection.indexes();
  if (indexes.some((index) => index.name === LEGACY_CONTEXT_INDEX)) {
    await BillingInvoiceModel.collection.dropIndex(LEGACY_CONTEXT_INDEX);
  }

  console.log(JSON.stringify({
    nullContextIdsRemoved: contextIdCleanup.modifiedCount,
    nullContextTypesRemoved: contextTypeCleanup.modifiedCount,
    index: 'contextType_contextId_unique_objectId',
  }));
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
