import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import type { RoleListQuery, RoleStatus, RoleType } from './role.types.js';
import {
  assignRoleUserBodySchema,
  createRoleBodySchema,
  listRolesQuerySchema,
  roleAuditQuerySchema,
  roleIdParamsSchema,
  roleListResponseSchema,
  roleResponseSchema,
  roleUserParamsSchema,
  updateRoleBodySchema,
  updateRoleStatusBodySchema,
} from './role.schemas.js';

type RoleIdParams = {
  id: string;
};

type RoleUserParams = {
  id: string;
  userId: string;
};

type ListRolesQuery = Partial<{
  search: string;
  status: RoleStatus;
  type: RoleType;
  page: number;
  limit: number;
  sortBy: RoleListQuery['sortBy'];
  sortOrder: RoleListQuery['sortOrder'];
}>;

type CreateRoleBody = {
  code: string;
  name: string;
  description?: string | null;
  type?: RoleType;
  status?: RoleStatus;
  color?: string | null;
};

type UpdateRoleBody = Partial<Omit<CreateRoleBody, 'status'>>;

type UpdateRoleStatusBody = {
  status: RoleStatus;
};

type AssignRoleUserBody = {
  userId: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerRoleRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: ListRolesQuery }>(
    '/api/roles',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'View'),
      schema: {
        querystring: listRolesQuerySchema,
        response: { 200: roleListResponseSchema },
      },
    },
    async (request) => ok(await services.roles.list(request.query)),
  );

  app.get<{ Params: RoleIdParams }>(
    '/api/roles/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'View'),
      schema: {
        params: roleIdParamsSchema,
        response: { 200: roleResponseSchema },
      },
    },
    async (request) => ok(await services.roles.getById(request.params.id)),
  );

  app.get<{ Params: RoleIdParams; Querystring: { page?: number; limit?: number } }>(
    '/api/roles/:id/audit-logs',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'View'),
      schema: { params: roleIdParamsSchema, querystring: roleAuditQuerySchema },
    },
    async (request) => ok(await services.roles.listAuditLogs(request.params.id, request.query)),
  );

  app.post<{ Body: CreateRoleBody }>(
    '/api/roles',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Create'),
      schema: {
        body: createRoleBodySchema,
      },
    },
    async (request, reply) => {
      const role = await services.roles.create(
        request.body,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.status(201).send(ok(role));
    },
  );

  app.patch<{ Params: RoleIdParams; Body: UpdateRoleBody }>(
    '/api/roles/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Edit'),
      schema: {
        params: roleIdParamsSchema,
        body: updateRoleBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.roles.update(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Params: RoleIdParams; Body: UpdateRoleStatusBody }>(
    '/api/roles/:id/status',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Edit'),
      schema: {
        params: roleIdParamsSchema,
        body: updateRoleStatusBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.roles.updateStatus(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.post<{ Params: RoleIdParams; Body: AssignRoleUserBody }>(
    '/api/roles/:id/users',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Assign'),
      schema: {
        params: roleIdParamsSchema,
        body: assignRoleUserBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.roles.assignUser(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.delete<{ Params: RoleUserParams }>(
    '/api/roles/:id/users/:userId',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Assign'),
      schema: {
        params: roleUserParamsSchema,
      },
    },
    async (request) =>
      ok(
        await services.roles.removeUser(
          request.params.id,
          request.params.userId,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.delete<{ Params: RoleIdParams }>(
    '/api/roles/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Roles', 'Delete'),
      schema: {
        params: roleIdParamsSchema,
      },
    },
    async (request) =>
      ok(await services.roles.delete(request.params.id, request.user!.id, metadataFromRequest(request))),
  );
};
