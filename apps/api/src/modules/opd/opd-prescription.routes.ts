import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  listOpdPrescriptionsQuerySchema,
  opdPrescriptionParamsSchema,
  opdPrescriptionVisitParamsSchema,
  saveOpdPrescriptionBodySchema,
  updateOpdPrescriptionStatusBodySchema,
} from './opd-prescription.schemas.js';
import type { ListPrescriptionsParams, OpdPrescriptionStatus, SaveOpdPrescriptionDTO } from './opd-prescription.types.js';

type VisitParams = { visitId: string };
type IdParams = { id: string };

export const registerOpdPrescriptionRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: ListPrescriptionsParams }>(
    '/api/opd/prescriptions',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'View'),
      schema: { querystring: listOpdPrescriptionsQuerySchema },
    },
    async (request) => ok(await services.opdPrescriptions.list(request.query, request.user!.id)),
  );

  app.patch<{ Params: IdParams; Body: { status: OpdPrescriptionStatus } }>(
    '/api/opd/prescriptions/:id/status',
    {
      preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'Dispense'),
      schema: { params: opdPrescriptionParamsSchema, body: updateOpdPrescriptionStatusBodySchema },
    },
    async (request) => ok(await services.opdPrescriptions.updateStatus(request.params.id, request.body.status, request.user!.id)),
  );

  app.get<{ Params: VisitParams }>(
    '/api/opd/visits/:visitId/prescription',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'View'),
      schema: { params: opdPrescriptionVisitParamsSchema },
    },
    async (request) => ok(await services.opdPrescriptions.getByVisit(request.params.visitId, request.user!.id)),
  );

  app.put<{ Params: VisitParams; Body: SaveOpdPrescriptionDTO }>(
    '/api/opd/visits/:visitId/prescription',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'Edit'),
      schema: { body: saveOpdPrescriptionBodySchema, params: opdPrescriptionVisitParamsSchema },
    },
    async (request) =>
      ok(await services.opdPrescriptions.saveDraft(request.params.visitId, request.body, request.user!.id)),
  );

  app.post<{ Params: VisitParams; Body: SaveOpdPrescriptionDTO }>(
    '/api/opd/visits/:visitId/prescription/submit',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'Edit'),
      schema: { body: saveOpdPrescriptionBodySchema, params: opdPrescriptionVisitParamsSchema },
    },
    async (request) =>
      ok(await services.opdPrescriptions.submit(request.params.visitId, request.body, request.user!.id)),
  );
};
