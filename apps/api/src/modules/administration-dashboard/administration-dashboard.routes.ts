import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { phaseTwoReportQuerySchema } from './phase-two-report.schemas.js';

export const registerAdministrationDashboardRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  app.get(
    '/api/administration/dashboard',
    { preHandler: requirePermission(services, 'Administration', 'Dashboard', 'View') },
    async () => ok(await services.administrationDashboard.get()),
  );
  app.get(
    '/api/administration/dashboard/overview',
    { preHandler: requirePermission(services, 'Administration', 'Dashboard', 'View') },
    async (request) => {
      const query = request.query as { branch_id?: string };
      const financialAccess = await services.permissions.userHasPermission(request.user!.id, 'Billing', 'Invoices', 'View');
      return ok(await services.administrationDashboard.getExecutiveOverview(request.user!.id, query.branch_id, financialAccess));
    },
  );
  app.get('/api/reports/phase-2', { preHandler: requirePermission(services, 'Reports', 'Phase 2 Reports', 'View') }, async (request) => {
    const query = phaseTwoReportQuerySchema.parse(request.query);
    const financialAccess = await services.permissions.userHasPermission(request.user!.id, 'Billing', 'Invoices', 'View');
    return ok(await services.administrationDashboard.getPhaseTwoReports(query, request.user!.id, financialAccess));
  });
};
