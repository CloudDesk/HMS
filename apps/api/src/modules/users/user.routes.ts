import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import type { AssignmentInput, UserListQuery, UserStatus } from './user.types.js';
import {
  changeUserPasswordBodySchema,
  createUserBodySchema,
  listUsersQuerySchema,
  resetUserPasswordBodySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
} from './user.schemas.js';

type UserIdParams = {
  id: string;
};

type ListUsersQuery = Partial<{
  search: string;
  status: UserStatus;
  branchId: string;
  departmentId: string;
  page: number;
  limit: number;
  sortBy: UserListQuery['sortBy'];
  sortOrder: UserListQuery['sortOrder'];
}>;

type CreateUserBody = {
  employeeCode: string;
  username: string;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  employeeType?: string | null;
  hireDate?: string | null;
  profilePhotoUrl?: string | null;
  address?: string | null;
  status?: UserStatus;
  password: string;
  branches: AssignmentInput[];
  departments: AssignmentInput[];
};

type UpdateUserBody = Partial<Omit<CreateUserBody, 'password' | 'status'>>;

type UpdateUserStatusBody = {
  status: UserStatus;
  lockedUntil?: string | null;
};

type ChangeUserPasswordBody = {
  currentPassword: string;
  newPassword: string;
};

type ResetUserPasswordBody = {
  newPassword: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerUserRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: ListUsersQuery }>(
    '/api/users',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'View'),
      schema: {
        querystring: listUsersQuerySchema,
      },
    },
    async (request) => ok(await services.users.list(request.query)),
  );

  app.get<{ Params: UserIdParams }>(
    '/api/users/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'View'),
      schema: {
        params: userIdParamsSchema,
      },
    },
    async (request) => ok(await services.users.getById(request.params.id)),
  );

  app.post<{ Body: CreateUserBody }>(
    '/api/users',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'Create'),
      schema: {
        body: createUserBodySchema,
      },
    },
    async (request, reply) => {
      const user = await services.users.create(
        request.body,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.status(201).send(ok(user));
    },
  );

  app.patch<{ Params: UserIdParams; Body: UpdateUserBody }>(
    '/api/users/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'Edit'),
      schema: {
        params: userIdParamsSchema,
        body: updateUserBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.users.update(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Params: UserIdParams; Body: UpdateUserStatusBody }>(
    '/api/users/:id/status',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'Edit'),
      schema: {
        params: userIdParamsSchema,
        body: updateUserStatusBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.users.updateStatus(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.post<{ Params: UserIdParams; Body: ChangeUserPasswordBody }>(
    '/api/users/:id/change-password',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'ChangePassword'),
      schema: {
        params: userIdParamsSchema,
        body: changeUserPasswordBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.users.changePassword(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.post<{ Params: UserIdParams; Body: ResetUserPasswordBody }>(
    '/api/users/:id/reset-password',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'ResetPassword'),
      schema: {
        params: userIdParamsSchema,
        body: resetUserPasswordBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.users.resetPassword(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.delete<{ Params: UserIdParams }>(
    '/api/users/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Users', 'Delete'),
      schema: {
        params: userIdParamsSchema,
      },
    },
    async (request) =>
      ok(await services.users.delete(request.params.id, request.user!.id, metadataFromRequest(request))),
  );
};
