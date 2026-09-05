import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import type { PermissionListQuery, PermissionStatus, PermissionType } from './permission.types.js';
import {
  createPermissionBodySchema,
  listPermissionsQuerySchema,
  permissionIdParamsSchema,
  permissionListResponseSchema,
  permissionResponseSchema,
  replaceRolePermissionsBodySchema,
  rolePermissionParamsSchema,
  updatePermissionBodySchema,
} from './permission.schemas.js';

type PermissionIdParams = {
  id: string;
};

type RolePermissionParams = {
  id: string;
};

type ListPermissionsQuery = Partial<{
  search: string;
  status: PermissionStatus;
  type: PermissionType;
  module: string;
  screen: string;
  action: string;
  categoryId: string;
  groupId: string;
  page: number;
  limit: number;
  sortBy: PermissionListQuery['sortBy'];
  sortOrder: PermissionListQuery['sortOrder'];
}>;

type PermissionBody = {
  code?: string;
  name?: string;
  module: string;
  screen: string;
  action: string;
  description?: string | null;
  type?: PermissionType;
  status?: PermissionStatus;
  categoryId?: string | null;
  categoryName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
};

type UpdatePermissionBody = Partial<PermissionBody>;

type ReplaceRolePermissionsBody = {
  permissionIds: string[];
  expectedRoleUpdatedAt: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});


export const registerPermissionRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: ListPermissionsQuery }>(
    '/api/permissions',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'View'),
      schema: {
        querystring: listPermissionsQuerySchema,
        response: { 200: permissionListResponseSchema },
      },
    },
    async (request) => ok(await services.permissions.list(request.query)),
  );

  app.get<{ Params: PermissionIdParams }>(
    '/api/permissions/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'View'),
      schema: {
        params: permissionIdParamsSchema,
        response: { 200: permissionResponseSchema },
      },
    },
    async (request) => ok(await services.permissions.getById(request.params.id)),
  );

  app.get<{ Params: PermissionIdParams }>(
    '/api/permissions/:id/roles',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'View'),
      schema: {
        params: permissionIdParamsSchema,
      },
    },
    async (request) => ok(await services.permissions.getRolesByPermission(request.params.id)),
  );

  app.post<{ Body: PermissionBody }>(
    '/api/permissions',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'Create'),
      schema: {
        body: createPermissionBodySchema,
      },
    },
    async (request, reply) => {
      const permission = await services.permissions.create(
        request.body,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.status(201).send(ok(permission));
    },
  );

  app.patch<{ Params: PermissionIdParams; Body: UpdatePermissionBody }>(
    '/api/permissions/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'Edit'),
      schema: {
        params: permissionIdParamsSchema,
        body: updatePermissionBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.permissions.update(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.delete<{ Params: PermissionIdParams }>(
    '/api/permissions/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'Delete'),
      schema: {
        params: permissionIdParamsSchema,
      },
    },
    async (request) =>
      ok(
        await services.permissions.delete(
          request.params.id,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.get<{ Params: RolePermissionParams }>(
    '/api/roles/:id/permissions',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'View'),
      schema: {
        params: rolePermissionParamsSchema,
      },
    },
    async (request) => ok(await services.permissions.getPermissionsByRole(request.params.id)),
  );

  app.put<{ Params: RolePermissionParams; Body: ReplaceRolePermissionsBody }>(
    '/api/roles/:id/permissions',
    {
      preHandler: requirePermission(services, 'Administration', 'Permissions', 'Assign'),
      schema: {
        params: rolePermissionParamsSchema,
        body: replaceRolePermissionsBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.permissions.replaceRolePermissions(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );
};
