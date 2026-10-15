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
      <div className="hms-dash-wrapper">
        <div className="hms-dash-header">
          <div className="hms-dash-title">
            <h2>Doctor Dashboard</h2>
            <p>Clinical schedule and consultations for today</p>
          </div>
          <div className="hms-dash-actions">
            <button className="hms-dash-btn secondary" onClick={() => navigate('/doctors/schedule')} type="button">
              <i className="ph ph-calendar-check" aria-hidden="true" />
              Today's Schedule
            </button>
            {dashboard.canViewOpdQueue ? (
              <button
                className="hms-dash-btn primary"
                onClick={() => navigate('/opd/queue')}
                type="button"
              >
                <i className="ph ph-stethoscope" aria-hidden="true" />
                Open Clinical Queue
              </button>
            ) : null}
          </div>
        </div>

        {dashboard.errorMessage ? (
          <div className="form-error-banner" role="alert" style={{ borderRadius: '8px' }}>
            <i className="ph ph-warning-circle" aria-hidden="true" />
            <span>{dashboard.errorMessage}</span>
          </div>
        ) : null}
        {dashboard.isLoading ? <div className="doc-muted-note">Loading live doctor metrics...</div> : null}

        {/* 5 Clinical KPIs */}
        <div className="hms-dash-kpi-grid">
          {kpis.map(([icon, tone, label, value, copy]) => (
            <div className="hms-dash-kpi-card" key={label}>
              <div className="hms-kpi-top">
                <span className={`hms-kpi-icon ${tone}`}>
                  <i className={`ph ${icon}`} aria-hidden="true" />
                </span>
                {tone === 'red' && typeof value === 'number' && value > 0 ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>Attention</span>
                ) : null}
              </div>
              <div>
                <div className="hms-kpi-label">{label}</div>
                <div className="hms-kpi-value">{value}</div>
                <div className="hms-kpi-sub">{copy}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Row: Trend & Donut */}
        <div className="hms-dash-grid two-col-7-5">
          <div className="hms-dash-card">
            <div className="hms-card-header">
              <div className="hms-card-header-left">
                <h3 className="hms-card-title">Weekly Consultation Trend</h3>
                <p className="hms-card-desc">Consultation volume over the last seven days</p>
              </div>
            </div>
            <div className="hms-card-body">
              {dashboard.hasCompleteAppointmentDataset && !dashboard.errorMessage ? (
                <LineChart points={trend} />
              ) : (
                <div className="hms-dash-empty">
                  <i className="ph ph-chart-line" />
                  <div className="hms-dash-empty-title">Trend data unavailable</div>
                  <div className="hms-dash-empty-desc">Complete consultation history is not available for this scope.</div>
                </div>
              )}
            </div>
          </div>

          <div className="hms-dash-card">
            <div className="hms-card-header">
              <div className="hms-card-header-left">
                <h3 className="hms-card-title">Appointment Status</h3>
                <p className="hms-card-desc">Today's appointment distribution by status</p>
              </div>
            </div>
            <div className="hms-card-body">
              {dashboard.appointmentSummary ? (
                <DonutChart summary={dashboard.appointmentSummary} />
              ) : (
                <div className="hms-dash-empty">
                  <i className="ph ph-chart-donut" />
                  <div className="hms-dash-empty-title">Status distribution unavailable</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lower Row: Upcoming Appointments & Quick Actions */}
        <div className="hms-dash-grid two-col-7-5">
          <div className="hms-dash-card">
            <div className="hms-card-header">
              <div className="hms-card-header-left">
                <h3 className="hms-card-title">Upcoming Consultations</h3>
                <p className="hms-card-desc">Next scheduled consultations in clinical queue</p>
              </div>
              <button className="hms-dash-btn secondary" onClick={() => navigate('/doctors/schedule')} style={{ height: '32px', fontSize: '12px' }} type="button">
                View Schedule
              </button>
            </div>
            <div className="hms-card-body" style={{ padding: '0.75rem 1rem' }}>
              <div className="doc-appointment-list">
                {dashboard.todayAppointments.length === 0 ? (
                  <div className="hms-dash-empty" style={{ padding: '1.5rem 1rem' }}>
                    <i className="ph ph-calendar-blank" style={{ fontSize: '1.75rem' }} />
                    <div className="hms-dash-empty-title">No appointments today</div>
                    <div className="hms-dash-empty-desc">No patients are currently queued for consultation.</div>
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
            </div>
          </div>

          <div className="hms-dash-card">
            <div className="hms-card-header">
              <div className="hms-card-header-left">
                <h3 className="hms-card-title">Quick Actions</h3>
                <p className="hms-card-desc">Common clinician workflows and navigation</p>
              </div>
            </div>
            <div className="hms-card-body">
              <div className="doc-quick-actions">
                {dashboard.canViewOpdQueue ? (
                  <button
                    className="doc-quick-action"
                    onClick={() => navigate('/opd/queue')}
                    type="button"
                  >
                    <i className="ph ph-stethoscope" aria-hidden="true" />
                    <span>
                      <strong>Open Clinical Queue</strong>
                      <span>Open active queue and start consultations</span>
                    </span>
                  </button>
                ) : null}
                <button className="doc-quick-action" onClick={() => navigate('/doctors/schedule')} type="button">
                  <i className="ph ph-calendar-check" aria-hidden="true" />
                  <span>
                    <strong>View Today's Schedule</strong>
                    <span>Review booked time slots and day view</span>
                  </span>
                </button>
                {dashboard.canSearchPatients ? (
                  <button className="doc-quick-action" onClick={() => navigate('/patients/search')} type="button">
                    <i className="ph ph-magnifying-glass" aria-hidden="true" />
                    <span>
                      <strong>Patient Search</strong>
                      <span>Search master patient index and history</span>
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
