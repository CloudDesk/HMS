import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../routing/navigation';
import {
  useOphthalmologyDraftGuard,
  getEncounterDraft,
  setEncounterDraft,
  clearEncounterDraft,
  hasEncounterDirtyDrafts,
  registerDraftSaveHandler,
  executeActiveDraftSave,
} from './useOphthalmologyDraftGuard';

describe('useOphthalmologyDraftGuard - Phase 2 internal tab navigation & draft persistence', () => {
  let root: Root;
  let container: HTMLDivElement;

  function DraftGuardHarness({ dirty = true }: { dirty?: boolean }) {
    useOphthalmologyDraftGuard(dirty, ['visit_id', 'section', 'care_tab', 'area']);
    return null;
  }

  beforeEach(() => {
    window.history.replaceState(null, '', '/opd/ophthalmology?visit_id=V123&section=clinical&care_tab=treatment');
    clearEncounterDraft('V123');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    clearEncounterDraft('V123');
    vi.restoreAllMocks();
  });

  it('TC-01: does not prompt confirmation when navigating between internal consultation tabs without changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => root.render(<DraftGuardHarness dirty={false} />));

    // Navigate to Prescriptions & Orders internal tab
    navigate('/opd/ophthalmology?visit_id=V123&section=clinical&care_tab=prescription');
    expect(window.location.search).toContain('care_tab=prescription');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('TC-01 & TC-02: allows switching internal consultation tabs even with dirty state without unnecessary confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => root.render(<DraftGuardHarness dirty={true} />));

    // Navigate to Optical Prescription internal tab
    navigate('/opd/ophthalmology?visit_id=V123&section=clinical&care_tab=optical');
    expect(window.location.search).toContain('care_tab=optical');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('TC-02 & TC-03: preserves encounter draft data in cache across internal tab switches', () => {
    const draftPayload = {
      clinical_summary: 'Patient exhibits signs of moderate dry eye syndrome OU',
      treatment_plans: [{ treatment: 'Artificial tears QID', action_type: 'MEDICATION' }],
    };

    setEncounterDraft('V123', 'clinical-review', draftPayload, true);
    expect(hasEncounterDirtyDrafts('V123')).toBe(true);

    const retrieved = getEncounterDraft<typeof draftPayload>('V123', 'clinical-review');
    expect(retrieved).toEqual(draftPayload);
    expect(retrieved?.clinical_summary).toBe('Patient exhibits signs of moderate dry eye syndrome OU');

    clearEncounterDraft('V123', 'clinical-review');
    expect(hasEncounterDirtyDrafts('V123')).toBe(false);
    expect(getEncounterDraft('V123', 'clinical-review')).toBeNull();
  });

  it('TC-04: prompts confirmation when leaving consultation route with unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => root.render(<DraftGuardHarness dirty={true} />));

    navigate('/opd/queue');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/opd/ophthalmology');
  });

  it('TC-05: prompts confirmation when switching patient encounter with unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => root.render(<DraftGuardHarness dirty={true} />));

    navigate('/opd/ophthalmology?visit_id=V456&section=clinical&care_tab=treatment');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain('visit_id=V123');
  });

  it('TC-06 & TC-07: executes registered draft save handler and confirms persistence', async () => {
    const mockSaveHandler = vi.fn().mockResolvedValue(true);
    const unregister = registerDraftSaveHandler('current', mockSaveHandler);

    const executed = await executeActiveDraftSave('current');
    expect(executed).toBe(true);
    expect(mockSaveHandler).toHaveBeenCalledTimes(1);

    unregister();
    const executedAfterUnregister = await executeActiveDraftSave('current');
    expect(executedAfterUnregister).toBe(false);
  });

  it('TC-08: propagates error if registered draft save handler fails', async () => {
    const mockSaveHandler = vi.fn().mockRejectedValue(new Error('Backend draft save failed: DB timeout'));
    const unregister = registerDraftSaveHandler('current', mockSaveHandler);

    await expect(executeActiveDraftSave('current')).rejects.toThrow('Backend draft save failed: DB timeout');

    unregister();
  });
});
