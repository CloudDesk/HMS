import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { parseLaboratoryListQuery, parseLaboratoryParams, parseLaboratoryResultBody, parseLaboratoryStatusBody } from './laboratory.schemas.js';

const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const requireStatusPermission = async (services: ServiceRegistry, request: FastifyRequest, status: string) => {
  const action = status === 'VERIFIED' ? 'VerifyResult' : 'Edit';
  if (await services.permissions.userHasPermission(request.user!.id, 'Laboratory', 'Orders', action)) return;
  await services.permissions.auditDeniedAccess(request.user!.id, 'Laboratory', 'Orders', action, metadata(request));
  throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
};

export const registerLaboratoryRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/laboratory/orders', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'View') },
    async (request) => ok(await services.laboratory.list(parseLaboratoryListQuery(request.query), request.user!.id)));
  app.get('/api/laboratory/orders/:id', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'View') },
    async (request) => ok(await services.laboratory.getById(parseLaboratoryParams(request.params).id, request.user!.id)));
  app.patch('/api/laboratory/orders/:id/status', { preHandler: authenticate(services) }, async (request) => {
    const body = parseLaboratoryStatusBody(request.body);
    await requireStatusPermission(services, request, body.status);
    return ok(await services.laboratory.updateStatus(parseLaboratoryParams(request.params).id, body, request.user!.id, metadata(request)));
  });
  app.post('/api/laboratory/orders/:id/results', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'EnterResult') },
    async (request, reply) => reply.status(201).send(ok(await services.laboratory.enterResult(
      parseLaboratoryParams(request.params).id, parseLaboratoryResultBody(request.body), request.user!.id, metadata(request),
    ))));
  app.patch('/api/laboratory/orders/:id/results', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'EnterResult') },
    async (request) => ok(await services.laboratory.updateResult(
      parseLaboratoryParams(request.params).id, parseLaboratoryResultBody(request.body), request.user!.id, metadata(request),
    )));
  app.get('/api/laboratory/orders/:id/results', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'View') },
    async (request) => ok(await services.laboratory.getResult(parseLaboratoryParams(request.params).id, request.user!.id)));
  app.get('/api/laboratory/summary', { preHandler: requirePermission(services, 'Laboratory', 'Orders', 'View') },
    async (request) => {
      const query = parseLaboratoryListQuery(request.query);
      return ok(await services.laboratory.summary(query.branch_id, request.user!.id));
    });
};
