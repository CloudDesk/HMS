import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  parseCreateMedicineBody,
  parseMedicineIdParams,
  parseMedicineListQuery,
  parseUpdateMedicineBody,
  parseUpdateMedicineStatusBody,
} from './medicine.schemas.js';

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerMedicineRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/medicines', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'View'),
  }, async (request) => ok(await services.medicines.list(parseMedicineListQuery(request.query))));

  app.get('/api/medicines/summary', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'View'),
  }, async () => ok(await services.medicines.summary()));

  app.get('/api/medicines/export', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'Export'),
  }, async (request, reply) => {
    const stream = await services.medicines.export(
      parseMedicineListQuery(request.query),
      request.user!.id,
      metadataFromRequest(request),
    );
    return reply.header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="hms-medicines.csv"')
      .send(stream);
  });

  app.get('/api/medicines/:id', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'View'),
  }, async (request) => {
    const { id } = parseMedicineIdParams(request.params);
    return ok(await services.medicines.getById(id));
  });

  app.post('/api/medicines', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'Create'),
  }, async (request, reply) => {
    const medicine = await services.medicines.create(
      parseCreateMedicineBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    );
    return reply.status(201).send(ok(medicine));
  });

  app.patch('/api/medicines/:id', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'Edit'),
  }, async (request) => {
    const { id } = parseMedicineIdParams(request.params);
    return ok(await services.medicines.update(
      id,
      parseUpdateMedicineBody(request.body),
      request.user!.id,
      metadataFromRequest(request),
    ));
  });

  app.patch('/api/medicines/:id/status', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'Edit'),
  }, async (request) => {
    const { id } = parseMedicineIdParams(request.params);
    const { status } = parseUpdateMedicineStatusBody(request.body);
    return ok(await services.medicines.updateStatus(id, status, request.user!.id, metadataFromRequest(request)));
  });

  app.delete('/api/medicines/:id', {
    preHandler: requirePermission(services, 'Administration', 'Medicines', 'Delete'),
  }, async (request) => {
    const { id } = parseMedicineIdParams(request.params);
    await services.medicines.delete(id, request.user!.id, metadataFromRequest(request));
    return ok({ success: true });
  });
};
