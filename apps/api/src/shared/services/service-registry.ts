import { checkDatabaseHealth } from '../../database/health.js';
import { AuthRepository } from '../../modules/auth/auth.repository.js';
import { AuthService } from '../../modules/auth/auth.service.js';
import { PermissionRepository } from '../../modules/permissions/permission.repository.js';
import { PermissionService } from '../../modules/permissions/permission.service.js';
import { RoleRepository } from '../../modules/roles/role.repository.js';
import { RoleService } from '../../modules/roles/role.service.js';
import { UserRepository } from '../../modules/users/user.repository.js';
import { UserService } from '../../modules/users/user.service.js';
import { BranchRepository } from '../../modules/branches/branch.repository.js';
import { BranchService } from '../../modules/branches/branch.service.js';
import { DepartmentRepository } from '../../modules/departments/department.repository.js';
import { DepartmentService } from '../../modules/departments/department.service.js';
import { ServiceRepository } from '../../modules/services/service.repository.js';
import { ServiceCatalogueService } from '../../modules/services/service.service.js';
import type { ServiceRegistry } from '../types/service-registry.js';

export const createServiceRegistry = (): ServiceRegistry => {
  const authRepository = new AuthRepository();
  const userRepository = new UserRepository();
  const roleRepository = new RoleRepository();
  const permissionRepository = new PermissionRepository();
  const branchRepository = new BranchRepository();
  const departmentRepository = new DepartmentRepository();
  const serviceRepository = new ServiceRepository();

  return {
    database: {
      healthCheck: checkDatabaseHealth,
    },
    auth: new AuthService(authRepository),
    users: new UserService(userRepository),
    roles: new RoleService(roleRepository),
    permissions: new PermissionService(permissionRepository),
    branches: new BranchService(branchRepository),
    departments: new DepartmentService(departmentRepository),
    serviceCatalogue: new ServiceCatalogueService(serviceRepository),
  };
};
