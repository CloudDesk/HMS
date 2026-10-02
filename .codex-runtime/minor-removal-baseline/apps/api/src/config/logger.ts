import type { FastifyServerOptions } from 'fastify';
import { env } from './env.js';

export const loggerConfig: FastifyServerOptions['logger'] = {
  level: env.app.logLevel,
};
