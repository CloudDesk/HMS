import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  opdPrescriptionVisitParamsSchema,
  saveOpdPrescriptionBodySchema,
} from './opd-prescription.schemas.js';
import type { SaveOpdPrescriptionDTO } from './opd-prescription.types.js';

type VisitParams = { visitId: string };

export const registerOpdPrescriptionRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Params: VisitParams }>(
    '/api/opd/visits/:visitId/prescription',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'View'),
      schema: { params: opdPrescriptionVisitParamsSchema },
    },
    async (request) => ok(await services.opdPrescriptions.getByVisit(request.params.visitId)),
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
