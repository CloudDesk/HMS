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
import { SettingsLogoStorage } from '../../modules/settings/settings.logo-storage.js';
import { SettingsRepository } from '../../modules/settings/settings.repository.js';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AdministrationDashboardRepository } from '../../modules/administration-dashboard/administration-dashboard.repository.js';
import { AdministrationDashboardService } from '../../modules/administration-dashboard/administration-dashboard.service.js';
import type { ServiceRegistry } from '../types/service-registry.js';

export const createServiceRegistry = (): ServiceRegistry => {
  const authRepository = new AuthRepository();
  const userRepository = new UserRepository();
  const roleRepository = new RoleRepository();
  const permissionRepository = new PermissionRepository();
  const branchRepository = new BranchRepository();
  const departmentRepository = new DepartmentRepository();
  const serviceRepository = new ServiceRepository();
  const settingsRepository = new SettingsRepository();
  const administrationDashboardRepository = new AdministrationDashboardRepository();

  return {
    database: {
      healthCheck: checkDatabaseHealth,
    },
    administrationDashboard: new AdministrationDashboardService(administrationDashboardRepository),
    auth: new AuthService(authRepository),
    users: new UserService(userRepository),
    roles: new RoleService(roleRepository),
    permissions: new PermissionService(permissionRepository),
    branches: new BranchService(branchRepository),
    departments: new DepartmentService(departmentRepository, branchRepository),
    serviceCatalogue: new ServiceCatalogueService(serviceRepository, departmentRepository),
    settings: new SettingsService(settingsRepository, new SettingsLogoStorage()),
  };
};
