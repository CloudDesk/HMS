import type { checkDatabaseHealth } from '../../database/health.js';
import type { AuthService } from '../../modules/auth/auth.service.js';
import type { PermissionService } from '../../modules/permissions/permission.service.js';
import type { RoleService } from '../../modules/roles/role.service.js';
import type { UserService } from '../../modules/users/user.service.js';
import type { BranchService } from '../../modules/branches/branch.service.js';
import type { DepartmentService } from '../../modules/departments/department.service.js';
import type { AppointmentService } from '../../modules/appointments/appointment.service.js';
import type { DoctorService } from '../../modules/doctors/doctor.service.js';
import type { OpdConsultationService } from '../../modules/opd/opd-consultation.service.js';
import type { OpdVitalsService } from '../../modules/opd/opd-vitals.service.js';
import type { OpdVisitService } from '../../modules/opd/opd-visit.service.js';
import type { PatientService } from '../../modules/patients/patient.service.js';
import type { ServiceCatalogueService } from '../../modules/services/service.service.js';

export type ServiceRegistry = {
  database: {
    healthCheck: typeof checkDatabaseHealth;
  };
  auth: AuthService;
  users: UserService;
  roles: RoleService;
  permissions: PermissionService;
  branches: BranchService;
  departments: DepartmentService;
  patients: PatientService;
  doctors: DoctorService;
  appointments: AppointmentService;
  opdVisits: OpdVisitService;
  opdVitals: OpdVitalsService;
  opdConsultations: OpdConsultationService;
  serviceCatalogue: ServiceCatalogueService;
};
