import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OphthalmologyPublicationTools } from './OphthalmologyPublicationTools';
import { OphthalmologyDiagnosisEditor } from './OphthalmologyDiagnosisEditor';
import { useOphthalmologyCareFeature, type CareWorkspace, type OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { OphthalmologyClinicalReviewEditor } from './OphthalmologyClinicalReviewEditor';
import { OphthalmologyOpticalEditor } from './OphthalmologyOpticalEditor';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
import { useDepartmentsList } from '../../hooks/departments/useDepartments';
import { useDoctorsList } from '../../hooks/doctors/useDoctors';
import { useServicesList } from '../../hooks/services/useServices';
import { NewProcedureRecommendationModal } from '../surgery/NewProcedureRecommendationModal';
import { OphthalmologySharedCareSection, type SharedCareTab } from './OphthalmologySharedCareSection';
import { OphthalmologyEmergencyClearance } from './OphthalmologyEmergencyClearance';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';

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
      {f.workspace?.canEscalate && (
        <button
          type="button"
          className="doc-btn doc-btn-danger"
          disabled={changed || f.busy || isSubmitting}
          onClick={async () => {
            const reason = window.prompt(`Emergency escalation reason for diagnostic finding (${task.test_name}):`);
            if (reason && reason.trim() && f.workspace?.escalate) {
              await f.workspace.escalate(reason.trim(), ['DIAGNOSTIC_REVIEW_FINDING'], 'EMERGENCY');
            }
          }}
        >
          <i className="ph ph-warning-bold" style={{ marginRight: '4px' }} />
          Escalate Emergency from Result
        </button>
      )}
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

export function OphthalmologyCareWorkspace({
  workspace,
  mode = 'treatment',
}: {
  workspace: CareWorkspace;
  mode?: 'treatment' | 'optical' | 'orders' | 'continuing-care';
}) {
  const f = useOphthalmologyCareFeature(workspace);
  const queryClient = useQueryClient();

  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [procedureInitialReason, setProcedureInitialReason] = useState('');

  const branchId = workspace.visit?.branch_id ?? '';
  const departmentsQuery = useDepartmentsList({ status: 'ACTIVE', page: 1, limit: 100 }, Boolean(branchId));
  const doctorsQuery = useDoctorsList({ branch_id: branchId });
  const servicesQuery = useServicesList(
    { status: 'ACTIVE', service_type: 'PROCEDURE', page: 1, limit: 100 },
    Boolean(branchId)
  );

  const departments = departmentsQuery.data?.data ?? [];
  const doctors = doctorsQuery.data?.data ?? [];
  const procedureServices = servicesQuery.data?.data ?? [];

  const handleOpenProcedure = (initialReason?: string) => {
    setProcedureInitialReason(initialReason || '');
    setProcedureModalOpen(true);
  };

  if (!workspace.canView) return <p role="alert">Consultation View or Optical Prescription View permission is required.</p>;
  if (workspace.scopeError || f.scopeError) return <p role="alert">Scope verification failed for this patient encounter. Open an authorised encounter context.</p>;

  // Dedicated Optical Prescription Mode (Tab 4: Optical Prescription)
  if (mode === 'optical') {
    return (
      <section>
        {!f.canOptical && <p role="alert">Ophthalmology Optical Prescription View permission is required.</p>}
        {f.canOptical && (
          <>
            {f.opticalQuery.isLoading && <p role="status">Loading optical prescription…</p>}
            {f.opticalQuery.isError && (
              <p role="alert">Optical prescription could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.opticalQuery.refetch()}>Retry optical prescription</button></p>
            )}
            {f.configurationQuery.isError && (
              <p role="alert">The active configuration could not be verified. <button type="button" className="doc-btn" onClick={() => void f.configurationQuery.refetch()}>Retry configuration</button></p>
            )}
            {(f.opticalQuery.isSuccess || f.opticalQuery.data !== undefined) && (
              <OphthalmologyOpticalEditor key={workspace.context?.id} feature={f} workspace={workspace} />
            )}
          </>
        )}
      </section>
    );
  }

  // Dedicated Prescriptions & Orders Mode (Tab 3: Prescriptions & Diagnostic Orders)
  if (mode === 'orders') {
    const validOrderTabs: SharedCareTab[] = ['prescription', 'lab-orders', 'imaging-orders'];
    const activeTab: SharedCareTab = validOrderTabs.includes(f.tab as SharedCareTab)
      ? (f.tab as SharedCareTab)
      : 'prescription';
    return (
      <section>
        <OphthalmologySharedCareSection
          workspace={workspace}
          feature={f}
          mode="orders"
          activeSharedTab={activeTab}
          onTabChange={(tab) => workspace.setQuery('care_tab', tab)}
          onReturnToTreatment={() => workspace.setQuery('care_tab', 'treatment')}
        />
      </section>
    );
  }

  // Dedicated Continuing Care Mode (Tab 5: Referral & Follow-up)
  if (mode === 'continuing-care') {
    const activeTab: SharedCareTab = f.tab === 'follow-up' ? 'follow-up' : 'referral';
    return (
      <section>
        <OphthalmologySharedCareSection
          workspace={workspace}
          feature={f}
          mode="continuing-care"
          activeSharedTab={activeTab}
          onTabChange={(tab) => workspace.setQuery('care_tab', tab)}
          onReturnToTreatment={() => workspace.setQuery('care_tab', 'treatment')}
        />
      </section>
    );
  }

  // Step 2: Diagnosis & Treatment Plan Mode
  return (
    <section>
      {/* If reviewing a specific test result, show a return button */}
      {f.tab === 'results' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className="doc-btn"
            style={{ fontWeight: 600, fontSize: '0.82rem' }}
            onClick={() => workspace.setQuery('care_tab', 'treatment')}
          >
            ← Back to Diagnosis &amp; Treatment Plan
          </button>
        </div>
      )}

      {/* Quick Encounter Action Bar */}
      {f.tab === 'treatment' && f.canClinical && (
        <div className="oph-care-quick-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Quick Actions:
            </span>
            <button
              type="button"
              className="doc-btn"
              style={{ fontSize: '0.78rem', background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 600 }}
              onClick={() => handleOpenProcedure()}
            >
              ✂️ + Recommend Surgery / Procedure
            </button>
            <button
              type="button"
              className="doc-btn"
              style={{ fontSize: '0.78rem' }}
              onClick={() => workspace.setQuery('care_tab', 'prescription')}
            >
              💊 Prescriptions &amp; Orders →
            </button>
            <button
              type="button"
              className="doc-btn"
              style={{ fontSize: '0.78rem' }}
              onClick={() => workspace.setQuery('care_tab', 'optical')}
            >
              👓 Optical Prescription →
            </button>
            <button
              type="button"
              className="doc-btn"
              style={{ fontSize: '0.78rem' }}
              onClick={() => workspace.setQuery('care_tab', 'referral')}
            >
              🔄 Referral &amp; Follow-up →
            </button>
          </div>
        </div>
      )}

      {workspace.emergencyAlerts && workspace.emergencyAlerts.length > 0 && (
        <OphthalmologyEmergencyClearance feature={workspace as unknown as OphthalmologyWorkspaceFeature} />
      )}

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

          {/* Diagnosis Structured Editor */}
          {f.consultation && f.showDiagnosisEditor && (
            <OphthalmologyDiagnosisEditor
              key={`${workspace.visitId}:${f.consultation.id || 'draft'}`}
              record={f.consultation}
              canEdit={f.canEditDiagnosis}
            />
          )}

          {/* Active Diagnostic Assessment Card */}
          <section className="doc-card oph-saved-assessment-card">
            <div className="oph-diag-header" style={{ marginBottom: '12px' }}>
              <div className="oph-diag-title-group">
                <div className="oph-diag-icon-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
                    Active Diagnostic Assessment
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Authenticated diagnosis records linked to this patient&apos;s OPD encounter.
                  </p>
                </div>
              </div>
              <span className="oph-status-badge version">
                Consultation v{f.consultation?.version ?? 0}
              </span>
            </div>

            {/* Assessment Narrative */}
            {f.consultation?.assessment ? (
              <div className="oph-assessment-narrative-box">
                <strong style={{ fontSize: '0.78rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Doctor&apos;s Assessment
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#1e293b', fontStyle: 'italic' }}>
                  &ldquo;{f.consultation.assessment}&rdquo;
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.84rem', color: '#64748b', fontStyle: 'italic', margin: '4px 0 12px' }}>
                No clinical assessment narrative recorded yet.
              </p>
            )}

            {/* Diagnoses List */}
            {f.diagnoses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {f.diagnoses.map((diag, index) => (
                  <div key={index} className="oph-saved-diagnosis-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`oph-eye-badge lat-${(diag.laterality ?? 'na').toLowerCase()}`}>
                        {diag.laterality ?? 'OU'}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                        {diag.display}
                      </strong>
                      <span className="oph-code-badge">{diag.code}</span>
                      <span className={`oph-status-pill status-${(diag.status ?? 'confirmed').toLowerCase().replace('_', '-')}`}>
                        {diag.status ?? 'CONFIRMED'}
                      </span>
                      <span className="oph-type-badge">
                        {diag.type}
                      </span>
                      {diag.differential && (
                        <span className="oph-diff-badge">Differential</span>
                      )}
                    </div>
                    {(diag.severity || diag.stage || diag.notes) && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', marginLeft: '32px' }}>
                        {diag.severity && <span>Severity: <strong>{diag.severity}</strong> · </span>}
                        {diag.stage && <span>Stage: <strong>{diag.stage}</strong> · </span>}
                        {diag.notes && <span style={{ fontStyle: 'italic' }}>{diag.notes}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="oph-empty-diagnoses-prompt">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: '#475569', fontSize: '0.88rem' }}>
                    No diagnoses saved yet
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Use the Structured Ophthalmic Diagnoses editor above to add condition codes and laterality.
                  </p>
                </div>
              </div>
            )}

            {/* Diagnosis History Audit Accordion */}
            {f.consultation?.clinical_history && f.consultation.clinical_history.length > 0 && (
              <details className="oph-audit-accordion" style={{ marginTop: '1rem' }}>
                <summary className="oph-audit-summary">
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#475569' }}>
                    📜 Diagnostic Revision History ({f.consultation.clinical_history.length} versions)
                  </span>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>View revisions</span>
                </summary>
                <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {f.consultation.clinical_history.map((entry) => (
                    <div key={entry.consultation_version} style={{ padding: '6px 10px', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong>Version {entry.consultation_version}</strong>
                        <span style={{ color: '#64748b' }}>{new Date(entry.changed_at).toLocaleString()} · {entry.changed_by}</span>
                      </div>
                      {entry.diagnoses.map((diagnosis, idx) => (
                        <div key={idx} style={{ color: '#475569', marginLeft: '6px' }}>
                          • {diagnosis.code} · {diagnosis.display} ({diagnosis.laterality ?? 'OU'} · {diagnosis.status ?? 'Status not recorded'})
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          {/* Treatment Plan Editor with Procedure Recommendation Callback */}
          {(f.clinicalQuery.isSuccess || f.clinicalQuery.data !== undefined) && (
            <OphthalmologyClinicalReviewEditor
              key={workspace.context?.id}
              feature={f}
              onOpenProcedureModal={handleOpenProcedure}
            />
          )}
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

      {/* Continuing Care & Downstream Workflows Navigation Card */}
      {f.tab === 'treatment' && (
        <section className="doc-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Next Clinical Steps &amp; Downstream Care
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Advance through prescriptions, optical correction, specialist handoffs, and final consultation sign-off.
              </p>
            </div>
          </div>

          <div className="oph-toolbar" style={{ marginTop: '12px' }}>
            {/* Direct Procedure / Surgery Button */}
            <button
              className="doc-btn primary"
              type="button"
              style={{ background: '#4f46e5', borderColor: '#4338ca', color: '#ffffff', fontWeight: 600 }}
              onClick={() => handleOpenProcedure()}
            >
              ✂️ + Recommend Surgery / Procedure
            </button>
            <button
              className="doc-btn"
              type="button"
              onClick={() => workspace.setQuery('care_tab', 'prescription')}
            >
              💊 Step 3: Prescriptions &amp; Orders →
            </button>
            <button
              className="doc-btn"
              type="button"
              onClick={() => workspace.setQuery('care_tab', 'optical')}
            >
              👓 Step 4: Optical Prescription →
            </button>
            <button
              className="doc-btn"
              type="button"
              onClick={() => workspace.setQuery('care_tab', 'referral')}
            >
              🔄 Step 5: Referral &amp; Follow-up →
            </button>
            <button
              className="doc-btn"
              type="button"
              onClick={() => workspace.setQuery('section', 'completion')}
            >
              📋 Step 6: Consultation Summary →
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 0' }}>
            All orders, surgical recommendations, and continuing care remain strictly linked to this encounter context without navigating away.
          </p>
        </section>
      )}

      {/* Modal: New Procedure Recommendation (Shared Surgery Modal) */}
      <NewProcedureRecommendationModal
        requireTargetEye
        open={procedureModalOpen}
        onClose={() => setProcedureModalOpen(false)}
        branchId={branchId}
        departments={departments}
        doctors={doctors}
        services={procedureServices}
        initialContext={{
          patient: {
            id: workspace.visit?.patient_id ?? '',
            patient_number: (workspace.visit as { patient_number?: string })?.patient_number ?? '',
            name: (workspace.visit as { patient_name?: string })?.patient_name ?? 'Patient',
          },
          department_id: workspace.visit?.department_id,
          recommending_doctor_id: (workspace.visit as { doctor_id?: string })?.doctor_id,
          encounter_id: workspace.visitId,
          clinical_reason: procedureInitialReason || f.diagnoses.map((d) => `${d.display} (${d.code}) - ${d.laterality ?? 'OU'}`).join('; ') || (workspace.visit as { reason?: string })?.reason || '',
          target_eye: (f.diagnoses.find((d) => d.laterality && ['OD', 'OS', 'OU'].includes(d.laterality))?.laterality as 'OD' | 'OS' | 'OU') || (workspace.context?.affected_eye && ['OD', 'OS', 'OU'].includes(workspace.context.affected_eye) ? (workspace.context.affected_eye as 'OD' | 'OS' | 'OU') : undefined),
          sourceContext: 'Ophthalmology Consultation',
        }}
        onCreateSuccess={() => {
          toast.success('Procedure recommendation created and linked to this encounter.');
          void f.clinicalQuery.refetch();
          void queryClient.invalidateQueries({ queryKey: ['ophthalmology-summary', workspace.visitId] });
        }}
      />
    </section>
  );
}
