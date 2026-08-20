import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { referralVisitParamsSchema, saveReferralBodySchema } from './opd-referral.schemas.js';
import type { SaveOpdReferralDTO } from './opd-referral.types.js';

type VisitParams = { visitId: string };

export const registerOpdReferralRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/referral', {
    preHandler: requirePermission(services, 'OPD', 'OPD Referral', 'View'),
    schema: { params: referralVisitParamsSchema },
  }, async (request) => ok(await services.opdReferrals.getByVisit(request.params.visitId, request.user!.id)));

  app.put<{ Params: VisitParams; Body: SaveOpdReferralDTO }>('/api/opd/visits/:visitId/referral', {
    preHandler: requirePermission(services, 'OPD', 'OPD Referral', 'Edit'),
    schema: { body: saveReferralBodySchema, params: referralVisitParamsSchema },
  }, async (request) => ok(await services.opdReferrals.saveDraft(request.params.visitId, request.body, request.user!.id)));

  app.post<{ Params: VisitParams; Body: SaveOpdReferralDTO }>('/api/opd/visits/:visitId/referral/submit', {
    preHandler: requirePermission(services, 'OPD', 'OPD Referral', 'Edit'),
    schema: { body: saveReferralBodySchema, params: referralVisitParamsSchema },
  }, async (request) => ok(await services.opdReferrals.submit(request.params.visitId, request.body, request.user!.id)));
};
