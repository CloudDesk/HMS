import { useOphthalmologyComparisonFeature } from '../../hooks/ophthalmology/useOphthalmologyComparisonFeature';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import type { OphthalmologyResultWorkspace } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';
import { useOphthalmologyResultFeature, type OphthalmologyResultFeature } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';
import { resultFields, resultReferenceFields, entryValues, fieldEntryKey, deriveResultValues, mergeResultEntries, profileForm, readPath, resultEditorSchema, type ResultEditorValues } from '../../hooks/ophthalmology/result-fields';
import type { OphthalmologyTask, OphthalmologyResult, TestFormType } from '../../api/ophthalmology';
import { useAppLocation } from '../../routing/navigation';
import { configuredResultFields, unavailableRequiredPaths } from '../../hooks/ophthalmology/configured-result-fields';
import { OphthalmologyResultAttachments } from './OphthalmologyResultAttachments';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { removeAcquisition, resultAcquisitions, selectedDocuments } from '../../hooks/ophthalmology/result-acquisitions';
import { OphthalmologyExaminationDashboard } from './OphthalmologyExaminationDashboard';

type EditorProps = { f: OphthalmologyResultFeature; workspace: OphthalmologyResultWorkspace; task: OphthalmologyTask; result: OphthalmologyResult | null; profileId: string; profile: Record<string, unknown>; formType: TestFormType; schemaVersion: string };
function CoreResultEditor({ f, workspace, task: latestTask, result: latestResult, profileId, profile: latestProfile, formType, schemaVersion }: EditorProps) {
  // The editing base changes only on explicit reload or a confirmed save.
  // Background query updates must never advance the version of a dirty form.
  const [profile] = useState(latestProfile);
  const [baseline, setBaseline] = useState({ task: latestTask, result: latestResult });
  const { task, result } = baseline;
  const serverChanged = latestTask.version !== task.version || latestResult?.version !== result?.version;
  const [payload, setPayload] = useState(result?.current.payload ?? {});
  const [additionalReadings, setAdditionalReadings] = useState<Record<string, number>>({});
  const acquisitions = useMemo(() => resultAcquisitions(formType, task.laterality, payload, additionalReadings), [formType, task.laterality, payload, additionalReadings]);
  const allFields = useCallback((data: Record<string, unknown>, extra: Record<string, number> = {}) => configuredResultFields(formType, task.laterality, [...resultFields(formType, task.laterality, data, extra).filter((field) => formType !== 'FUNDUS_PHOTOGRAPHY' || !field.path.startsWith('image_sets.')), ...resultAcquisitions(formType, task.laterality, data, extra).fields, ...resultReferenceFields(formType, task.laterality, data, extra)], profile), [formType, task.laterality, profile]);
  const fields = useMemo(() => allFields(payload, additionalReadings), [allFields, payload, additionalReadings]);
  const unavailableFields = unavailableRequiredPaths(fields, payload, profile);
  const fundusConfigured = formType !== 'POSTERIOR_FUNDUS_EXAM' || fields.some((field) => /^eyes\.(OD|OS)\.(optic_disc|macula|retina|media|vitreous|fovea|vessels)\./.test(field.path));
  const editorDefaults = useCallback((record: OphthalmologyResult | null) => ({ profile_id: profileId, performed_at: record?.current.performed_at ?? '', ...(record ? { reliability: record.current.reliability } : {}), reliability_reason: record?.current.reliability_reason ?? '', comments: record?.current.comments ?? '', amendment_reason: '', document_ids: record?.current.document_ids ?? [], entries: entryValues(allFields(record?.current.payload ?? {}), record?.current.payload ?? {}) }), [profileId, allFields]);
  const defaults = useMemo(() => editorDefaults(result), [editorDefaults, result]);
  const { register, control, handleSubmit, reset, getValues, setValue, setError, formState: { errors, isDirty, isSubmitting } } = useForm<ResultEditorValues>({ resolver: zodResolver(resultEditorSchema), defaultValues: defaults });
  const values = useWatch({ control });
  const savedVersion = useRef(result?.version ?? null);
  useEffect(() => { if (!isDirty && (savedVersion.current === null || (result && result.version >= savedVersion.current))) reset(defaults); }, [defaults, isDirty, reset, result]);
  const dirty = isDirty || Object.values(additionalReadings).some((count) => count > 0) || JSON.stringify(payload) !== JSON.stringify(result?.current.payload ?? {});
  useOphthalmologyDraftGuard(dirty, ['visit_id', 'section', 'area', 'task_id', 'form_profile_id', 'amend', 'edit_context']);
  const disabled = !f.canEdit || f.busy || isSubmitting;
  const supportsComparison = formType === 'VISUAL_FIELD' || formType === 'OCT';
  const comparisons = useOphthalmologyComparisonFeature(task.id, result?.id ?? null, result?.version ?? 0, supportsComparison && f.canEdit && !dirty && !serverChanged && !f.busy);
  const changeTask = (id: string) => { workspace.setQuery('task_id', id); };
  return <form onSubmit={handleSubmit(async (values) => {
    if (!f.amending && task.status !== 'IN_PROGRESS' && task.status !== 'DRAFT') return;
    if (f.amending && (!result || !values.amendment_reason?.trim())) { setError('amendment_reason', { message: 'Record the reason for this correction.' }); return; }
    try {
      const edited = deriveResultValues(formType, mergeResultEntries(fields, values.entries, payload, profile));
      const common = { expected_task_version: task.version, form_type: formType, form_schema_version: schemaVersion, form_profile_version_id: values.profile_id, performed_at: values.performed_at, reliability: values.reliability, reliability_reason: values.reliability_reason.trim() || null, comments: values.comments.trim() || null, document_ids: values.document_ids ?? result?.current.document_ids ?? [], payload: edited };
      const saved = f.amending && result ? await f.amend({ ...common, expected_task_status: 'COMPLETED', expected_result_version: result.version, source_type: 'MANUAL_CORRECTION', reason: values.amendment_reason ?? '' }) : task.status === 'IN_PROGRESS' || task.status === 'DRAFT' ? await f.save({ ...common, expected_task_status: task.status, expected_result_version: result?.version ?? null, source_type: 'MANUAL' }) : undefined;
      if (saved) {
        savedVersion.current = saved.version; setAdditionalReadings({});
        const fresh = await f.reload();
        const confirmed = fresh?.result?.version === saved.version ? fresh : { task, result: saved };
        setBaseline(confirmed); setPayload(confirmed.result?.current.payload ?? {}); reset(editorDefaults(confirmed.result));
      }
    } catch (cause) { setError('root', { message: cause instanceof Error ? cause.message : 'Check the result values.' }); }
  })}>
    <div className="oph-toolbar"><strong>{task.test_name} · {task.laterality} · {task.status}</strong><span>{dirty ? 'Unsaved result changes' : 'No unsaved result changes'}</span>
      {f.canAmend && <button type="button" className="doc-btn" disabled={f.busy} onClick={() => { workspace.setQuery('amend', f.amending ? '0' : '1'); }}>{f.amending ? 'Leave correction mode' : 'Correct completed result'}</button>}
      <button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={async () => { if (!dirty || window.confirm('Discard unsaved changes and reload the saved result?')) { const fresh = await f.reload(); if (fresh) { savedVersion.current = fresh.result?.version ?? null; setAdditionalReadings({}); setBaseline(fresh); setPayload(fresh.result?.current.payload ?? {}); reset(editorDefaults(fresh.result)); } } }}>Reload result</button>
      <button type="button" className="doc-btn" disabled={f.busy} onClick={() => { workspace.setQuery('section', 'intake'); }}>{workspace.returnLabel ?? 'Return to intake'}</button>
    </div>
    <label className="doc-field">Existing task on this page<select value={task.id} disabled={f.busy} onChange={(event) => changeTask(event.target.value)}>{!f.tasks.some((item) => item.id === task.id) && <option value={task.id}>{task.test_name}</option>}{f.tasks.map((item) => <option value={item.id} key={item.id}>{item.test_name} · {item.laterality} · {item.status}</option>)}</select></label>
    {f.error && <p className="form-error-banner" role="alert">{f.error} Entries are retained. Reload stale records before retrying.</p>}
    {serverChanged && <p className="form-error-banner" role="alert">The server record has changed. Your editing version and entries are preserved. Reload the saved record before completing; a stale save will be rejected.</p>}
    {Object.entries(errors).map(([name, error]) => <p className="form-error-banner" key={name} role="alert">{name}: {typeof error.message === 'string' ? error.message : 'Check the entries.'}</p>)}
    <p>Form {formType} · schema {schemaVersion} · task version {task.version} · result version {result?.version ?? 'not saved'}. Station {task.station_id ?? 'unassigned'} · performer {result?.current.performer_user_id ?? task.assigned_user_id ?? 'unassigned'} · device {task.device_code ?? 'not recorded'}.</p>
    <p>This form supports partial data entry. Existing detailed findings, attachment references and history are preserved. Approved profile rules enable additional measurement and choice fields. Unsupported detailed structures remain read-only; missing required controls prevent completion.</p>
    {!fundusConfigured && <p role="status">Detailed fundus input definitions are missing from this profile. Completion is unavailable until approved clinical controls are configured.</p>}
    {supportsComparison && <section className="doc-card"><h3>Previous result comparison</h3><p>Save the current measurements before loading prior versions. Only compatible completed versions can be selected. Outcome is an explicit clinical decision.</p><label className="doc-field">Comparison outcome<select disabled={disabled} value={values.entries?.[fieldEntryKey('comparison.outcome')] ?? ''} onChange={(event) => {
      setValue(`entries.${fieldEntryKey('comparison.outcome')}`, event.target.value, { shouldDirty: true });
      if (event.target.value === 'NOT_COMPARED') for (const path of ['comparison.result_id', 'comparison.clinical_version']) setValue(`entries.${fieldEntryKey(path)}`, '', { shouldDirty: true });
    }}><option value="">Not recorded</option>{['STABLE', 'IMPROVED', 'WORSENED', 'NOT_COMPARED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <p>Selected prior result: {values.entries?.[fieldEntryKey('comparison.result_id')] || 'None'} · clinical version {values.entries?.[fieldEntryKey('comparison.clinical_version')] || 'None'}</p>
      <button type="button" className="doc-btn" disabled={!result || dirty || serverChanged || disabled} onClick={() => workspace.setQuery('comparison_lookup', comparisons.open ? 'closed' : 'open')}>{comparisons.open ? 'Hide prior results' : 'Load prior results'}</button>
      {comparisons.open && (dirty || serverChanged) && <p role="status">Save or reload before loading compatible prior versions.</p>}
      {comparisons.open && comparisons.query.isLoading && <p role="status">Loading prior results…</p>}
      {comparisons.open && comparisons.query.isError && <p role="alert">Prior results could not be loaded. <button type="button" className="doc-btn" disabled={dirty || serverChanged || disabled} onClick={() => void comparisons.query.refetch()}>Retry prior results</button></p>}
      {comparisons.data && <><p>{comparisons.data.meta.total} prior completed versions · page {comparisons.page}. Incompatible versions are shown with their reason.</p>{comparisons.data.data.length === 0 && <p>No prior completed results.</p>}{comparisons.data.data.map((prior) => <div className="oph-toolbar" key={`${prior.result_id}:${prior.clinical_version}`}><span>{new Date(prior.performed_at).toLocaleString()} · {prior.form_type} · {prior.eye ?? 'Eye not recorded'} · version {prior.clinical_version} · {prior.eligible ? 'Compatible' : prior.reason?.replaceAll('_', ' ')}</span><button type="button" className="doc-btn" disabled={disabled || !comparisons.canSelect || !prior.eligible} onClick={() => {
        setValue(`entries.${fieldEntryKey('comparison.result_id')}`, prior.result_id, { shouldDirty: true }); setValue(`entries.${fieldEntryKey('comparison.clinical_version')}`, String(prior.clinical_version), { shouldDirty: true });
        if (getValues(`entries.${fieldEntryKey('comparison.outcome')}`) === 'NOT_COMPARED') setValue(`entries.${fieldEntryKey('comparison.outcome')}`, '', { shouldDirty: true });
      }}>Use prior version</button></div>)}<div className="oph-toolbar"><button type="button" className="doc-btn" disabled={comparisons.page <= 1 || !comparisons.canSelect} onClick={() => workspace.setQuery('comparison_page', String(comparisons.page - 1))}>Previous comparisons</button><button type="button" className="doc-btn" disabled={comparisons.page >= comparisons.data.meta.totalPages || !comparisons.canSelect} onClick={() => workspace.setQuery('comparison_page', String(comparisons.page + 1))}>Next comparisons</button></div></>}
    </section>}
    {acquisitions.groups.length > 0 && <fieldset disabled={disabled} className="oph-fieldset"><section className="doc-card"><h3>Repeated observations</h3><p>Each code position uses its approved profile choices. Existing observations remain until explicitly removed.</p>{acquisitions.groups.map((group) => <div className="oph-toolbar" key={group.path}><span>{group.label} · {group.count} rows</span><button type="button" className="doc-btn" disabled={group.count >= group.maximum} onClick={() => { setAdditionalReadings((previous) => ({ ...previous, [group.path]: (previous[group.path] ?? 0) + 1 })); setValue('comments', getValues('comments'), { shouldDirty: true }); }}>Add {group.label}</button>{group.count > (group.path === 'image_sets' ? 1 : 0) && <button type="button" className="doc-btn" onClick={() => {
      if (!window.confirm(`Remove the last ${group.label} row? Save the draft to persist this change.`)) return;
      try {
        const edited = mergeResultEntries(fields, getValues('entries'), payload, profile);
        const rows = readPath(edited, group.path);
        if ((!Array.isArray(rows) || rows.length < group.count) && (additionalReadings[group.path] ?? 0) > 0) {
          const prefix = fieldEntryKey(`${group.path}.${group.count - 1}`);
          setValue('entries', Object.fromEntries(Object.entries(getValues('entries')).filter(([key]) => key !== prefix && !key.startsWith(`${prefix}__`))), { shouldDirty: true });
          setAdditionalReadings((previous) => ({ ...previous, [group.path]: Math.max(0, (previous[group.path] ?? 0) - 1) })); return;
        }
        const next = removeAcquisition(edited, group.path, group.count - 1);
        setPayload(next); setAdditionalReadings({}); reset({ ...getValues(), entries: entryValues(allFields(next), next) }, { keepDefaultValues: true });
      } catch (cause) { setError('root', { message: cause instanceof Error ? cause.message : 'Check the acquisition rows.' }); }
    }}>Remove last {group.label}</button>}</div>)}</section></fieldset>}
    {unavailableFields.length > 0 && <p role="alert">Required clinical controls need configuration: {unavailableFields.join(', ')}. Existing data remains preserved.</p>}
    {['CONTACT_LENS', 'PAEDIATRIC_VISION'].includes(formType) && <section className="doc-card"><div className="oph-toolbar"><button type="button" className="doc-btn" onClick={() => workspace.setQuery('clinical_lookups', f.lookupsOpen ? 'closed' : 'open')}>{f.lookupsOpen ? 'Hide clinical catalogues' : 'Load approved clinical catalogues'}</button>{f.lookupsOpen && <><button type="button" className="doc-btn" disabled={workspace.configurationPage <= 1} onClick={() => workspace.setQuery('configuration_page', String(workspace.configurationPage - 1))}>Previous catalogue page</button><span>Page {workspace.configurationPage}</span><button type="button" className="doc-btn" disabled={workspace.configurationPage >= Math.max(f.productsQuery?.data?.meta.totalPages ?? 0, f.drugsQuery?.data?.meta.totalPages ?? 0)} onClick={() => workspace.setQuery('configuration_page', String(workspace.configurationPage + 1))}>Next catalogue page</button></>}</div>{f.lookupsOpen && (f.productsQuery?.isError || f.drugsQuery?.isError) && <p role="alert">Clinical catalogues could not be loaded. <button className="doc-btn" type="button" onClick={() => { if (formType === 'CONTACT_LENS') void f.productsQuery.refetch(); else void f.drugsQuery.refetch(); }}>Retry catalogue</button></p>}</section>}
    {['AUTOREFRACTION_KERATOMETRY', 'INTRAOCULAR_PRESSURE', 'PACHYMETRY'].includes(formType) && <fieldset className="oph-fieldset" disabled={disabled}><div className="oph-toolbar">{(task.laterality === 'OD' ? ['OD'] : task.laterality === 'OS' ? ['OS'] : ['OD', 'OS']).map((eye) => <button className="doc-btn" type="button" key={eye} onClick={() => setAdditionalReadings((current) => ({ ...current, [eye]: (current[eye] ?? 0) + 1 }))}>Add {eye} source reading</button>)}</div><p>Retained source readings remain in the record. Enter the selected reading index to calculate final IOP or spherical equivalent when saving.</p></fieldset>}
    <fieldset className="oph-fieldset" disabled={disabled}><section className="doc-card"><h3>Acquisition and reliability</h3><div className="doc-form-grid two">
      <label className="doc-field"><span>Performed time <span className="oph-required">*</span></span><input type="datetime-local" value={values.performed_at && !Number.isNaN(Date.parse(values.performed_at)) ? format(new Date(values.performed_at), "yyyy-MM-dd'T'HH:mm") : ''} onChange={(event) => setValue('performed_at', event.target.value ? new Date(event.target.value).toISOString() : '', { shouldDirty: true })} /></label>
      <label className="doc-field"><span>Reliability <span className="oph-required">*</span></span><select {...register('reliability')}><option value="">Select</option>{['GOOD', 'FAIR', 'POOR'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="doc-field">Reliability reason<input maxLength={1000} {...register('reliability_reason')} /></label><label className="doc-field">Comments<textarea maxLength={4000} {...register('comments')} /></label>
      {f.amending && <label className="doc-field"><span>Correction reason <span className="oph-required">*</span></span><textarea maxLength={1000} {...register('amendment_reason')} /></label>}
    </div></section><section className="doc-card"><h3>Structured observations</h3><div className="doc-form-grid two">{fields.filter((descriptor) => !supportsComparison || !descriptor.path.startsWith('comparison.')).map((descriptor) => {
      const configured = profile.allowed_values && typeof profile.allowed_values === 'object' ? Reflect.get(profile.allowed_values, descriptor.path) : undefined;
      const options = descriptor.options ?? (Array.isArray(configured) ? configured.filter((value): value is string => typeof value === 'string') : []);
      const current = readPath(payload, descriptor.path);
      const calculated = (formType === 'INTRAOCULAR_PRESSURE' && descriptor.path.startsWith('final_iop.')) || (formType === 'AUTOREFRACTION_KERATOMETRY' && descriptor.path.startsWith('spherical_equivalent.')) || (formType === 'PACHYMETRY' && descriptor.path.startsWith('average_thickness.')) || (formType === 'COLOUR_VISION' && descriptor.path === 'score_percent') || (formType === 'CORNEAL_TOPOGRAPHY' && /\.(average_k|corneal_astigmatism)$/.test(descriptor.path));
      const structured = current != null && !['string', 'boolean', 'number'].includes(typeof current);
      if (descriptor.kind === 'documents') {
        const selected = selectedDocuments(values.entries?.[fieldEntryKey(descriptor.path)]);
        const imageEye = descriptor.eye ?? (descriptor.path.startsWith('image_sets.') ? values.entries?.[fieldEntryKey(descriptor.path.replace('image_document_ids', 'eye'))] : undefined);
        const documents = (f.attachments ?? []).filter((item) => !imageEye || item.laterality === imageEye || item.laterality === 'OU');
        return <fieldset className="oph-document-options" key={descriptor.path}><legend>{descriptor.label}</legend>{selected.filter((id) => !documents.some((item) => item.patient_document_id === id)).map((id) => <label key={id}><input type="checkbox" checked onChange={() => setValue(`entries.${fieldEntryKey(descriptor.path)}`, JSON.stringify(selected.filter((item) => item !== id)), { shouldDirty: true })} /> Saved document {id}</label>)}{documents.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.patient_document_id)} onChange={(event) => setValue(`entries.${fieldEntryKey(descriptor.path)}`, JSON.stringify(event.target.checked ? [...new Set([...selected, item.patient_document_id])] : selected.filter((id) => id !== item.patient_document_id)), { shouldDirty: true })} /> {item.original_file_name} · {item.laterality}</label>)}{!documents.length && <p>Load task attachments below to select compatible documents.</p>}</fieldset>;
      }
      if (descriptor.kind === 'reference') {
        const references = descriptor.referenceType === 'OPTICAL_PRODUCT' ? (f.products ?? []).map((item) => ({ id: item.id, label: `${item.name} · revision ${item.revision}` })) : descriptor.referenceType === 'DRUG_OPTION' ? (f.drugs ?? []).map((item) => ({ id: item.id, label: `${item.name} · revision ${item.revision}` })) : (f.attachments ?? []).map((item) => ({ id: item.patient_document_id, label: `${item.original_file_name} · ${item.laterality} · ${item.review_state}` }));
        return <label className="doc-field" key={descriptor.path}>{descriptor.label}<select disabled={!references.length && typeof current !== 'string'} {...register(`entries.${fieldEntryKey(descriptor.path)}`)}><option value="">Not recorded</option>{typeof current === 'string' && !references.some((item) => item.id === current) && <option value={current}>Saved reference</option>}{references.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>{descriptor.referenceType === 'DOCUMENT' ? 'Load task attachments below to select an existing document.' : 'Load the approved clinical catalogue above.'}</small></label>;
      }
      return <label className="doc-field" key={descriptor.path}>{descriptor.label}{structured ? <span>Saved structured value preserved; this control is unavailable.</span> : descriptor.kind === 'choice' || descriptor.kind === 'boolean' ? <><select disabled={descriptor.kind === 'choice' && !options.length} {...register(`entries.${fieldEntryKey(descriptor.path)}`)}><option value="">Not recorded</option>{current != null && descriptor.kind === 'choice' && !options.includes(String(current)) && <option value={String(current)}>Saved: {String(current)}</option>}{descriptor.kind === 'boolean' ? <><option value="true">Yes</option><option value="false">No</option></> : options.map((value) => <option key={value}>{value}</option>)}</select>{descriptor.kind === 'choice' && !options.length && <small>Approved options are required for new entry.</small>}</> : descriptor.kind === 'instant' ? <input type="datetime-local" value={values.entries?.[fieldEntryKey(descriptor.path)] && !Number.isNaN(Date.parse(values.entries[fieldEntryKey(descriptor.path)] ?? '')) ? format(new Date(values.entries[fieldEntryKey(descriptor.path)] ?? ''), "yyyy-MM-dd'T'HH:mm") : ''} onChange={(event) => setValue(`entries.${fieldEntryKey(descriptor.path)}`, event.target.value ? new Date(event.target.value).toISOString() : '', { shouldDirty: true })} /> : <input readOnly={calculated} title={calculated ? 'Calculated from entered source values on save' : undefined} type={descriptor.kind === 'number' ? 'number' : 'text'} step={descriptor.kind === 'number' ? 'any' : undefined} {...register(`entries.${fieldEntryKey(descriptor.path)}`)} />}</label>;
    })}</div></section><div className="oph-toolbar"><button type="submit" className="doc-btn primary">{f.amending ? 'Save correction as new version' : 'Save result draft'}</button><button type="button" className="doc-btn" disabled={!f.canComplete || dirty || serverChanged || !fundusConfigured || unavailableFields.length > 0} onClick={() => { if (window.confirm('Complete this saved result? The server checks clinical requirements; doctor review remains separate.')) void f.complete(); }}>Complete saved result</button></div></fieldset>
    <OphthalmologyResultAttachments feature={f} workspace={workspace} selectedIds={values.document_ids ?? []} onSelection={(ids) => setValue('document_ids', ids, { shouldDirty: true })} disabled={disabled} />
    {result && <section className="doc-card"><h3>Clinical-version history</h3><p>Current version {result.current_clinical_version} · {result.current.source_type} · {result.current.status}</p><p>Attachments: {result.current.document_ids.length}; prior versions: {result.history.length}</p>{result.history.map((version) => <p key={version.clinical_version}>Version {version.clinical_version} · {version.status} · {new Date(version.performed_at).toLocaleString()} · performer {version.performer_user_id} · {version.amendment_reason ?? 'Original result'}</p>)}</section>}
  </form>;
}
export function OphthalmologyTestsWorkspace({ workspace }: { workspace: OphthalmologyResultWorkspace }) {
  const f = useOphthalmologyResultFeature(workspace);
  const { search } = useAppLocation();
  const profileId = f.result?.current.form_profile_version_id ?? new URLSearchParams(search).get('form_profile_id') ?? '';
  const profile = f.result?.current.form_profile_version_id === profileId ? f.result.current.form_profile_snapshot : f.profiles.find((item) => item.id === profileId)?.values;
  const form = profile && f.task ? profileForm(profile, f.task.test_code) : null;
  if (!f.canView) return <p role="alert">Ophthalmology Test Queue View permission is required.</p>;
  if (f.scopeError) return <p role="alert">The selected task/result does not belong to this encounter. Reopen the task.</p>;
  return <section>
    {!f.taskId && <OphthalmologyExaminationDashboard feature={f} workspace={workspace} />}
    {f.taskId && (
      <div className="oph-toolbar" style={{ marginTop: '20px' }}>
        <h3>Clinical Task Result Editor</h3>
        {workspace.canEscalate && (
          <button
            type="button"
            className="doc-btn doc-btn-danger"
            onClick={async () => {
              const reason = window.prompt(`Emergency escalation reason identified during test assessment (${f.task?.test_name ?? 'Test'}):`);
              if (reason && reason.trim() && workspace.escalate) {
                await workspace.escalate(reason.trim(), ['ASSESSMENT_TEST_FINDING'], 'EMERGENCY');
              }
            }}
          >
            <i className="ph ph-warning-bold" style={{ marginRight: '4px' }} />
            Escalate Emergency Finding
          </button>
        )}
        <button type="button" className="doc-btn" onClick={() => workspace.setQuery('task_id', '')}>
          ← Back to Examination Dashboard
        </button>
      </div>
    )}
    {f.taskId && (f.taskQuery.isLoading || f.resultQuery.isLoading) && <p role="status">Loading test result…</p>}
    {f.taskId && (f.taskQuery.isError || f.resultQuery.isError) && <p role="alert">Task/result could not be loaded. Editing is disabled.<button type="button" className="doc-btn" onClick={() => { void f.taskQuery.refetch(); void f.resultQuery.refetch(); }}>Retry task/result</button></p>}
    {f.task && f.resultLoaded && !f.result && <section className="doc-card"><label className="doc-field">Approved form profile<select value={profileId} onChange={(event) => { if (!profileId || window.confirm('Changing form profile discards unsaved result entries. Continue?')) workspace.setQuery('form_profile_id', event.target.value); }}><option value="">Select matching profile</option>{f.profiles.filter((item) => profileForm(item.values, f.task?.test_code ?? '')).map((item) => <option key={item.id} value={item.id}>{item.name} · revision {item.revision}</option>)}</select></label>{f.profilesQuery.isLoading && <p role="status">Loading form profiles…</p>}{f.profilesQuery.isError && <p role="alert">Form profiles could not be loaded. <button type="button" className="doc-btn" onClick={() => void f.profilesQuery.refetch()}>Retry profiles</button></p>}<p>All 21 form families have initial controls. Detailed substructures and clinical master selections remain pending where noted.</p></section>}
    {f.task && f.resultLoaded && !form && <div className="oph-toolbar"><p>Select a matching form profile to open supported controls.</p><button className="doc-btn" type="button" onClick={() => workspace.setQuery('task_id', '')}>Choose another task</button><button className="doc-btn" type="button" onClick={() => workspace.setQuery('section', 'intake')}>{workspace.returnLabel ?? 'Return to intake'}</button></div>}
    {f.task && form && profile && f.resultLoaded && <CoreResultEditor key={`${workspace.visitId}-${f.taskId}-${profileId}-${f.amending ? 'correction' : 'draft'}`} workspace={workspace} f={f} task={f.task} result={f.result} profileId={profileId} profile={profile} formType={form.type} schemaVersion={form.schemaVersion} />}
  </section>;
}
