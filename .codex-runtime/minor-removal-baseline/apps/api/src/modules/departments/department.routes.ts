import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  departmentIdParamsSchema,
  createDepartmentBodySchema,
  listDepartmentsQuerySchema,
  updateDepartmentBodySchema,
  updateDepartmentStatusBodySchema,
} from './department.schemas.js';
import type { DepartmentListQuery, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

type DepartmentIdParams = {
  id: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

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

  app.get(
    '/api/departments/summary',
    { preHandler: requirePermission(services, 'Administration', 'Departments', 'View') },
    async () => ok(await services.departments.summary()),
  );

  app.get<{ Querystring: DepartmentListQuery }>(
    '/api/departments/export',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'Export'),
      schema: { querystring: listDepartmentsQuerySchema },
    },
    async (request, reply) => {
      const stream = await services.departments.export(request.query, request.user!.id, metadataFromRequest(request));
      return reply.header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="hms-departments.csv"').send(stream);
    },
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
      const department = await services.departments.create(request.body, request.user!.id, metadataFromRequest(request));
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
    async (request) => ok(await services.departments.update(request.params.id, request.body, request.user!.id, metadataFromRequest(request))),
  );

  app.patch<{ Params: DepartmentIdParams; Body: { status: 'ACTIVE' | 'INACTIVE' } }>(
    '/api/departments/:id/status',
    {
      preHandler: requirePermission(services, 'Administration', 'Departments', 'Edit'),
      schema: { params: departmentIdParamsSchema, body: updateDepartmentStatusBodySchema },
    },
    async (request) => ok(await services.departments.updateStatus(request.params.id, request.body.status, request.user!.id, metadataFromRequest(request))),
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
      await services.departments.delete(request.params.id, request.user!.id, metadataFromRequest(request));
      return ok({ success: true });
    },
  );
};
