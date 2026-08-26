import { useState, useEffect } from 'react';
import { useDashboardOverviewFeature } from '../hooks/dashboard/useDashboardOverviewFeature';
import { useAuth } from '../auth/useAuth';
import { useAppLocation } from '../routing/navigation';
import { formatDateTime } from './patient-utils';
import { DoctorDashboardPage } from './DoctorDashboardPage';
import { AppointmentDashboardPage } from './AppointmentDashboardPage';
import { OpdDashboardPage } from './OpdDashboardPage';
import { BillingDashboardPage } from './BillingDashboardPage';
import { AdministrationDashboardPage } from './AdministrationDashboardPage';
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

  const loadError = isError ? 'Executive dashboard metrics could not be updated.' : '';
  const maxRevenue = Math.max(1, ...data.trend.map((t) => t.revenue));
  const formatCurrency = useCurrencyFormatter();

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

      <div className="stat-cards-container" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <StatCard icon="ph-users" label="Registered Patients" note="Active patient directory" tone="blue" value={data.registeredPatients} />
        <StatCard icon="ph-stethoscope" label="Active Doctors" note="On-duty clinical staff" tone="green" value={data.activeDoctors} />
        <StatCard icon="ph-calendar-check" label="Today's Appointments" note="Bookings & encounters" tone="orange" value={data.appointmentsToday} />
        <StatCard icon="ph-first-aid" label="OPD Visits Today" note="Checked-in patient visits" tone="purple" value={data.opdVisitsToday} />
        <StatCard icon="ph-receipt" label="Today Billed Revenue" note="Live billing summary" tone="green" value={data.billedTotal === null ? '...' : formatCurrency(data.billedTotal)} />
      </div>

      <div className="doc-grid dashboard-main" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>7-Day Revenue &amp; Encounter Flow</h3>
              <p>Combined outpatient volume &amp; financial collections trend</p>
            </div>
          </div>
          <div className="doc-chart">
            {data.trend.length === 0 ? (
              <div className="um-state-cell" style={{ height: '200px' }}>Trend data is currently unavailable.</div>
            ) : (
              <>
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
                    <span key={pt.day} style={{ fontSize: '0.8rem', color: '#64748b' }}>{pt.day} ({formatCurrency(pt.revenue)})</span>
                  ))}
                </div>
              </>
            )}
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
              <strong style={{ color: '#0f172a' }}>{data.billedTotal === null ? '...' : formatCurrency(data.billedTotal)}</strong>
            </div>
            <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <span>Collected Funds</span>
              <strong style={{ color: '#16a34a' }}>{data.collectedTotal === null ? '...' : formatCurrency(data.collectedTotal)}</strong>
            </div>
            <div className="opd-summary-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pending Outstanding</span>
              <strong style={{ color: '#ea580c' }}>{data.billedTotal === null || data.collectedTotal === null ? '...' : formatCurrency(Math.max(0, data.billedTotal - data.collectedTotal))}</strong>
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

type DashboardTab = 'overview' | 'doctors' | 'appointments' | 'opd' | 'billing' | 'admin';

const isDashboardTab = (val: string | null): val is DashboardTab => {
  return val !== null && ['overview', 'doctors', 'appointments', 'opd', 'billing', 'admin'].includes(val);
};

export function DashboardShell() {
  const location = useAppLocation();
  const searchParams = new URLSearchParams(location.search);
  const rawTab = searchParams.get('tab');
  const requestedTab = isDashboardTab(rawTab) ? rawTab : 'overview';
  const [activeTab, setActiveTab] = useState<DashboardTab>(requestedTab);

  useEffect(() => {
    if (requestedTab && ['overview', 'doctors', 'appointments', 'opd', 'billing', 'admin'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  return (
    <div className="dashboard-master-wrapper">
      <div className="dashboard-tab-bar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.25rem' }}>
        <button
          className={`dashboard-tab-btn${activeTab === 'overview' ? ' active' : ''}`}
          onClick={() => setActiveTab('overview')}
          type="button"
        >
          <i className="ph ph-squares-four" aria-hidden="true" />
          Overview
        </button>
        <button
          className={`dashboard-tab-btn${activeTab === 'doctors' ? ' active' : ''}`}
          onClick={() => setActiveTab('doctors')}
          type="button"
        >
          <i className="ph ph-stethoscope" aria-hidden="true" />
          Doctors
        </button>
        <button
          className={`dashboard-tab-btn${activeTab === 'appointments' ? ' active' : ''}`}
          onClick={() => setActiveTab('appointments')}
          type="button"
        >
          <i className="ph ph-calendar-blank" aria-hidden="true" />
          Appointments
        </button>
        <button
          className={`dashboard-tab-btn${activeTab === 'opd' ? ' active' : ''}`}
          onClick={() => setActiveTab('opd')}
          type="button"
        >
          <i className="ph ph-first-aid" aria-hidden="true" />
          OPD
        </button>
        <button
          className={`dashboard-tab-btn${activeTab === 'billing' ? ' active' : ''}`}
          onClick={() => setActiveTab('billing')}
          type="button"
        >
          <i className="ph ph-receipt" aria-hidden="true" />
          Billing
        </button>
        <button
          className={`dashboard-tab-btn${activeTab === 'admin' ? ' active' : ''}`}
          onClick={() => setActiveTab('admin')}
          type="button"
        >
          <i className="ph ph-gear" aria-hidden="true" />
          Administration
        </button>
      </div>

      <div className="dashboard-tab-content">
        {activeTab === 'overview' ? <ExecutiveOverviewTab /> : null}
        {activeTab === 'doctors' ? <DoctorDashboardPage /> : null}
        {activeTab === 'appointments' ? <AppointmentDashboardPage /> : null}
        {activeTab === 'opd' ? <OpdDashboardPage /> : null}
        {activeTab === 'billing' ? <BillingDashboardPage /> : null}
        {activeTab === 'admin' ? <AdministrationDashboardPage /> : null}
      </div>
    </div>
  );
}





