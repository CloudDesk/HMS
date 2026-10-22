import { OphthalmologyConsultationSummaryCard } from './OphthalmologyConsultationSummaryCard';
import { OphthalmologyBillingCard } from './OphthalmologyBillingCard';
import { OphthalmologyPublicationTools } from './OphthalmologyPublicationTools';
import { OphthalmologyFinalizationTools } from './OphthalmologyFinalizationTools';
import { useOphthalmologyCompletionFeature, type CompletionWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { OphthalmologyCompletionActionDialog } from './OphthalmologyCompletionActionDialog';
import { Reading } from './OphthalmologyCareWorkspace';
import { queueTime } from '../../hooks/ophthalmology/queue-actions';

export function OphthalmologyCompletionWorkspace({ workspace }: { workspace: CompletionWorkspace }) {
  const f = useOphthalmologyCompletionFeature(workspace);
  const latestCompletion = f.history?.completions.at(-1);
  if (!f.canView) return <p role="alert">Ophthalmology Consultation View permission is required.</p>;
  if (f.scopeError) return <p role="alert">The completion record does not match this patient encounter. Reopen the encounter.</p>;

  const isCompleted = f.history?.status === 'COMPLETED';
  const isAmendment = f.history?.status === 'AMENDMENT_OPEN';
  const allReady = f.readiness?.ready ?? false;
  const unmetCount = f.unmet.length;

  return (
    <section className="oph-completion-workspace">
      {/* 1. Primary Consolidated Clinical Summary */}
      <OphthalmologyConsultationSummaryCard feature={f} />

      {/* 2. Clinical Readiness & Doctor Finalization Card */}
      <section className="doc-card oph-signoff-card" style={{ marginTop: '20px' }}>
        <div className="oph-signoff-header">
          <div className="oph-signoff-title-wrap">
            <div className="oph-signoff-badge-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Clinical Readiness & Doctor Finalization
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                Verify prerequisite clinical checks and record authenticated doctor sign-off.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`oph-badge ${isCompleted ? 'oph-badge-green' : isAmendment ? 'oph-badge-amber' : allReady ? 'oph-badge-blue' : 'oph-badge-amber'}`} style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
              {isCompleted ? '✓ Consultation Finalized' : isAmendment ? '● Amendment in Progress' : allReady ? '✓ Ready for Doctor Approval' : `${unmetCount} Action(s) Required`}
            </span>
            <button
              type="button"
              className="doc-btn"
              disabled={!f.active || f.busy || f.readinessQuery.isFetching || f.historyQuery.isFetching}
              onClick={() => void f.refresh()}
            >
              Refresh Status
            </button>
          </div>
        </div>

        {/* Informative Status banner if refresh error occurs */}
        {(f.readinessQuery.isError || f.historyQuery.isError) && (
          <div className="oph-info-banner" style={{ margin: '14px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.84rem', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Readiness or history could not be refreshed. Cached information may be stale; actions are disabled.</span>
            <button type="button" className="doc-btn" onClick={() => void f.refresh()}>Retry saved information</button>
          </div>
        )}

        {f.staleContext && (
          <p role="alert" className="form-error-banner" style={{ margin: '12px 0' }}>
            The encounter context changed. Refresh the context and readiness together before recording an exception.
          </p>
        )}

        {/* Prerequisites Checklist */}
        {f.readiness && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Encounter Prerequisite Checklist:
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Reported readiness: {f.readiness.ready ? 'Configured checks satisfied' : 'Unmet configured checks'}
              </span>
            </div>
            <div className="oph-readiness-grid">
              {f.readiness.requirements.map((row) => (
                <div key={row.code} className={`oph-readiness-chip ${row.satisfied ? 'satisfied' : 'unmet'}`}>
                  <div className="oph-readiness-chip-left">
                    <span className="oph-readiness-icon">{row.satisfied ? '✓' : '•'}</span>
                    <div>
                      <div className="oph-readiness-name">{row.code.replaceAll('_', ' ')}</div>
                      <div className="oph-readiness-details">{row.details || (row.satisfied ? 'Requirement met' : 'Review required')}</div>
                    </div>
                  </div>
                  <div>
                    {!row.satisfied && f.linkFor(row.code) ? (
                      <button
                        type="button"
                        className="oph-readiness-link-btn"
                        onClick={() => f.openRequirement(row.code)}
                      >
                        Open Section →
                      </button>
                    ) : (
                      <span className={`oph-badge ${row.satisfied ? 'oph-badge-green' : 'oph-badge-amber'}`} style={{ fontSize: '0.72rem' }}>
                        {row.satisfied ? 'Satisfied' : 'Unmet'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doctor Finalization Actions & Governance */}
        <div className="oph-signoff-action-box" style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Doctor Signature & Clinical Approval
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {isCompleted
                  ? `Authenticated and approved by Doctor ${latestCompletion?.approver_doctor_id ?? ''} on ${latestCompletion?.approved_at ? queueTime(latestCompletion.approved_at) : ''}.`
                  : 'Reported readiness evaluates the configured prerequisites. Review the encounter sections and any authorized exceptions before recording doctor approval.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {f.canOverride && (
                <>
                  <button
                    type="button"
                    className="doc-btn"
                    disabled={!f.writable || f.busy}
                    onClick={() => f.setQuery({ completion_action: 'defer' })}
                  >
                    Record result deferral
                  </button>
                  <button
                    type="button"
                    className="doc-btn"
                    disabled={!f.writable || f.busy || !f.unmet.length}
                    onClick={() => f.setQuery({ completion_action: 'override' })}
                  >
                    Request authorized override
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tools Dialogs / Actions */}
        <OphthalmologyFinalizationTools workspace={workspace} completion={f} />
      </section>

      {/* 3. Publication Tools if Approved */}
      {f.history && latestCompletion && (
        <OphthalmologyPublicationTools
          scope={f.history}
          source={{
            source_type: 'CONSULTATION_SUMMARY',
            source_id: f.history.id,
            source_version: latestCompletion.clinical_version,
          }}
          sourceApproved={f.history.status === 'COMPLETED' && !f.historyQuery.isError && !f.historyQuery.isFetching && !f.staleContext}
        />
      )}

      {/* 4. Billing Card */}
      <div style={{ marginTop: '20px' }}>
        <OphthalmologyBillingCard workspace={workspace} />
      </div>

      {/* 5. Collapsible Regulatory Audit & History */}
      <details className="doc-card oph-audit-accordion" style={{ marginTop: '20px' }}>
        <summary className="oph-audit-summary">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <div>
              <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>Encounter Regulatory Audit & Governance History</strong>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Immutable approval history, recorded deferrals, authorized overrides, and amendment episodes
              </div>
            </div>
          </div>
          <span className="oph-badge oph-badge-blue">
            Finalization: {f.history?.status ?? (f.historyQuery.data === null ? 'Not started' : 'Unavailable')} · v{f.finalizationVersion ?? 0}
          </span>
        </summary>

        <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <h4>Recorded deferrals</h4>
          {f.historyQuery.data === null && <p style={{ color: '#64748b' }}>No finalization history has been recorded.</p>}
          {f.history && !f.history.deferrals.length && <p style={{ color: '#64748b' }}>No recorded deferrals.</p>}
          {f.history?.deferrals.map((entry) => (
            <details key={entry.id} style={{ marginBottom: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>{entry.source_type} · {entry.source_id} · {queueTime(entry.recorded_at)}</summary>
              <p>Reason: {entry.reason}</p>
              <p>Review plan: {entry.review_plan || 'Not recorded'} · due {queueTime(entry.due_at)}</p>
              <p>Responsible doctor {entry.responsible_doctor_id} · recorded by {entry.recorded_by}</p>
              <p style={{ color: '#64748b', fontSize: '0.8rem' }}>This deferral does not mark the result reviewed.</p>
            </details>
          ))}

          <h4 style={{ marginTop: '16px' }}>Recorded overrides</h4>
          {f.history && !f.history.overrides.length && <p style={{ color: '#64748b' }}>No recorded overrides.</p>}
          {f.history?.overrides.map((entry) => (
            <details key={entry.id} style={{ marginBottom: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>{queueTime(entry.created_at)} · doctor {entry.doctor_id} · actor {entry.actor_user_id}</summary>
              <p>Reason: {entry.reason}</p>
              <ul>
                {entry.unmet_snapshot.map((row, index) => (
                  <li key={index}>{row.code} · {row.details} · {row.resource_ids.join(', ') || 'No linked resource'}</li>
                ))}
              </ul>
            </details>
          ))}

          <h4 style={{ marginTop: '16px' }}>Immutable approval history</h4>
          {f.history && !f.history.completions.length && <p style={{ color: '#64748b' }}>No consultation approvals recorded.</p>}
          {f.history?.completions.map((entry) => (
            <details key={entry.clinical_version} style={{ marginBottom: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>Clinical version {entry.clinical_version} · approved {queueTime(entry.approved_at)}</summary>
              <p>Doctor {entry.approver_doctor_id} · authenticated actor {entry.approver_user_id}</p>
              <p>Supersedes {entry.supersedes_clinical_version ?? 'None'} · configuration revision {entry.configuration_revision} · consultation version {entry.consultation_version} · clinical-review version {entry.clinical_review_version} · optical version {entry.optical_prescription_version ?? 'None'}</p>
              <ul>
                {entry.requirement_snapshot.map((row) => (
                  <li key={row.code}>{row.code} · {row.satisfied ? 'Satisfied' : 'Unmet in approved snapshot'} · {row.details}</li>
                ))}
              </ul>
            </details>
          ))}

          <h4 style={{ marginTop: '16px' }}>Amendment journal</h4>
          {f.history && !f.history.amendment_episodes.length && <p style={{ color: '#64748b' }}>No amendment episodes recorded.</p>}
          {f.history?.amendment_episodes.map((episode) => (
            <details key={episode.id} style={{ marginBottom: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}>{episode.status} · source clinical version {episode.source_clinical_version} · opened {queueTime(episode.opened_at)}</summary>
              <p>{episode.reason} · actor {episode.opened_by}</p>
              {episode.changes.map((change, index) => (
                <section className="doc-card" key={index}>
                  <h4>{change.section}</h4>
                  <p>{change.reason} · {change.changed_by} · {queueTime(change.changed_at)}</p>
                  <h4>Before</h4>
                  <Reading value={change.before_value} />
                  <h4>After</h4>
                  <Reading value={change.after_value} />
                </section>
              ))}
              <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Supported text amendments update a new clinical source version and require reapproval. Earlier journal-only entries should be checked against their source record.</p>
            </details>
          ))}

          <p style={{ marginTop: '16px', fontSize: '0.8rem', color: '#64748b' }}>
            Original approved versions remain read-only. Supported text corrections use a separate amendment episode and source version; other sections require their typed correction workflow.
          </p>
        </div>
      </details>

      {(f.action === 'defer' || f.action === 'override') && f.finalizationVersion !== undefined && (
        <OphthalmologyCompletionActionDialog key={`${workspace.visitId}:${f.action}`} feature={f} action={f.action} />
      )}
      {f.error && !f.action && <p className="form-error-banner" role="alert" style={{ marginTop: '12px' }}>{f.error}</p>}
    </section>
  );
}
