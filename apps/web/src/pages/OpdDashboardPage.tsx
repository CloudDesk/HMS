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
    hasCompleteDataset,
    capabilities,
    summary,
    summaryLoading,
    branchScope,
  } = useOpdDashboard();

  const maxTrend = Math.max(1, ...trend.map((point) => point.value));

  return (
    <div className="opd-page">
      <section className="opd-page-header">
        <div className="opd-page-title">
          <h2>OPD Dashboard</h2>
          <p>Monitor outpatient activity, queues and visit flow</p>
          <small>Branch scope: {branchScope === 'ALL_AUTHORIZED' ? 'All authorized branches' : 'Selected branch'}</small>
        </div>
        <div className="opd-page-actions">
          {capabilities.canSearchPatients ? <button className="doc-btn" onClick={() => navigate('/patients/search')} type="button">
            Patients
          </button> : null}
          {capabilities.canViewQueue ? <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-queue" aria-hidden="true" />
            Open Queue
          </button> : null}
          {capabilities.canCheckIn ? <button className="doc-btn primary" onClick={() => navigate('/opd/queue')} type="button">
            <i className="ph ph-sign-in" aria-hidden="true" />
            Check-in Patient
          </button> : null}
        </div>
      </section>

      {loadError ? <div className="form-error-banner">{getOpdErrorMessage(loadError)}</div> : null}

      <section className="doc-kpi-grid opd-kpi-grid">
        {([
          ['ph-users', 'blue', "Today's OPD Patients", summary?.total ?? '—', summary ? 'Checked in today' : 'Summary unavailable'],
          ['ph-hourglass', 'orange', 'Awaiting Nursing Action', summary ? summary.by_status.CHECKED_IN + summary.by_status.WAITING_FOR_VITALS : '—', summary ? 'Vitals/triage pending' : 'Summary unavailable'],
          ['ph-stethoscope', 'cyan', 'Ready/In Consultation', summary ? summary.by_status.READY_FOR_CONSULTATION + summary.by_status.IN_CONSULTATION : '—', summary ? 'Doctor workflow' : 'Summary unavailable'],
          ['ph-check-circle', 'green', 'Completed Visits', summary?.by_status.COMPLETED ?? '—', summary ? 'Closed today' : 'Summary unavailable'],
          ['ph-warning-circle', 'red', 'Urgent / Emergency', summary?.urgent ?? '—', summary ? 'Active priority visits' : 'Summary unavailable'],
          ['ph-person-simple-walk', 'purple', 'Walk-ins', summary?.walk_ins ?? '—', summary ? 'Registered without appointment' : 'Summary unavailable'],
        ] as const).map(([icon, tone, label, value, copy]) => (
          <article className="doc-kpi" key={label}>
            <span className={`doc-kpi-icon ${tone}`}>
              <i className={`ph ${icon}`} aria-hidden="true" />
            </span>
            <div className="doc-kpi-copy">
              <span>{label}</span>
              <strong>{loading || summaryLoading ? '-' : value}</strong>
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
          {hasCompleteDataset ? <div className="doc-chart">
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
          </div> : <div className="um-state-cell">Complete trend data is unavailable for this dashboard scope.</div>}
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
                <strong>{summary ? `${summary.by_status.CHECKED_IN + summary.by_status.WAITING_FOR_VITALS} patients awaiting nursing action` : 'Waiting total unavailable'}</strong>
                <span>Move checked-in patients to vitals in the next phase.</span>
              </div>
            </div>
            <div className="opd-alert">
              <i className="ph ph-stethoscope" aria-hidden="true" />
              <div className="copy">
                <strong>{summary ? `${summary.by_status.READY_FOR_CONSULTATION} ready for doctor` : 'Ready-for-doctor total unavailable'}</strong>
                <span>Consultation workspace is intentionally held for the next phase.</span>
              </div>
            </div>
            <div className="opd-alert danger">
              <i className="ph ph-warning-circle" aria-hidden="true" />
              <div className="copy">
                <strong>{summary ? `${summary.urgent} urgent active visits` : 'Urgent total unavailable'}</strong>
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
            {capabilities.canViewQueue ? <button className="doc-btn" onClick={() => navigate('/opd/queue')} type="button">
              View Queue
            </button> : null}
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
