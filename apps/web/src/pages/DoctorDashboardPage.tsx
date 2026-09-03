import { useMemo } from 'react';
import type { AppointmentDashboardSummary } from '../api/appointments';
import {
  type DoctorDashboardAppointment as AppointmentResponse,
  useDoctorDashboard,
} from '../hooks/doctors/useDoctorDashboard';
import { navigate } from '../routing/navigation';
import { todayInputValue } from './appointment-utils';
import {
  appointmentStatusText,
  patientInitialsFromName,
  statusTone,
  visitTypeText,
} from './doctor-workflow-utils';

type ChartPoint = {
  label: string;
  value: number;
};

const buildTrend = (appointments: AppointmentResponse[]): ChartPoint[] => {
  const today = new Date(`${todayInputValue()}T00:00:00`);
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      label: new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(date),
      value: appointments.filter((appointment) => appointment.appointment_date.slice(0, 10) === key).length,
    };
  });
};

function LineChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 100 - (point.value / max) * 84 - 8;
    return `${x},${y}`;
  });

  return (
    <div className="doc-chart doc-line-chart">
      <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline className="doc-line-fill" points={`0,100 ${coordinates.join(' ')} 100,100`} />
        <polyline className="doc-line-stroke" points={coordinates.join(' ')} />
        {points.map((point, index) => {
          const [x = '0', y = '0'] = coordinates[index]?.split(',') ?? [];
          return <circle cx={x} cy={y} key={point.label} r="1.4" />;
        })}
      </svg>
      <div className="doc-chart-axis">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ summary }: { summary: AppointmentDashboardSummary }) {
  const counts = [
    summary.by_status.CHECKED_IN,
    summary.by_status.CONFIRMED,
    summary.by_status.SCHEDULED,
    summary.by_status.CANCELLED,
  ];
  const totalCount = counts.reduce((sum, count) => sum + count, 0);
  const total = Math.max(totalCount, 1);
  const colors = ['#16a34a', '#2563eb', '#f59e0b', '#8b5cf6'];
  let start = 0;
  const gradient = counts
    .map((count, index) => {
      const end = start + (count / total) * 100;
      const segment = `${colors[index]} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(', ');

  return (
    <div className="doc-donut-wrap">
      <div
        className="doc-donut"
        style={{ background: totalCount === 0 ? '#e2e8f0' : `conic-gradient(${gradient})` }}
      />
      <div className="doc-legend">
        {['Checked in', 'Confirmed', 'Waiting', 'Cancelled'].map((label, index) => (
          <span key={label}>
            <i style={{ background: colors[index] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DoctorDashboardPage() {
  const dashboard = useDoctorDashboard();
  const trend = useMemo(
    () => buildTrend(dashboard.weekAppointments),
    [dashboard.weekAppointments],
  );

  const metricsAvailable = Boolean(dashboard.appointmentSummary) && !dashboard.errorMessage;
  const kpis = [
    ['ph-calendar-check', 'blue', "Today's Appointments", dashboard.appointmentSummary?.total ?? '—', metricsAvailable ? 'Scheduled today' : 'Summary unavailable'],
    [
      'ph-hourglass-medium',
      'orange',
      'Waiting Patients',
      dashboard.opdSummary ? dashboard.opdSummary.by_status.READY_FOR_CONSULTATION : '—',
      dashboard.opdSummary ? 'Ready for consultation' : 'Summary unavailable',
    ],
    [
      'ph-arrow-counter-clockwise',
      'purple',
      'Follow-up Patients',
      dashboard.appointmentSummary?.follow_ups ?? '—',
      metricsAvailable ? 'Scheduled today' : 'Summary unavailable',
    ],
    ['ph-warning-circle', 'red', 'Urgent Cases', dashboard.opdSummary?.urgent ?? '—', dashboard.opdSummary ? 'Active priority visits' : 'Summary unavailable'],
    ['ph-list-checks', 'cyan', 'Pending Clinical Work', dashboard.opdSummary ? dashboard.opdSummary.by_status.READY_FOR_CONSULTATION + dashboard.opdSummary.by_status.IN_CONSULTATION : '—', dashboard.opdSummary ? 'Ready or in consultation' : 'Summary unavailable'],
  ] as const;

  return (
    <>
      <div className="doctor-page">
        <section className="doctor-page-header">
          <div className="doctor-page-title">
            <h2>Doctor Dashboard</h2>
            <p>Your clinical workspace for today</p>
          </div>
          <div className="doctor-page-actions">
            <button className="doc-btn" style={{ cursor: 'default' }} type="button">
              <i className="ph ph-calendar-check" aria-hidden="true" />
              Today's Appointments
            </button>
            {dashboard.canViewOpdQueue ? <button
              className="doc-btn primary"
              onClick={() => navigate('/opd/queue')}
              type="button"
            >
              <i className="ph ph-stethoscope" aria-hidden="true" />
              Open Clinical Queue
            </button> : null}
          </div>
        </section>

        {dashboard.errorMessage ? (
          <div className="form-error-banner" role="alert">
            <i className="ph ph-warning-circle" aria-hidden="true" />
            <span>{dashboard.errorMessage}</span>
          </div>
        ) : null}
        {dashboard.isLoading ? <div className="doc-muted-note">Loading live doctor metrics...</div> : null}

            <section className="doc-kpi-grid">
              {kpis.map(([icon, tone, label, value, copy]) => (
                <article className="doc-kpi" key={label}>
                  <span className={`doc-kpi-icon ${tone}`}>
                    <i className={`ph ${icon}`} aria-hidden="true" />
                  </span>
                  <div className="doc-kpi-copy">
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{copy}</small>
                  </div>
                </article>
              ))}
            </section>

            <section className="doc-grid dashboard-main">
              <article className="doc-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Weekly Consultation Trend</h3>
                    <p>Appointment volume over the last seven days</p>
                  </div>
                </div>
                {dashboard.hasCompleteAppointmentDataset && !dashboard.errorMessage ? <LineChart points={trend} /> : <div className="um-state-cell">Complete trend data is unavailable for this dashboard scope.</div>}
              </article>
              <article className="doc-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Appointment Status</h3>
                    <p>Today's active appointment mix</p>
                  </div>
                </div>
                {dashboard.appointmentSummary ? <DonutChart summary={dashboard.appointmentSummary} /> : <div className="um-state-cell">Complete status totals are unavailable for this dashboard scope.</div>}
              </article>
            </section>

            <section className="doc-grid dashboard-bottom">
              <article className="doc-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Upcoming Appointments</h3>
                    <p>Next patients in your clinical queue</p>
                  </div>
                  <button className="doc-btn" onClick={() => navigate('/doctors/schedule')} type="button">
                    View Schedule
                  </button>
                </div>
                <div className="doc-appointment-list">
                  {dashboard.todayAppointments.length === 0 ? (
                    <div className="um-state-cell">
                      No appointments scheduled{dashboard.selectedDoctor ? ` for ${dashboard.selectedDoctor.display_name}` : ''} today.
                    </div>
                  ) : (
                    dashboard.todayAppointments.slice(0, 6).map((appointment) => (
                      <div className="doc-appointment-item" key={appointment.id}>
                        <span className="doc-time">{appointment.start_time}</span>
                        <span className="doc-avatar">{patientInitialsFromName(appointment.patient_name)}</span>
                        <div className="doc-appointment-copy">
                          <strong>{appointment.patient_name}</strong>
                          <span>
                            {visitTypeText(appointment.visit_type)} · {appointment.doctor_specialization}
                          </span>
                        </div>
                        <span className={`doc-status ${statusTone(appointment.status)}`}>
                          {appointmentStatusText(appointment)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </article>
              <article className="doc-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Frequent clinical workflows</p>
                  </div>
                </div>
                <div className="doc-quick-actions">
                  {dashboard.canViewOpdQueue ? <button
                    className="doc-quick-action"
                    onClick={() => navigate('/opd/queue')}
                    type="button"
                  >
                    <i className="ph ph-stethoscope" aria-hidden="true" />
                    <span>
                      <strong>Open Clinical Queue</strong>
                      <span>Start the correct persisted OPD encounter</span>
                    </span>
                  </button> : null}
                  <button className="doc-quick-action" onClick={() => navigate('/doctors/schedule')} type="button">
                    <i className="ph ph-calendar-check" aria-hidden="true" />
                    <span>
                      <strong>View Today's Schedule</strong>
                      <span>Review appointments and time slots</span>
                    </span>
                  </button>
                  {dashboard.canSearchPatients ? <button className="doc-quick-action" onClick={() => navigate('/patients/search')} type="button">
                    <i className="ph ph-magnifying-glass" aria-hidden="true" />
                    <span>
                      <strong>Patient Search</strong>
                      <span>Find and open a patient record</span>
                    </span>
                  </button> : null}
                </div>
              </article>
            </section>
      </div>

    </>
  );
}
