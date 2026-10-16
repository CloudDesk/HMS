import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createQueueTaskSchema } from '../../api/ophthalmology-queue';
import type { AdminConfiguration } from '../../api/ophthalmology-admin';
import type { OphthalmologyContext } from '../../api/ophthalmology';
import type { OphthalmologyQueueFeature } from '../../hooks/ophthalmology/useOphthalmologyQueueFeature';
import { configuredQueueTests } from '../../hooks/ophthalmology/queue-actions';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors } from './OphthalmologyConfigurationEditor';
import { QueueLookupPages } from './OphthalmologyQueueActionDialog';
import { Modal } from '../ui/Modal';

const formSchema = z.object(createQueueTaskSchema.shape).omit({ expected_context_version: true });
function CreateTaskForm({ feature: f, context: latest }: { feature: OphthalmologyQueueFeature; context: OphthalmologyContext }) {
  const [context] = useState(latest);
  const { register, control, setValue, handleSubmit, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { test_catalogue_version_id: '', test_code: '', source_type: f.fromOrder ? 'CLINICAL_ORDER_ITEM' : 'WORKFLOW', source_order_id: null, source_order_item_id: null, workflow_stage_code: null, special_instructions: null } });
  const values = useWatch({ control }); const attempt = useRef<{ signature: string; key: string } | null>(null);
  const committed = useOphthalmologyDraftGuard(isDirty, ['branch_id', 'visit_id', 'create', 'task_id']);
  const [selectedCatalogue, setSelectedCatalogue] = useState<AdminConfiguration>();
  const catalogue = f.catalogues.find((item) => item.id === values.test_catalogue_version_id) ?? (selectedCatalogue?.id === values.test_catalogue_version_id ? selectedCatalogue : undefined);
  const tests = configuredQueueTests(catalogue?.values);
  const disabled = f.busy || isSubmitting || !f.canConfigure || f.contextQuery.isError || f.visitQuery.isError || f.cataloguesQuery.isError || f.workflowQuery.isError || !f.workflow || context.version !== latest.version;
  return <form id="oph-create-task" onSubmit={handleSubmit(async (form) => {
    try {
      const body = createQueueTaskSchema.parse({ ...form, expected_context_version: context.version });
      const signature = JSON.stringify([context.id, body]); if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
      const task = await f.createSubmit(body, attempt.current.key);
      if (task) { reset(form); committed(); f.setQuery({ create: null, task_id: task.id, visit_id: task.visit_id, action: null }); }
    } catch (cause) { setError('root', { message: cause instanceof z.ZodError ? cause.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ') : cause instanceof Error ? cause.message : 'Check the task fields.' }); }
  })}><EditorErrors errors={errors} />{context.version !== latest.version && <p role="alert">The context changed. Close and reopen to use its current version; your entries remain here.</p>}
    <p>Patient {f.visit?.patient_name} · {f.visit?.patient_number} · {f.visit?.visit_number} · context version {context.version}</p>
    <fieldset className="oph-fieldset" disabled={disabled}><div className="doc-form-grid two">
      <label className="doc-field"><span>Test catalogue version <span className="oph-required">*</span></span><select {...register('test_catalogue_version_id')} onChange={(event) => { setSelectedCatalogue(f.catalogues.find((item) => item.id === event.target.value)); setValue('test_catalogue_version_id', event.target.value, { shouldDirty: true }); setValue('test_code', '', { shouldDirty: true }); setValue('workflow_stage_code', null, { shouldDirty: true }); }}><option value="">Select approved branch catalogue</option>{values.test_catalogue_version_id && !f.catalogues.some((item) => item.id === values.test_catalogue_version_id) && <option value={values.test_catalogue_version_id}>Selected version (not on this page)</option>}{f.catalogues.map((item) => <option key={item.id} value={item.id}>{item.name} · revision {item.revision}</option>)}</select></label>
      <label className="doc-field"><span>Test <span className="oph-required">*</span></span><select {...register('test_code')} onChange={(event) => { setValue('test_code', event.target.value, { shouldDirty: true }); setValue('workflow_stage_code', null, { shouldDirty: true }); }}><option value="">Select configured test</option>{tests.map((test) => <option key={test.code} value={test.code}>{test.name}</option>)}</select></label>
      <label className="doc-field"><span>Eye <span className="oph-required">*</span></span><select {...register('laterality')}><option value="">Select</option>{['OD', 'OS', 'OU', 'NOT_APPLICABLE'].map((eye) => <option key={eye}>{eye}</option>)}</select></label>
      <label className="doc-field"><span>Priority <span className="oph-required">*</span></span><select {...register('priority')}><option value="">Select</option>{['ROUTINE', 'PRIORITY', 'EMERGENCY'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label className="doc-field">Workflow stage<select {...register('workflow_stage_code', { setValueAs: (value: string) => value || null })}><option value="">No stage binding</option>{f.workflow?.stages.filter((stage) => stage.test_codes.includes(values.test_code ?? '')).map((stage) => <option key={stage.code} value={stage.code}>{stage.name} · {stage.mode}</option>)}</select></label>
      <label className="doc-field">Source<select {...register('source_type')} onChange={(event) => { const source = event.target.value === 'CLINICAL_ORDER_ITEM' ? 'CLINICAL_ORDER_ITEM' : 'WORKFLOW'; setValue('source_type', source, { shouldDirty: true }); setValue('source_order_id', null, { shouldDirty: true }); setValue('source_order_item_id', null, { shouldDirty: true }); f.setQuery({ create_source: source }); }}><option value="WORKFLOW">Workflow</option><option value="CLINICAL_ORDER_ITEM" disabled={!f.canReadOrders}>Existing submitted clinical order</option></select></label>
    </div>{values.source_type === 'CLINICAL_ORDER_ITEM' && <label className="doc-field"><span>Submitted order item <span className="oph-required">*</span></span><select value={values.source_order_id && values.source_order_item_id ? `${values.source_order_id}:${values.source_order_item_id}` : ''} onChange={(event) => { const [orderId, itemId] = event.target.value.split(':'); const order = f.orders.find((entry) => entry.id === orderId && entry.items.some((item) => item.id === itemId)); setValue('source_order_id', order?.id ?? null, { shouldDirty: true }); setValue('source_order_item_id', order ? itemId ?? null : null, { shouldDirty: true }); }}><option value="">Select existing order/item</option>{f.orders.flatMap((order) => order.items.map((item) => <option key={`${order.id}:${item.id}`} value={`${order.id}:${item.id}`}>{order.order_type} · {item.investigation_name} · {order.status}</option>))}</select></label>}
      <label className="doc-field">Special instructions<textarea maxLength={2000} {...register('special_instructions', { setValueAs: (value: string) => value.trim() || null })} /></label>
      <button className="doc-btn primary" type="submit" disabled={!tests.some((test) => test.code === values.test_code)}>Create configured task</button>
    </fieldset>
    {f.cataloguesQuery.isLoading && <p role="status">Loading test catalogues…</p>}{f.cataloguesQuery.isError && <p role="alert">Catalogue lookup failed. <button className="doc-btn" type="button" onClick={() => void f.cataloguesQuery.refetch()}>Retry catalogues</button></p>}
    <QueueLookupPages page={f.cataloguePage} total={f.cataloguesQuery.data?.meta.totalPages ?? 0} change={(page) => f.setQuery({ catalogue_page: String(page) })} label="catalogues" />
    {f.workflowQuery.isError && <p role="alert">Bound workflow could not be loaded. <button className="doc-btn" type="button" onClick={() => void f.workflowQuery.refetch()}>Retry bound workflow</button></p>}
    {f.fromOrder && (f.labQuery.isError || f.imagingQuery.isError) && <p role="alert">An order source could not be loaded. <button className="doc-btn" type="button" onClick={() => { void f.labQuery.refetch(); void f.imagingQuery.refetch(); }}>Retry order sources</button></p>}
    {f.error && <p className="form-error-banner" role="alert">{f.error} Entries are retained for retry.</p>}
  </form>;
}
export function OphthalmologyQueueCreateDialog({ feature: f }: { feature: OphthalmologyQueueFeature }) {
  const close = () => { if (!f.busy) f.setQuery({ create: null }); };
  return <Modal open size="large" className="oph-workspace" title="Create configured ophthalmology task" onClose={close} footer={<button className="doc-btn" type="button" disabled={f.busy} onClick={close}>Close</button>}>
    {!f.canVisits && <p role="alert">OPD Visits View is required to select and verify the encounter.</p>}
    {f.canVisits && !f.visitId && <><label className="doc-field">Find encounter<input maxLength={120} defaultValue="" placeholder="Patient / encounter; press Enter" onKeyDown={(event) => { if (event.key === 'Enter') f.setQuery({ visit_search: event.currentTarget.value.trim() || null, visit_page: '1' }); }} /></label>{f.visitsQuery.isLoading && <p role="status">Loading encounters…</p>}{f.visitsQuery.isError && <p role="alert">Encounter search failed. <button className="doc-btn" type="button" onClick={() => void f.visitsQuery.refetch()}>Retry encounters</button></p>}{f.visits.map((visit) => <button className="doc-btn" type="button" key={visit.id} onClick={() => f.setQuery({ visit_id: visit.id })}>{visit.patient_name} · {visit.patient_number} · {visit.visit_number} · {visit.status}</button>)}{!f.visitsQuery.isLoading && !f.visits.length && <p>No encounters on this page.</p>}<QueueLookupPages page={f.positive('visit_page')} total={f.visitsQuery.data?.meta.totalPages ?? 0} change={(page) => f.setQuery({ visit_page: String(page) })} label="encounters" /></>}
    {f.visitId && <div className="oph-toolbar"><span>Encounter {f.visit?.visit_number ?? f.visitId}</span><button className="doc-btn" type="button" disabled={f.busy} onClick={() => f.setQuery({ visit_id: null })}>Choose another encounter</button></div>}
    {(f.visitQuery.isLoading || f.contextQuery.isLoading) && <p role="status">Loading encounter context…</p>}
    {(f.canVisits && f.visitQuery.isError || f.canReadContext && f.contextQuery.isError) && <p role="alert">An eligible Ophthalmology encounter/context could not be loaded. <button className="doc-btn" type="button" onClick={() => { if (f.canVisits) void f.visitQuery.refetch(); if (f.canReadContext) void f.contextQuery.refetch(); }}>Retry context</button></p>}
    {f.visit && !f.canReadContext && <p role="alert">Ophthalmology Intake View permission is required to verify this encounter before creating a task.</p>}
    {f.visit && f.contextQuery.data === null && <p role="alert">Activate this encounter's Ophthalmology context before creating a task. <button className="doc-btn" type="button" onClick={f.openEncounter}>Open encounter</button></p>}
    {f.context && !f.canConfigure && <p role="alert">Configuration View permission is required to select approved test catalogues.</p>}
    {f.context && f.canConfigure && <CreateTaskForm key={f.context.id} feature={f} context={f.context} />}
  </Modal>;
}
