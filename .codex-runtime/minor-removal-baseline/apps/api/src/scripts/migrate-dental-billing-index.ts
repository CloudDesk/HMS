import { closeDatabase, connectDatabase } from '../database/client.js';
import { BillingInvoiceItemModel } from '../modules/billing/billing.model.js';

const INDEX_NAME = 'procedure_originating_order_unique';

const migrate = async () => {
  await connectDatabase();
  await BillingInvoiceItemModel.collection.createIndex(
    { serviceType: 1, originatingOrderId: 1 },
    {
      name: INDEX_NAME,
      unique: true,
      partialFilterExpression: {
        serviceType: 'PROCEDURE',
        originatingOrderId: { $type: 'objectId' },
        deletedAt: null,
      },
    },
  );
  console.log(JSON.stringify({ index: INDEX_NAME }));
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
