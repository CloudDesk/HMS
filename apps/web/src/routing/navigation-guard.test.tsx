import { confirmAction } from '../components/ui/confirm-action';
vi.mock('../components/ui/confirm-action', () => ({ confirmAction: vi.fn().mockResolvedValue(true) }));
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from './navigation';
import { useOphthalmologyDraftGuard } from '../hooks/ophthalmology/useOphthalmologyDraftGuard';

describe('optional editor navigation guard', () => {
  let root: Root; let container: HTMLDivElement;
  function Harness({ dirty = true }: { dirty?: boolean }) { useOphthalmologyDraftGuard(dirty, ['visit_id', 'section', 'task_id']); return null; }
  beforeEach(() => { window.history.replaceState(null, '', '/opd/ophthalmology?visit_id=QA&section=tests&task_id=QA'); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  it('retains the current URL when an unsaved editor declines sidebar navigation', async () => {
    const confirm = vi.mocked(confirmAction).mockReset().mockResolvedValue(false);
    await act(async () => root.render(<Harness />)); await act(async () => { navigate('/dashboard'); });
    expect(window.location.pathname).toBe('/opd/ophthalmology'); expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('allows lookup pagination without discarding the same clinical draft', async () => {
    const confirm = vi.mocked(confirmAction).mockReset().mockResolvedValue(false);
    await act(async () => root.render(<Harness />)); await act(async () => { navigate('/opd/ophthalmology?visit_id=QA&section=tests&task_id=QA&attachment_page=2'); });
    expect(window.location.search).toContain('attachment_page=2'); expect(confirm).not.toHaveBeenCalled();
  });
  it('confirms task changes and permits authorised departure', async () => {
    vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
    await act(async () => root.render(<Harness />)); await act(async () => { navigate('/opd/ophthalmology?visit_id=QA&section=tests&task_id=NEXT'); });
    expect(window.location.search).toContain('task_id=NEXT');
  });
  it('does not block session-expiry login or a clean editor', async () => {
    const confirm = vi.mocked(confirmAction).mockReset().mockResolvedValue(false);
    await act(async () => root.render(<Harness />)); await act(async () => { navigate('/login'); }); expect(window.location.pathname).toBe('/login');
    await act(async () => root.render(<Harness dirty={false} />)); await act(async () => { navigate('/dashboard'); }); expect(window.location.pathname).toBe('/dashboard'); expect(confirm).not.toHaveBeenCalled();
  });
  it('asks once for multiple dirty editors and preserves replace navigation', async () => {
    vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
    await act(async () => root.render(<><Harness /><Harness /></>));
    const replace = vi.spyOn(window.history, 'replaceState');
    await act(async () => { navigate('/dashboard', { replace: true }); });
    expect(confirmAction).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/dashboard');
    expect(replace).toHaveBeenCalledWith(null, '', '/dashboard');
  });
  it('cancels native same-document Back/Forward traversal when the browser exposes Navigation events', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'navigation'); const navigation = new EventTarget();
    Object.defineProperty(window, 'navigation', { configurable: true, value: navigation });
    try {
      vi.mocked(confirmAction).mockReset().mockResolvedValue(false); await act(async () => root.render(<Harness />));
      const event = new Event('navigate', { cancelable: true });
      Object.defineProperties(event, { navigationType: { value: 'traverse' }, destination: { value: { url: `${window.location.origin}/dashboard` } } });
      expect(navigation.dispatchEvent(event)).toBe(false); expect(event.defaultPrevented).toBe(true);
    } finally { if (original) Object.defineProperty(window, 'navigation', original); else Reflect.deleteProperty(window, 'navigation'); }
  });
});
