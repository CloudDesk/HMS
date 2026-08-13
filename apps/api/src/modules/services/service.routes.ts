import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  serviceIdParamsSchema,
  createServiceBodySchema,
  listServicesQuerySchema,
  updateServiceBodySchema,
  updateServiceStatusBodySchema,
} from './service.schemas.js';
import type { ServiceListQuery, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

type ServiceIdParams = {
  id: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

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

  app.get(
    '/api/services/summary',
    { preHandler: requirePermission(services, 'Administration', 'Services', 'View') },
    async () => ok(await services.serviceCatalogue.summary()),
  );

  app.get<{ Querystring: ServiceListQuery }>(
    '/api/services/export',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'Export'),
      schema: { querystring: listServicesQuerySchema },
    },
    async (request, reply) => {
      const stream = await services.serviceCatalogue.export(request.query, request.user!.id, metadataFromRequest(request));
      return reply.header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="hms-services.csv"').send(stream);
    },
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
      const service = await services.serviceCatalogue.create(request.body, request.user!.id, metadataFromRequest(request));
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
    async (request) => ok(await services.serviceCatalogue.update(request.params.id, request.body, request.user!.id, metadataFromRequest(request))),
  );

  app.patch<{ Params: ServiceIdParams; Body: { status: 'ACTIVE' | 'INACTIVE' } }>(
    '/api/services/:id/status',
    {
      preHandler: requirePermission(services, 'Administration', 'Services', 'Edit'),
      schema: { params: serviceIdParamsSchema, body: updateServiceStatusBodySchema },
    },
    async (request) => ok(await services.serviceCatalogue.updateStatus(request.params.id, request.body.status, request.user!.id, metadataFromRequest(request))),
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
      await services.serviceCatalogue.delete(request.params.id, request.user!.id, metadataFromRequest(request));
      return ok({ success: true });
    },
  );
};
