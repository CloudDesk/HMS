import { lazy, Suspense, type ReactNode } from 'react';
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
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { useCurrencyFormatter } from '../api/useSettings';

const DoctorDashboardPage = lazy(() => import('./DoctorDashboardPage').then((m) => ({ default: m.DoctorDashboardPage })));
const AppointmentDashboardPage = lazy(() => import('./AppointmentDashboardPage').then((m) => ({ default: m.AppointmentDashboardPage })));
const OpdDashboardPage = lazy(() => import('./OpdDashboardPage').then((m) => ({ default: m.OpdDashboardPage })));
const BillingDashboardPage = lazy(() => import('./BillingDashboardPage').then((m) => ({ default: m.BillingDashboardPage })));
const AdministrationDashboardPage = lazy(() => import('./AdministrationDashboardPage').then((m) => ({ default: m.AdministrationDashboardPage })));
const PrescriptionQueuePage = lazy(() => import('./PrescriptionQueuePage').then((m) => ({ default: m.PrescriptionQueuePage })));
const PharmacyMedicineInventoryPage = lazy(() => import('./PharmacyMedicineInventoryPage').then((m) => ({ default: m.PharmacyMedicineInventoryPage })));
const LaboratoryQueuePage = lazy(() => import('./LaboratoryQueuePage').then((m) => ({ default: m.LaboratoryQueuePage })));
const ImagingQueuePage = lazy(() => import('./ImagingQueuePage').then((m) => ({ default: m.ImagingQueuePage })));
const PhaseTwoReportsPage = lazy(() => import('./PhaseTwoReportsPage').then((m) => ({ default: m.PhaseTwoReportsPage })));

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


import { useBranchesList } from '../hooks/branches/useBranches';

type StatCardProps = {
  icon: string;
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  value: string | number;
};

function StatCard({ icon, label, note, tone, value }: StatCardProps) {
  return (
    <div className="stat-card" style={{ minWidth: 0, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
      <div className={`stat-icon ${tone}`} style={{ flexShrink: 0 }}>
        <i className={`ph ${icon}`} aria-hidden="true" style={{ fontSize: '1.5rem' }} />
      </div>
      <div className="stat-info" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 600, color: '#64748b', whiteSpace: 'normal', lineHeight: 1.2 }}>{label}</p>
        <h3 style={{ margin: '0.2rem 0', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
      </div>
    </div>
  );
}

function ExecutiveOverviewTab() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'User';
  const { data, isLoading: loading, isError, isFetching, refresh, selectedBranchId, setSelectedBranchId } = useDashboardOverviewFeature();
  const formatMoney = useCurrencyFormatter();
  const { data: branchesData } = useBranchesList({ limit: 100 });

  const accessibleBranches = branchesData?.data || [];
  const loadError = isError ? 'Executive dashboard metrics could not be updated.' : '';

  const maxRevenue = Math.max(1, ...data.trend.map((t) => t.revenue));
  const maxEncounters = Math.max(1, ...data.trend.map((t) => t.encounters));

  const totalBilled = data.financialSummary?.totalBilledAmount;
  const totalCollected = data.financialSummary?.collectedFunds;
  const pendingBalance = data.financialSummary?.pendingOutstanding;
  const collectionRate = totalBilled && totalBilled > 0 ? Math.min(100, Math.round(((totalCollected ?? 0) / totalBilled) * 100)) : 0;

  return (
    <div className="dashboard-grid">
      <div className="appointment-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="appointment-page-title">
          <h2>Hospital Executive Overview</h2>
          <p>Welcome back, {firstName}. Live enterprise health, encounters, and financial performance.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {accessibleBranches.length > 1 ? (
            <select
              className="doc-form-select"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', borderColor: '#cbd5e1' }}
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranchId(e.target.value || undefined)}
            >
              <option value="">All Accessible Branches ({accessibleBranches.length})</option>
              {accessibleBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : null}
          <button className="secondary-action" disabled={loading || isFetching} onClick={() => refresh()} type="button">
            <i className={`ph ph-arrow-clockwise${isFetching ? ' ph-spin' : ''}`} aria-hidden="true" />
            {isFetching ? 'Refreshing...' : 'Refresh Live Data'}
          </button>
        </div>
      </div>

      {loadError ? <div className="um-state-cell" role="alert" style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '6px' }}>{loadError}</div> : null}

      <div className="stat-cards-container stat-cards-container--five" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <StatCard icon="ph-users" label="Registered Patients" note="Active patient directory" tone="blue" value={loading || !data ? '...' : (data.kpis?.registeredPatients ?? 0)} />
        <StatCard icon="ph-stethoscope" label="Active Doctors" note="On-duty clinical staff" tone="green" value={loading || !data ? '...' : (data.kpis?.activeDoctors ?? 0)} />
        <StatCard icon="ph-calendar-check" label="Today's Appointments" note="Bookings for today" tone="orange" value={loading || !data ? '...' : (data.kpis?.todayAppointments ?? 0)} />
        <StatCard icon="ph-first-aid" label="OPD Visits Today" note="Checked-in patient visits" tone="purple" value={loading || !data ? '...' : (data.kpis?.todayOpdVisits ?? 0)} />
        <StatCard icon="ph-receipt" label="Today's Billed Revenue" note="Live billing summary" tone="green" value={loading || !data ? '...' : (data.kpis?.todayBilledRevenue === null || data.kpis?.todayBilledRevenue === undefined ? 'Restricted' : formatMoney(data.kpis.todayBilledRevenue))} />
      </div>

      {/* Operational Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="ph ph-hourglass" style={{ fontSize: '1.4rem', color: '#ea580c' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Patients Waiting</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.patientsWaiting}</div>
          </div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="ph ph-user-focus" style={{ fontSize: '1.4rem', color: '#2563eb' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>In Consultation</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.patientsInConsultation}</div>
          </div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="ph ph-check-circle" style={{ fontSize: '1.4rem', color: '#16a34a' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Completed Today</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : data.operationalMetrics.completedConsultationsToday}</div>
          </div>
        </div>
      </div>

      <div className="doc-grid dashboard-main executive-dashboard-main" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        {/* 7-Day Trend Chart */}
        <article className="doc-card">
          <div className="doc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>7-Day Revenue &amp; Encounter Flow</h3>
              <p>Combined outpatient volume &amp; financial collections trend</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#2563eb', borderRadius: '50%', display: 'inline-block' }} />
                Revenue (KES)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#9333ea' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#9333ea', borderRadius: '2px', display: 'inline-block' }} />
                Encounters
              </span>
            </div>
          </div>
          <div className="doc-chart" style={{ padding: '1rem 0.5rem 0.5rem' }}>
            {loading ? (
              <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Loading 7-day trend analysis...
              </div>
            ) : (
              <>
                <svg className="doc-line-chart" viewBox="0 0 700 210" role="img" aria-label="Revenue and visit trend" style={{ width: '100%', height: 'auto' }}>
                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="40" x2="660" y1={20 + line * 38} y2={20 + line * 38} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                  ))}
                  {/* Encounters Bars */}
                  {data.trend.map((pt, idx) => {
                    const x = 55 + idx * 96;
                    const barHeight = Math.max(4, (pt.encounters / maxEncounters) * 110);
                    const y = 172 - barHeight;
                    return (
                      <g key={`bar-${pt.date}`}>
                        <rect x={x - 12} y={y} width="24" height={barHeight} fill="#e9d5ff" rx="3" />
                        <text x={x} y={y - 5} textAnchor="middle" fill="#7e22ce" fontSize="10" fontWeight="600">
                          {pt.encounters > 0 ? pt.encounters : ''}
                        </text>
                      </g>
                    );
                  })}

                  {/* Revenue Line */}
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={data.trend.map((pt, idx) => `${55 + idx * 96},${172 - (pt.revenue / maxRevenue) * 130}`).join(' ')}
                  />
                  {data.trend.map((pt, idx) => {
                    const cx = 55 + idx * 96;
                    const cy = 172 - (pt.revenue / maxRevenue) * 130;
                    return (
                      <g key={`pt-${pt.date}`}>
                        <circle cx={cx} cy={cy} fill="#2563eb" stroke="#ffffff" strokeWidth="2" r="5" />
                      </g>
                    );
                  })}
                </svg>
                <div className="doc-chart-axis" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.5rem 0 0.5rem' }}>
                  {data.trend.map((pt) => (
                    <div key={pt.date} style={{ textAlign: 'center', width: '90px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{pt.day}</div>
                      <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 500 }}>{formatMoney(pt.revenue)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>

        {/* Financial Settlement Summary */}
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Financial Settlement Summary</h3>
              <p>Real-time collections vs outstanding</p>
            </div>
          </div>
          {data.financialSummary === null ? (
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              <i className="ph ph-lock-key" style={{ fontSize: '1.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }} />
              Financial metrics are restricted for your assigned user role.
            </div>
          ) : (
            <div className="opd-summary-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Billed Amount</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{formatMoney(totalBilled ?? 0)}</strong>
              </div>
              <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Collected Funds</span>
                <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{formatMoney(totalCollected ?? 0)}</strong>
              </div>
              <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Pending Outstanding</span>
                <strong style={{ color: '#ea580c', fontSize: '0.95rem' }}>{formatMoney(pendingBalance ?? 0)}</strong>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
                  <span>Collection Settlement Rate</span>
                  <strong>{collectionRate}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${collectionRate}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '4px', transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          )}
        </article>
      </div>

      {/* Live OPD Patient Encounters Table */}
      <div className="card appointments-card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Live OPD Patient Encounters</h3>
            <p>Real-time check-ins and clinical status tracking</p>
          </div>
        </div>
        {loading ? (
          <div className="um-state-cell">Loading live encounter stream...</div>
        ) : data.recentVisits.length === 0 ? (
          <div className="patient-empty-inline" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
            No OPD visits recorded today for the selected branch.
          </div>
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
  { key: 'doctors', label: 'Doctors', icon: 'ph-stethoscope', content: withSuspense('Doctors', <DoctorDashboardPage />) },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) },
  { key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) },
  { key: 'billing', label: 'Billing', icon: 'ph-receipt', content: withSuspense('Billing', <BillingDashboardPage />) },
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
    tabs.push({ key: 'pharmacy', label: 'Pharmacy Queue', icon: 'ph-pill', content: withSuspense('Pharmacy Queue', <PrescriptionQueuePage />) });
  }
  if (canView(user, 'Pharmacy', 'Medicine Inventory')) {
    tabs.push({ key: 'pharmacy-inventory', label: 'Pharmacy Inventory', icon: 'ph-package', content: withSuspense('Pharmacy Inventory', <PharmacyMedicineInventoryPage />) });
  }
  if (canView(user, 'Laboratory', 'Orders')) {
    tabs.push({ key: 'laboratory', label: 'Laboratory', icon: 'ph-flask', content: withSuspense('Laboratory', <LaboratoryQueuePage />) });
  }
  if (canView(user, 'Imaging', 'Orders')) {
    tabs.push({ key: 'imaging', label: 'Imaging', icon: 'ph-image-square', content: withSuspense('Imaging', <ImagingQueuePage />) });
  }
  if (canView(user, 'Billing', 'Invoices')) {
    tabs.push({ key: 'billing', label: 'Billing', icon: 'ph-receipt', content: withSuspense('Billing', <BillingDashboardPage />) });
  }
  if (canView(user, 'Appointments', 'Appointment Records')) {
    tabs.push({ key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank', content: withSuspense('Appointments', <AppointmentDashboardPage />) });
  }
  if (canView(user, 'OPD', 'OPD Visits')) {
    tabs.push({ key: 'opd', label: 'OPD', icon: 'ph-first-aid', content: withSuspense('OPD', <OpdDashboardPage />) });
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
    tabs.push({ key: 'reports', label: 'Reports', icon: 'ph-chart-bar', content: withSuspense('Reports', <PhaseTwoReportsPage />) });
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





