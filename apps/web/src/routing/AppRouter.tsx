import { lazy, Suspense } from 'react';
import { LoadingState } from '../components/LoadingState';
import { canAccessRoute, isPermissionControlledRoute } from '../auth/access-control';
import { useAuth } from '../auth/useAuth';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { sidebarModules } from '../data/ui-foundation';
import { ProtectedRoute } from './ProtectedRoute';
import { navigate, useAppLocation } from './navigation';

const AdministrationDashboardPage = lazy(() => import('../pages/AdministrationDashboardPage').then((module) => ({ default: module.AdministrationDashboardPage })));
const AppointmentBookingPage = lazy(() => import('../pages/AppointmentBookingPage').then((module) => ({ default: module.AppointmentBookingPage })));
const AppointmentCalendarPage = lazy(() => import('../pages/AppointmentCalendarPage').then((module) => ({ default: module.AppointmentCalendarPage })));
const AppointmentDashboardPage = lazy(() => import('../pages/AppointmentDashboardPage').then((module) => ({ default: module.AppointmentDashboardPage })));
const AppointmentQueuePage = lazy(() => import('../pages/AppointmentQueuePage').then((module) => ({ default: module.AppointmentQueuePage })));
const AuthSupportPage = lazy(() => import('../pages/AuthSupportPage').then((module) => ({ default: module.AuthSupportPage })));
const BedAvailabilityPage = lazy(() => import('../pages/BedAvailabilityPage').then((module) => ({ default: module.BedAvailabilityPage })));
const BedManagementPage = lazy(() => import('../pages/BedManagementPage').then((module) => ({ default: module.BedManagementPage })));
const BillingDashboardPage = lazy(() => import('../pages/BillingDashboardPage').then((module) => ({ default: module.BillingDashboardPage })));
const BillingHistoryPage = lazy(() => import('../pages/BillingHistoryPage').then((module) => ({ default: module.BillingHistoryPage })));
const BillingWorkspacePage = lazy(() => import('../pages/BillingWorkspacePage').then((module) => ({ default: module.BillingWorkspacePage })));
const BranchManagementPage = lazy(() => import('../pages/BranchManagementPage').then((module) => ({ default: module.BranchManagementPage })));
const ConsentTemplatesPage = lazy(() => import('../pages/ConsentTemplatesPage').then((module) => ({ default: module.ConsentTemplatesPage })));
const DashboardShell = lazy(() => import('../pages/DashboardShell').then((module) => ({ default: module.DashboardShell })));
const DepartmentManagementPage = lazy(() => import('../pages/DepartmentManagementPage').then((module) => ({ default: module.DepartmentManagementPage })));
const DoctorAvailabilityPage = lazy(() => import('../pages/DoctorAvailabilityPage').then((module) => ({ default: module.DoctorAvailabilityPage })));
const DoctorDashboardPage = lazy(() => import('../pages/DoctorDashboardPage').then((module) => ({ default: module.DoctorDashboardPage })));
const DoctorDirectoryPage = lazy(() => import('../pages/DoctorDirectoryPage').then((module) => ({ default: module.DoctorDirectoryPage })));
const DoctorPerformancePage = lazy(() => import('../pages/DoctorPerformancePage').then((module) => ({ default: module.DoctorPerformancePage })));
const DoctorProfilePage = lazy(() => import('../pages/DoctorProfilePage').then((module) => ({ default: module.DoctorProfilePage })));
const DoctorSchedulePage = lazy(() => import('../pages/DoctorSchedulePage').then((module) => ({ default: module.DoctorSchedulePage })));
const EmergencyDashboardPage = lazy(() => import('../pages/EmergencyDashboardPage').then((module) => ({ default: module.EmergencyDashboardPage })));
const EmergencyQueuePage = lazy(() => import('../pages/EmergencyQueuePage').then((module) => ({ default: module.EmergencyQueuePage })));
const EmergencyWorkspacePage = lazy(() => import('../pages/EmergencyWorkspacePage').then((module) => ({ default: module.EmergencyWorkspacePage })));
const ImagingQueuePage = lazy(() => import('../pages/ImagingQueuePage').then((module) => ({ default: module.ImagingQueuePage })));
const ImagingReportEntryPage = lazy(() => import('../pages/ImagingReportEntryPage').then((module) => ({ default: module.ImagingReportEntryPage })));
const ImagingWorkspacePage = lazy(() => import('../pages/ImagingWorkspacePage').then((module) => ({ default: module.ImagingWorkspacePage })));
const InpatientAdmissionPage = lazy(() => import('../pages/InpatientAdmissionPage').then((module) => ({ default: module.InpatientAdmissionPage })));
const InpatientWorkspacePage = lazy(() => import('../pages/InpatientWorkspacePage').then((module) => ({ default: module.InpatientWorkspacePage })));
const LaboratoryQueuePage = lazy(() => import('../pages/LaboratoryQueuePage').then((module) => ({ default: module.LaboratoryQueuePage })));
const LaboratoryResultEntryPage = lazy(() => import('../pages/LaboratoryResultEntryPage').then((module) => ({ default: module.LaboratoryResultEntryPage })));
const LaboratoryWorkspacePage = lazy(() => import('../pages/LaboratoryWorkspacePage').then((module) => ({ default: module.LaboratoryWorkspacePage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const MedicineMasterPage = lazy(() => import('../pages/MedicineMasterPage').then((module) => ({ default: module.MedicineMasterPage })));
const OpdDashboardPage = lazy(() => import('../pages/OpdDashboardPage').then((module) => ({ default: module.OpdDashboardPage })));
const OpdQueuePage = lazy(() => import('../pages/OpdQueuePage').then((module) => ({ default: module.OpdQueuePage })));
const OpdVisitPage = lazy(() => import('../pages/OpdVisitPage').then((module) => ({ default: module.OpdVisitPage })));
const PatientConsentPage = lazy(() => import('../pages/PatientConsentPage').then((module) => ({ default: module.PatientConsentPage })));
const PatientDocumentsPage = lazy(() => import('../pages/PatientDocumentsPage').then((module) => ({ default: module.PatientDocumentsPage })));
const PatientProfilePage = lazy(() => import('../pages/PatientProfilePage').then((module) => ({ default: module.PatientProfilePage })));
const PatientRegistrationPage = lazy(() => import('../pages/PatientRegistrationPage').then((module) => ({ default: module.PatientRegistrationPage })));
const PatientSearchPage = lazy(() => import('../pages/PatientSearchPage').then((module) => ({ default: module.PatientSearchPage })));
const PharmacyMedicineInventoryPage = lazy(() => import('../pages/PharmacyMedicineInventoryPage').then((module) => ({ default: module.PharmacyMedicineInventoryPage })));
const PhaseTwoReportsPage = lazy(() => import('../pages/PhaseTwoReportsPage').then((module) => ({ default: module.PhaseTwoReportsPage })));
const PrescriptionQueuePage = lazy(() => import('../pages/PrescriptionQueuePage').then((module) => ({ default: module.PrescriptionQueuePage })));
const ReferralBookingPage = lazy(() => import('../pages/ReferralBookingPage').then((module) => ({ default: module.ReferralBookingPage })));
const RolesPermissionsPage = lazy(() => import('../pages/RolesPermissionsPage').then((module) => ({ default: module.RolesPermissionsPage })));
const ServiceCataloguePage = lazy(() => import('../pages/ServiceCataloguePage').then((module) => ({ default: module.ServiceCataloguePage })));
const SurgeryWorkspacePage = lazy(() => import('../pages/SurgeryWorkspacePage').then((module) => ({ default: module.SurgeryWorkspacePage })));
const SystemSettingsPage = lazy(() => import('../pages/SystemSettingsPage').then((module) => ({ default: module.SystemSettingsPage })));
const UserManagementPage = lazy(() => import('../pages/UserManagementPage').then((module) => ({ default: module.UserManagementPage })));

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
    return <Suspense fallback={<LoadingState title="Loading sign in" message="Preparing the secure sign-in page." />}><LoginPage /></Suspense>;
  }

  if (pathname === '/forgot-password') {
    return <Suspense fallback={<LoadingState title="Loading account support" message="Preparing account recovery." />}><AuthSupportPage mode="forgot-password" /></Suspense>;
  }

  if (pathname === '/reset-password') {
    return <Suspense fallback={<LoadingState title="Loading account support" message="Preparing account recovery." />}><AuthSupportPage mode="reset-password" /></Suspense>;
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
  } else if (pathname === '/administration/consent-templates') {
    title = 'Consent Templates';
    breadcrumbs = ['Home', 'Administration', 'Consent Templates'];
    content = <ConsentTemplatesPage />;
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
  } else if (pathname === '/appointments/referrals') {
    title = 'Referral Booking';
    breadcrumbs = ['Home', 'Appointments', 'Referral Booking'];
    content = <ReferralBookingPage />;
  } else if (pathname === '/admissions/bed-availability') {
    title = 'Bed Availability';
    breadcrumbs = ['Home', 'Admissions', 'Bed Availability'];
    content = <BedAvailabilityPage />;
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
  } else if (pathname === '/admissions/beds' || pathname === '/admissions/bed-availability') {
    title = 'Bed Management';
    breadcrumbs = ['Home', 'Admissions', 'Bed Management'];
    content = <BedManagementPage />;
  } else if (pathname === '/admissions/inpatients' || pathname === '/admissions/requests') {
    title = 'Admission Requests';
    breadcrumbs = ['Home', 'Admissions', 'Admission Requests'];
    content = <InpatientAdmissionPage />;
  } else if (pathname === '/admissions' || pathname === '/admissions/workspace') {
    title = 'Inpatient Workspace';
    breadcrumbs = ['Home', 'Admissions', 'Inpatient Workspace'];
    content = <InpatientWorkspacePage />;
  } else if (pathname === '/reports/library') {
    title = 'Phase 2 Reports';
    breadcrumbs = ['Home', 'Reports', 'Phase 2 Reports'];
    content = <PhaseTwoReportsPage />;
  } else if (pathname === '/surgery' || pathname === '/surgery/recommendations' || pathname === '/surgery/bookings' || pathname === '/surgery/schedule') {
    title = 'Surgery & Procedures';
    breadcrumbs = ['Home', 'Surgery', 'Procedure Workflow'];
    content = <SurgeryWorkspacePage />;
  } else if (pathname === '/emergency') {
    title = 'Emergency Dashboard';
    breadcrumbs = ['Home', 'Emergency', 'Dashboard'];
    content = <EmergencyDashboardPage />;
  } else if (pathname === '/emergency/queue') {
    title = 'Emergency Queue';
    breadcrumbs = ['Home', 'Emergency', 'Emergency Queue'];
    content = <EmergencyQueuePage />;
  } else if (pathname === '/emergency/workspace') {
    title = 'Emergency Workspace';
    breadcrumbs = ['Home', 'Emergency', 'Emergency Workspace'];
    content = <EmergencyWorkspacePage />;
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
        <Suspense fallback={<LoadingState title="Loading page" message="Preparing the requested HMS workspace." />}>
          {content}
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
