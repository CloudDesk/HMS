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
import { AppointmentRepository } from '../../modules/appointments/appointment.repository.js';
import { AppointmentService } from '../../modules/appointments/appointment.service.js';
import { DoctorRepository } from '../../modules/doctors/doctor.repository.js';
import { DoctorService } from '../../modules/doctors/doctor.service.js';
import { OpdConsultationRepository } from '../../modules/opd/opd-consultation.repository.js';
import { OpdConsultationService } from '../../modules/opd/opd-consultation.service.js';
import { OpdVitalsRepository } from '../../modules/opd/opd-vitals.repository.js';
import { OpdVitalsService } from '../../modules/opd/opd-vitals.service.js';
import { OpdVisitRepository } from '../../modules/opd/opd-visit.repository.js';
import { OpdVisitService } from '../../modules/opd/opd-visit.service.js';
import { PatientRepository } from '../../modules/patients/patient.repository.js';
import { PatientService } from '../../modules/patients/patient.service.js';
import { ServiceRepository } from '../../modules/services/service.repository.js';
import { ServiceCatalogueService } from '../../modules/services/service.service.js';
import { SettingsLogoStorage } from '../../modules/settings/settings.logo-storage.js';
import { SettingsRepository } from '../../modules/settings/settings.repository.js';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AdministrationDashboardRepository } from '../../modules/administration-dashboard/administration-dashboard.repository.js';
import { AdministrationDashboardService } from '../../modules/administration-dashboard/administration-dashboard.service.js';
import { PatientDocumentStorageService } from '../storage/patient-document-storage.service.js';
import type { ServiceRegistry } from '../types/service-registry.js';

export const createServiceRegistry = (): ServiceRegistry => {
  const authRepository = new AuthRepository();
  const userRepository = new UserRepository();
  const roleRepository = new RoleRepository();
  const permissionRepository = new PermissionRepository();
  const branchRepository = new BranchRepository();
  const departmentRepository = new DepartmentRepository();
  const doctorRepository = new DoctorRepository();
  const appointmentRepository = new AppointmentRepository();
  const opdVisitRepository = new OpdVisitRepository();
  const opdVitalsRepository = new OpdVitalsRepository();
  const opdConsultationRepository = new OpdConsultationRepository();
  const patientRepository = new PatientRepository();
  const serviceRepository = new ServiceRepository();
  const settingsRepository = new SettingsRepository();
  const administrationDashboardRepository = new AdministrationDashboardRepository();
  const patientDocumentStorageService = new PatientDocumentStorageService();

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
    patients: new PatientService(patientRepository, patientDocumentStorageService),
    doctors: new DoctorService(doctorRepository, branchRepository, departmentRepository),
    appointments: new AppointmentService(appointmentRepository, patientRepository, doctorRepository),
    opdVisits: new OpdVisitService(opdVisitRepository, appointmentRepository, patientRepository, doctorRepository),
    opdVitals: new OpdVitalsService(opdVitalsRepository, opdVisitRepository, patientRepository),
    opdConsultations: new OpdConsultationService(
      opdConsultationRepository,
      opdVisitRepository,
      opdVitalsRepository,
      patientRepository,
    ),
    serviceCatalogue: new ServiceCatalogueService(serviceRepository, departmentRepository),
    settings: new SettingsService(settingsRepository, new SettingsLogoStorage()),
  };
};
