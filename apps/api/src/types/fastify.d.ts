import type { AuthenticatedUser } from '../shared/types/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
