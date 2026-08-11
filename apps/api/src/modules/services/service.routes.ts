import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  serviceIdParamsSchema,
  createServiceBodySchema,
  listServicesQuerySchema,
  updateServiceBodySchema,
} from './service.schemas.js';
import type { ServiceListQuery, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

type ServiceIdParams = {
  id: string;
};

export const registerServiceRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: ServiceListQuery }>(
    '/api/services',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'View'),
      schema: {
        querystring: listServicesQuerySchema,
      },
    },
    async (request) => ok(await services.serviceCatalogue.list(request.query)),
  );

  app.get<{ Params: ServiceIdParams }>(
    '/api/services/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'View'),
      schema: {
        params: serviceIdParamsSchema,
      },
    },
    async (request) => ok(await services.serviceCatalogue.getById(request.params.id)),
  );

  app.post<{ Body: CreateServiceDTO }>(
    '/api/services',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'Create'),
      schema: {
        body: createServiceBodySchema,
      },
    },
    async (request, reply) => {
      const service = await services.serviceCatalogue.create(request.body, request.user!.id);
      return reply.status(201).send(ok(service));
    },
  );

  app.patch<{ Params: ServiceIdParams; Body: UpdateServiceDTO }>(
    '/api/services/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'Edit'),
      schema: {
        params: serviceIdParamsSchema,
        body: updateServiceBodySchema,
      },
    },
    async (request) => ok(await services.serviceCatalogue.update(request.params.id, request.body, request.user!.id)),
  );

  app.delete<{ Params: ServiceIdParams }>(
    '/api/services/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'Delete'),
      schema: {
        params: serviceIdParamsSchema,
      },
    },
    async (request) => {
      await services.serviceCatalogue.delete(request.params.id);
      return ok({ success: true });
    },
  );
};
