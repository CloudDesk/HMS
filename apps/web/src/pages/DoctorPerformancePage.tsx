import { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentsApi, type AppointmentResponse } from '../api/appointments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import {
  appointmentVisitTypeLabels,
  getAppointmentErrorMessage,
} from './appointment-utils';
import {
  getDateRangeForPeriod,
  groupAppointmentsByVisitType,
  toMonthLabel,
  uniquePatientCount,
} from './doctor-workflow-utils';

type PerformancePoint = {
  label: string;
  value: number;
};

const periods = ['Today', 'This Week', 'This Month', 'Last Month', 'Quarter', 'Year'];

const toInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const defaultMonthPoints = (): PerformancePoint[] => {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      label: toMonthLabel(toInput(date)),
      value: 0,
    };
  });
};

const buildMonthlyTrend = (appointments: AppointmentResponse[]): PerformancePoint[] => {
  const grouped = appointments.reduce<Record<string, number>>((result, appointment) => {
    const key = appointment.appointment_date.slice(0, 7);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return defaultMonthPoints();
  }

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) => ({ label: toMonthLabel(`${month}-01T00:00:00`), value }));
};

function PerformanceLine({ points, tone = 'blue' }: { points: PerformancePoint[]; tone?: 'blue' | 'green' }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 100 - (point.value / max) * 84 - 8;
    return `${x},${y}`;
  });

  return (
    <div className={`doc-chart doc-line-chart ${tone}`}>
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

function DistributionDonut({ appointments }: { appointments: AppointmentResponse[] }) {
  const distribution = groupAppointmentsByVisitType(appointments);
  const entries = Object.entries(distribution);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);
  const total = Math.max(totalCount, 1);
  const colors = ['#2563eb', '#16a34a', '#8b5cf6', '#ef4444', '#0891b2'];
  let start = 0;
  const gradient = entries
    .map(([, count], index) => {
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
        {entries.map(([type, count], index) => (
          <span key={type}>
            <i style={{ background: colors[index] }} />
            {appointmentVisitTypeLabels[type as keyof typeof appointmentVisitTypeLabels]} ({count})
          </span>
        ))}
      </div>
    </div>
  );
}

export function DoctorPerformancePage() {
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [period, setPeriod] = useState('This Month');
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const trend = useMemo(() => buildMonthlyTrend(appointments), [appointments]);
  const zeroTrend = useMemo(() => defaultMonthPoints(), []);
  const patientsSeen = uniquePatientCount(appointments);
  const noShows = appointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
  const noShowRate = appointments.length === 0 ? 0 : Math.round((noShows / appointments.length) * 1000) / 10;
  const checkedIn = appointments.filter((appointment) => appointment.status === 'CHECKED_IN').length;

  const loadDoctors = useCallback(async () => {
    const response = await doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
    setDoctors(response.data);
    setSelectedDoctorId((current) => current || response.data[0]?.id || '');
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!selectedDoctorId) {
      setAppointments([]);
      return;
    }

    const range = getDateRangeForPeriod(period);
    const response = await appointmentsApi.list({
      doctor_id: selectedDoctorId,
      date_from: range.from,
      date_to: range.to,
      limit: 100,
      sortBy: 'appointment_date',
      sortOrder: 'asc',
    });
    setAppointments(response.data);
  }, [period, selectedDoctorId]);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    void loadDoctors()
      .catch((error) => setLoadError(getAppointmentErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [loadDoctors]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    setLoading(true);
    setLoadError('');
    void loadAppointments()
      .catch((error) => {
        setAppointments([]);
        setLoadError(getAppointmentErrorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [loadAppointments, selectedDoctorId]);

  const kpis = [
    ['ph-stethoscope', 'blue', 'Total Consultations', checkedIn, 'Checked-in appointment records'],
    ['ph-users-three', 'green', 'Patients Seen', patientsSeen, 'Unique patients'],
    ['ph-star', 'orange', 'Patient Satisfaction', '0%', 'No feedback captured'],
    ['ph-timer', 'purple', 'Average Consultation Time', '0 min', 'Target: 30 min'],
    ['ph-prescription', 'cyan', 'Prescription Count', 0, 'Digital prescriptions'],
    ['ph-user-minus', 'red', 'No Show Rate', `${noShowRate}%`, 'Appointment status based'],
  ] as const;

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>Doctor Performance</h2>
          <p>Review clinical productivity and patient outcomes</p>
        </div>
        <div className="doctor-page-actions">
          <div className="doc-field compact">
            <label htmlFor="performance-period">Performance Period</label>
            <select id="performance-period" onChange={(event) => setPeriod(event.target.value)} value={period}>
              {periods.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button className="doc-btn" onClick={() => window.print()} type="button">
            <i className="ph ph-file-text" aria-hidden="true" />
            Detailed Report
          </button>
          <button className="doc-btn primary" onClick={() => window.print()} type="button">
            <i className="ph ph-download-simple" aria-hidden="true" />
            Export Report
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="form-error-banner" role="alert">
          <i className="ph ph-warning-circle" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}
      {loading ? <div className="doc-muted-note">Loading live doctor performance...</div> : null}

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

          <section className="doc-grid performance">
            <article className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Consultation Trend</h3>
                  <p>Appointment volume{selectedDoctor ? ` for ${selectedDoctor.display_name}` : ''}</p>
                </div>
              </div>
              <PerformanceLine points={trend} />
            </article>
            <article className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Patient Satisfaction</h3>
                  <p>Six-month satisfaction trend</p>
                </div>
              </div>
              <PerformanceLine points={zeroTrend} tone="green" />
            </article>
          </section>

          <section className="doc-grid performance">
            <article className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Consultation Distribution</h3>
                  <p>Encounters by visit type</p>
                </div>
              </div>
              <DistributionDonut appointments={appointments} />
            </article>
            <article className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Performance Metrics</h3>
                  <p>Clinical activity indicators</p>
                </div>
              </div>
              <div className="doc-metric-list">
                {[
                  ['Average Consultation Time', '0 min'],
                  ['Patients Per Day', patientsSeen === 0 ? 0 : Math.round((patientsSeen / 30) * 10) / 10],
                  ['Prescription Count', 0],
                  ['Referral Count', 0],
                  ['Lab Orders', 0],
                  ['Radiology Orders', 0],
                  ['Checked-in Appointments', checkedIn],
                  ['Total Appointments', appointments.length],
                  ['No Show Rate', `${noShowRate}%`],
                ].map(([label, value]) => (
                  <div className="doc-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
    </div>
  );
}
