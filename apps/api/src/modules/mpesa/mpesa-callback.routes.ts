import type { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';

export const registerMpesaCallbackRoutes = async (
  app: FastifyInstance, services: Pick<ServiceRegistry, 'mpesaCallback'>,
) => {
  app.post<{ Body: unknown; Reply: unknown }>('/api/payments/mpesa/callback', {
    bodyLimit: 16 * 1024,
    // Never log arbitrary query strings or headers supplied to this public URL.
    childLoggerFactory: (logger, bindings, options) => logger.child(bindings, {
      ...options,
      serializers: { req: () => ({ method: 'POST', url: '/api/payments/mpesa/callback' }) },
    }),
    onRequest: async (request) => services.mpesaCallback.checkRateLimit(request.ip),
    errorHandler: (error, request, reply) => {
      const status = error instanceof AppError ? error.statusCode
        : error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 503;
      const code = error instanceof AppError ? error.code
        : status === 413 ? 'MPESA_CALLBACK_TOO_LARGE'
          : status === 415 ? 'MPESA_CALLBACK_CONTENT_TYPE'
            : status < 500 ? 'MPESA_CALLBACK_INVALID' : 'MPESA_CALLBACK_UNAVAILABLE';
      const message = error instanceof AppError ? error.message
        : status < 500 ? 'Invalid M-PESA callback request' : 'M-PESA callback storage temporarily unavailable';
      if (status === 429 || status === 503) reply.header('Retry-After', '60');
      if (status >= 500) request.log.error({ code }, 'M-PESA callback intake failed');
      return reply.status(status).send({ error: { code, message, requestId: request.id } });
    },
    schema: {
      response: {
        200: {
          type: 'object', required: ['data'], additionalProperties: false,
          properties: { data: {
            type: 'object', required: ['received'], additionalProperties: false,
            properties: { received: { type: 'boolean' } },
          } },
        },
      },
    },
  }, async (request) => {
    await services.mpesaCallback.receive(request.body);
    return ok({ received: true });
  });
};
