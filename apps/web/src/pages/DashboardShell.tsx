import { lazy, Suspense, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  getAccessibleSidebarModules,
  hasPermission,
  isSuperAdministrator,
} from '../auth/access-control';
import type { AuthUser } from '../auth/auth-types';
import { navigate, useAppLocation } from '../routing/navigation';
import { MedicalLoader } from '../components/ui/MedicalLoader';

const DoctorDashboardPage = lazy(() => import('./DoctorDashboardPage').then((m) => ({ default: m.DoctorDashboardPage })));
const AppointmentDashboardPage = lazy(() => import('./AppointmentDashboardPage').then((m) => ({ default: m.AppointmentDashboardPage })));
const OpdDashboardPage = lazy(() => import('./OpdDashboardPage').then((m) => ({ default: m.OpdDashboardPage })));
const BillingDashboardPage = lazy(() => import('./BillingDashboardPage').then((m) => ({ default: m.BillingDashboardPage })));
const AdministrationDashboardPage = lazy(() => import('./AdministrationDashboardPage').then((m) => ({ default: m.AdministrationDashboardPage })));
const PharmacyQueueDashboardPage = lazy(() => import('./PharmacyQueueDashboardPage').then((m) => ({ default: m.PharmacyQueueDashboardPage })));
const PharmacyInventoryDashboardPage = lazy(() => import('./PharmacyInventoryDashboardPage').then((m) => ({ default: m.PharmacyInventoryDashboardPage })));
const LaboratoryDashboardPage = lazy(() => import('./LaboratoryDashboardPage').then((m) => ({ default: m.LaboratoryDashboardPage })));
const ImagingDashboardPage = lazy(() => import('./ImagingDashboardPage').then((m) => ({ default: m.ImagingDashboardPage })));

function DashboardSuspenseFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading ${label}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        padding: '2rem',
      }}
    >
      <MedicalLoader text={`Loading ${label}…`} subtext="Retrieving workspace telemetry" />
    </div>
  );
}

const withSuspense = (label: string, component: ReactNode) => (
  <Suspense fallback={<DashboardSuspenseFallback label={label} />}>
    {component}
  </Suspense>
);




import { SuperAdminExecutiveOverview } from '../components/dashboard/SuperAdminExecutiveOverview';

function ExecutiveOverviewTab() {
  return <SuperAdminExecutiveOverview />;
}

type DashboardTabDefinition = {
  key: string;
  label: string;
  icon: string;
  content: ReactNode;
};

const canView = (user: AuthUser, module: string, screen: string) =>
  hasPermission(user.permissions, { module, screen, action: 'View' });

const hasRole = (user: AuthUser, roleCode: string) =>
  user.roles.some((role) => role.code === roleCode);

const dashboardShortcutOnlyModules = new Set(['emergency', 'admissions', 'surgery']);

function AccessibleModulesOverview({ user }: { user: AuthUser }) {
  const modules = getAccessibleSidebarModules(user.permissions, user.roles)
    .filter((module) => !dashboardShortcutOnlyModules.has(module.key));

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>My HMS Workspace</h2>
          <p>Modules available through your current role and permissions.</p>
        </div>
      </section>

      {modules.length === 0 ? (
        <div className="admin-dashboard-state" role="status">
          <i className="ph ph-shield-warning" aria-hidden="true" />
          <strong>No dashboard summary is available</strong>
          <span>Use the sidebar for any separately authorized operational modules.</span>
        </div>
      ) : (
        <section className="doc-grid dashboard-bottom" aria-label="Permitted HMS modules">
          {modules.map((module) => (
            <article className="doc-card" key={module.key}>
              <div className="doc-card-header">
                <div>
                  <h3><i className={`ph ${module.icon}`} aria-hidden="true" /> {module.label}</h3>
                  <p>{module.links.length} permitted {module.links.length === 1 ? 'workspace' : 'workspaces'}</p>
                </div>
              </div>
              <div className="doc-quick-actions">
                {module.links.map((link) => (
                  <button className="doc-quick-action" key={link.href} onClick={() => navigate(link.href)} type="button">
                    <i className="ph ph-arrow-square-out" aria-hidden="true" />
                    <span><strong>{link.label}</strong><span>Open permitted workspace</span></span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const buildSuperAdministratorTabs = (): DashboardTabDefinition[] => [
  { key: 'overview', label: 'Overview', icon: 'ph-squares-four', content: <ExecutiveOverviewTab /> },
  { key: 'doctors', label: 'Doctors', icon: 'ph-stethoscope', content: withSuspense('Doctors', <DoctorDashboardPage />) },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) },
  { key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) },
  { key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: withSuspense('Pharmacy Queue', <PharmacyQueueDashboardPage />) },
  { key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: withSuspense('Pharmacy Inventory', <PharmacyInventoryDashboardPage />) },
  { key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: withSuspense('Laboratory', <LaboratoryDashboardPage />) },
  { key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: withSuspense('Imaging', <ImagingDashboardPage />) },
  { key: 'admin', label: 'Administration', icon: 'ph-gear', content: withSuspense('Administration', <AdministrationDashboardPage />) },
];

const buildPermissionTabs = (user: AuthUser): DashboardTabDefinition[] => {
  const doctorUser = user.roles.some((role) => role.code === 'DOCTOR');
  const tabs: DashboardTabDefinition[] = [];

  if (
    doctorUser &&
    canView(user, 'Doctors', 'Doctor Directory') &&
    canView(user, 'Appointments', 'Appointment Records')
  ) {
    tabs.push({ key: 'clinical', label: 'My Clinical Day', icon: 'ph-stethoscope', content: withSuspense('Clinical Day', <DoctorDashboardPage />) });
  }

  if (canView(user, 'Administration', 'Dashboard')) {
    tabs.push({ key: 'admin', label: 'Administration', icon: 'ph-gear', content: withSuspense('Administration', <AdministrationDashboardPage />) });
  }

  if (canView(user, 'Pharmacy', 'Dispensing')) {
    tabs.push({ key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: withSuspense('Pharmacy Queue', <PharmacyQueueDashboardPage />) });
  }
  if (canView(user, 'Pharmacy', 'Medicine Inventory')) {
    tabs.push({ key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: withSuspense('Pharmacy Inventory', <PharmacyInventoryDashboardPage />) });
  }
  if (canView(user, 'Laboratory', 'Orders')) {
    tabs.push({ key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: withSuspense('Laboratory', <LaboratoryDashboardPage />) });
  }
  if (canView(user, 'Imaging', 'Orders')) {
    tabs.push({ key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: withSuspense('Imaging', <ImagingDashboardPage />) });
  }
  if (hasRole(user, 'BILLING_AUTHORIZED') && canView(user, 'Billing', 'Invoices')) {
    tabs.push({ key: 'billing', label: 'Billing', icon: 'ph-receipt', content: withSuspense('Billing', <BillingDashboardPage />) });
  }
  const isNurse = hasRole(user, 'CLINICIAN_NURSE');

  if (isNurse && canView(user, 'OPD', 'OPD Visits')) {
    tabs.push({ key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) });
  }
  if (canView(user, 'Appointments', 'Appointment Records')) {
    tabs.push({ key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) });
  }
  if (!isNurse && canView(user, 'OPD', 'OPD Visits')) {
    tabs.push({ key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) });
  }
  return tabs.length > 0
    ? tabs
    : [{ key: 'access', label: 'My Access', icon: 'ph-squares-four', content: <AccessibleModulesOverview user={user} /> }];
};

export function DashboardShell() {
  const { user } = useAuth();
  const location = useAppLocation();
  const searchParams = new URLSearchParams(location.search);
  if (!user) return null;

  const tabs = isSuperAdministrator(user.roles)
    ? buildSuperAdministratorTabs()
    : buildPermissionTabs(user);
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.find((tab) => tab.key === requestedTab) ?? tabs[0] ?? {
    key: 'access',
    label: 'My Access',
    icon: 'ph-squares-four',
    content: <AccessibleModulesOverview user={user} />,
  };

  return (
    <div className="dashboard-master-wrapper">
      <div className="dashboard-tab-content" role="tabpanel">
        {activeTab.content}
      </div>
    </div>
  );
}





