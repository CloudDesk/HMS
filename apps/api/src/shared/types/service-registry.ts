import type { checkDatabaseHealth } from '../../database/health.js';
import type { AuthService } from '../../modules/auth/auth.service.js';
import type { PermissionService } from '../../modules/permissions/permission.service.js';
import type { RoleService } from '../../modules/roles/role.service.js';
import type { UserService } from '../../modules/users/user.service.js';
import type { BranchService } from '../../modules/branches/branch.service.js';
import type { DepartmentService } from '../../modules/departments/department.service.js';
import type { ServiceCatalogueService } from '../../modules/services/service.service.js';
import type { SettingsService } from '../../modules/settings/settings.service.js';
import type { AdministrationDashboardService } from '../../modules/administration-dashboard/administration-dashboard.service.js';

export type ServiceRegistry = {
  administrationDashboard: AdministrationDashboardService;
  database: {
    healthCheck: typeof checkDatabaseHealth;
  };
  auth: AuthService;
  users: UserService;
  roles: RoleService;
  permissions: PermissionService;
  branches: BranchService;
  departments: DepartmentService;
  serviceCatalogue: ServiceCatalogueService;
  settings: SettingsService;
};
