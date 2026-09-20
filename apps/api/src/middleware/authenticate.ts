import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import type { ServiceRegistry } from '../shared/types/service-registry.js';

export const authenticate =
  (services: ServiceRegistry) => async (request: FastifyRequest, _reply: FastifyReply) => {
    void _reply;
    const header = request.headers.authorization;
    let token: string | null = null;

    if (header?.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length).trim();
    } else if (typeof (request.query as { token?: string } | undefined)?.token === 'string') {
      token = (request.query as { token: string }).token.trim();
    }

    if (!token) {
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    request.user = await services.auth.authenticateAccessToken(token);
  };
