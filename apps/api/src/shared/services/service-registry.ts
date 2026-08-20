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
import { OpdClinicalOrderRepository } from '../../modules/opd/opd-clinical-order.repository.js';
import { OpdClinicalOrderService } from '../../modules/opd/opd-clinical-order.service.js';
import { OpdPrescriptionRepository } from '../../modules/opd/opd-prescription.repository.js';
import { OpdPrescriptionService } from '../../modules/opd/opd-prescription.service.js';
import { OpdFollowUpRepository } from '../../modules/opd/opd-follow-up.repository.js';
import { OpdFollowUpService } from '../../modules/opd/opd-follow-up.service.js';
import { OpdReferralRepository } from '../../modules/opd/opd-referral.repository.js';
import { OpdReferralService } from '../../modules/opd/opd-referral.service.js';
import { OpdVitalsRepository } from '../../modules/opd/opd-vitals.repository.js';
import { OpdVitalsService } from '../../modules/opd/opd-vitals.service.js';
import { OpdVisitRepository } from '../../modules/opd/opd-visit.repository.js';
import { OpdVisitService } from '../../modules/opd/opd-visit.service.js';
import { PatientRepository } from '../../modules/patients/patient.repository.js';
import { PatientService } from '../../modules/patients/patient.service.js';
import { ServiceRepository } from '../../modules/services/service.repository.js';
import { ServiceCatalogueService } from '../../modules/services/service.service.js';
import { MedicineRepository } from '../../modules/medicines/medicine.repository.js';
import { MedicineService } from '../../modules/medicines/medicine.service.js';
import { PharmacyInventoryRepository } from '../../modules/pharmacy-inventory/pharmacy-inventory.repository.js';
import { PharmacyInventoryService } from '../../modules/pharmacy-inventory/pharmacy-inventory.service.js';
import { LaboratoryRepository } from '../../modules/laboratory/laboratory.repository.js';
import { LaboratoryService } from '../../modules/laboratory/laboratory.service.js';
import { ImagingRepository } from '../../modules/imaging/imaging.repository.js';
import { ImagingService } from '../../modules/imaging/imaging.service.js';
import { BillingRepository } from '../../modules/billing/billing.repository.js';
import { BillingService } from '../../modules/billing/billing.service.js';
import { SettingsLogoStorage } from '../../modules/settings/settings.logo-storage.js';
import { SettingsRepository } from '../../modules/settings/settings.repository.js';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AdministrationDashboardRepository } from '../../modules/administration-dashboard/administration-dashboard.repository.js';
import { AdministrationDashboardService } from '../../modules/administration-dashboard/administration-dashboard.service.js';
import { PatientPortalRepository } from '../../modules/patient-portal/patient-portal.repository.js';
import { PatientPortalService } from '../../modules/patient-portal/patient-portal.service.js';
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
  const opdClinicalOrderRepository = new OpdClinicalOrderRepository();
  const opdPrescriptionRepository = new OpdPrescriptionRepository();
  const opdFollowUpRepository = new OpdFollowUpRepository();
  const opdReferralRepository = new OpdReferralRepository();
  const patientRepository = new PatientRepository();
  const serviceRepository = new ServiceRepository();
  const medicineRepository = new MedicineRepository();
  const pharmacyInventoryRepository = new PharmacyInventoryRepository();
  const laboratoryRepository = new LaboratoryRepository();
  const imagingRepository = new ImagingRepository();
  const billingRepository = new BillingRepository();
  const settingsRepository = new SettingsRepository();
  const administrationDashboardRepository = new AdministrationDashboardRepository();
  const patientDocumentStorageService = new PatientDocumentStorageService();
  const userService = new UserService(userRepository, roleRepository);
  const appointmentService = new AppointmentService(
    appointmentRepository,
    patientRepository,
    doctorRepository,
    opdVisitRepository,
  );
  const doctorService = new DoctorService(
    doctorRepository,
    branchRepository,
    departmentRepository,
    userRepository,
    userService,
    appointmentRepository,
  );
  const patientService = new PatientService(patientRepository, patientDocumentStorageService);

  return {
    database: {
      healthCheck: checkDatabaseHealth,
    },
    administrationDashboard: new AdministrationDashboardService(administrationDashboardRepository),
    auth: new AuthService(authRepository),
    users: userService,
    roles: new RoleService(roleRepository),
    permissions: new PermissionService(permissionRepository),
    branches: new BranchService(branchRepository),
    departments: new DepartmentService(departmentRepository, branchRepository),
    patients: patientService,
doctors: doctorService,

appointments: appointmentService,

opdVisits: new OpdVisitService(
  opdVisitRepository,
  appointmentRepository,
  patientRepository,
  doctorRepository,
  opdConsultationRepository,
),
    opdVitals: new OpdVitalsService(opdVitalsRepository, opdVisitRepository, patientRepository),
    opdConsultations: new OpdConsultationService(
      opdConsultationRepository,
      opdVisitRepository,
      opdVitalsRepository,
      patientRepository,
      appointmentRepository,
    ),
    opdClinicalOrders: new OpdClinicalOrderService(
      opdClinicalOrderRepository,
      opdVisitRepository,
      opdConsultationRepository,
      patientRepository,
      serviceRepository,
    ),
    opdPrescriptions: new OpdPrescriptionService(
      opdPrescriptionRepository,
      opdVisitRepository,
      opdConsultationRepository,
      patientRepository,
    ),
    opdFollowUps: new OpdFollowUpService(
      opdFollowUpRepository,
      opdVisitRepository,
      opdConsultationRepository,
      appointmentService,
      patientRepository,
    ),
    opdReferrals: new OpdReferralService(
      opdReferralRepository,
      opdVisitRepository,
      opdConsultationRepository,
      doctorRepository,
      appointmentService,
      patientRepository,
    ),
    serviceCatalogue: new ServiceCatalogueService(serviceRepository, departmentRepository),
    medicines: new MedicineService(medicineRepository, pharmacyInventoryRepository),
    pharmacyInventory: new PharmacyInventoryService(pharmacyInventoryRepository),
    laboratory: new LaboratoryService(opdClinicalOrderRepository, laboratoryRepository, serviceRepository),
    imaging: new ImagingService(opdClinicalOrderRepository, imagingRepository),
    billing: new BillingService(
      billingRepository,
      patientRepository,
      opdVisitRepository,
      appointmentRepository,
      opdConsultationRepository,
      opdClinicalOrderRepository,
      serviceRepository,
      pharmacyInventoryRepository,
    ),
    settings: new SettingsService(settingsRepository, new SettingsLogoStorage()),
    patientPortal: new PatientPortalService(new PatientPortalRepository(), userService, appointmentService, doctorService, patientService),
  };
};
