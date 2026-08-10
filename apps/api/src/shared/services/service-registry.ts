import { checkDatabaseHealth } from '../../database/health.js';
import { AuthRepository } from '../../modules/auth/auth.repository.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import { PermissionRepository } from '../../modules/permissions/permission.repository.js';
import { PermissionService } from '../../modules/permissions/permission.service.js';
import { RoleRepository } from '../../modules/roles/role.repository.js';
import { RoleService } from '../../modules/roles/role.service.js';
import { UserRepository } from '../../modules/users/user.repository.js';
import { UserService } from '../../modules/users/user.service.js';
import type { ServiceRegistry } from '../types/service-registry.js';

export const createServiceRegistry = (): ServiceRegistry => {
  const authRepository = new AuthRepository();
  const userRepository = new UserRepository();
  const roleRepository = new RoleRepository();
  const permissionRepository = new PermissionRepository();

  return {
    database: {
      healthCheck: checkDatabaseHealth,
    },
    auth: new AuthService(authRepository),
    users: new UserService(userRepository),
    roles: new RoleService(roleRepository),
    permissions: new PermissionService(permissionRepository),
  };
};
