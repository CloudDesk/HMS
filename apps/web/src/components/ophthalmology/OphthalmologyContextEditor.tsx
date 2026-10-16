import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createContextSchema, subtypeSchema, type OphthalmologyContext } from '../../api/ophthalmology';
import type { z } from 'zod';
import type { OphthalmologyWorkspaceFeature } from '../../hooks/ophthalmology/useOphthalmologyWorkspaceFeature';
import { Modal } from '../ui/Modal';
import { EditorErrors, useEditorLeaveGuard } from './OphthalmologyConfigurationEditor';

const schema = createContextSchema.omit({ configuration_version_id: true });
export function OphthalmologyContextEditor({ feature: f, context: initial }: { feature: OphthalmologyWorkspaceFeature; context: OphthalmologyContext }) {
  const [context] = useState(initial);
  const { register, handleSubmit, setValue, reset, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { visit_subtype: context.visit_subtype, affected_eye: context.affected_eye, workflow_profile_version_id: context.workflow_profile_version_id } });
  const leave = useEditorLeaveGuard(isDirty);
  const close = () => { if (!f.busy && !isSubmitting && leave()) f.setQuery('edit_context', 'closed'); };
  const disabled = !f.canEdit || f.busy || isSubmitting || f.contextQuery.isError || f.visitQuery.isError;
  return <Modal open className="oph-workspace" title="Edit ophthalmology context" onClose={close} footer={<><button className="doc-btn" type="button" disabled={f.busy || isSubmitting} onClick={close}>Cancel</button><button className="doc-btn primary" type="submit" form="oph-context-form" disabled={disabled || !isDirty || f.workflowsQuery.isError}>Save context changes</button></>}>
    <p>Context version {context.version}. The server rechecks visit mapping and workflow compatibility.</p>
    {initial.version !== context.version && <p role="alert">The saved context has changed. Close and reopen this editor to reload; saving the original version will report a conflict.</p>}
    <form id="oph-context-form" onSubmit={handleSubmit(async (body) => {
      if (!window.confirm('Save the affected eye, subtype and workflow changes for this encounter?')) return;
      const saved = await f.updateContext({ expected_version: context.version, ...body });
      if (saved) { reset(body); f.setQuery('edit_context', 'closed'); }
    })}><EditorErrors errors={errors} /><fieldset className="oph-fieldset" disabled={disabled}>
      <label className="doc-field"><span>Affected eye <span className="oph-required">*</span></span><select {...register('affected_eye')}>{['OD', 'OS', 'OU', 'NOT_SPECIFIED'].map((eye) => <option key={eye}>{eye}</option>)}</select></label>
      <label className="doc-field"><span>Visit subtype <span className="oph-required">*</span></span><select {...register('visit_subtype')} disabled={!f.canConfigure} onChange={(event) => {
        const parsed = subtypeSchema.safeParse(event.target.value); if (!parsed.success) return;
        setValue('visit_subtype', parsed.data, { shouldDirty: true }); setValue('workflow_profile_version_id', '', { shouldDirty: true }); f.setQuery('subtype', parsed.data);
      }}>{subtypeSchema.options.map((subtype) => <option key={subtype} disabled={!f.availableSubtypes.includes(subtype)}>{subtype}</option>)}</select></label>
      <label className="doc-field"><span>Workflow version <span className="oph-required">*</span></span><select {...register('workflow_profile_version_id')} disabled={!f.canConfigure}><option value="">Select compatible active workflow</option>{!f.workflows.some((item) => item.id === context.workflow_profile_version_id) && <option value={context.workflow_profile_version_id}>Current saved workflow</option>}{f.workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!f.canConfigure && <p>Configuration View is required to select another subtype/workflow. The current workflow reference is retained.</p>}
      {f.workflowsQuery.isLoading && <p role="status">Loading compatible workflows…</p>}{f.workflowsQuery.isError && <p role="alert">Workflow lookup failed. <button type="button" className="doc-btn" onClick={() => void f.workflowsQuery.refetch()}>Retry workflows</button></p>}
      {f.canConfigure && <div className="oph-toolbar"><button type="button" className="doc-btn" disabled={f.configurationPage <= 1} onClick={() => f.setQuery('configuration_page', String(f.configurationPage - 1))}>Previous workflows</button><span>Page {f.configurationPage}</span><button type="button" className="doc-btn" disabled={f.configurationPage >= (f.workflowsQuery.data?.meta.totalPages ?? 0)} onClick={() => f.setQuery('configuration_page', String(f.configurationPage + 1))}>Next workflows</button></div>}
    </fieldset>{f.actionError && <p className="form-error-banner" role="alert">{f.actionError} Your changes are retained.</p>}</form>
  </Modal>;
}
