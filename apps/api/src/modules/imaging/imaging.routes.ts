import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { parseImagingListQuery, parseImagingParams, parseImagingReportBody, parseImagingStatusBody } from './imaging.schemas.js';

const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const requireStatusPermission = async (services: ServiceRegistry, request: FastifyRequest, status: string) => {
  const action = status === 'VERIFIED' ? 'VerifyReport' : 'Edit';
  if (await services.permissions.userHasPermission(request.user!.id, 'Imaging', 'Orders', action)) return;
  await services.permissions.auditDeniedAccess(request.user!.id, 'Imaging', 'Orders', action, metadata(request));
  throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
};

export const registerImagingRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/imaging/orders', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'View') },
    async (request) => ok(await services.imaging.list(parseImagingListQuery(request.query), request.user!.id)));
  app.get('/api/imaging/orders/:id', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'View') },
    async (request) => ok(await services.imaging.getById(parseImagingParams(request.params).id, request.user!.id)));
  app.patch('/api/imaging/orders/:id/status', { preHandler: authenticate(services) }, async (request) => {
    const body = parseImagingStatusBody(request.body);
    await requireStatusPermission(services, request, body.status);
    return ok(await services.imaging.updateStatus(parseImagingParams(request.params).id, body, request.user!.id, metadata(request)));
  });
  app.post('/api/imaging/orders/:id/report', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'EnterReport') },
    async (request, reply) => reply.status(201).send(ok(await services.imaging.enterReport(
      parseImagingParams(request.params).id, parseImagingReportBody(request.body), request.user!.id, metadata(request),
    ))));
  app.patch('/api/imaging/orders/:id/report', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'EnterReport') },
    async (request) => ok(await services.imaging.updateReport(
      parseImagingParams(request.params).id, parseImagingReportBody(request.body), request.user!.id, metadata(request),
    )));
  app.get('/api/imaging/orders/:id/report', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'View') },
    async (request) => ok(await services.imaging.getReport(parseImagingParams(request.params).id, request.user!.id)));
  app.get('/api/imaging/summary', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'View') },
    async (request) => {
      const query = parseImagingListQuery(request.query);
      return ok(await services.imaging.summary(query.branch_id, request.user!.id));
    });
};
