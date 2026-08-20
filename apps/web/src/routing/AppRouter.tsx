import { LoadingState } from '../components/LoadingState';
import { canAccessRoute, isPermissionControlledRoute } from '../auth/access-control';
import { useAuth } from '../auth/useAuth';
import { AuthSupportPage } from '../pages/AuthSupportPage';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { DashboardShell } from '../pages/DashboardShell';
import { AppointmentBookingPage } from '../pages/AppointmentBookingPage';
import { AppointmentCalendarPage } from '../pages/AppointmentCalendarPage';
import { AppointmentDashboardPage } from '../pages/AppointmentDashboardPage';
import { AppointmentQueuePage } from '../pages/AppointmentQueuePage';
import { DoctorDashboardPage } from '../pages/DoctorDashboardPage';
import { DoctorDirectoryPage } from '../pages/DoctorDirectoryPage';
import { DoctorPerformancePage } from '../pages/DoctorPerformancePage';
import { DoctorSchedulePage } from '../pages/DoctorSchedulePage';
import { DoctorProfilePage } from '../pages/DoctorProfilePage';
import { DoctorAvailabilityPage } from '../pages/DoctorAvailabilityPage';
import { LoginPage } from '../pages/LoginPage';
import { OpdDashboardPage } from '../pages/OpdDashboardPage';
import { OpdQueuePage } from '../pages/OpdQueuePage';
import { OpdVisitPage } from '../pages/OpdVisitPage';
import { PatientProfilePage } from '../pages/PatientProfilePage';
import { PatientRegistrationPage } from '../pages/PatientRegistrationPage';
import { PatientSearchPage } from '../pages/PatientSearchPage';
import { PatientDocumentsPage } from '../pages/PatientDocumentsPage';
import { PatientConsentPage } from '../pages/PatientConsentPage';
import { RolesPermissionsPage } from '../pages/RolesPermissionsPage';
import { UserManagementPage } from '../pages/UserManagementPage';
import { DepartmentManagementPage } from '../pages/DepartmentManagementPage';
import { BranchManagementPage } from '../pages/BranchManagementPage';
import { ServiceCataloguePage } from '../pages/ServiceCataloguePage';
import { MedicineMasterPage } from '../pages/MedicineMasterPage';
import { PharmacyMedicineInventoryPage } from '../pages/PharmacyMedicineInventoryPage';
import { PrescriptionQueuePage } from '../pages/PrescriptionQueuePage';
import { LaboratoryQueuePage } from '../pages/LaboratoryQueuePage';
import { LaboratoryWorkspacePage } from '../pages/LaboratoryWorkspacePage';
import { LaboratoryResultEntryPage } from '../pages/LaboratoryResultEntryPage';
import { ImagingQueuePage } from '../pages/ImagingQueuePage';
import { ImagingWorkspacePage } from '../pages/ImagingWorkspacePage';
import { ImagingReportEntryPage } from '../pages/ImagingReportEntryPage';
import { BillingDashboardPage } from '../pages/BillingDashboardPage';
import { BillingWorkspacePage } from '../pages/BillingWorkspacePage';
import { BillingHistoryPage } from '../pages/BillingHistoryPage';
import { SystemSettingsPage } from '../pages/SystemSettingsPage';
import { AdministrationDashboardPage } from '../pages/AdministrationDashboardPage';
import { BedManagementPage } from '../pages/BedManagementPage';
import { InpatientAdmissionPage } from '../pages/InpatientAdmissionPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { sidebarModules } from '../data/ui-foundation';
import { ProtectedRoute } from './ProtectedRoute';
import { navigate, useAppLocation } from './navigation';

function NotFoundPage() {
  return (
    <main className="app-shell app-shell--center">
      <section className="auth-support-panel" aria-labelledby="not-found-title">
        <p className="eyebrow">Route not found</p>
        <h1 id="not-found-title">Page unavailable</h1>
        <p>The requested HMS route is not available.</p>
        <button className="secondary-action" onClick={() => navigate('/dashboard')} type="button">
          Go to dashboard
        </button>
      </section>
    </main>
  );
}

function AccessDeniedPage() {
  return (
    <div className="admin-dashboard-state admin-dashboard-state--error" role="alert">
      <i className="ph ph-shield-warning" aria-hidden="true" />
      <strong>Access denied</strong>
      <span>You do not have permission to open this page.</span>
      <button className="btn-secondary" onClick={() => navigate('/dashboard')} type="button">
        Go to dashboard
      </button>
    </div>
  );
}

export function AppRouter() {
  const { status, user } = useAuth();
  const { pathname } = useAppLocation();

  if (status === 'loading' && pathname !== '/login') {
    return <LoadingState />;
  }

  // ── Public routes ────────────────────────────────────────────────────────────

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (pathname === '/forgot-password') {
    return <AuthSupportPage mode="forgot-password" />;
  }

  if (pathname === '/reset-password') {
    return <AuthSupportPage mode="reset-password" />;
  }

  // ── Protected routes ─────────────────────────────────────────────────────────

  let content = <NotFoundPage />;
  let title = 'Not Found';
  let breadcrumbs = ['Home', 'Not Found'];

  // Look up the route dynamically from ui-foundation.ts sidebar config
  let matchedLink = undefined;
  let matchedModule = undefined;

  for (const module of sidebarModules) {
    const link = module.links.find(
      (l) => l.href === pathname || l.href + '/' === pathname
    );
    if (link) {
      matchedModule = module;
      matchedLink = link;
      break;
    }
  }

  // 1. Explicitly implemented pages override dynamic matching
  if (pathname === '/' || pathname === '/dashboard') {
    title = 'Dashboard';
    breadcrumbs = ['Home', 'Dashboard'];
    content = <DashboardShell />;
  } else if (pathname === '/administration') {
    title = 'Administration Dashboard';
    breadcrumbs = ['Home', 'Administration', 'Dashboard'];
    content = <AdministrationDashboardPage />;
  } else if (pathname === '/patients' || pathname === '/patients/search') {
    title = 'Patients';
    breadcrumbs = ['Home', 'Patients'];
    content = <PatientSearchPage />;
  } else if (pathname === '/patients/register') {
    title = 'Register Patient';
    breadcrumbs = ['Home', 'Patients', 'Register Patient'];
    content = <PatientRegistrationPage />;
  } else if (pathname === '/patients/profile') {
    title = 'Patient Workspace';
    breadcrumbs = ['Home', 'Patients', 'Patient Workspace'];
    content = <PatientProfilePage />;
  } else if (pathname === '/patients/history' || pathname === '/patients/emr') {
    title = 'Page Moved';
    breadcrumbs = ['Home', 'Patients', 'Page Moved'];
    content = (
      <div className="admin-dashboard-state" role="status">
        <i className="ph ph-arrow-square-right" aria-hidden="true" />
        <strong>This page has moved</strong>
        <span>Patient information is now available in the Patient Workspace. Use Search Patients to find a patient and click View Patient.</span>
        <button className="btn-secondary" onClick={() => navigate('/patients/search')} type="button">
          Go to Search Patients
        </button>
      </div>
    );
  } else if (pathname === '/patients/documents') {
    title = 'Patient Documents';
    breadcrumbs = ['Home', 'Patients', 'Documents'];
    content = <PatientDocumentsPage />;
  } else if (pathname === '/patients/consents' || pathname === '/patients/consent') {
    title = 'Patient Consent';
    breadcrumbs = ['Home', 'Patients', 'Consent Forms'];
    content = <PatientConsentPage />;
  } else if (pathname === '/doctors') {
    title = 'Doctor Dashboard';
    breadcrumbs = ['Home', 'Doctors', 'Dashboard'];
    content = <DoctorDashboardPage />;
  } else if (pathname === '/doctors/directory') {
    title = 'Doctor Directory';
    breadcrumbs = ['Home', 'Doctors', 'Doctor Directory'];
    content = <DoctorDirectoryPage />;
  } else if (pathname === '/doctors/profile') {
    title = 'Doctor Profile';
    breadcrumbs = ['Home', 'Doctors', 'Doctor Profile'];
    content = <DoctorProfilePage />;
  } else if (pathname === '/doctors/availability') {
    title = 'Doctor Availability';
    breadcrumbs = ['Home', 'Doctors', 'Availability'];
    content = <DoctorAvailabilityPage />;
  } else if (pathname === '/doctors/schedule') {
    title = 'Doctor Schedule';
    breadcrumbs = ['Home', 'Doctors', 'Schedule'];
    content = <DoctorSchedulePage />;
  } else if (pathname === '/doctors/performance') {
    title = 'Doctor Performance';
    breadcrumbs = ['Home', 'Doctors', 'Performance'];
    content = <DoctorPerformancePage />;
  } else if (pathname === '/appointments') {
    title = 'Appointment Dashboard';
    breadcrumbs = ['Home', 'Appointments', 'Appointment Dashboard'];
    content = <AppointmentDashboardPage />;
  } else if (pathname === '/appointments/book') {
    title = 'Book Appointment';
    breadcrumbs = ['Home', 'Appointments', 'Book Appointment'];
    content = <AppointmentBookingPage />;
  } else if (pathname === '/appointments/calendar') {
    title = 'Calendar View';
    breadcrumbs = ['Home', 'Appointments', 'Calendar View'];
    content = <AppointmentCalendarPage />;
  } else if (pathname === '/appointments/queue') {
    title = 'Queue Management';
    breadcrumbs = ['Home', 'Appointments', 'Queue Management'];
    content = <AppointmentQueuePage />;
  } else if (pathname === '/opd' || pathname === '/opd/') {
    title = 'OPD Dashboard';
    breadcrumbs = ['Home', 'OPD', 'Dashboard'];
    content = <OpdDashboardPage />;
  } else if (pathname === '/opd/consultation') {
    title = 'Consultation Workspace';
    breadcrumbs = ['Home', 'OPD', 'Consultation'];
    content = <OpdVisitPage />;
  } else if (pathname === '/opd/queue') {
    title = 'OPD Waiting Queue';
    breadcrumbs = ['Home', 'OPD', 'Waiting Queue'];
    content = <OpdQueuePage />;
  } else if (pathname === '/opd/visit') {
    title = 'Consultation Workspace';
    breadcrumbs = ['Home', 'OPD', 'Consultation Workspace'];
    content = <OpdVisitPage />;
  } else if (pathname === '/administration/users') {
    title = 'User Management';
    breadcrumbs = ['Home', 'Administration', 'User Management'];
    content = <UserManagementPage />;
  } else if (pathname === '/administration/roles-permissions') {
    title = 'Roles & Permissions';
    breadcrumbs = ['Home', 'Administration', 'Roles & Permissions'];
    content = <RolesPermissionsPage />;
  } else if (pathname === '/administration/departments') {
    title = 'Department Management';
    breadcrumbs = ['Home', 'Administration', 'Department Management'];
    content = <DepartmentManagementPage />;
  } else if (pathname === '/administration/branches') {
    title = 'Branch Management';
    breadcrumbs = ['Home', 'Administration', 'Branch Management'];
    content = <BranchManagementPage />;
  } else if (pathname === '/administration/services') {
    title = 'Service Catalogue';
    breadcrumbs = ['Home', 'Administration', 'Service Catalogue'];
    content = <ServiceCataloguePage />;
  } else if (pathname === '/administration/medicines') {
    title = 'Medicine Master';
    breadcrumbs = ['Home', 'Administration', 'Medicine Master'];
    content = <MedicineMasterPage />;
  } else if (pathname === '/pharmacy' || pathname === '/pharmacy/queue') {
    title = 'Prescription Queue';
    breadcrumbs = ['Home', 'Pharmacy', 'Prescription Queue'];
    content = <PrescriptionQueuePage />;
  } else if (pathname === '/pharmacy/inventory') {
    title = 'Medicine Inventory';
    breadcrumbs = ['Home', 'Pharmacy', 'Medicine Inventory'];
    content = <PharmacyMedicineInventoryPage />;
  } else if (pathname === '/laboratory' || pathname === '/laboratory/queue') {
    title = pathname === '/laboratory' ? 'Laboratory Dashboard' : 'Laboratory Work Queue';
    breadcrumbs = ['Home', 'Laboratory', pathname === '/laboratory' ? 'Dashboard' : 'Work Queue'];
    content = <LaboratoryQueuePage />;
  } else if (pathname === '/laboratory/workspace') {
    title = 'Laboratory Workspace'; breadcrumbs = ['Home', 'Laboratory', 'Workspace']; content = <LaboratoryWorkspacePage />;
  } else if (pathname === '/laboratory/reports' || pathname === '/laboratory/results') {
    title = 'Laboratory Results'; breadcrumbs = ['Home', 'Laboratory', 'Results']; content = <LaboratoryResultEntryPage />;
  } else if (pathname === '/imaging' || pathname === '/imaging/queue') {
    title = pathname === '/imaging' ? 'Imaging Dashboard' : 'Imaging Work Queue';
    breadcrumbs = ['Home', 'Imaging', pathname === '/imaging' ? 'Dashboard' : 'Work Queue'];
    content = <ImagingQueuePage />;
  } else if (pathname === '/imaging/workspace') {
    title = 'Imaging Workspace'; breadcrumbs = ['Home', 'Imaging', 'Workspace']; content = <ImagingWorkspacePage />;
  } else if (pathname === '/imaging/reports') {
    title = 'Imaging Reports'; breadcrumbs = ['Home', 'Imaging', 'Reports']; content = <ImagingReportEntryPage />;
  } else if (pathname === '/billing') {
    title = 'Billing Dashboard'; breadcrumbs = ['Home', 'Billing', 'Dashboard']; content = <BillingDashboardPage />;
  } else if (pathname === '/billing/workspace') {
    title = 'Billing Workspace'; breadcrumbs = ['Home', 'Billing', 'Workspace']; content = <BillingWorkspacePage />;
  } else if (pathname === '/billing/history') {
    title = 'Billing History'; breadcrumbs = ['Home', 'Billing', 'History']; content = <BillingHistoryPage />;
  } else if (pathname === '/administration/settings') {
    title = 'System Settings';
    breadcrumbs = ['Home', 'Administration', 'System Settings'];
    content = <SystemSettingsPage />;
  } else if (pathname === '/admissions/beds') {
    title = 'Bed Management';
    breadcrumbs = ['Home', 'Admissions', 'Bed Management'];
    content = <BedManagementPage />;
  } else if (pathname === '/admissions/inpatients') {
    title = 'Inpatient Admission';
    breadcrumbs = ['Home', 'Admissions', 'Inpatient Admission'];
    content = <InpatientAdmissionPage />;
  } 
  // 2. All other sidebar routes automatically get a ComingSoonPage stub
  else if (matchedModule && matchedLink) {
    title = matchedLink.label;
    breadcrumbs = ['Home', matchedModule.label, matchedLink.label];
    content = (
      <ComingSoonPage
        title={matchedLink.label}
        icon={matchedModule.icon}
        description={`${matchedLink.label} is under development. Use the sidebar to access other functionality.`}
        activeHref={matchedLink.href}
        activeModule={matchedModule.key}
      />
    );
  }

  const routeNeedsPermission = isPermissionControlledRoute(pathname) || Boolean(matchedLink);
  if (routeNeedsPermission && !canAccessRoute(pathname, user?.permissions ?? [], user?.roles ?? [])) {
    title = 'Access Denied';
    breadcrumbs = ['Home', 'Access Denied'];
    content = <AccessDeniedPage />;
  }

  return (
    <ProtectedRoute>
      <DashboardLayout title={title} breadcrumbs={breadcrumbs}>
        {content}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
