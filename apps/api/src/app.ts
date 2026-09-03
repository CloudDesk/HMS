import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { resolveAllowedCorsOrigins } from './config/env.js';
import { loggerConfig } from './config/logger.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerRequestContext } from './middleware/request-context.js';
import { registerModules } from './modules/index.js';
import { createServiceRegistry } from './shared/services/service-registry.js';

export const buildApp = async () => {
  const app = Fastify({
    logger: loggerConfig,
    trustProxy: env.http.trustProxy,
  });

  const services = createServiceRegistry();

  registerErrorHandler(app);
  await registerRequestContext(app);

  // Refresh tokens are stored in HttpOnly cookies and validated by the auth service.
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-XSS-Protection', '0');
  });

  await app.register(cookie);

  const allowedCorsOrigins = resolveAllowedCorsOrigins(env.cors.origins);

  await app.register(cors, {
    origin: allowedCorsOrigins,
    credentials: true,
    exposedHeaders: ['content-disposition'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // await app.register(multipart, {
  //   limits: {
  //     fileSize: 2 * 1024 * 1024,
  //     files: 1,
  //   },
  // });

  await app.register(multipart, {
    limits: {
      fileSize: env.upload.patientDocumentMaxFileSizeBytes,
      files: 1,
    },
  });

  await registerModules(app, services);

  return { app, services };
};
