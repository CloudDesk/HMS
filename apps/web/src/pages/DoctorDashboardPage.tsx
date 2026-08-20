import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Modal } from '../components/ui/Modal';
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

const consultationSchema = z.object({
  appointmentId: z.string().min(1, 'Select an appointment.'),
  clinicalNotes: z.string(),
});

type ConsultationFormValues = z.infer<typeof consultationSchema>;

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

function DonutChart({ appointments }: { appointments: AppointmentResponse[] }) {
  const counts = [
    appointments.filter((appointment) => appointment.status === 'CHECKED_IN').length,
    appointments.filter((appointment) => appointment.status === 'CONFIRMED').length,
    appointments.filter((appointment) => appointment.status === 'SCHEDULED').length,
    appointments.filter((appointment) => appointment.status === 'CANCELLED').length,
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
  const [modalOpen, setModalOpen] = useState(false);
  const consultationForm = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationSchema),
    defaultValues: { appointmentId: '', clinicalNotes: '' },
  });
  const consultationAppointmentId = consultationForm.watch('appointmentId');
  const startableAppointments = dashboard.todayAppointments.filter((appointment) =>
    ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'].includes(appointment.status),
  );
  const selectedAppointment =
    dashboard.todayAppointments.find(
      (appointment) => appointment.id === consultationAppointmentId,
    ) ?? null;
  const trend = useMemo(
    () => buildTrend(dashboard.weekAppointments),
    [dashboard.weekAppointments],
  );

  const openStartConsultation = () => {
    if (!dashboard.canEditAppointments || startableAppointments.length === 0) {
      return;
    }
    consultationForm.reset({
      appointmentId: startableAppointments[0]?.id ?? '',
      clinicalNotes: '',
    });
    setModalOpen(true);
  };

  const startConsultation = async (values: ConsultationFormValues) => {
    const appointment = startableAppointments.find(
      (candidate) => candidate.id === values.appointmentId,
    );
    if (!appointment) return;

    const succeeded = await dashboard.startConsultation(
      appointment,
      values.clinicalNotes,
    );
    if (succeeded) {
      setModalOpen(false);
      consultationForm.reset();
    }
  };

  const kpis = [
    ['ph-calendar-check', 'blue', "Today's Appointments", dashboard.todayAppointments.length, `${startableAppointments.length} active`],
    [
      'ph-check-circle',
      'green',
      'Completed Consultations',
      0,
      'Pending OPD integration',
    ],
    [
      'ph-hourglass-medium',
      'orange',
      'Waiting Patients',
      dashboard.todayAppointments.filter((appointment) => ['SCHEDULED', 'CONFIRMED'].includes(appointment.status)).length,
      'Requires attention',
    ],
    [
      'ph-arrow-counter-clockwise',
      'purple',
      'Follow-up Patients',
      dashboard.todayAppointments.filter((appointment) => appointment.visit_type === 'FOLLOW_UP').length,
      'Scheduled today',
    ],
    ['ph-file-text', 'red', 'Pending Reports', 0, 'Pending OPD integration'],
    ['ph-timer', 'cyan', 'Average Consultation Time', '0 min', 'Target: 30 min'],
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
            <button
              className="doc-btn primary"
              disabled={!dashboard.canEditAppointments || startableAppointments.length === 0}
              onClick={openStartConsultation}
              type="button"
            >
              <i className="ph ph-stethoscope" aria-hidden="true" />
              Start Consultation
            </button>
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
                <LineChart points={trend} />
              </article>
              <article className="doc-card">
                <div className="doc-card-header">
                  <div>
                    <h3>Appointment Status</h3>
                    <p>Today's active appointment mix</p>
                  </div>
                </div>
                <DonutChart appointments={dashboard.todayAppointments} />
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
                  <button
                    className="doc-quick-action"
                    disabled={!dashboard.canEditAppointments || startableAppointments.length === 0}
                    onClick={openStartConsultation}
                    type="button"
                  >
                    <i className="ph ph-stethoscope" aria-hidden="true" />
                    <span>
                      <strong>Start Consultation</strong>
                      <span>Begin the next patient encounter</span>
                    </span>
                  </button>
                  <button className="doc-quick-action" onClick={() => navigate('/doctors/schedule')} type="button">
                    <i className="ph ph-calendar-check" aria-hidden="true" />
                    <span>
                      <strong>View Today's Schedule</strong>
                      <span>Review appointments and time slots</span>
                    </span>
                  </button>
                  <button className="doc-quick-action" style={{ cursor: 'default' }} type="button">
                    <i className="ph ph-magnifying-glass" aria-hidden="true" />
                    <span>
                      <strong>Patient Search</strong>
                      <span>Find and open a patient record</span>
                    </span>
                  </button>
                </div>
              </article>
            </section>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Start Consultation">
        <form className="modal-form patient-form" onSubmit={consultationForm.handleSubmit(startConsultation)}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="consultation-appointment">Patient Appointment</label>
              <select
                id="consultation-appointment"
                {...consultationForm.register('appointmentId')}
              >
                {startableAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.start_time} · {appointment.patient_name} · {visitTypeText(appointment.visit_type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="consultation-room">Consultation Room</label>
              <input id="consultation-room" readOnly value={dashboard.selectedDoctor?.consultation_room ?? 'Not assigned'} />
            </div>
            <div className="form-group">
              <label htmlFor="consultation-visit">Visit Type</label>
              <input id="consultation-visit" readOnly value={selectedAppointment ? visitTypeText(selectedAppointment.visit_type) : '-'} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="consultation-notes">Initial Clinical Notes</label>
              <textarea
                id="consultation-notes"
                {...consultationForm.register('clinicalNotes')}
                placeholder="Document presenting complaint and initial observations..."
                rows={4}
              />
            </div>
          </div>
          <p className="doc-muted-note">OPD consultation workspace integration will be handled in the OPD phase.</p>
          <div className="modal-actions">
            <button className="secondary-action" disabled={dashboard.isUpdatingStatus} onClick={() => setModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={dashboard.isUpdatingStatus || !selectedAppointment} type="submit">
              {dashboard.isUpdatingStatus ? 'Starting...' : 'Start Consultation'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
