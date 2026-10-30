import { useState } from 'react';
import { OphthalmologyConsultationSummaryCard, OphthalmologySummaryHeader } from './OphthalmologyConsultationSummaryCard';
import { OphthalmologyPublicationTools } from './OphthalmologyPublicationTools';
import { OphthalmologyFinalizationTools } from './OphthalmologyFinalizationTools';
import { useOphthalmologyCompletionFeature, type CompletionWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { OphthalmologyCompletionActionDialog } from './OphthalmologyCompletionActionDialog';
import { CloseOpdJourneyModal } from '../opd/CloseOpdJourneyModal';
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
      <OphthalmologySummaryHeader printDisabled={f.summaryQuery.isLoading || f.summaryQuery.isError || !f.summaryQuery.data} />
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
