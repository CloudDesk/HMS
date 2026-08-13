import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import type { ServiceRegistry } from '../shared/types/service-registry.js';

export const authenticate =
  (services: ServiceRegistry) => async (request: FastifyRequest, _reply: FastifyReply) => {
    void _reply;
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const token = header.slice('Bearer '.length).trim();
    request.user = await services.auth.authenticateAccessToken(token);
  };
