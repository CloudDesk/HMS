import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  parsePharmacyBatchListQuery,
  parsePharmacyBatchParams,
  parsePharmacyInventoryListQuery,
  parsePharmacyInventoryParams,
  parsePharmacyMovementListQuery,
  parseRecordMedicineStockAdjustmentBody,
  parseRecordMedicineStockMovementBody,
  parseRegisterMedicineBatchBody,
  parseUpdateLowStockThresholdBody,
  parseUpdateMedicineBatchBody,
} from './pharmacy-inventory.schemas.js';

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerPharmacyInventoryRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/pharmacy/medicine-inventory', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'View'),
  }, async (request) => ok(await services.pharmacyInventory.list(
    parsePharmacyInventoryListQuery(request.query),
    request.user!.id,
    metadataFromRequest(request),
  )));

  app.get('/api/pharmacy/medicine-inventory/summary', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'View'),
  }, async (request) => {
    const query = parsePharmacyInventoryListQuery(request.query);
    return ok(await services.pharmacyInventory.summary(query.branch_id, request.user!.id, metadataFromRequest(request)));
  });

  app.get('/api/pharmacy/medicine-inventory/movements', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'View'),
  }, async (request) => ok(await services.pharmacyInventory.listMovements(
    parsePharmacyMovementListQuery(request.query),
    request.user!.id,
  )));

  app.post('/api/pharmacy/medicine-inventory/movements', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'RecordMovement'),
  }, async (request, reply) => {
    const result = await services.pharmacyInventory.recordMovement(
      parseRecordMedicineStockMovementBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(ok(result));
  });

  app.post('/api/pharmacy/medicine-inventory/adjustments', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'AdjustStock'),
  }, async (request, reply) => {
    const result = await services.pharmacyInventory.recordMovement(
      parseRecordMedicineStockAdjustmentBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    );
    return reply.status(result.replayed ? 200 : 201).send(ok(result));
  });

  app.get('/api/pharmacy/medicine-inventory/:medicineId', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'View'),
  }, async (request) => {
    const { medicineId } = parsePharmacyInventoryParams(request.params);
    const query = parsePharmacyInventoryListQuery(request.query);
    return ok(await services.pharmacyInventory.getDetail(
      medicineId,
      query.branch_id,
      request.user!.id,
      metadataFromRequest(request),
    ));
  });

  app.get('/api/pharmacy/medicine-inventory/:medicineId/batches', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'View'),
  }, async (request) => {
    const { medicineId } = parsePharmacyInventoryParams(request.params);
    return ok(await services.pharmacyInventory.listBatches(
      medicineId,
      parsePharmacyBatchListQuery(request.query),
      request.user!.id,
      metadataFromRequest(request),
    ));
  });

  app.post('/api/pharmacy/medicine-inventory/:medicineId/batches', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'RegisterBatch'),
  }, async (request, reply) => {
    const { medicineId } = parsePharmacyInventoryParams(request.params);
    const result = await services.pharmacyInventory.registerBatch(
      medicineId,
      parseRegisterMedicineBatchBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    );
    return reply.status(201).send(ok(result));
  });

  app.patch('/api/pharmacy/medicine-inventory/batches/:batchId', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'EditBatch'),
  }, async (request) => {
    const { batchId } = parsePharmacyBatchParams(request.params);
    return ok(await services.pharmacyInventory.updateBatch(
      batchId,
      parseUpdateMedicineBatchBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    ));
  });

  app.patch('/api/pharmacy/medicine-inventory/:medicineId/low-stock-threshold', {
    preHandler: requirePermission(services, 'Pharmacy', 'Medicine Inventory', 'ConfigureLowStock'),
  }, async (request) => {
    const { medicineId } = parsePharmacyInventoryParams(request.params);
    return ok(await services.pharmacyInventory.updateThreshold(
      medicineId,
      parseUpdateLowStockThresholdBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    ));
  });
};

