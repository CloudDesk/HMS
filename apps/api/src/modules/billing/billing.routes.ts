import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  parseBillingInvoiceListQuery,
  parseBillingInvoiceParams,
  parseBillingPaymentParams,
  parseBillingSummaryQuery,
  parseCollectBillingPaymentBody,
  parseCreateBillingInvoiceBody,
  parseUpdateBillingInvoiceBody,
} from './billing.schemas.js';

const metadata = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerBillingRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get(
    '/api/billing/invoices',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'View') },
    async (request) => ok(await services.billing.list(parseBillingInvoiceListQuery(request.query), request.user!.id)),
  );

  app.get(
    '/api/billing/summary',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'View') },
    async (request) => ok(await services.billing.summary(parseBillingSummaryQuery(request.query), request.user!.id)),
  );

  app.get(
    '/api/billing/invoices/:id',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'View') },
    async (request) => ok(await services.billing.getById(parseBillingInvoiceParams(request.params).id, request.user!.id)),
  );

  app.post(
    '/api/billing/invoices',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'Create') },
    async (request, reply) => reply.status(201).send(ok(await services.billing.create(
      parseCreateBillingInvoiceBody(request.body),
      request.user!.id,
      metadata(request),
    ))),
  );

  app.patch(
    '/api/billing/invoices/:id',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'Edit') },
    async (request) => ok(await services.billing.update(
      parseBillingInvoiceParams(request.params).id,
      parseUpdateBillingInvoiceBody(request.body),
      request.user!.id,
      metadata(request),
    )),
  );

  app.post(
    '/api/billing/invoices/:id/cancel',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'Cancel') },
    async (request) => ok(await services.billing.cancel(
      parseBillingInvoiceParams(request.params).id,
      request.user!.id,
      metadata(request),
    )),
  );

  app.post(
    '/api/billing/invoices/:id/payments',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment') },
    async (request, reply) => reply.status(201).send(ok(await services.billing.collectPayment(
      parseBillingInvoiceParams(request.params).id,
      parseCollectBillingPaymentBody(request.body),
      request.user!.id,
      metadata(request),
    ))),
  );

  app.get(
    '/api/billing/invoices/:id/payments',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'View') },
    async (request) => ok(await services.billing.listPayments(
      parseBillingInvoiceParams(request.params).id,
      request.user!.id,
    )),
  );

  app.get(
    '/api/billing/payments/:id/receipt',
    { preHandler: requirePermission(services, 'Billing', 'Invoices', 'ViewReceipt') },
    async (request) => ok(await services.billing.receipt(
      parseBillingPaymentParams(request.params).id,
      request.user!.id,
      metadata(request),
    )),
  );
};

