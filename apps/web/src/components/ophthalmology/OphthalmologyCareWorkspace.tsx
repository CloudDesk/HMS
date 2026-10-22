import { OphthalmologyPublicationTools } from './OphthalmologyPublicationTools';
import { OphthalmologyDiagnosisEditor } from './OphthalmologyDiagnosisEditor';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOphthalmologyCareFeature, type CareWorkspace, type OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { OphthalmologyClinicalReviewEditor } from './OphthalmologyClinicalReviewEditor';
import { OphthalmologyOpticalEditor } from './OphthalmologyOpticalEditor';
import { EditorErrors } from './OphthalmologyConfigurationEditor';

export function Reading({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <span>Not recorded</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span>{String(value)}</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (depth > 5) return <span>Open the source result for further detail.</span>;
  if (Array.isArray(value)) return <ol>{value.map((item: unknown, index) => <li key={index}><Reading value={item} depth={depth + 1} /></li>)}</ol>;
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd><Reading value={item} depth={depth + 1} /></dd></div>)}</dl>;
  return <span>Unavailable</span>;
}

const reviewForm = z.object({ comment: z.string().max(2000) });

function ResultReview({ feature: f }: { feature: OphthalmologyCareFeature }) {
  const [baseline, setBaseline] = useState({ task: f.task, result: f.result });
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof reviewForm>>({ resolver: zodResolver(reviewForm), defaultValues: { comment: '' } });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'care_tab', 'review_task_id', 'area']);
  const task = baseline.task; const result = baseline.result;
  if (!task || !result) return null;
  const changed = task.version !== f.task?.version || result.version !== f.result?.version || result.current_clinical_version !== f.result?.current_clinical_version;
  return (
    <form className="doc-card" onSubmit={handleSubmit(async (values) => {
      if (!f.canReview || changed || f.busy || isSubmitting || !window.confirm(`Review ${task.test_name}, ${task.laterality}, clinical version ${result.current_clinical_version}? This records your authenticated review.`)) return;
      const saved = await f.reviewResult({ expected_task_version: task.version, expected_result_version: result.version, expected_clinical_version: result.current_clinical_version, comment: values.comment || null });
      if (saved) { setBaseline({ task: saved, result }); reset(values); }
    })}>
      <h3>{task.test_name} · {task.laterality} · {task.status}</h3>
      <p>Clinical version {result.current_clinical_version} · {result.current.form_type} · {result.current.reliability} · performer {result.current.performer_user_id} · {new Date(result.current.performed_at).toLocaleString()}</p>
      <p>{result.current.reliability_reason ?? 'No reliability reason recorded'}</p>
      <p>{result.current.comments ?? 'No technician impression recorded'}</p>
      {changed && <p role="alert">The task or clinical result changed. The displayed review version is retained. Load the latest version before reviewing.</p>}
      <button type="button" className="doc-btn" disabled={f.busy || f.taskQuery.isError || f.resultQuery.isError} onClick={() => { if (!isDirty || window.confirm('Discard your comment and load the latest saved clinical version?')) { setBaseline({ task: f.task, result: f.result }); reset({ comment: '' }); } }}>Load latest review version</button>
      <Reading value={result.current.payload} />
      <p>Source documents: {result.current.document_ids.join(', ') || 'None'}. Open the source result for authorised attachment access.</p>
      <button type="button" className="doc-btn" onClick={f.openSourceResult}>Open source result and attachments</button>
      {f.canRequestRepeat && (
        <>
          <button type="button" className="doc-btn" disabled={changed || f.busy || isSubmitting} onClick={() => { if (!isDirty || window.confirm('Leave the unsaved review comment and open the repeat-test request?')) f.requestRepeat(); }}>Request repeat test</button>
          <p>The repeat request requires a reason and station assignment. The original result remains preserved.</p>
        </>
      )}
      <p>Reviewer {task.reviewed_by ?? 'Not reviewed'} · {task.reviewed_at ? new Date(task.reviewed_at).toLocaleString() : 'No review time'} · reviewed clinical version {task.reviewed_clinical_version ?? 'None'}</p>
      <EditorErrors errors={errors} />
      <label className="doc-field">Review comment<textarea maxLength={2000} disabled={!f.canReview || changed || f.busy} {...register('comment')} /></label>
      <button type="submit" className="doc-btn primary" disabled={!f.canReview || changed || f.busy || isSubmitting}>Record review of this saved clinical version</button>
      {f.error && <p role="alert" className="form-error-banner">{f.error} Your comment is retained.</p>}
    </form>
  );
}

export function OphthalmologyCareWorkspace({ workspace, mode }: { workspace: CareWorkspace; mode?: 'treatment' | 'optical' }) {
  const f = useOphthalmologyCareFeature(workspace);
  if (f.scopeError) return <p role="alert">The clinical record does not match this patient encounter. Reopen the encounter.</p>;

  // Dedicated Optical Tab Mode (Step 4)
  const isDedicatedOptical = mode === 'optical' || f.tab === 'optical';

  if (isDedicatedOptical) {
    return (
      <section>
        {f.tab === 'optical' && f.optical && (
          <OphthalmologyPublicationTools
            scope={f.optical}
            source={{
              source_type: 'OPTICAL_PRESCRIPTION',
              source_id: f.optical.id,
              source_version: f.optical.current_clinical_version,
            }}
            sourceApproved={
              f.optical.status === 'APPROVED' &&
              !f.opticalQuery.isError &&
              !f.opticalQuery.isFetching
            }
          />
        )}
        {!f.canOptical && (
          <div className="doc-card" role="alert">
            <p className="form-error-banner">Ophthalmology Optical Prescription View permission is required.</p>
          </div>
        )}
        {f.canOptical && (
          <>
            {f.opticalQuery.isLoading && <p role="status">Loading optical prescription…</p>}
            {f.opticalQuery.isError && (
              <p role="alert" className="form-error-banner">
                Optical prescription could not be loaded.{' '}
                <button type="button" className="doc-btn" onClick={() => void f.opticalQuery.refetch()}>
                  Retry optical prescription
                </button>
              </p>
            )}
            {(f.opticalQuery.isSuccess || f.opticalQuery.data !== undefined) && (
              <OphthalmologyOpticalEditor
                key={workspace.context?.id}
                feature={f}
                workspace={workspace}
              />
            )}
          </>
        )}
      </section>
    );
  }

  // Treatment & Diagnostic Results Mode (Step 3: Diagnosis & Treatment)
  return (
    <section>
      <nav className="oph-care-subnav" aria-label="Clinical care sections">
        {f.canClinical && (
          <>
            <button
              type="button"
              className={`oph-care-subtab ${f.tab === 'treatment' ? 'active' : ''}`}
              onClick={() => workspace.setQuery('care_tab', 'treatment')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Clinical Review & Treatment</span>
            </button>
            <button
              type="button"
              className={`oph-care-subtab ${f.tab === 'results' ? 'active' : ''}`}
              onClick={() => workspace.setQuery('care_tab', 'results')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              <span>Review Selected Test Result</span>
            </button>
          </>
        )}
      </nav>

      {f.tab === 'treatment' && !f.canClinical && <p role="alert">Ophthalmology Consultation View permission is required.</p>}

      {f.tab === 'results' && f.task && f.result && (
        <OphthalmologyPublicationTools
          scope={f.result}
          source={{
            source_type: 'TEST_RESULT',
            source_id: f.result.id,
            source_version: f.result.current_clinical_version,
          }}
          sourceApproved={
            f.task.status === 'REVIEWED' &&
            f.task.reviewed_clinical_version === f.result.current_clinical_version &&
            !f.taskQuery.isError &&
            !f.resultQuery.isError &&
            !f.taskQuery.isFetching &&
            !f.resultQuery.isFetching
          }
        />
      )}

      {f.tab === 'treatment' && f.canClinical && (
        <>
          {(f.clinicalQuery.isLoading || f.consultationQuery.isLoading) && <p role="status">Loading saved assessment and treatment…</p>}
          {f.clinicalQuery.isError && (
            <p role="alert">Clinical review could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.clinicalQuery.refetch()}>Retry clinical review</button></p>
          )}
          {f.canShared('OPD Consultation') && f.consultationQuery.isError && (
            <p role="alert">Saved diagnoses could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.consultationQuery.refetch()}>Retry diagnoses</button></p>
          )}
          {f.consultation && f.showDiagnosisEditor && (
            <OphthalmologyDiagnosisEditor key={`${workspace.visitId}:${f.consultation.id}`} record={f.consultation} canEdit={f.canEditDiagnosis} />
          )}
          <section className="doc-card">
            <h3>Saved structured assessment</h3>
            <p>{f.consultation?.assessment || 'No saved assessment available.'}</p>
            {!f.diagnoses.length && <p>No current saved diagnoses available. OPD Consultation View is required to read diagnoses.</p>}
            {f.diagnoses.map((diagnosis, index) => (
              <p key={index}>{diagnosis.code} · {diagnosis.display} · {diagnosis.laterality ?? 'Eye not recorded'} · {diagnosis.status ?? 'Certainty not recorded'} · {diagnosis.type}{diagnosis.differential ? ' · Differential' : ''}{diagnosis.severity ? ` · ${diagnosis.severity}` : ''}{diagnosis.stage ? ` · ${diagnosis.stage}` : ''}{diagnosis.notes ? ` · ${diagnosis.notes}` : ''}</p>
            ))}
            <p>Machine observations are not final diagnoses. Diagnosis editing requires current draft state and dedicated permissions.</p>
            {f.consultation?.clinical_history?.map((entry) => (
              <details key={entry.consultation_version}>
                <summary>Diagnosis history · consultation version {entry.consultation_version} · {new Date(entry.changed_at).toLocaleString()} · {entry.changed_by}</summary>
                {entry.diagnoses.map((diagnosis, index) => (
                  <p key={index}>{diagnosis.code} · {diagnosis.display} · {diagnosis.laterality ?? 'Not recorded'} · {diagnosis.status ?? 'Not recorded'} · {diagnosis.type}</p>
                ))}
              </details>
            ))}
          </section>
          {(f.clinicalQuery.isSuccess || f.clinicalQuery.data !== undefined) && <OphthalmologyClinicalReviewEditor key={workspace.context?.id} feature={f} />}
        </>
      )}

      {f.tab === 'results' && (
        <>
          {(!f.canQueue || !f.canClinical) && <p role="alert">Consultation View and Test Queue View are required to select a clinical result.</p>}
          {f.canQueue && f.canClinical && (
            <section className="doc-card">
              <h3>Authorized encounter tasks</h3>
              {f.invalidTaskId && <p role="alert">The selected task ID is invalid. Select an authorized encounter task.</p>}
              {f.tasksQuery.isLoading && <p role="status">Loading tasks…</p>}
              {f.tasksQuery.isError && <p role="alert">Tasks could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.tasksQuery.refetch()}>Retry tasks</button></p>}
              {!f.tasksQuery.isLoading && !f.tasks.length && <p>No authorized tasks on this page.</p>}
              {f.tasks.map((task) => (
                <button type="button" className="doc-btn" key={task.id} onClick={() => workspace.setQuery('review_task_id', task.id)}>
                  {task.test_name} · {task.laterality} · {task.status}
                </button>
              ))}
              <div className="oph-toolbar">
                <button type="button" className="doc-btn" disabled={f.page <= 1} onClick={() => workspace.setQuery('review_page', String(f.page - 1))}>Previous tasks</button>
                <span>Page {f.page}</span>
                <button type="button" className="doc-btn" disabled={f.page >= (f.tasksQuery.data?.meta.totalPages ?? 0)} onClick={() => workspace.setQuery('review_page', String(f.page + 1))}>Next tasks</button>
              </div>
              {(f.taskQuery.isLoading || f.resultQuery.isLoading) && <p role="status">Loading selected clinical result…</p>}
              {f.taskQuery.isError && <p role="alert">Task could not be verified. <button type="button" className="doc-btn" onClick={() => void f.taskQuery.refetch()}>Retry selected task</button></p>}
              {f.resultQuery.isError && f.task && <p role="alert">Result could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.resultQuery.refetch()}>Retry selected result</button></p>}
              {f.task && f.resultQuery.isSuccess && !f.result && <p>No saved result is available for this task.</p>}
              {f.task && f.result && <ResultReview key={f.task.id} feature={f} />}
            </section>
          )}
        </>
      )}

      <section className="doc-card">
        <h3>Shared care workflows</h3>
        <div className="oph-toolbar">
          {[
            { label: 'Medication prescription', tab: 'Prescription', screen: 'OPD Prescription' },
            { label: 'Laboratory orders', tab: 'Lab Orders', screen: 'OPD Clinical Orders' },
            { label: 'Imaging orders', tab: 'Imaging Orders', screen: 'OPD Clinical Orders' },
            { label: 'Referral', tab: 'Referral', screen: 'OPD Referral' },
            { label: 'Follow-up', tab: 'Follow-up', screen: 'OPD Follow-up' }
          ].filter((entry) => f.canShared(entry.screen)).map((entry) => (
            <button className="doc-btn" type="button" key={entry.tab} onClick={() => f.openShared(entry.tab, entry.screen)}>{entry.label}</button>
          ))}
        </div>
        <p>New investigations, medication and continuing care remain linked to this encounter. Test completion, clinician review, optical approval and consultation completion are separate actions.</p>
        <p>Historical comparisons, IOP comparison graphs and optical print/share are unavailable in this view.</p>
      </section>
    </section>
  );
}
