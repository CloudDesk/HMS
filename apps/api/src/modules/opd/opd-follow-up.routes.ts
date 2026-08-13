import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { followUpVisitParamsSchema, saveFollowUpBodySchema } from './opd-follow-up.schemas.js';
import type { SaveOpdFollowUpDTO } from './opd-follow-up.types.js';

type VisitParams = { visitId: string };

export const registerOpdFollowUpRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/follow-up', {
    preHandler: requirePermission(services, 'OPD', 'OPD Follow-up', 'View'),
    schema: { params: followUpVisitParamsSchema },
  }, async (request) => ok(await services.opdFollowUps.getByVisit(request.params.visitId)));

  app.put<{ Params: VisitParams; Body: SaveOpdFollowUpDTO }>('/api/opd/visits/:visitId/follow-up', {
    preHandler: requirePermission(services, 'OPD', 'OPD Follow-up', 'Edit'),
    schema: { body: saveFollowUpBodySchema, params: followUpVisitParamsSchema },
  }, async (request) => ok(await services.opdFollowUps.saveDraft(request.params.visitId, request.body, request.user!.id)));

  app.post<{ Params: VisitParams; Body: SaveOpdFollowUpDTO }>('/api/opd/visits/:visitId/follow-up/schedule', {
    preHandler: requirePermission(services, 'OPD', 'OPD Follow-up', 'Edit'),
    schema: { body: saveFollowUpBodySchema, params: followUpVisitParamsSchema },
  }, async (request) => ok(await services.opdFollowUps.schedule(request.params.visitId, request.body, request.user!.id)));
};
