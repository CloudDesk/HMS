import { confirmAction } from '../ui/confirm-action';
vi.mock('../ui/confirm-action', () => ({ confirmAction: vi.fn().mockResolvedValue(true) }));
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
vi.mock('../../hooks/ophthalmology/useOphthalmologyDraftGuard', () => ({ useOphthalmologyDraftGuard: () => vi.fn() }));
import { OphthalmologyCompletionActionDialog } from './OphthalmologyCompletionActionDialog';
describe('B5 original readiness snapshot and preserved exception reasons', () => {
  let root: Root; let container: HTMLDivElement; const override = vi.fn(); const setQuery = vi.fn();
  const feature = (version = 4, details = 'Review result') => ({ finalizationVersion: version, readiness: { consultation_version: version }, unmet: [{ code: 'ALL_RESULTS_RESOLVED', details, resource_ids: [] }], tasks: [], orders: [], doctors: [], writable: true, busy: false, error: null, override, setQuery }) as unknown as OphthalmologyCompletionFeature;
  beforeEach(() => { override.mockReset(); setQuery.mockReset(); vi.mocked(confirmAction).mockReset().mockResolvedValue(true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  async function reason(value: string) { const input = document.querySelector('textarea'); if (!input) throw new Error('Missing reason'); await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); return input; }
  async function submit() { await act(async () => { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
  it('sends the original version and complete unmet snapshot and retains a failed reason', async () => {
    await act(async () => root.render(<OphthalmologyCompletionActionDialog feature={feature()} action="override" />));
    const input = await reason('QA authorized exception'); override.mockResolvedValue(undefined); await submit();
    expect(override).toHaveBeenCalledWith({ expected_version: 4, expected_unmet_codes: ['ALL_RESULTS_RESOLVED'], reason: 'QA authorized exception' }); expect(input.value).toBe('QA authorized exception'); expect(setQuery).not.toHaveBeenCalled();
  });
  it('disables a dialog when readiness changes even if the finalization version and unmet codes are unchanged', async () => {
    await act(async () => root.render(<OphthalmologyCompletionActionDialog feature={feature()} action="override" />)); const input = await reason('My retained exception');
    const next = feature(); next.readiness = { ...next.readiness, consultation_version: 8 } as typeof next.readiness;
    await act(async () => root.render(<OphthalmologyCompletionActionDialog feature={next} action="override" />));
    expect(input.value).toBe('My retained exception'); expect(document.body.textContent).toContain('saved state or unmet requirements changed'); await submit(); expect(override).not.toHaveBeenCalled();
  });
  it('allows refreshing unavailable readiness without discarding the entered reason', async () => {
    const refresh = vi.fn(); const current = { ...feature(), writable: false, refresh };
    await act(async () => root.render(<OphthalmologyCompletionActionDialog feature={current} action="override" />));
    const button = Array.from(document.querySelectorAll('button')).find((row) => row.textContent === 'Refresh readiness/history');
    expect(button?.disabled).toBe(false); await act(async () => button?.click()); expect(refresh).toHaveBeenCalledOnce();
  });
  it('requires a reason and respects declined confirmation', async () => {
    await act(async () => root.render(<OphthalmologyCompletionActionDialog feature={feature()} action="override" />)); await submit(); expect(override).not.toHaveBeenCalled();
    await reason('QA reason'); vi.mocked(confirmAction).mockResolvedValue(false); await submit(); expect(override).not.toHaveBeenCalled();
  });
});
