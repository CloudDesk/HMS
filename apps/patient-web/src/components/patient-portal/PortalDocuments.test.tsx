import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalDocuments } from './PortalDocuments';

const mocks = vi.hoisted(() => ({ download: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock('../../api/patient-portal', () => ({ patientPortalApi: { downloadDocument: mocks.download } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({
    data: { data: [{ id: 'document-1', title: 'Test document', review_status: 'PENDING', source: 'PATIENT', mime_type: 'application/pdf', file_name: 'test.pdf', created_at: '2026-09-23T00:00:00Z', file_size_bytes: 100 }] },
    isLoading: false, isError: false,
  }),
}));

describe('patient document preview', () => {
  let root: Root;
  let container: HTMLDivElement;
  let preview: { opener: unknown; closed: boolean; location: { href: string }; close: ReturnType<typeof vi.fn> };
  const clickView = async () => {
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.trim() === 'View');
    if (!button) throw new Error('View button missing');
    await act(async () => button.click());
  };
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    preview = { opener: window, closed: false, location: { href: 'about:blank' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => preview));
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-document');
      static revokeObjectURL = vi.fn();
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<PortalDocuments patientId="patient-1" />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });
  it('retains the opened tab and removes its opener before fetching the authenticated document', async () => {
    mocks.download.mockImplementation(async () => {
      expect(preview.opener).toBeNull();
      return { blob: new Blob(['test'], { type: 'application/pdf' }) };
    });
    await clickView();
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(mocks.download).toHaveBeenCalledWith('patient-1', 'document-1');
    expect(preview.location.href).toBe('blob:test-document');
    expect(mocks.error).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-document');
  });
  it('reports a genuinely blocked popup without fetching a document', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    await clickView();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Allow pop-ups to view this document.');
  });
  it('closes the empty tab and reports a download failure', async () => {
    mocks.download.mockRejectedValue(new Error('Document unavailable'));
    await clickView();
    expect(preview.close).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith('Document unavailable');
  });
  it('does not navigate or allocate a blob URL after the user closes the tab', async () => {
    mocks.download.mockImplementation(async () => {
      preview.closed = true;
      return { blob: new Blob(['test']) };
    });
    await clickView();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
