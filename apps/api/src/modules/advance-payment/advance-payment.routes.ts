import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { getAdvancePaymentQuerySchema, syncAdvancePaymentSchema } from './advance-payment.schemas.js';
import type { SyncAdvancePaymentDTO } from './advance-payment.types.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';

type GetAdvancePaymentQuery = Pick<SyncAdvancePaymentDTO, 'source_type' | 'source_id'>;

export const registerAdvancePaymentRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: GetAdvancePaymentQuery }>(
    '/api/advance-payments',
    {
      schema: {
        querystring: getAdvancePaymentQuerySchema,
      },
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View')
    },
    async (request, reply) => {
      const record = await services.advancePayment.getBySource(request.query.source_type, request.query.source_id);
      if (!record) {
        return reply.status(404).send({ error: 'Advance payment requirement not found' });
      }
      return reply.send(record);
    },
  );

  app.post<{ Body: SyncAdvancePaymentDTO }>(
    '/api/advance-payments/sync',
    {
      schema: {
        body: syncAdvancePaymentSchema,
      },
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'Edit')
    },
    async (request, reply) => {
      const record = await services.advancePayment.syncRequirement(request.body, request.user!.id);
      return reply.send(record);
    },
  );
};
