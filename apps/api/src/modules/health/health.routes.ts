import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { ok } from '../../shared/http/response.js';
import { databaseHealthResponseSchema, healthResponseSchema } from '../../validators/common-schemas.js';

export const registerHealthRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () =>
      ok({
        status: 'ok',
        service: env.app.name,
        environment: env.app.environment,
      }),
  );

  app.get(
    '/api/health/db',
    {
      schema: {
        response: {
          200: databaseHealthResponseSchema,
        },
      },
    },
    async () => {
      const database = await services.database.healthCheck();

      return ok({
        status: database.connected ? 'ok' : 'error',
        database: database.database,
      });
    },
  );
};
