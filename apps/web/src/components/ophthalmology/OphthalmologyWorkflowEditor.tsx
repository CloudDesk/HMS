import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { subtypeSchema } from '../../api/ophthalmology';
import { workflowWriteSchema, type AdminWorkflow } from '../../api/ophthalmology-admin';
import type { OphthalmologyAdministrationFeature } from '../../hooks/ophthalmology/useOphthalmologyAdministrationFeature';
import { lines } from '../../hooks/ophthalmology/configuration-form';
import { EditorErrors, inputInstant, localDateTime, useEditorLeaveGuard } from './OphthalmologyConfigurationEditor';

const schema = z.object({ name: z.string().trim().min(1).max(160), visit_subtype: subtypeSchema, effective_from: z.string().datetime({ offset: true }).nullable(), stages: z.array(z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), mode: z.enum(['', 'SEQUENTIAL', 'PARALLEL']), test_codes: z.string(), bypass_allowed: z.boolean() })).min(1).max(50) });
type Editor = z.infer<typeof schema>;
export function OphthalmologyWorkflowEditor({ feature: f, record: initialRecord }: { feature: OphthalmologyAdministrationFeature; record: AdminWorkflow | null }) {
  const [record] = useState(initialRecord);
  const { register, control, setValue, handleSubmit, setError, formState: { errors, isDirty, isSubmitting } } = useForm<Editor>({ resolver: zodResolver(schema), defaultValues: { name: record?.name ?? '', visit_subtype: record?.visit_subtype, effective_from: record?.effective_from ?? null, stages: record?.stages.map((stage) => ({ ...stage, test_codes: stage.test_codes.join('\n') })) ?? [] } });
  const stages = useFieldArray({ control, name: 'stages' }); const values = useWatch({ control });
  const leave = useEditorLeaveGuard(isDirty); const readOnly = f.list.isError || (record ? record.status !== 'DRAFT' || !f.canEdit : !f.canCreate);
  const close = async () => { if (!f.busy && !isSubmitting && await leave()) f.setQuery({ edit_id: null }); };
  return <Modal size="large" className="oph-workspace" open title={record ? `Edit workflow · revision ${record.revision}` : 'New ophthalmology workflow'} onClose={close} footer={<><button type="button" className="doc-btn" disabled={f.busy || isSubmitting} onClick={close}>Cancel</button><button type="submit" form="oph-workflow-form" className="doc-btn primary" disabled={f.busy || isSubmitting || readOnly}>Save draft workflow</button></>}>
    <form id="oph-workflow-form" onSubmit={handleSubmit(async (form) => {
      const body = workflowWriteSchema.safeParse({ name: form.name, effective_from: form.effective_from, stages: form.stages.map((stage) => ({ ...stage, test_codes: lines(stage.test_codes).map((code) => code.toUpperCase()) })) });
      if (!body.success) { setError('root', { message: 'Choose each stage mode and use unique stage/test codes.' }); return; }
      await f.save({ resource: 'workflows', id: record?.id ?? null, expected_version: record?.version ?? null, branch_id: f.branchId, visit_subtype: form.visit_subtype, body: body.data });
    })}><EditorErrors errors={errors} />{f.error && <p className="form-error-banner" role="alert">{f.error} Draft values are retained. Reopen a stale version before retrying.</p>}
      <fieldset className="oph-fieldset" disabled={f.busy || isSubmitting || readOnly}><div className="doc-form-grid two"><label className="doc-field"><span>Name <span className="oph-required">*</span></span><input maxLength={160} {...register('name')} /></label><label className="doc-field"><span>Visit subtype <span className="oph-required">*</span></span><select disabled={Boolean(record)} {...register('visit_subtype')}><option value="">Select</option>{subtypeSchema.options.map((subtype) => <option key={subtype}>{subtype}</option>)}</select></label><label className="doc-field">Effective from<input type="datetime-local" value={localDateTime(values.effective_from)} onChange={(event) => setValue('effective_from', inputInstant(event.target.value), { shouldDirty: true })} /></label></div>
        <h4>Ordered stages</h4>{stages.fields.map((stage, index) => <section className="doc-card" key={stage.id}><h4>Stage {index + 1}</h4><div className="doc-form-grid two"><label className="doc-field"><span>Code <span className="oph-required">*</span></span><input maxLength={80} {...register(`stages.${index}.code`)} /></label><label className="doc-field"><span>Name <span className="oph-required">*</span></span><input maxLength={160} {...register(`stages.${index}.name`)} /></label><label className="doc-field"><span>Execution mode <span className="oph-required">*</span></span><select {...register(`stages.${index}.mode`)}><option value="">Select</option><option>SEQUENTIAL</option><option>PARALLEL</option></select></label><label className="doc-field">Test codes, one per line<textarea {...register(`stages.${index}.test_codes`)} /></label><label><input type="checkbox" {...register(`stages.${index}.bypass_allowed`)} /> Bypass permitted</label></div><div className="oph-toolbar"><button className="doc-btn" type="button" disabled={index === 0} onClick={() => stages.move(index, index - 1)}>Move earlier</button><button className="doc-btn" type="button" disabled={index === stages.fields.length - 1} onClick={() => stages.move(index, index + 1)}>Move later</button><button className="doc-btn" type="button" onClick={() => stages.remove(index)}>Remove stage</button></div></section>)}<button type="button" className="doc-btn" disabled={stages.fields.length >= 50} onClick={() => stages.append({ code: '', name: '', mode: '', test_codes: '', bypass_allowed: false })}>Add stage</button>
      </fieldset>
    </form>
  </Modal>;
}
