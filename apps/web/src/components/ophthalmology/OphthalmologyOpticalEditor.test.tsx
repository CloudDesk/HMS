import { confirmAction } from '../ui/confirm-action';
vi.mock('../ui/confirm-action', () => ({ confirmAction: vi.fn().mockResolvedValue(true) }));
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { opticalSchema } from '../../api/ophthalmology-care';
import type { CareWorkspace, OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { clearEncounterDraft } from '../../hooks/ophthalmology/encounter-draft-cache';
vi.mock('../../hooks/ophthalmology/useOphthalmologyDraftGuard', () => ({ useOphthalmologyDraftGuard: () => vi.fn() }));
import { OphthalmologyOpticalEditor } from './OphthalmologyOpticalEditor';
const id = '111111111111111111111111';
const record = (version = 4) => opticalSchema.parse({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, current_clinical_version: 1, status: 'DRAFT', version, created_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z', history: [], current: { clinical_version: 1, status: 'DRAFT', prescription_type: 'DISTANCE', power: { OD: { sphere: -2, cylinder: -1, axis: 90 }, OS: null }, pupillary_distance: { format: 'BINOCULAR', binocular: 62 }, segment_height: null, lens_type: 'QA_LENS', material: 'QA_MATERIAL', coating_codes: [], usage_instructions: 'QA instructions', valid_until: '2099-01-01T00:00:00Z', review_date: null, approver_user_id: null, approver_doctor_id: null, approved_at: null, created_by: id, created_at: '2026-10-16T00:00:00Z' } });
describe('optical saved draft, conflict and approval interaction', () => {
  let root: Root; let container: HTMLDivElement;
  const saveOptical = vi.fn(); const approveOptical = vi.fn();
  const feature = (version = 4) => ({ optical: record(version), canSaveOptical: true, canApproveOptical: true, busy: false, opticalQuery: {}, configuration: { name: 'QA' }, configurationQuery: {}, canConfigure: false, lensTypes: ['QA_LENS'], materials: ['QA_MATERIAL'], coatings: [], error: null, saveOptical, approveOptical }) as unknown as OphthalmologyCareFeature;
  const workspace: CareWorkspace = { visitId: id, canView: true, scopeError: false, visitQuery: { isError: false }, contextQuery: { isError: false }, configurationPage: 1, setQuery: vi.fn() };
  beforeEach(() => { clearEncounterDraft(id); saveOptical.mockReset(); approveOptical.mockReset(); vi.mocked(confirmAction).mockReset().mockResolvedValue(true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  function instructions() { const textarea = [...container.querySelectorAll('label')].find((label) => label.textContent?.toLowerCase().includes('instructions for optician'))?.querySelector('textarea'); if (!textarea) throw new Error('Missing instructions'); return textarea; }
  function approve() { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.toLowerCase().includes('authorize prescription')); if (!button) throw new Error('Missing approval'); return button; }
  async function type(value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(instructions(), value); instructions().dispatchEvent(new Event('input', { bubbles: true })); }); }
  async function submit() { await act(async () => container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
  it('saves a draft with the three optional sections blank without enabling authorization', async () => {
    const partial = record();
    partial.current.prescription_type = null;
    partial.current.power = { OD: null, OS: null };
    partial.current.pupillary_distance = {};
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={{ ...feature(), optical: partial }} workspace={workspace} />));
    expect(approve().disabled).toBe(true);
    expect(container.querySelector('.oph-card-title')?.textContent).toContain('(optional)');
    saveOptical.mockResolvedValue(partial);
    await submit();
    expect(saveOptical).toHaveBeenCalledWith(expect.objectContaining({ prescription_type: null,
      power: { OD: null, OS: null }, pupillary_distance: {} }));
    expect(approveOptical).not.toHaveBeenCalled();
  });
  it('does not approve dirty values and retains original version and untouched eye on save failure', async () => {
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={feature()} workspace={workspace} />));
    await type('Retained edited instructions'); expect(approve().disabled).toBe(true);
    saveOptical.mockResolvedValue(undefined); await submit();
    expect(saveOptical).toHaveBeenCalledWith(expect.objectContaining({ expected_version: 4, usage_instructions: 'Retained edited instructions', power: { OD: expect.objectContaining({ sphere: -2, cylinder: -1, axis: 90 }), OS: null } }));
    expect(instructions().value).toBe('Retained edited instructions'); expect(approveOptical).not.toHaveBeenCalled();
  });
  it('does not silently adopt a newer background version over entered values', async () => {
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={feature()} workspace={workspace} />)); await type('My retained draft');
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={feature(5)} workspace={workspace} />));
    expect(container.textContent).toContain('The saved prescription changed'); expect(instructions().value).toBe('My retained draft'); expect(approve().disabled).toBe(true); expect(container.querySelector('fieldset')?.disabled).toBe(true);
  });
  it('confirms approval of the exact clean saved version', async () => {
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={feature()} workspace={workspace} />));
    expect(approve().disabled).toBe(false); await act(async () => approve().click()); expect(approveOptical).toHaveBeenCalledWith(4); expect(confirmAction).toHaveBeenCalledTimes(1);
  });
  it('shows readable coating labels while saving the configured coating code', async () => {
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={{ ...feature(), coatings: ['ANTI_REFLECTIVE'] }} workspace={workspace} />));
    const coating = container.querySelector<HTMLInputElement>('.oph-coating-pill input');
    expect(container.querySelector('.oph-coating-pill')?.textContent).toContain('Anti-reflective');
    await act(async () => coating?.click());
    expect(approve().disabled).toBe(true);
    await submit();
    expect(saveOptical).toHaveBeenCalledWith(expect.objectContaining({ coating_codes: ['ANTI_REFLECTIVE'] }));
  });
  it('shows the dispensing lock only in the first section header without the approval card', async () => {
    const approved = record();
    approved.status = 'APPROVED';
    approved.current.status = 'APPROVED';
    approved.current.approved_at = '2026-10-26T19:03:13Z';
    await act(async () => root.render(<OphthalmologyOpticalEditor feature={{ ...feature(), optical: approved, canSaveOptical: false, canApproveOptical: false }} workspace={workspace} />));
    expect(container.querySelector('.oph-card-header')?.textContent).toContain('Locked for Dispensing');
    expect(container.textContent?.split('Locked for Dispensing')).toHaveLength(2);
    expect(container.textContent).not.toContain('Doctor Authentication & Clinical Approval Confirmed');
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(approve().disabled).toBe(true);
  });
});
