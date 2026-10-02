import { closeDatabase, connectDatabase } from '../database/client.js';
import { OpdClinicalOrderModel } from '../modules/opd/opd-clinical-order.model.js';
import { OpdPrescriptionModel } from '../modules/opd/opd-prescription.model.js';

const dropIndexIfPresent = async (
  model: typeof OpdPrescriptionModel | typeof OpdClinicalOrderModel,
  name: string,
) => {
  const indexes = await model.collection.indexes();
  if (indexes.some((index) => index.name === name)) {
    await model.collection.dropIndex(name);
  }
};

const migrate = async () => {
  await connectDatabase();

  const prescriptionCleanup = await OpdPrescriptionModel.collection.updateMany(
    { sourceType: { $ne: 'OPD_VISIT' }, visitId: { $type: 'null' } },
    { $unset: { visitId: '' } },
  );
  const clinicalOrderCleanup = await OpdClinicalOrderModel.collection.updateMany(
    { sourceType: { $ne: 'OPD_VISIT' }, visitId: { $type: 'null' } },
    { $unset: { visitId: '' } },
  );

  await OpdPrescriptionModel.collection.createIndex(
    { visitId: 1 },
    {
      name: 'visitId_unique_objectId',
      unique: true,
      partialFilterExpression: { visitId: { $type: 'objectId' } },
    },
  );
  await OpdClinicalOrderModel.collection.createIndex(
    { visitId: 1, orderType: 1 },
    {
      name: 'visitId_orderType_unique_objectId',
      unique: true,
      partialFilterExpression: { visitId: { $type: 'objectId' } },
    },
  );

  await dropIndexIfPresent(OpdPrescriptionModel, 'visitId_1');
  await dropIndexIfPresent(OpdClinicalOrderModel, 'visitId_1_orderType_1');

  console.log(JSON.stringify({
    prescriptionNullVisitIdsRemoved: prescriptionCleanup.modifiedCount,
    clinicalOrderNullVisitIdsRemoved: clinicalOrderCleanup.modifiedCount,
    indexes: [
      'visitId_unique_objectId',
      'visitId_orderType_unique_objectId',
    ],
  }));
};

migrate()
  .finally(closeDatabase)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
