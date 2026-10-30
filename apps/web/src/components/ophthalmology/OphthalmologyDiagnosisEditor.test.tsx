import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpdConsultationResponse } from '../../api/opd';
import { clearEncounterDraft } from '../../hooks/ophthalmology/encounter-draft-cache';
import { OphthalmologyDiagnosisEditor } from './OphthalmologyDiagnosisEditor';

vi.mock('../../hooks/opd/useOpd', () => ({ useSaveOpdConsultationDraft: () => ({ isPending: false, mutateAsync: vi.fn() }) }));

describe('diagnosis removal confirmation', () => {
  let root: Root;
  let container: HTMLDivElement;
  const visitId = 'diagnosis-confirm-test';
  beforeEach(() => {
    clearEncounterDraft(visitId);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    await act(async () => root.unmount());
    container.remove();
    clearEncounterDraft(visitId);
    vi.restoreAllMocks();
  });

  it('keeps the diagnosis on Cancel and removes it only after HMS confirmation', async () => {
    const native = vi.spyOn(window, 'confirm');
    const record = { visit_id: visitId, patient_id: 'patient', version: 1, status: 'DRAFT', diagnoses: [
      { code: 'H52.1', display: 'Myopia', codingSystem: 'ICD-10', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED' },
    ] } as OpdConsultationResponse;
    await act(async () => root.render(<OphthalmologyDiagnosisEditor record={record} canEdit />));
    const remove = () => [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Remove'));
    const dialogButton = (label: string) => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === label) as HTMLButtonElement;
    await act(async () => remove()?.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Remove diagnosis "Myopia" from draft?');
    await act(async () => dialogButton('Cancel').click());
    expect([...container.querySelectorAll('input')].some((input) => input.value === 'Myopia')).toBe(true);
    await act(async () => remove()?.click());
    await act(async () => dialogButton('Confirm').click());
    expect([...container.querySelectorAll('input')].some((input) => input.value === 'Myopia')).toBe(false);
    expect(native).not.toHaveBeenCalled();
  });
});
