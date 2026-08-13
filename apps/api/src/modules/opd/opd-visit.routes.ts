import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createOpdVisitBodySchema,
  listOpdVisitsQuerySchema,
  opdVisitIdParamsSchema,
  updateOpdVisitStatusBodySchema,
} from './opd-visit.schemas.js';
import type { CreateOpdVisitDTO, OpdVisitListQuery, UpdateOpdVisitStatusDTO } from './opd-visit.types.js';

type OpdVisitIdParams = {
  id: string;
};

export const registerOpdVisitRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: OpdVisitListQuery }>(
    '/api/opd/visits',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Visits', 'View'),
      schema: {
        querystring: listOpdVisitsQuerySchema,
      },
    },
    async (request) => ok(await services.opdVisits.list(request.query, request.user!.id)),
  );

  app.get<{ Params: OpdVisitIdParams }>(
    '/api/opd/visits/:id',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Visits', 'View'),
      schema: {
        params: opdVisitIdParamsSchema,
      },
    },
    async (request) => ok(await services.opdVisits.getById(request.params.id, request.user!.id)),
  );

  app.post<{ Body: CreateOpdVisitDTO }>(
    '/api/opd/visits',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Visits', 'Create'),
      schema: {
        body: createOpdVisitBodySchema,
      },
    },
    async (request, reply) => {
      const visit = await services.opdVisits.create(request.body, request.user!.id);
      return reply.status(201).send(ok(visit));
    },
  );

  app.patch<{ Params: OpdVisitIdParams; Body: UpdateOpdVisitStatusDTO }>(
    '/api/opd/visits/:id/status',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Visits', 'Edit'),
      schema: {
        params: opdVisitIdParamsSchema,
        body: updateOpdVisitStatusBodySchema,
      },
    },
    async (request) => ok(await services.opdVisits.updateStatus(request.params.id, request.body, request.user!.id)),
  );
};
