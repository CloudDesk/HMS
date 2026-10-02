import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  branchIdParamsSchema,
  createBranchBodySchema,
  listBranchesQuerySchema,
  updateBranchBodySchema,
  updateBranchStatusBodySchema,
} from './branch.schemas.js';
import type { BranchListQuery, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

type BranchIdParams = {
  id: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerBranchRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: BranchListQuery }>(
    '/api/branches',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'View'),
      schema: {
        querystring: listBranchesQuerySchema,
      },
    },
    async (request) => ok(await services.branches.list(request.query)),
  );

  app.get(
    '/api/branches/summary',
    { preHandler: requirePermission(services, 'Administration', 'Branches', 'View') },
    async () => ok(await services.branches.summary()),
  );

  app.get<{ Querystring: BranchListQuery }>(
    '/api/branches/export',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'Export'),
      schema: { querystring: listBranchesQuerySchema },
    },
    async (request, reply) => {
      const stream = await services.branches.export(request.query, request.user!.id, metadataFromRequest(request));
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="hms-branches.csv"')
        .send(stream);
    },
  );

  app.get<{ Params: BranchIdParams }>(
    '/api/branches/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'View'),
      schema: {
        params: branchIdParamsSchema,
      },
    },
    async (request) => ok(await services.branches.getById(request.params.id)),
  );

  app.post<{ Body: CreateBranchDTO }>(
    '/api/branches',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'Create'),
      schema: {
        body: createBranchBodySchema,
      },
    },
    async (request, reply) => {
      const branch = await services.branches.create(request.body, request.user!.id, metadataFromRequest(request));
      return reply.status(201).send(ok(branch));
    },
  );

  app.patch<{ Params: BranchIdParams; Body: UpdateBranchDTO }>(
    '/api/branches/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'Edit'),
      schema: {
        params: branchIdParamsSchema,
        body: updateBranchBodySchema,
      },
    },
    async (request) => ok(await services.branches.update(request.params.id, request.body, request.user!.id, metadataFromRequest(request))),
  );

  app.patch<{ Params: BranchIdParams; Body: { status: 'ACTIVE' | 'INACTIVE' } }>(
    '/api/branches/:id/status',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'Edit'),
      schema: { params: branchIdParamsSchema, body: updateBranchStatusBodySchema },
    },
    async (request) => ok(await services.branches.updateStatus(request.params.id, request.body.status, request.user!.id, metadataFromRequest(request))),
  );

  app.delete<{ Params: BranchIdParams }>(
    '/api/branches/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Branches', 'Delete'),
      schema: {
        params: branchIdParamsSchema,
      },
    },
    async (request) => {
      await services.branches.delete(request.params.id, request.user!.id, metadataFromRequest(request));
      return ok({ success: true });
    },
  );
};
