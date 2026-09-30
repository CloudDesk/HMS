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
    <div className="hms-dash-wrapper">
      <div className="hms-dash-header">
        <div className="hms-dash-title">
          <h2>OPD Dashboard</h2>
          <p>Monitor outpatient activity, queues, and clinical visit flow</p>
          <span className="hms-dash-scope-tag">
            <i className="ph ph-buildings" aria-hidden="true" />
            Branch scope: {branchScope === 'ALL_AUTHORIZED' ? 'All authorized branches' : 'Selected branch'}
          </span>
        </div>
        <div className="hms-dash-actions">
          {capabilities.canSearchPatients ? (
            <button className="hms-dash-btn secondary" onClick={() => navigate('/patients/search')} type="button">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              Patients
            </button>
          ) : null}
          {capabilities.canViewQueue ? (
            <button className="hms-dash-btn secondary" onClick={() => navigate('/opd/queue')} type="button">
              <i className="ph ph-queue" aria-hidden="true" />
              Open Queue
            </button>
          ) : null}
          {capabilities.canCheckIn ? (
            <button className="hms-dash-btn primary" onClick={() => navigate('/opd/queue')} type="button">
              <i className="ph ph-sign-in" aria-hidden="true" />
              Check-in Patient
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? <div className="form-error-banner" style={{ borderRadius: '8px' }}>{getOpdErrorMessage(loadError)}</div> : null}

      <div className="hms-dash-kpi-grid">
        {([
          ['ph-users', 'blue', "Today's OPD Patients", summary?.total ?? '—', summary ? 'Checked in today' : 'Summary unavailable'],
          ['ph-hourglass', 'orange', 'Awaiting Nursing Action', summary ? summary.by_status.CHECKED_IN + summary.by_status.WAITING_FOR_VITALS : '—', summary ? 'Vitals / triage pending' : 'Summary unavailable'],
          ['ph-stethoscope', 'cyan', 'Ready/In Consultation', summary ? summary.by_status.READY_FOR_CONSULTATION + summary.by_status.IN_CONSULTATION : '—', summary ? 'Doctor workflow' : 'Summary unavailable'],
          ['ph-check-circle', 'green', 'Completed Visits', summary?.by_status.COMPLETED ?? '—', summary ? 'Closed today' : 'Summary unavailable'],
          ['ph-warning-circle', 'red', 'Urgent / Emergency', summary?.urgent ?? '—', summary ? 'Active priority visits' : 'Summary unavailable'],
          ['ph-person-simple-walk', 'purple', 'Walk-ins', summary?.walk_ins ?? '—', summary ? 'Registered without booking' : 'Summary unavailable'],
        ] as const).map(([icon, tone, label, value, copy]) => (
          <div className="hms-dash-kpi-card" key={label}>
            <div className="hms-kpi-top">
              <span className={`hms-kpi-icon ${tone}`}>
                <i className={`ph ${icon}`} aria-hidden="true" />
              </span>
              {tone === 'red' && typeof value === 'number' && value > 0 ? (
                <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>Priority</span>
              ) : null}
            </div>
            <div>
              <div className="hms-kpi-label">{label}</div>
              <div className="hms-kpi-value">{loading || summaryLoading ? '—' : value}</div>
              <div className="hms-kpi-sub">{copy}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hms-dash-grid two-col-7-5">
        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">OPD Visit Trend</h3>
              <p className="hms-card-desc">Outpatient visits over the last seven days</p>
            </div>
          </div>
          <div className="hms-card-body">
            {hasCompleteDataset ? (
              <div className="hms-chart-wrap">
                <svg className="hms-chart-svg" viewBox="0 0 700 220" role="img" aria-label="OPD visit trend chart" style={{ height: '190px' }}>
                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="30" x2="670" y1={25 + line * 36} y2={25 + line * 36} className="hms-chart-gridline" />
                  ))}
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trend.map((point, index) => `${40 + index * 105},${170 - (point.value / maxTrend) * 135}`).join(' ')}
                  />
                  {trend.map((point, index) => (
                    <circle
                      cx={40 + index * 105}
                      cy={170 - (point.value / maxTrend) * 135}
                      key={point.label}
                      r="4"
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
                <div className="hms-chart-axis-labels">
                  {trend.map((point) => (
                    <div key={point.label} className="hms-chart-axis-item">
                      <div>{point.label}</div>
                      <div className="hms-chart-axis-sub">{point.value} visits</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hms-dash-empty">
                <i className="ph ph-chart-line" />
                <div className="hms-dash-empty-title">Trend data unavailable</div>
                <div className="hms-dash-empty-desc">Complete trend data is unavailable for this dashboard scope.</div>
              </div>
            )}
          </div>
        </div>

        <div className="hms-dash-card">
          <div className="hms-card-header">
            <div className="hms-card-header-left">
              <h3 className="hms-card-title">Clinical Alerts</h3>
              <p className="hms-card-desc">Operational attention points</p>
            </div>
          </div>
          <div className="hms-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon orange" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>
                  <i className="ph ph-clock-countdown" aria-hidden="true" />
                </span>
                <div className="hms-attention-text">
                  <strong>{summary ? `${summary.by_status.CHECKED_IN + summary.by_status.WAITING_FOR_VITALS} patients awaiting nursing action` : 'Waiting total unavailable'}</strong>
                  <small>Move checked-in patients to vitals</small>
                </div>
              </div>
            </div>
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #2563eb' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon blue" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>
                  <i className="ph ph-stethoscope" aria-hidden="true" />
                </span>
                <div className="hms-attention-text">
                  <strong>{summary ? `${summary.by_status.READY_FOR_CONSULTATION} ready for doctor` : 'Ready-for-doctor total unavailable'}</strong>
                  <small>Consultation queue ready</small>
                </div>
              </div>
            </div>
            <div className="hms-attention-item" style={{ borderLeft: '3px solid #ef4444' }}>
              <div className="hms-attention-left">
                <span className="hms-kpi-icon red" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                </span>
                <div className="hms-attention-text">
                  <strong>{summary ? `${summary.urgent} urgent active visits` : 'Urgent total unavailable'}</strong>
                  <small>Prioritize in queue views</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
