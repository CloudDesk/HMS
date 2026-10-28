import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  attemptIdSchema,
  attemptVersionSchema,
  createAttemptSchema,
  invoiceIdSchema,
  listAttemptsQuerySchema,
  listExceptionsQuerySchema,
  parseAttemptInput,
  reconcileOptionsSchema,
} from './mpesa-attempt.schemas.js';

export const registerMpesaAttemptRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  await app.register(async (routes) => {
    routes.setErrorHandler((error, request, reply) => {
      const known = error instanceof AppError;
      const httpStatus = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode : 503;
      const status = known ? error.statusCode : httpStatus >= 400 && httpStatus < 500 ? httpStatus : 503;
      const code = known ? error.code : status < 500 ? 'MPESA_REQUEST_INVALID' : 'MPESA_ATTEMPT_UNAVAILABLE';
      if (status >= 500) request.log.error({ code }, 'M-PESA attempt operation failed');
      return reply.status(status).send({
        error: {
          code,
          requestId: request.id,
          message: known ? error.message : status < 500 ? 'Invalid M-PESA request' : 'M-PESA attempt unavailable; check status before retrying',
        },
      });
    });

    routes.post('/api/billing/invoices/:id/mpesa-attempts', {
      bodyLimit: 2048,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaAttempts.create(
      parseAttemptInput(invoiceIdSchema, request.params).id,
      parseAttemptInput(createAttemptSchema, request.body),
      request.user!.id,
    )));

    routes.get('/api/payments/mpesa/attempts/:id', {
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View'),
    }, async (request) => ok(await services.mpesaAttempts.get(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
    )));

    routes.post('/api/payments/mpesa/attempts/:id/submit', {
      bodyLimit: 1024,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaAttempts.submit(
      parseAttemptInput(attemptIdSchema, request.params).id,
      parseAttemptInput(attemptVersionSchema, request.body).expectedVersion,
      request.user!.id,
    )));

    routes.post('/api/payments/mpesa/attempts/:id/correlate', {
      bodyLimit: 1024,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaAttempts.correlatePending(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
    )));

    routes.post('/api/payments/mpesa/attempts/:id/verify', {
      bodyLimit: 1024,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaAttempts.verify(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
    )));

    routes.get('/api/payments/mpesa/attempts', {
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View'),
    }, async (request) => ok(await services.mpesaAttempts.list(
      parseAttemptInput(listAttemptsQuerySchema, request.query),
      request.user!.id,
    )));

    routes.post('/api/payments/mpesa/reconcile', {
      bodyLimit: 1024,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaAttempts.reconcileEligible(
      parseAttemptInput(reconcileOptionsSchema, request.body ?? {}),
      request.user!.id,
    )));

    routes.post('/api/payments/mpesa/attempts/:id/post', {
      bodyLimit: 1024,
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'CollectPayment'),
    }, async (request) => ok(await services.mpesaPosting.postPayment(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
    )));

    routes.get('/api/payments/mpesa/attempts/:id/payment', {
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View'),
    }, async (request) => ok(await services.mpesaPosting.getPaymentForAttempt(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
    )));

    routes.get('/api/payments/mpesa/attempts/:id/receipt', {
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View'),
    }, async (request) => ok(await services.mpesaPosting.getReceiptForAttempt(
      parseAttemptInput(attemptIdSchema, request.params).id,
      request.user!.id,
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
    )));

    routes.get('/api/payments/mpesa/exceptions', {
      preHandler: requirePermission(services, 'Billing', 'Invoices', 'View'),
    }, async (request) => ok(await services.mpesaPosting.listExceptions(
      request.user!.id,
      parseAttemptInput(listExceptionsQuerySchema, request.query),
    )));
  }, { logSerializers: { req: () => 'M-PESA staff request (details redacted)' } });
};
