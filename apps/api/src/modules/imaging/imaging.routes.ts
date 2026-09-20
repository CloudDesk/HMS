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
  app.get('/api/imaging/orders/:id/report', { preHandler: authenticate(services) },
    async (request) => {
      const id = parseImagingParams(request.params).id;
      if (!(await services.permissions.userHasPermission(request.user!.id, 'Imaging', 'Orders', 'View'))) {
        if (!(await services.permissions.userHasPermission(request.user!.id, 'OPD', 'OPD Clinical Orders', 'View'))) {
          await services.permissions.auditDeniedAccess(request.user!.id, 'Imaging', 'Orders', 'View', metadata(request));
          throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
        }
        await services.opdClinicalOrders.authorizeDentalImagingReport(id, request.user!.id);
      }
      return ok(await services.imaging.getReport(id, request.user!.id));
    });
  app.post('/api/imaging/orders/:id/attachments', { preHandler: authenticate(services) },
    async (request, reply) => {
      const id = parseImagingParams(request.params).id;
      if (!(await services.permissions.userHasPermission(request.user!.id, 'Imaging', 'Orders', 'EnterReport'))) {
        if (!(await services.permissions.userHasPermission(request.user!.id, 'OPD', 'OPD Clinical Orders', 'Edit'))) {
          await services.permissions.auditDeniedAccess(request.user!.id, 'Imaging', 'Orders', 'EnterReport', metadata(request));
          throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
        }
        await services.opdClinicalOrders.authorizeDentalImagingReport(id, request.user!.id);
      }
      const file = await request.file();
      if (!file) throw new AppError('Attachment file is required', 400, 'VALIDATION_ERROR');
      const data = await file.toBuffer();
      const result = await services.imaging.uploadAttachment(id, {
        fileName: file.filename,
        mimeType: file.mimetype,
        data,
      }, request.user!.id);
      return reply.status(201).send(ok(result));
    });
  app.get('/api/imaging/orders/:id/attachments/:attachmentId/download', { preHandler: authenticate(services) },
    async (request, reply) => {
      const id = parseImagingParams(request.params).id;
      const attachmentId = (request.params as { attachmentId: string }).attachmentId;
      if (!attachmentId) throw new AppError('Attachment id is required', 400, 'VALIDATION_ERROR');
      if (!(await services.permissions.userHasPermission(request.user!.id, 'Imaging', 'Orders', 'View'))) {
        if (!(await services.permissions.userHasPermission(request.user!.id, 'OPD', 'OPD Clinical Orders', 'View'))) {
          await services.permissions.auditDeniedAccess(request.user!.id, 'Imaging', 'Orders', 'View', metadata(request));
          throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
        }
        await services.opdClinicalOrders.authorizeDentalImagingReport(id, request.user!.id);
      }
      const download = await services.imaging.downloadAttachment(id, attachmentId, request.user!.id);
      const safeName = download.attachment.file_name.replace(/["\r\n]/g, '');
      return reply
        .header('content-type', download.contentType)
        .header('content-disposition', `attachment; filename="${safeName}"`)
        .send(download.data);
    });
  app.get('/api/imaging/summary', { preHandler: requirePermission(services, 'Imaging', 'Orders', 'View') },
    async (request) => {
      const query = parseImagingListQuery(request.query);
      return ok(await services.imaging.summary(query.branch_id, request.user!.id));
    });
};
