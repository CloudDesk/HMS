import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OphthalmologyQueueFeature } from '../../hooks/ophthalmology/useOphthalmologyQueueFeature';
import type { QueueTask } from '../../api/ophthalmology-queue';
vi.mock('../../hooks/ophthalmology/useOphthalmologyDraftGuard', () => ({ useOphthalmologyDraftGuard: () => vi.fn() }));
import { OphthalmologyQueueActionDialog } from './OphthalmologyQueueActionDialog';

describe('queue action dialog preserves editing intent', () => {
  let root: Root; let container: HTMLDivElement;
  const id = '111111111111111111111111';
  const task = { id, station_id: id, patient_id: id, test_name: 'QA lensometry', laterality: 'OD', status: 'DRAFT', version: 3, assigned_user_id: id } as QueueTask;
  const actionSubmit = vi.fn(); const setQuery = vi.fn();
  const query = { isError: false, data: undefined, refetch: vi.fn() };
  const feature = (error: string | null = null) => ({ busy: false, writable: true, routeNext: false, canView: true, canConfigure: true, canUsers: true, actionSubmit, setQuery, positive: () => 1, stations: [], members: [], userId: id, station: undefined, stationQuery: query, stationsQuery: query, usersQuery: query, nextTaskQuery: query, nextTasksQuery: query, error }) as unknown as OphthalmologyQueueFeature;
  beforeEach(() => { actionSubmit.mockReset(); setQuery.mockReset(); vi.spyOn(window, 'confirm').mockReturnValue(true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const reason = () => { const input = document.querySelector('textarea'); if (!input) throw new Error('Missing reason'); return input; };
  async function typeReason(value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(reason(), value); reason().dispatchEvent(new Event('input', { bubbles: true })); }); }
  async function submit() { await act(async () => { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
  it('retains reason and original version after an error; a background refresh disables confirmation', async () => {
    await act(async () => root.render(<OphthalmologyQueueActionDialog feature={feature()} task={task} action="cancel" />));
    await typeReason('Patient requested cancellation'); actionSubmit.mockResolvedValue(undefined); await submit();
    expect(actionSubmit).toHaveBeenCalledWith({ action: 'cancel', task_id: id, body: { expected_version: 3, expected_status: 'DRAFT', reason: 'Patient requested cancellation' } });
    await act(async () => root.render(<OphthalmologyQueueActionDialog feature={feature('Conflict; refresh required')} task={{ ...task, version: 4 }} action="cancel" />));
    expect(reason().value).toBe('Patient requested cancellation');
    expect(document.body.textContent).toContain('This task changed');
    const confirm = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Confirm cancel test');
    expect(confirm?.disabled).toBe(true); expect(setQuery).not.toHaveBeenCalled();
  });
  it('rejects a blank reason and respects declined confirmation without submitting', async () => {
    await act(async () => root.render(<OphthalmologyQueueActionDialog feature={feature()} task={task} action="cancel" />));
    await submit(); expect(actionSubmit).not.toHaveBeenCalled();
    await typeReason('Patient requested cancellation'); vi.mocked(window.confirm).mockReturnValue(false); await submit(); expect(actionSubmit).not.toHaveBeenCalled();
  });
  it('allows station selection with task permissions and no Configuration View grant', async () => { const f = { ...feature(), canConfigure: false }; await act(async () => root.render(<OphthalmologyQueueActionDialog feature={f} task={{ ...task, status: 'ORDERED' }} action="assign" />)); const station = document.querySelector<HTMLSelectElement>('select[name="station_id"]'); expect(station?.disabled).toBe(false); const confirm = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Confirm assign'); expect(confirm?.disabled).not.toBe(true); expect(document.body.textContent).not.toContain('Configuration View permission is required'); });
  it('uses the same repeat key after an ambiguous response and closes only after saved success', async () => {
    await act(async () => root.render(<OphthalmologyQueueActionDialog feature={feature()} task={{ ...task, status: 'COMPLETED' }} action="request-repeat" />));
    await typeReason('Acquisition quality insufficient'); actionSubmit.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id });
    await submit(); expect(setQuery).not.toHaveBeenCalled(); await submit();
    expect(actionSubmit).toHaveBeenCalledTimes(2); expect(actionSubmit.mock.calls[0]?.[0]).toEqual(actionSubmit.mock.calls[1]?.[0]);
    expect(actionSubmit.mock.calls[0]?.[0]?.key).toMatch(/^[a-f0-9-]{36}$/); expect(setQuery).toHaveBeenCalledWith(expect.objectContaining({ action: null, task_id: id }));
  });
});
