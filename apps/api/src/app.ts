import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { loggerConfig } from './config/logger.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerRequestContext } from './middleware/request-context.js';
import { registerModules } from './modules/index.js';
import { createServiceRegistry } from './shared/services/service-registry.js';

export const buildApp = async () => {
  const app = Fastify({
    logger: loggerConfig,
  });

  const services = createServiceRegistry();

  registerErrorHandler(app);
  await registerRequestContext(app);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || env.cors.origins.includes('*') || env.app.environment !== 'prod') {
        cb(null, true);
        return;
      }
      if (env.cors.origins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
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
