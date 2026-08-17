import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  opdConsultationVisitParamsSchema,
  saveOpdConsultationBodySchema,
} from './opd-consultation.schemas.js';
import type { SaveOpdConsultationDTO } from './opd-consultation.types.js';

type OpdConsultationVisitParams = {
  visitId: string;
};

export const registerOpdConsultationRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: OpdConsultationVisitParams }>(
    '/api/opd/visits/:visitId/consultation',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
      schema: {
        params: opdConsultationVisitParamsSchema,
      },
    },
    async (request) => ok(await services.opdConsultations.getByVisit(request.params.visitId, request.user!.id)),
  );

  app.put<{ Params: OpdConsultationVisitParams; Body: SaveOpdConsultationDTO }>(
    '/api/opd/visits/:visitId/consultation',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
      schema: {
        body: saveOpdConsultationBodySchema,
        params: opdConsultationVisitParamsSchema,
      },
    },
    async (request) => ok(await services.opdConsultations.saveDraft(request.params.visitId, request.body, request.user!.id)),
  );

  app.post<{ Params: OpdConsultationVisitParams; Body: SaveOpdConsultationDTO }>(
    '/api/opd/visits/:visitId/consultation/complete',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
      schema: {
        body: saveOpdConsultationBodySchema,
        params: opdConsultationVisitParamsSchema,
      },
    },
    async (request) => ok(await services.opdConsultations.complete(request.params.visitId, request.body, request.user!.id)),
  );
};
