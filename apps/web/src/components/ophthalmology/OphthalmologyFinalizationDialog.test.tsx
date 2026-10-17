import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
vi.mock('../../hooks/ophthalmology/useOphthalmologyDraftGuard', () => ({ useOphthalmologyDraftGuard: () => vi.fn() }));
import { OphthalmologyFinalizationDialog } from './OphthalmologyFinalizationDialog';

describe('C4 exact-version completion dialog', () => {
  let root: Root; let container: HTMLDivElement; const complete = vi.fn(); const setQuery = vi.fn();
  const feature = () => ({
    summary: { consultation: { version: 4, assessment: 'Stable cataract' }, clinical_review: { version: 5, current: { clinical_summary: 'Reviewed' } }, optical_prescription: null },
    history: { status: 'OPEN', version: 2 }, readiness: { ready: true, context_version: 3, consultation_version: 4,
      clinical_review_version: 5, optical_prescription_version: null }, openEpisode: undefined, completionAllowed: true,
    reopenAllowed: false, correctionAllowed: false, busy: false, error: null, complete, setQuery,
  }) as unknown as OphthalmologyCompletionFeature;
  beforeEach(() => { complete.mockReset(); setQuery.mockReset(); vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111'); container = document.createElement('div');
    document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  it('submits the frozen source versions and closes only after success', async () => {
    complete.mockResolvedValue({ version: 3 });
    await act(async () => root.render(<OphthalmologyFinalizationDialog feature={feature()} action="complete" />));
    await act(async () => document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(complete).toHaveBeenCalledWith({ expected_version: 2, expected_context_version: 3, expected_consultation_version: 4,
      expected_clinical_review_version: 5, expected_optical_prescription_version: null }, '11111111-1111-4111-8111-111111111111');
    expect(setQuery).toHaveBeenCalledWith({ completion_action: null });
  });
});
