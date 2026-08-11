import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  branchIdParamsSchema,
  createBranchBodySchema,
  listBranchesQuerySchema,
  updateBranchBodySchema,
} from './branch.schemas.js';
import type { BranchListQuery, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

type BranchIdParams = {
  id: string;
};

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
      const branch = await services.branches.create(request.body, request.user!.id);
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
    async (request) => ok(await services.branches.update(request.params.id, request.body, request.user!.id)),
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
      await services.branches.delete(request.params.id);
      return ok({ success: true });
    },
  );
};
