import type { ReactNode } from 'react';
import { useDashboardOverviewFeature } from '../hooks/dashboard/useDashboardOverviewFeature';
import { useAuth } from '../auth/useAuth';
import {
  canAccessRoute,
  getAccessibleSidebarModules,
  hasPermission,
  isSuperAdministrator,
} from '../auth/access-control';
import type { AuthUser } from '../auth/auth-types';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDateTime } from './patient-utils';
import { DoctorDashboardPage } from './DoctorDashboardPage';
import { AppointmentDashboardPage } from './AppointmentDashboardPage';
import { OpdDashboardPage } from './OpdDashboardPage';
import { BillingDashboardPage } from './BillingDashboardPage';
import { AdministrationDashboardPage } from './AdministrationDashboardPage';
import { PrescriptionQueuePage } from './PrescriptionQueuePage';
import { PharmacyMedicineInventoryPage } from './PharmacyMedicineInventoryPage';
import { LaboratoryQueuePage } from './LaboratoryQueuePage';
import { ImagingQueuePage } from './ImagingQueuePage';
import { PhaseTwoReportsPage } from './PhaseTwoReportsPage';
import { useCurrencyFormatter } from '../api/useSettings';


type StatCardProps = {
  icon: string;
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  value: string | number;
};

function StatCard({ icon, label, note, tone, value }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <i className={`ph-fill ${icon}`} aria-hidden="true" />
      </div>
      <div className="stat-info">
        <p>{label}</p>
        <h3>{typeof value === 'number' ? value.toLocaleString() : value}</h3>
        <span>{note}</span>
      </div>
    </div>
  );
}

function ExecutiveOverviewTab() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'User';
  const { data, isLoading: loading, isError, refresh } = useDashboardOverviewFeature();
  const formatMoney = useCurrencyFormatter();

  const loadError = isError ? 'Executive dashboard metrics could not be updated.' : '';
  const maxRevenue = Math.max(1, ...data.trend.map((t) => t.revenue));

  return (
    <div className="dashboard-grid">
      <div className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Hospital Executive Overview</h2>
          <p>Welcome back, {firstName}. Live enterprise health, encounters, and financial performance.</p>
        </div>
        <button className="secondary-action" disabled={loading} onClick={() => refresh()} type="button">
          <i className="ph ph-arrow-clockwise" aria-hidden="true" />
          Refresh Live Data
        </button>
      </div>

      {loadError ? <div className="um-state-cell" role="alert">{loadError}</div> : null}

      <div className="stat-cards-container stat-cards-container--five">
        <StatCard icon="ph-users" label="Registered Patients" note="Active patient directory" tone="blue" value={data.registeredPatients} />
        <StatCard icon="ph-stethoscope" label="Active Doctors" note="On-duty clinical staff" tone="green" value={data.activeDoctors} />
        <StatCard icon="ph-calendar-check" label="Today's Appointments" note="Bookings & encounters" tone="orange" value={data.appointmentsToday} />
        <StatCard icon="ph-first-aid" label="OPD Visits Today" note="Checked-in patient visits" tone="purple" value={data.opdVisitsToday} />
        <StatCard icon="ph-receipt" label="Today Billed Revenue" note="Live billing summary" tone="green" value={data.billedTotal === null ? '--' : formatMoney(data.billedTotal)} />
      </div>

      <div className="doc-grid dashboard-main executive-dashboard-main">
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>7-Day Revenue &amp; Encounter Flow</h3>
              <p>Combined outpatient volume &amp; financial collections trend</p>
            </div>
          </div>
          <div className="doc-chart">
            <svg className="doc-line-chart" viewBox="0 0 700 200" role="img" aria-label="Revenue and visit trend">
              {[0, 1, 2, 3].map((line) => (
                <line key={line} x1="30" x2="670" y1={30 + line * 45} y2={30 + line * 45} stroke="#e2e8f0" strokeDasharray="4 4" />
              ))}
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                points={data.trend.map((pt, idx) => `${30 + idx * 105},${165 - (pt.revenue / maxRevenue) * 120}`).join(' ')}
              />
              {data.trend.map((pt, idx) => (
                <circle cx={30 + idx * 105} cy={165 - (pt.revenue / maxRevenue) * 120} fill="#2563eb" key={pt.day} r="5" />
              ))}
            </svg>
            <div className="doc-chart-axis" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem 0 1rem' }}>
              {data.trend.map((pt) => (
                <span key={pt.day} style={{ fontSize: '0.8rem', color: '#64748b' }}>{pt.day} ({formatMoney(pt.revenue)})</span>
              ))}
            </div>
          </div>
        </article>

        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Financial Settlement Summary</h3>
              <p>Real-time collections vs outstanding</p>
            </div>
          </div>
          <div className="opd-summary-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <span>Total Billed Amount</span>
              <strong style={{ color: '#0f172a' }}>{data.billedTotal === null ? '--' : formatMoney(data.billedTotal)}</strong>
            </div>
            <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <span>Collected Funds</span>
              <strong style={{ color: '#16a34a' }}>{data.collectedTotal === null ? '--' : formatMoney(data.collectedTotal)}</strong>
            </div>
            <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pending Outstanding</span>
              <strong style={{ color: '#ea580c' }}>{data.billedTotal === null || data.collectedTotal === null ? '--' : formatMoney(Math.max(0, data.billedTotal - data.collectedTotal))}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="card appointments-card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <div>
            <h3>Live OPD Patient Encounters</h3>
            <p>Real-time check-ins and clinical status tracking</p>
          </div>
        </div>
        {loading ? (
          <div className="um-state-cell">Loading live encounter stream...</div>
        ) : data.recentVisits.length === 0 ? (
          <div className="patient-empty-inline">No OPD visits recorded today.</div>
        ) : (
          <div className="um-table-section">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit #</th>
                  <th>Patient Name</th>
                  <th>Attending Doctor</th>
                  <th>Check-in Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentVisits.map((visit) => (
                  <tr key={visit.id}>
                    <td><strong>{visit.visit_number}</strong></td>
                    <td>{visit.patient_name}</td>
                    <td>{visit.doctor_name}</td>
                    <td>{formatDateTime(visit.check_in_time)}</td>
                    <td><span className="status-badge neutral">{visit.status.replaceAll('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type DashboardTabDefinition = {
  key: string;
  label: string;
  icon: string;
  content: ReactNode;
};

const canView = (user: AuthUser, module: string, screen: string) =>
  hasPermission(user.permissions, { module, screen, action: 'View' });

function AccessibleModulesOverview({ user }: { user: AuthUser }) {
  const modules = getAccessibleSidebarModules(user.permissions, user.roles);

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
          <strong>No staff modules are assigned</strong>
          <span>Contact a system administrator if you require additional access.</span>
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

function ModuleWorkspaceOverview({ user, moduleKey }: { user: AuthUser; moduleKey: string }) {
  const module = getAccessibleSidebarModules(user.permissions, user.roles)
    .find((candidate) => candidate.key === moduleKey);

  if (!module) return <AccessibleModulesOverview user={user} />;

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>{module.label}</h2>
          <p>Open an operational workspace permitted by your current access.</p>
        </div>
      </section>
      <section className="doc-card" aria-label={`${module.label} workspaces`}>
        <div className="doc-quick-actions">
          {module.links.map((link) => (
            <button className="doc-quick-action" key={link.href} onClick={() => navigate(link.href)} type="button">
              <i className={`ph ${module.icon}`} aria-hidden="true" />
              <span><strong>{link.label}</strong><span>Open permitted workspace</span></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const buildSuperAdministratorTabs = (): DashboardTabDefinition[] => [
  { key: 'overview', label: 'Overview', icon: 'ph-squares-four', content: <ExecutiveOverviewTab /> },
  { key: 'doctors', label: 'Doctors', icon: 'ph-stethoscope', content: <DoctorDashboardPage /> },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: <AppointmentDashboardPage /> },
  { key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: <OpdDashboardPage /> },
  { key: 'billing', label: 'Billing', icon: 'ph-receipt', content: <BillingDashboardPage /> },
  { key: 'admin', label: 'Administration', icon: 'ph-gear', content: <AdministrationDashboardPage /> },
];

const buildPermissionTabs = (user: AuthUser): DashboardTabDefinition[] => {
  const doctorUser = user.roles.some((role) => role.code === 'DOCTOR');
  const tabs: DashboardTabDefinition[] = [];

  if (
    doctorUser &&
    canView(user, 'Doctors', 'Doctor Directory') &&
    canView(user, 'Appointments', 'Appointment Records')
  ) {
    tabs.push({ key: 'clinical', label: 'My Clinical Day', icon: 'ph-stethoscope', content: <DoctorDashboardPage /> });
  }

  if (canView(user, 'Administration', 'Dashboard')) {
    tabs.push({ key: 'admin', label: 'Administration', icon: 'ph-gear', content: <AdministrationDashboardPage /> });
  }

  if (canView(user, 'Pharmacy', 'Dispensing')) {
    tabs.push({ key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: <PrescriptionQueuePage /> });
  }
  if (canView(user, 'Pharmacy', 'Medicine Inventory')) {
    tabs.push({ key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: <PharmacyMedicineInventoryPage /> });
  }
  if (canView(user, 'Laboratory', 'Orders')) {
    tabs.push({ key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: <LaboratoryQueuePage /> });
  }
  if (canView(user, 'Imaging', 'Orders')) {
    tabs.push({ key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: <ImagingQueuePage /> });
  }
  if (canView(user, 'Billing', 'Invoices')) {
    tabs.push({ key: 'billing', label: 'Billing', icon: 'ph-receipt', content: <BillingDashboardPage /> });
  }
  if (!doctorUser && canView(user, 'Appointments', 'Appointment Records')) {
    tabs.push({ key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: <AppointmentDashboardPage /> });
  }
  if (canView(user, 'OPD', 'OPD Visits')) {
    tabs.push({ key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: <OpdDashboardPage /> });
  }
  if (canView(user, 'Emergency', 'Encounters')) {
    tabs.push({ key: 'emergency', label: 'Emergency', icon: 'ph-warning-circle', content: <ModuleWorkspaceOverview moduleKey="emergency" user={user} /> });
  }
  if (
    canView(user, 'Admissions', 'Inpatient Admissions') ||
    canView(user, 'Admissions', 'Admission Requests')
  ) {
    tabs.push({ key: 'admissions', label: 'Admissions', icon: 'ph-bed', content: <ModuleWorkspaceOverview moduleKey="admissions" user={user} /> });
  }
  if (canAccessRoute('/surgery', user.permissions, user.roles)) {
    tabs.push({ key: 'surgery', label: 'Surgery', icon: 'ph-scissors', content: <ModuleWorkspaceOverview moduleKey="surgery" user={user} /> });
  }
  if (canView(user, 'Reports', 'Phase 2 Reports')) {
    tabs.push({ key: 'reports', label: 'Reports', icon: 'ph-chart-bar', content: <PhaseTwoReportsPage /> });
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

  const selectTab = (key: string) => {
    const next = new URLSearchParams(location.search);
    next.set('tab', key);
    navigate(`/dashboard?${next.toString()}`);
  };

  return (
    <div className="dashboard-master-wrapper">
      <div aria-label="Dashboard sections" className="dashboard-tab-bar" role="tablist" style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab.key === tab.key}
            className={`dashboard-tab-btn${activeTab.key === tab.key ? ' active' : ''}`}
            key={tab.key}
            onClick={() => selectTab(tab.key)}
            role="tab"
            type="button"
          >
            <i className={`ph ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-tab-content" role="tabpanel">
        {activeTab.content}
      </div>
    </div>
  );
}





