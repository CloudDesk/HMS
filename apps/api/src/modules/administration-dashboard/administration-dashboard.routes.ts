import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';

export const registerAdministrationDashboardRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  app.get(
    '/api/administration/dashboard',
    { preHandler: requirePermission(services, 'Administration', 'Dashboard', 'View') },
    async () => ok(await services.administrationDashboard.get()),
  );
};
