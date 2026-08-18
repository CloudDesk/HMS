import { navigate } from '../routing/navigation';
import {
  activeVisitStatuses,
  formatVisitDateTime,
  getOpdErrorMessage,
  isActiveVisit,
  opdVisitPriorityLabels,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  visitPriorityClass,
  visitStatusClass,
} from './opd-utils';
import { useOpdDashboard } from '../hooks/opd/useOpdDashboard';

export function OpdDashboardPage() {
  const {
    visits,
    loading,
    loadError,
    trend,
    waitingVisits,
    readyVisits,
    inConsultationVisits,
    completedVisits,
    urgentVisits,
  } = useOpdDashboard();

  const maxTrend = Math.max(1, ...trend.map((point) => point.value));

  return (
    <div className="opd-page">
      <section className="opd-page-header">
        <div className="opd-page-title">
          <h2>OPD Dashboard</h2>
          <p>Monitor outpatient activity, queues and visit flow</p>
        </div>
        <div className="opd-page-actions">
          <button className="doc-btn" onClick={() => navigate('/patients/search')} type="button">
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            Search Patient
          </button>
          <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-queue" aria-hidden="true" />
            Open Queue
          </button>
          <button className="doc-btn primary" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-sign-in" aria-hidden="true" />
            Check-in Patient
          </button>
        </div>
      </section>

      {loadError ? <div className="form-error-banner">{getOpdErrorMessage(loadError)}</div> : null}

      <section className="doc-kpi-grid opd-kpi-grid">
        {([
          ['ph-users', 'blue', "Today's OPD Patients", visits.length, 'Checked in today'],
          ['ph-hourglass', 'orange', 'Waiting Queue', waitingVisits.length, 'Vitals/triage pending'],
          ['ph-stethoscope', 'cyan', 'Ready/In Consultation', readyVisits.length + inConsultationVisits.length, 'Doctor workflow'],
          ['ph-check-circle', 'green', 'Completed Visits', completedVisits.length, 'Closed today'],
          ['ph-warning-circle', 'red', 'Urgent / Emergency', urgentVisits.length, 'Active priority visits'],
        ] as const).map(([icon, tone, label, value, copy]) => (
          <article className="doc-kpi" key={label}>
            <span className={`doc-kpi-icon ${tone}`}>
              <i className={`ph ${icon}`} aria-hidden="true" />
            </span>
            <div className="doc-kpi-copy">
              <span>{label}</span>
              <strong>{loading ? '-' : value}</strong>
              <small>{copy}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="opd-dashboard-grid">
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>OPD Visit Trend</h3>
              <p>Outpatient visits over the last seven days</p>
            </div>
          </div>
          <div className="doc-chart">
            <svg className="doc-line-chart" viewBox="0 0 700 220" role="img" aria-label="OPD visit trend chart">
              {[0, 1, 2, 3, 4].map((line) => (
                <line key={line} x1="30" x2="680" y1={30 + line * 38} y2={30 + line * 38} />
              ))}
              <polyline
                points={trend.map((point, index) => `${30 + index * 108},${190 - (point.value / maxTrend) * 150}`).join(' ')}
              />
              {trend.map((point, index) => (
                <circle cx={30 + index * 108} cy={190 - (point.value / maxTrend) * 150} key={point.label} r="4" />
              ))}
            </svg>
            <div className="doc-chart-axis">
              {trend.map((point) => (
                <span key={point.label}>{point.label}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Clinical Alerts</h3>
              <p>Operational attention points</p>
            </div>
          </div>
          <div className="opd-alert-list">
            <div className="opd-alert warning">
              <i className="ph ph-clock-countdown" aria-hidden="true" />
              <div className="copy">
                <strong>{waitingVisits.length} patients waiting</strong>
                <span>Move checked-in patients to vitals in the next phase.</span>
              </div>
            </div>
            <div className="opd-alert">
              <i className="ph ph-stethoscope" aria-hidden="true" />
              <div className="copy">
                <strong>{readyVisits.length} ready for doctor</strong>
                <span>Consultation workspace is intentionally held for the next phase.</span>
              </div>
            </div>
            <div className="opd-alert danger">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <div className="copy">
                <strong>{urgentVisits.length} urgent active visits</strong>
                <span>Urgent and emergency priorities are highlighted in queue views.</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="opd-dashboard-triple">
        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Active OPD Queue</h3>
              <p>Patients currently in outpatient flow</p>
            </div>
            <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
              View Queue
            </button>
          </div>
          <div className="doc-appointment-list">
            {visits.filter(isActiveVisit).length === 0 ? (
              <div className="um-state-cell">No active OPD visits for today.</div>
            ) : (
              visits.filter(isActiveVisit).slice(0, 5).map((visit) => (
                <div className="doc-appointment-item" key={visit.id}>
                  <span className="doc-time">{formatVisitDateTime(visit.check_in_time)}</span>
                  <span className="doc-avatar">{patientInitials(visit.patient_name)}</span>
                  <div className="doc-appointment-copy">
                    <strong>{visit.patient_name}</strong>
                    <span>
                      {visit.patient_number} - {opdVisitTypeLabels[visit.visit_type]}
                    </span>
                  </div>
                  <span className={`doc-status ${visitStatusClass(visit.status)}`}>{opdVisitStatusLabels[visit.status]}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Priority Mix</h3>
              <p>Active visit priority distribution</p>
            </div>
          </div>
          <div className="opd-summary-list">
            {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map((priority) => (
              <div className="opd-summary-row" key={priority}>
                <span>{opdVisitPriorityLabels[priority]}</span>
                <strong className={`doc-status ${visitPriorityClass(priority)}`}>
                  {visits.filter((visit) => isActiveVisit(visit) && visit.priority === priority).length}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Visit Status</h3>
              <p>Today by lifecycle state</p>
            </div>
          </div>
          <div className="opd-summary-list">
            {activeVisitStatuses.map((status) => (
              <div className="opd-summary-row" key={status}>
                <span>{opdVisitStatusLabels[status]}</span>
                <strong>{visits.filter((visit) => visit.status === status).length}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
