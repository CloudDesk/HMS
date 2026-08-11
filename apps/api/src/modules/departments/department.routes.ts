import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  departmentIdParamsSchema,
  createDepartmentBodySchema,
  listDepartmentsQuerySchema,
  updateDepartmentBodySchema,
} from './department.schemas.js';
import type { DepartmentListQuery, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

type DepartmentIdParams = {
  id: string;
};

export const registerDepartmentRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: DepartmentListQuery }>(
    '/api/departments',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'View'),
      schema: {
        querystring: listDepartmentsQuerySchema,
      },
    },
    async (request) => ok(await services.departments.list(request.query)),
  );

  app.get<{ Params: DepartmentIdParams }>(
    '/api/departments/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'View'),
      schema: {
        params: departmentIdParamsSchema,
      },
    },
    async (request) => ok(await services.departments.getById(request.params.id)),
  );

  app.post<{ Body: CreateDepartmentDTO }>(
    '/api/departments',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'Create'),
      schema: {
        body: createDepartmentBodySchema,
      },
    },
    async (request, reply) => {
      const department = await services.departments.create(request.body, request.user!.id);
      return reply.status(201).send(ok(department));
    },
  );

  app.patch<{ Params: DepartmentIdParams; Body: UpdateDepartmentDTO }>(
    '/api/departments/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'Edit'),
      schema: {
        params: departmentIdParamsSchema,
        body: updateDepartmentBodySchema,
      },
    },
    async (request) => ok(await services.departments.update(request.params.id, request.body, request.user!.id)),
  );

  app.delete<{ Params: DepartmentIdParams }>(
    '/api/departments/:id',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'Delete'),
      schema: {
        params: departmentIdParamsSchema,
      },
    },
    async (request) => {
      await services.departments.delete(request.params.id);
      return ok({ success: true });
    },
  );
};
