import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createOpdVitalsBodySchema,
  listOpdVitalsQuerySchema,
  opdVitalsVisitParamsSchema,
} from './opd-vitals.schemas.js';
import type { CreateOpdVitalsDTO, OpdVitalsListQuery } from './opd-vitals.types.js';

type OpdVitalsVisitParams = {
  visitId: string;
};

export const registerOpdVitalsRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: OpdVitalsVisitParams; Querystring: OpdVitalsListQuery }>(
    '/api/opd/visits/:visitId/vitals',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Vitals', 'View'),
      schema: {
        params: opdVitalsVisitParamsSchema,
        querystring: listOpdVitalsQuerySchema,
      },
    },
    async (request) => ok(await services.opdVitals.listByVisit(request.params.visitId, request.query)),
  );

  app.get<{ Params: OpdVitalsVisitParams }>(
    '/api/opd/visits/:visitId/vitals/latest',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Vitals', 'View'),
      schema: {
        params: opdVitalsVisitParamsSchema,
      },
    },
    async (request) => ok(await services.opdVitals.getLatestByVisit(request.params.visitId)),
  );

  app.post<{ Params: OpdVitalsVisitParams; Body: CreateOpdVitalsDTO }>(
    '/api/opd/visits/:visitId/vitals',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Vitals', 'Create'),
      schema: {
        body: createOpdVitalsBodySchema,
        params: opdVitalsVisitParamsSchema,
      },
    },
    async (request, reply) => {
      const vitals = await services.opdVitals.create(request.params.visitId, request.body, request.user!.id);
      return reply.status(201).send(ok(vitals));
    },
  );
};
