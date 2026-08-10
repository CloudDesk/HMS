import type { FastifyInstance } from 'fastify';
import type { ServiceRegistry } from '../shared/types/service-registry.js';
import { registerAuthRoutes } from './auth/auth.routes.js';
import { registerHealthRoutes } from './health/health.routes.js';
import { registerPermissionRoutes } from './permissions/permission.routes.js';
import { registerRoleRoutes } from './roles/role.routes.js';
import { registerUserRoutes } from './users/user.routes.js';

export const registerModules = async (app: FastifyInstance, services: ServiceRegistry) => {
  await registerHealthRoutes(app, services);
  await registerAuthRoutes(app, services);
  await registerUserRoutes(app, services);
  await registerRoleRoutes(app, services);
  await registerPermissionRoutes(app, services);
};
