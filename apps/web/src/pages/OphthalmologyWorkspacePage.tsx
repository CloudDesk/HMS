import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createContextSchema, subtypeSchema, type OphthalmologyAlert } from '../api/ophthalmology';
import { useOphthalmologyWorkspaceFeature, type OphthalmologyWorkspaceFeature } from '../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { OphthalmologyIntakeForm } from '../components/ophthalmology/OphthalmologyIntakeForm';
import { OphthalmologyTestsWorkspace } from '../components/ophthalmology/OphthalmologyTestsWorkspace';
import '../styles/ophthalmology.css';
import { useOphthalmologyDraftGuard } from '../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { OphthalmologyCompletionWorkspace } from '../components/ophthalmology/OphthalmologyCompletionWorkspace';
import { OphthalmologyCareWorkspace } from '../components/ophthalmology/OphthalmologyCareWorkspace';
import { OphthalmologyContextEditor } from '../components/ophthalmology/OphthalmologyContextEditor';

function ActivateContext({ feature: f }: { feature: OphthalmologyWorkspaceFeature }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<z.infer<typeof createContextSchema>>({ resolver: zodResolver(createContextSchema), defaultValues: { ...(f.subtypeSelected ? { visit_subtype: f.subtype } : {}), configuration_version_id: '', workflow_profile_version_id: '' } });
  useOphthalmologyDraftGuard(isDirty, ['visit_id', 'section', 'subtype']);
  return <form className="doc-card" onSubmit={handleSubmit(async (body) => { await f.create(body); })}><h3>Activate ophthalmology for this encounter</h3><p>Select approved branch configuration. The server checks specialty, visit type and workflow compatibility.</p>
    {!f.canConfigure && <p role="status">Configuration View permission is required to select approved profiles.</p>}
    <fieldset className="oph-fieldset" disabled={!f.canEdit || !f.canConfigure || f.busy}>
      <div className="doc-form-grid two"><label className="doc-field"><span>Visit subtype <span className="oph-required">*</span></span><select {...register('visit_subtype')} onChange={(event) => f.setQuery('subtype', event.target.value)}><option value="">Select compatible subtype</option>{subtypeSchema.options.map((subtype) => <option key={subtype} disabled={!f.availableSubtypes.includes(subtype)}>{subtype}</option>)}</select></label>
        <label className="doc-field">Affected eye <span className="oph-required">*</span><select {...register('affected_eye')}><option value="">Select</option>{['OD', 'OS', 'OU', 'NOT_SPECIFIED'].map((eye) => <option key={eye}>{eye}</option>)}</select></label>
        <label className="doc-field">Completion profile <span className="oph-required">*</span><select {...register('configuration_version_id')}><option value="">Select approved version</option>{f.completions.map((item) => <option key={item.id} value={item.id}>{item.name} · revision {item.revision}</option>)}</select></label>
        <label className="doc-field">Workflow profile <span className="oph-required">*</span><select {...register('workflow_profile_version_id')}><option value="">Select approved version</option>{f.workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {[f.completionQuery, f.workflowsQuery].some((query) => query.isLoading) && <p role="status">Loading profiles…</p>}
      {[f.completionQuery, f.workflowsQuery].some((query) => query.isError) && <p role="alert">Profiles could not be loaded. <button type="button" className="doc-btn" onClick={() => { void f.completionQuery.refetch(); void f.workflowsQuery.refetch(); }}>Retry</button></p>}
      {Object.entries(errors).map(([name, error]) => <p role="alert" key={name}>{name.replaceAll('_', ' ')}: {error.message}</p>)}
      <div className="oph-toolbar"><button type="button" className="doc-btn" disabled={f.configurationPage <= 1} onClick={() => f.setQuery('configuration_page', String(f.configurationPage - 1))}>Previous profiles</button><span>Page {f.configurationPage}</span><button type="button" className="doc-btn" disabled={f.configurationPage >= Math.max(f.completionQuery.data?.meta.totalPages ?? 0, f.workflowsQuery.data?.meta.totalPages ?? 0)} onClick={() => f.setQuery('configuration_page', String(f.configurationPage + 1))}>Next profiles</button><button className="doc-btn primary" type="submit">Activate encounter</button></div>
    </fieldset>
  </form>;
}
const acknowledgementSchema = z.object({ note: z.string().trim().max(1000) });
function EmergencyAlert({ alert, feature: f }: { alert: OphthalmologyAlert; feature: OphthalmologyWorkspaceFeature }) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof acknowledgementSchema>>({ resolver: zodResolver(acknowledgementSchema), defaultValues: { note: '' } });
  return <section className={`doc-card ${alert.status === 'ACTIVE' ? 'oph-emergency' : ''}`}><h3>Emergency review · {alert.status}</h3><p>{alert.reason}</p><p>Triggered {new Date(alert.triggered_at).toLocaleString()} · actor {alert.triggered_by}</p>
    {alert.status === 'ACKNOWLEDGED' ? <p>Acknowledged {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleString() : ''} · actor {alert.acknowledged_by} · {alert.acknowledgement_note || 'No note'}</p> : f.canEscalate && <form onSubmit={handleSubmit(async ({ note }) => { if (window.confirm('Acknowledge this emergency alert? The server requires an eligible ophthalmologist.')) await f.alert(alert, 'acknowledge', note || null); })}><fieldset disabled={f.busy || f.intakeQuery.isError} className="oph-fieldset"><label className="doc-field">Acknowledgement note<textarea {...register('note')} maxLength={1000} /></label>{errors.note && <p role="alert">{errors.note.message}</p>}<div className="oph-toolbar"><button type="button" className="doc-btn" onClick={() => void f.alert(alert, 'route', null)}>Retry clinician routing</button><button type="submit" className="doc-btn">Acknowledge alert</button></div></fieldset></form>}
  </section>;
}
export function OphthalmologyWorkspacePage() {
  const f = useOphthalmologyWorkspaceFeature();
  if (!f.canView) return <div className="doc-card" role="alert">Permission denied. Intake with OPD Visits View, or dedicated Consultation/Optical Prescription View is required.</div>;
  if (!f.visitId) return <div className="doc-card" role="alert">Select a valid OPD encounter to open ophthalmology.</div>;
  if (f.scopeError) return <div className="doc-card" role="alert">The returned clinical record does not match this patient encounter. Reopen the encounter before continuing.</div>;
  if ((f.visitQuery.isError && !f.visit) || (f.contextQuery.isError && !f.context)) return <div className="doc-card" role="alert"><p>The ophthalmology encounter could not be loaded. {f.encounterError}</p><button className="doc-btn" type="button" onClick={() => { void f.visitQuery.refetch(); if (f.visit) void f.contextQuery.refetch(); }}>Retry encounter</button><button className="doc-btn" type="button" onClick={f.back}>Return to consultation</button></div>;
  if (!f.visit || f.contextQuery.isPending) return <p role="status">Loading ophthalmology encounter…</p>;
  return <div className="opd-page oph-workspace"><section className="opd-page-header oph-patient-header"><div><h2>Ophthalmology consultation</h2><p>{f.visit.patient_name} · MRN {f.visit.patient_number} · {f.visit.visit_number}</p><p>OPD: {f.visit.status} · Ophthalmology: {f.context?.workflow_status ?? 'Context not activated'} · {f.context?.visit_subtype ?? f.visit.visit_type} · {f.context?.affected_eye ?? 'Eye not recorded'}</p><p>Consultant: {f.visit.doctor_name} · Priority: {f.visit.priority}</p><p className={f.intakeView?.shared_history.allergies ? 'oph-allergy-alert' : ''}>Allergies: {f.intakeView ? f.intakeView.shared_history.allergies || 'None recorded in shared history' : 'Shared history not loaded'}</p>{Boolean(f.intakeView?.alerts.some((alert) => alert.status === 'ACTIVE')) && <p className="oph-allergy-alert">Emergency review required — see active alerts below.</p>}</div></section>
    {f.context && f.areas && <nav className="oph-consultation-areas" aria-label="Ophthalmology consultation areas">{f.areas.map((area) => <button type="button" key={area.id} className={`doc-btn ${f.selectedArea?.id === area.id ? 'primary' : ''}`} aria-current={f.selectedArea?.id === area.id ? 'page' : undefined} onClick={() => f.openArea(area.id)}>{area.label}</button>)}</nav>}
    {(f.visitQuery.isError || f.contextQuery.isError) && <p className="form-error-banner" role="alert">The encounter could not be refreshed. Entries are retained; editing is disabled. {f.encounterError}<button className="doc-btn" type="button" onClick={() => { void f.visitQuery.refetch(); void f.contextQuery.refetch(); }}>Retry encounter</button></p>}
    {f.actionError && !f.intakeView && <p className="form-error-banner" role="alert">{f.actionError}</p>}
    {f.context && <div className="oph-toolbar">{f.canViewClinical && <button className="doc-btn" type="button" onClick={() => f.openClinical('treatment')}>Clinical review and treatment</button>}{f.canViewOptical && <button className="doc-btn" type="button" onClick={() => f.openClinical('optical')}>Optical prescription</button>}</div>}
    {f.canViewQueue && <button className="doc-btn" type="button" onClick={f.openQueue}>Open encounter test queue</button>}
    {f.context && f.canEdit && <button className="doc-btn" type="button" disabled={f.busy} onClick={() => f.setQuery('edit_context', 'open')}>Edit encounter context</button>}
    {f.context && f.contextEditOpen && <OphthalmologyContextEditor key={`${f.visitId}-${f.context.id}`} feature={f} context={f.context} />}
    {f.contextQuery.data === null && <ActivateContext key={`${f.visitId}-${f.subtype}`} feature={f} />}
    {f.context && f.intakeQuery.isLoading && <p role="status">Loading intake…</p>}
    {f.context && f.intakeQuery.isError && <p className="form-error-banner" role="alert">Intake could not be refreshed. Editing is disabled. <button className="doc-btn" type="button" onClick={() => void f.intakeQuery.refetch()}>Retry intake</button></p>}
    {f.context && f.intakeView && !f.contextEditOpen && f.section === 'intake' && <OphthalmologyIntakeForm key={`${f.visitId}-${f.context.id}`} context={f.context} view={f.intakeView} feature={f} />}
    {f.context && !f.contextEditOpen && f.section === 'tests' && <OphthalmologyTestsWorkspace workspace={f} />}
    {f.context && !f.contextEditOpen && f.section === 'completion' && <OphthalmologyCompletionWorkspace key={`${f.visitId}-${f.context.id}`} workspace={f} />}
    {f.context && !f.contextEditOpen && f.section === 'clinical' && <OphthalmologyCareWorkspace key={`${f.visitId}-${f.context.id}`} workspace={f} />}
    {f.context && f.section === 'overview' && <section className="doc-card"><h3>Patient Summary</h3><p>{f.visit.reason || 'Visit reason not recorded'}</p><p>{f.visit.notes || 'No encounter notes recorded'}</p>{f.intakeView && <dl>{Object.entries(f.intakeView.shared_history).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>}<p>Intake: {f.intakeView?.intake?.status ?? 'Not saved'}</p></section>}
    {f.context && f.section === 'shared' && f.selectedArea && <section className="doc-card"><h3>{f.selectedArea.label}</h3><p>This area continues in the existing OPD encounter. Specialty clinical care is available through the clinical-review and optical-prescription controls. Diagnosis editing and final consultation completion retain their separate workflow requirements.</p>{'tab' in f.selectedArea && <button type="button" className="doc-btn primary" onClick={() => { if (f.selectedArea && 'tab' in f.selectedArea) f.openShared(f.selectedArea.tab); }}>Open existing {f.selectedArea.tab}</button>}</section>}
    {f.intakeView?.alerts.map((alert) => <EmergencyAlert key={alert.id} alert={alert} feature={f} />)}
  </div>;
}
