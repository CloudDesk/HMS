import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/app-error.js';
import type { ServiceRegistry } from '../shared/types/service-registry.js';
import { authenticate } from './authenticate.js';

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const requirePermission = (
  services: ServiceRegistry,
  moduleName: string,
  screen: string,
  action: string,
) => [
  authenticate(services),
  async (request: FastifyRequest, _reply: FastifyReply) => {
    void _reply;
    const userId = request.user!.id;
    const allowed = await services.permissions.userHasPermission(userId, moduleName, screen, action);

    if (!allowed) {
      await services.permissions.auditDeniedAccess(
        userId,
        moduleName,
        screen,
        action,
        metadataFromRequest(request),
      );
      throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
    }
  },
];
