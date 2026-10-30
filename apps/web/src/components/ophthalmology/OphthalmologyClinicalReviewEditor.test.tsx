import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clinicalReviewSchema } from '../../api/ophthalmology-care';
import type { OphthalmologyCareFeature } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
vi.mock('../../hooks/ophthalmology/useOphthalmologyDraftGuard', () => ({ useOphthalmologyDraftGuard: () => vi.fn() }));
import { clearEncounterDraft } from '../../hooks/ophthalmology/encounter-draft-cache';
import { OphthalmologyClinicalReviewEditor } from './OphthalmologyClinicalReviewEditor';
const id = '111111111111111111111111';
const record = (version = 4) => clinicalReviewSchema.parse({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, current_clinical_version: 1, status: 'DRAFT', version, created_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z', history: [], current: { clinical_version: 1, clinical_summary: 'QA review', follow_up_decision: null, patient_instructions: null, created_by: id, created_at: '2026-10-16T00:00:00Z', treatment_plans: [{ id, clinician_user_id: id, diagnosis_code: 'QA', diagnosis_laterality: 'OD', action_type: 'MEDICATION', legacy_category: null, treatment: 'QA treatment', priority: 'URGENT', status: 'ACTIVE', medication_prescription_id: id, optical_prescription_id: null, clinical_order_ids: [], procedure_recommendation_id: null, referral_id: null, follow_up_id: null }] } });
describe('clinical review preserves treatment linkage and original version', () => {
  let root: Root; let container: HTMLDivElement; const saveClinical = vi.fn();
  const feature = (version = 4) => ({ clinical: record(version), clinicalQuery: {}, canSaveClinical: true, busy: false, saveClinical, diagnoses: [{ code: 'QA', display: 'QA diagnosis', laterality: 'OD' }, { code: 'QB', display: 'Other saved diagnosis', laterality: 'OS' }], error: null }) as unknown as OphthalmologyCareFeature;
  beforeEach(() => { clearEncounterDraft('', 'clinical-review'); saveClinical.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('changes the diagnosis/eye together while retaining existing care references and excluding view-only IDs', async () => {
    await act(async () => root.render(<OphthalmologyClinicalReviewEditor feature={feature()} />));
    const select = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Saved diagnosis and eye'))?.querySelector('select'); if (!select) throw new Error('Missing diagnosis selector');
    await act(async () => { select.value = 'QB:OS'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(saveClinical).toHaveBeenCalledWith(expect.objectContaining({ expected_version: 4, treatment_plans: [expect.objectContaining({ diagnosis_code: 'QB', diagnosis_laterality: 'OS', action_type: 'MEDICATION', medication_prescription_id: id, clinical_order_ids: [] })] }));
    const row: unknown = saveClinical.mock.calls[0]?.[0]?.treatment_plans[0]; expect(row).not.toHaveProperty('id'); expect(row).not.toHaveProperty('clinician_user_id');
  });
  it('retains entered treatment and disables saving when a newer record arrives', async () => {
    await act(async () => root.render(<OphthalmologyClinicalReviewEditor feature={feature()} />)); const input = container.querySelector('textarea'); if (!input) throw new Error('Missing summary');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(input, 'Retained treatment'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => root.render(<OphthalmologyClinicalReviewEditor feature={feature(5)} />)); expect(input.value).toBe('Retained treatment'); expect(container.querySelector('fieldset')?.disabled).toBe(true); expect(container.textContent).toContain('The saved review changed');
  });
  it('clears an incompatible saved reference when the clinician changes action', async () => {
    await act(async () => root.render(<OphthalmologyClinicalReviewEditor feature={feature()} />));
    const select = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Action'))?.querySelector('select');
    if (!select) throw new Error('Missing action selector');
    await act(async () => { select.value = 'OTHER'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(saveClinical).toHaveBeenCalledWith(expect.objectContaining({ treatment_plans: [expect.objectContaining({ action_type: 'OTHER', medication_prescription_id: null, clinical_order_ids: [] })] }));
  });
  it('removes the summary input and saves a new treatment review without summary text', async () => {
    await act(async () => root.render(<OphthalmologyClinicalReviewEditor feature={{ ...feature(), clinical: null }} />));
    expect(container.querySelector('[name="clinical_summary"]')).toBeNull();
    expect(container.querySelector('.oph-clinical-summary-details')).toBeNull();
    await act(async () => container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(saveClinical).toHaveBeenCalledWith(expect.objectContaining({ clinical_summary: '', treatment_plans: [] }));
  });
});
