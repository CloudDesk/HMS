import { useCallback, useEffect, useState } from 'react';
import { appointmentsApi } from '../api/appointments';
import { doctorsApi } from '../api/doctors';
import { opdApi, type OpdVisitResponse } from '../api/opd';
import { patientsApi } from '../api/patients';
import { useAuth } from '../auth/useAuth';
import { navigate } from '../routing/navigation';
import { formatDateTime } from './patient-utils';
import { DoctorDashboardPage } from './DoctorDashboardPage';
import { AppointmentDashboardPage } from './AppointmentDashboardPage';
import { OpdDashboardPage } from './OpdDashboardPage';
import { BillingDashboardPage } from './BillingDashboardPage';
import { AdministrationDashboardPage } from './AdministrationDashboardPage';

type DashboardData = {
  activeDoctors: number;
  appointmentsToday: number;
  completedVisits: number;
  opdVisitsToday: number;
  registeredPatients: number;
  recentVisits: OpdVisitResponse[];
};

const emptyDashboard: DashboardData = {
  activeDoctors: 0,
  appointmentsToday: 0,
  completedVisits: 0,
  opdVisitsToday: 0,
  registeredPatients: 0,
  recentVisits: [],
};

type StatCardProps = {
  icon: string;
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  value: number;
};

function StatCard({ icon, label, note, tone, value }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <i className={`ph-fill ${icon}`} aria-hidden="true" />
      </div>
      <div className="stat-info">
        <p>{label}</p>
        <h3>{value.toLocaleString()}</h3>
        <span>{note}</span>
      </div>
    </div>
  );
}

function ExecutiveOverviewTab() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'User';

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [patients, doctors, appointments, visits] = await Promise.all([
        patientsApi.list({ limit: 1 }),
        doctorsApi.list({ limit: 1, status: 'ACTIVE' }),
        appointmentsApi.list({ date_from: today, date_to: today, limit: 100 }),
        opdApi.listVisits({ date_from: today, date_to: today, limit: 100, sortBy: 'created_at', sortOrder: 'desc' }),
      ]);

      setData({
        activeDoctors: doctors.meta.total,
        appointmentsToday: appointments.meta.total,
        completedVisits: visits.data.filter((visit) => visit.status === 'COMPLETED').length,
        opdVisitsToday: visits.meta.total,
        registeredPatients: patients.meta.total,
        recentVisits: visits.data.slice(0, 6),
      });
    } catch {
      setData(emptyDashboard);
      setLoadError('Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="dashboard-grid">
      <div className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>Hospital Dashboard</h2>
          <p>Welcome back, {firstName}. Here is today&apos;s live operational summary.</p>
        </div>
        <button className="secondary-action" disabled={loading} onClick={() => void loadDashboard()} type="button">
          <i className="ph ph-arrow-clockwise" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loadError ? <div className="um-state-cell" role="alert">{loadError}</div> : null}

      <div className="stat-cards-container" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <StatCard icon="ph-users" label="Registered Patients" note="Persisted patient records" tone="blue" value={data.registeredPatients} />
        <StatCard icon="ph-stethoscope" label="Active Doctors" note="Available active records" tone="green" value={data.activeDoctors} />
        <StatCard icon="ph-calendar-check" label="Today's Appointments" note="All appointment statuses" tone="orange" value={data.appointmentsToday} />
        <StatCard icon="ph-first-aid" label="OPD Visits Today" note="Checked-in patient visits" tone="purple" value={data.opdVisitsToday} />
        <StatCard icon="ph-check-circle" label="Completed Visits" note="Completed today" tone="green" value={data.completedVisits} />
      </div>

      <div className="card appointments-card">
        <div className="card-header">
          <div>
            <h3>Recent OPD Activity</h3>
            <p>Latest persisted visits for today</p>
          </div>
          <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">Open OPD Queue</button>
        </div>
        {loading ? (
          <div className="um-state-cell">Loading dashboard data...</div>
        ) : data.recentVisits.length === 0 ? (
          <div className="patient-empty-inline">No OPD visits have been recorded today.</div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th>Visit</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Check-in</th>
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

export function DashboardShell() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const isDoctor = user?.roles.some(
    (r) => r.code === 'DOCTOR' || r.name.toLowerCase() === 'doctor',
  ) ?? false;

  const isReceptionist = user?.roles.some(
    (r) =>
      ['RECEPTIONIST', 'APPOINTMENT_STAFF', 'FRONT_DESK'].includes(r.code) ||
      r.name.toLowerCase().includes('reception') ||
      r.name.toLowerCase().includes('appointment'),
  ) ?? false;

  // Single-role users automatically land on their respective specialized dashboard
  if (isDoctor) {
    return <DoctorDashboardPage />;
  }

  if (isReceptionist) {
    return <AppointmentDashboardPage />;
  }

  // Admin / Executive Multi-Tab Centralized Master Dashboard
  return (
    <div className="dashboard-master-wrapper">
      <div className="dashboard-tab-bar">
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
