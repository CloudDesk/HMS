import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resultSchema, taskSchema } from '../api/ophthalmology';

const state = vi.hoisted(() => ({ alertStatus: null as null | 'ACTIVE' | 'ACKNOWLEDGED', task: undefined as unknown, result: undefined as unknown, canEdit: true, canEscalate: true, escalate: vi.fn(), contextEditOpen: false, contextVersion: 0, updateContext: vi.fn(), amending: false, canAttach: false, refreshError: false, save: vi.fn(), amend: vi.fn(), upload: vi.fn(), reload: vi.fn(), setQuery: vi.fn() }));
vi.mock('../routing/navigation', async (importOriginal) => ({ ...await importOriginal<typeof import('../routing/navigation')>(), useAppLocation: () => ({ pathname: '/opd/ophthalmology', search: '?section=tests' }) }));
vi.mock('../hooks/ophthalmology/useOphthalmologyWorkspaceFeature', () => ({ useOphthalmologyWorkspaceFeature: () => ({
  canView: true, canConfigure: true, canEscalate: state.canEscalate, escalate: state.escalate, visitId: '111111111111111111111111', section: 'tests', context: { id: '222222222222222222222222', version: state.contextVersion, visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OD', workflow_profile_version_id: '111111111111111111111111' }, contextEditOpen: state.contextEditOpen, canEdit: state.canEdit, availableSubtypes: ['NEW_CONSULTATION'], workflows: [], workflowsQuery: {}, updateContext: state.updateContext,
  intakeView: state.alertStatus ? { shared_history: {}, alerts: [{ id: 'alert-1', status: state.alertStatus, reason: 'Emergency screening', triggered_at: '2026-10-21T00:00:00Z', triggered_by: 'clinician-1' }] } : undefined, visit: { patient_name: 'QA Patient', patient_number: 'QA', visit_number: 'QA-OPD' }, contextQuery: {}, intakeQuery: {}, visitQuery: {}, setQuery: state.setQuery,
}) }));
vi.mock('../hooks/ophthalmology/useOphthalmologyResultFeature', () => ({ useOphthalmologyResultFeature: () => ({
  task: state.task, result: state.result, taskId: '333333333333333333333333', canView: true, canEdit: state.canEdit, canComplete: state.canEdit,
  taskQuery: {}, resultQuery: { isSuccess: !state.refreshError, isError: state.refreshError, data: state.result }, resultLoaded: true, tasks: [], profiles: [], busy: false, amending: state.amending, canAttach: state.canAttach, save: state.save, amend: state.amend, upload: state.upload, reload: state.reload,
}) }));
vi.mock('../hooks/ophthalmology/useOphthalmologyComparisonFeature', () => ({ useOphthalmologyComparisonFeature: () => ({ open: false, page: 1, query: {}, data: undefined, canSelect: false }) }));
vi.mock('../hooks/appointments/useAppointments', () => ({ useAppointmentDetails: () => ({ data: undefined }) }));
import { OphthalmologyWorkspacePage } from './OphthalmologyWorkspacePage';

const id = '111111111111111111111111';
const scope = { visit_id: id, context_id: '222222222222222222222222', patient_id: id, branch_id: id, department_id: id };
const task = () => taskSchema.parse({ ...scope, id: '333333333333333333333333', test_code: 'LENS', test_name: 'Lensometry', laterality: 'OD', priority: 'ROUTINE', status: 'DRAFT', version: 1, station_id: id, assigned_user_id: id, device_code: null, started_at: null, completed_at: null, special_instructions: null });
const result = () => resultSchema.parse({ ...scope, id, task_id: '333333333333333333333333', version: 0, status: 'DRAFT', current_clinical_version: 1, history: [], current: {
  clinical_version: 1, status: 'DRAFT', form_type: 'LENSOMETRY', form_schema_version: 'qa-1', form_profile_version_id: id, form_profile_revision: 1,
  form_profile_snapshot: { form_type: 'LENSOMETRY', schema_version: 'qa-1', test_codes: ['LENS'] }, laterality: 'OD', station_id: id, performer_user_id: id,
  performed_at: '2026-10-16T00:00:00Z', device_code: null, device_snapshot: null, source_type: 'MANUAL', reliability: 'GOOD', reliability_reason: null,
  comments: null, document_ids: [], payload: { optical_power: { OD: { sphere: -2 } }, optical_centre_pd: { OD: { preserved: 31 } } }, supersedes_clinical_version: null, amendment_reason: null, completed_at: null,
} });
describe('ophthalmology structured form interaction', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => { state.alertStatus = null; state.task = task(); state.result = result(); state.canEdit = true; state.contextEditOpen = false; state.contextVersion = 0; state.updateContext.mockReset(); state.amending = false; state.canAttach = false; state.refreshError = false; state.save.mockReset(); state.amend.mockReset(); state.upload.mockReset(); state.reload.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  function sphereInput() {
    const input = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('OD optical power sphere'))?.querySelector('input');
    if (!input) throw new Error('Sphere input is missing'); return input;
  }
  async function changeSphere(value: string) {
    const input = sphereInput(); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Input setter is missing');
    await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  async function submit() { await act(async () => { container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
  it.each(['ACTIVE', 'ACKNOWLEDGED'] as const)('does not present %s as clinical clearance or a confirmed Emergency link', async (status) => {
    state.alertStatus = status;
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    expect(container.textContent).toContain('Acknowledgement records receipt only.');
    expect(container.textContent).toContain('Clinical disposition and clearance to resume routine OPD are not recorded by this alert.');
    expect(container.textContent).toContain('No linked Emergency encounter is confirmed here.');
  });
  it('preserves a dirty editing base and sends its original versions after background refresh', async () => {
    await act(async () => root.render(<OphthalmologyWorkspacePage />)); await changeSphere('0');
    state.task = { ...task(), version: 2 }; state.result = { ...result(), version: 1, current: { ...result().current, payload: { optical_power: { OD: { sphere: 9 } } } } };
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    expect(sphereInput().value).toBe('0'); expect(container.textContent).toContain('server record has changed');
    await submit();
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ expected_task_version: 1, expected_result_version: 0, payload: { optical_power: { OD: { sphere: 0 } }, optical_centre_pd: { OD: { preserved: 31 } } } }));
  });
  it('retains entered values when an API save fails', async () => {
    state.save.mockRejectedValueOnce(new Error('QA API failure'));
    await act(async () => root.render(<OphthalmologyWorkspacePage />)); await changeSphere('-1'); await submit();
    expect(container.textContent).toContain('QA API failure'); expect(sphereInput().value).toBe('-1');
  });
  it('keeps the original context version when a background refresh arrives during an edit', async () => {
    state.contextEditOpen = true; vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    const eye = document.querySelector<HTMLSelectElement>('#oph-context-form select[name="affected_eye"]'); if (!eye) throw new Error('Context eye input missing');
    await act(async () => { eye.value = 'OS'; eye.dispatchEvent(new Event('change', { bubbles: true })); });
    state.contextVersion = 1; await act(async () => root.render(<OphthalmologyWorkspacePage />));
    expect(eye.value).toBe('OS');
    await act(async () => { document.querySelector('#oph-context-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(state.updateContext).toHaveBeenCalledWith({ expected_version: 0, visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OS', workflow_profile_version_id: '111111111111111111111111' });
  });
  it('reloads common metadata and document references together with the payload and versions', async () => {
    const fresh = result(); fresh.version = 2; fresh.current.reliability = 'FAIR'; fresh.current.comments = 'Reloaded QA comment'; fresh.current.document_ids = ['222222222222222222222222']; fresh.current.payload = { optical_power: { OD: { sphere: 1 } }, unknown_source: 'retain' };
    state.reload.mockResolvedValue({ task: { ...task(), version: 3 }, result: fresh });
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    const reload = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reload result'); if (!reload) throw new Error('Reload button missing');
    await act(async () => reload.click()); await submit();
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ expected_task_version: 3, expected_result_version: 2, reliability: 'FAIR', comments: 'Reloaded QA comment', document_ids: ['222222222222222222222222'], payload: fresh.current.payload }));
  });
  it('renders denied result editing as read only', async () => {
    state.canEdit = false; await act(async () => root.render(<OphthalmologyWorkspacePage />));
    expect(sphereInput().closest('fieldset')?.disabled).toBe(true); expect(container.textContent).not.toContain('OS optical power');
  });
  it('adds and saves an independent IOL calculation without replacing existing measurements', async () => {
    const base = result();
    state.result = { ...base, current: { ...base.current, form_type: 'BIOMETRY_IOL', form_profile_snapshot: { form_type: 'BIOMETRY_IOL', schema_version: 'qa-1', test_codes: ['LENS'] }, payload: { measurements: { OD: { source_value: 0 } }, calculations: { OD: [{ formula: 'QA', iol_model: 'QA', iol_power: 0, predicted_refraction: 0, vendor: 'retain' }] } } } };
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Add OD IOL calculation');
    if (!add) throw new Error('IOL acquisition button missing');
    await act(async () => add.click());
    const power = [...container.querySelectorAll('label')].find((label) => label.textContent === 'OD calculation 2 iol power')?.querySelector('input');
    if (!power) throw new Error('Second calculation power missing');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => { setter?.call(power, '1'); power.dispatchEvent(new Event('input', { bubbles: true })); }); await submit();
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ measurements: { OD: { source_value: 0 } }, calculations: { OD: [{ formula: 'QA', iol_model: 'QA', iol_power: 0, predicted_refraction: 0, vendor: 'retain' }, { iol_power: 1 }] } }) }));
  });
  it('keeps unsaved entries mounted when a background refresh fails', async () => {
    await act(async () => root.render(<OphthalmologyWorkspacePage />)); await changeSphere('-3');
    state.refreshError = true; state.canEdit = false; await act(async () => root.render(<OphthalmologyWorkspacePage />));
    expect(sphereInput().value).toBe('-3'); expect(sphereInput().closest('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('Task/result could not be loaded');
  });
  it('requires a reason and sends exact completed versions for a manual correction', async () => {
    state.amending = true; state.task = { ...task(), status: 'COMPLETED', version: 3 }; state.result = { ...result(), status: 'COMPLETED', version: 2 };
    await act(async () => root.render(<OphthalmologyWorkspacePage />)); await submit(); expect(state.amend).not.toHaveBeenCalled();
    const reason = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Correction reason'))?.querySelector('textarea');
    if (!reason) throw new Error('Correction reason missing');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    await act(async () => { setter?.call(reason, 'Verified QA transcription correction'); reason.dispatchEvent(new Event('input', { bubbles: true })); });
    await submit(); expect(state.save).not.toHaveBeenCalled(); expect(state.amend).toHaveBeenCalledWith(expect.objectContaining({ expected_task_status: 'COMPLETED', expected_task_version: 3, expected_result_version: 2, source_type: 'MANUAL_CORRECTION', reason: 'Verified QA transcription correction' }));
  });
  it('renders Escalate Emergency button when user has escalation grant and dispatches escalation', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Severe chemical burn OD');
    state.canEscalate = true;
    state.alertStatus = null;
    await act(async () => root.render(<OphthalmologyWorkspacePage />));
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Escalate Emergency'));
    expect(btn).toBeDefined();
    await act(async () => { btn?.click(); });
    expect(state.escalate).toHaveBeenCalledWith('Severe chemical burn OD', ['CLINICAL_ESCALATION'], 'EMERGENCY');
  });
});
