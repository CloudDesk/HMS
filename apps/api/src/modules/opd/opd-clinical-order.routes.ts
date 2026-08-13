import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { clinicalOrderParamsSchema, saveClinicalOrderBodySchema } from './opd-clinical-order.schemas.js';
import type { ClinicalOrderType, SaveOpdClinicalOrderDTO } from './opd-clinical-order.types.js';

type ClinicalOrderParams = { visitId: string; orderType: ClinicalOrderType };

export const registerOpdClinicalOrderRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: ClinicalOrderParams }>(
    '/api/opd/visits/:visitId/clinical-orders/:orderType',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Clinical Orders', 'View'),
      schema: { params: clinicalOrderParamsSchema },
    },
    async (request) =>
      ok(await services.opdClinicalOrders.getByVisitAndType(request.params.visitId, request.params.orderType)),
  );

  app.put<{ Params: ClinicalOrderParams; Body: SaveOpdClinicalOrderDTO }>(
    '/api/opd/visits/:visitId/clinical-orders/:orderType',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Clinical Orders', 'Edit'),
      schema: { body: saveClinicalOrderBodySchema, params: clinicalOrderParamsSchema },
    },
    async (request) =>
      ok(
        await services.opdClinicalOrders.saveDraft(
          request.params.visitId,
          request.params.orderType,
          request.body,
          request.user!.id,
        ),
      ),
  );

  app.post<{ Params: ClinicalOrderParams; Body: SaveOpdClinicalOrderDTO }>(
    '/api/opd/visits/:visitId/clinical-orders/:orderType/submit',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Clinical Orders', 'Edit'),
      schema: { body: saveClinicalOrderBodySchema, params: clinicalOrderParamsSchema },
    },
    async (request) =>
      ok(
        await services.opdClinicalOrders.submit(
          request.params.visitId,
          request.params.orderType,
          request.body,
          request.user!.id,
        ),
      ),
  );
};
