import { useState } from 'react';
import { OphthalmologyConsultationSummaryCard } from './OphthalmologyConsultationSummaryCard';
import { OphthalmologyPublicationTools } from './OphthalmologyPublicationTools';
import { OphthalmologyFinalizationTools } from './OphthalmologyFinalizationTools';
import { useOphthalmologyCompletionFeature, type CompletionWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { OphthalmologyCompletionActionDialog } from './OphthalmologyCompletionActionDialog';
import { CloseOpdJourneyModal } from '../opd/CloseOpdJourneyModal';
import { Reading } from './OphthalmologyCareWorkspace';
import { queueTime } from '../../hooks/ophthalmology/queue-actions';
import type { OpdVisitResponse } from '../../api/opd';

export function OphthalmologyCompletionWorkspace({ workspace }: { workspace: CompletionWorkspace }) {
  const [showCloseJourneyModal, setShowCloseJourneyModal] = useState(false);
  const f = useOphthalmologyCompletionFeature(workspace);
  const latestCompletion = f.history?.completions.at(-1);
  if (!f.canView) return <p role="alert">Ophthalmology Consultation View permission is required.</p>;
  if (f.scopeError) return <p role="alert">The completion record does not match this patient encounter. Reopen the encounter.</p>;

  const isCompleted = f.history?.status === 'COMPLETED';

  return (
    <section className="oph-completion-workspace">
      {/* 1. Primary Consolidated Clinical Summary (8-card sequential structure) */}
      <OphthalmologyConsultationSummaryCard feature={f} workspace={workspace} />

      {/* Finalization Modal Dialogs & Tools */}
      <OphthalmologyFinalizationTools workspace={workspace} completion={f} />

      {/* Post-Sign-Off Status Banner for Clinically Completed Journeys */}
      {isCompleted && workspace.visit?.status === 'CLINICALLY_COMPLETED' && (
        <section className="doc-card oph-journey-banner clinically-completed" style={{ marginTop: '20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>🩺</span>
                <h4 style={{ margin: 0, color: '#1e40af', fontSize: '1.05rem', fontWeight: 700 }}>
                  Clinical Consultation Completed
                </h4>
                <span className="doc-status signed" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
                  CLINICALLY_COMPLETED
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', color: '#1e3a8a', fontSize: '0.88rem' }}>
                Doctor sign-off has been recorded. The patient's OPD journey remains open until the required billing and medication dispensing steps are completed.
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                Verification occurs during authorized checkout.
              </p>
            </div>
            {f.canCloseVisit && (
              <button
                type="button"
                className="doc-btn success"
                onClick={() => setShowCloseJourneyModal(true)}
              >
                <i className="ph ph-check-circle" aria-hidden="true" /> Close OPD Journey
              </button>
            )}
          </div>
        </section>
      )}

      {isCompleted && workspace.visit?.status === 'COMPLETED' && (
        <section className="doc-card oph-journey-banner completed" style={{ marginTop: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🏁</span>
            <h4 style={{ margin: 0, color: '#166534', fontSize: '1.05rem', fontWeight: 700 }}>
              OPD Journey Closed
            </h4>
            <span className="doc-status completed" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
              COMPLETED
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#14532d', fontSize: '0.88rem' }}>
            Doctor consultation, billing settlement, and medication dispensing are finalized and closed.
          </p>
        </section>
      )}

      {/* 2. Publication Tools if Approved */}
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

      {/* 3. Collapsible Regulatory Audit & History */}
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

      <CloseOpdJourneyModal
        open={showCloseJourneyModal}
        visit={(workspace.visit as OpdVisitResponse) ?? null}
        onClose={() => setShowCloseJourneyModal(false)}
        onSuccess={() => {
          setShowCloseJourneyModal(false);
          void f.refresh();
          window.location.reload();
        }}
      />
    </section>
  );
}
