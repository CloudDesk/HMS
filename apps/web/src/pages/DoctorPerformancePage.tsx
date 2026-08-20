import { useState } from 'react';
import {
  doctorPerformancePeriods,
  parseDoctorPerformancePeriod,
  type DoctorPerformanceDistributionEntry,
  type DoctorPerformancePeriod,
  type DoctorPerformancePoint,
  useDoctorPerformance,
} from '../hooks/doctors/useDoctorPerformance';
import {
  appointmentVisitTypeLabels,
} from './appointment-utils';

function PerformanceLine({ points, tone = 'blue' }: { points: DoctorPerformancePoint[]; tone?: 'blue' | 'green' }) {
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

function DistributionDonut({ entries }: { entries: DoctorPerformanceDistributionEntry[] }) {
  const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);
  const total = Math.max(totalCount, 1);
  const colors = ['#2563eb', '#16a34a', '#8b5cf6', '#ef4444', '#0891b2'];
  let start = 0;
  const gradient = entries
    .map((entry, index) => {
      const end = start + (entry.count / total) * 100;
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
        {entries.map((entry, index) => (
          <span key={entry.type}>
            <i style={{ background: colors[index] }} />
            {appointmentVisitTypeLabels[entry.type]} ({entry.count})
          </span>
        ))}
      </div>
    </div>
  );
}

export function DoctorPerformancePage() {
  const [period, setPeriod] = useState<DoctorPerformancePeriod>('This Month');
  const performance = useDoctorPerformance(period);

  const kpis = [
    ['ph-stethoscope', 'blue', 'Total Consultations', performance.checkedIn, 'Checked-in appointment records'],
    ['ph-users-three', 'green', 'Patients Seen', performance.patientsSeen, 'Unique patients'],
    ['ph-star', 'orange', 'Patient Satisfaction', '0%', 'No feedback captured'],
    ['ph-timer', 'purple', 'Average Consultation Time', '0 min', 'Target: 30 min'],
    ['ph-prescription', 'cyan', 'Prescription Count', 0, 'Digital prescriptions'],
    ['ph-user-minus', 'red', 'No Show Rate', `${performance.noShowRate}%`, 'Appointment status based'],
  ];

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
            <select id="performance-period" onChange={(event) => setPeriod(parseDoctorPerformancePeriod(event.target.value))} value={period}>
              {doctorPerformancePeriods.map((item) => (
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

      {performance.error ? (
        <div className="form-error-banner" role="alert">
          <i className="ph ph-warning-circle" aria-hidden="true" />
          <span>{performance.error}</span>
        </div>
      ) : null}
      {performance.isLoading ? <div className="doc-muted-note">Loading live doctor performance...</div> : null}

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
                  <p>Appointment volume{performance.selectedDoctor ? ` for ${performance.selectedDoctor.display_name}` : ''}</p>
                </div>
              </div>
              <PerformanceLine points={performance.trend} />
            </article>
            <article className="doc-card">
              <div className="doc-card-header">
                <div>
                  <h3>Patient Satisfaction</h3>
                  <p>Six-month satisfaction trend</p>
                </div>
              </div>
              <PerformanceLine points={performance.zeroTrend} tone="green" />
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
              <DistributionDonut entries={performance.distribution} />
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
                  ['Patients Per Day', performance.patientsSeen === 0 ? 0 : Math.round((performance.patientsSeen / 30) * 10) / 10],
                  ['Prescription Count', 0],
                  ['Referral Count', 0],
                  ['Lab Orders', 0],
                  ['Radiology Orders', 0],
                  ['Checked-in Appointments', performance.checkedIn],
                  ['Total Appointments', performance.appointments.length],
                  ['No Show Rate', `${performance.noShowRate}%`],
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
