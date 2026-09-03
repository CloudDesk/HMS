// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('../routing/navigation', () => ({ navigate }));
vi.mock('../hooks/imaging/useImagingQueueFeature', () => ({
  useImagingQueueFeature: () => ({
    branches: [{ id: 'branch-1', code: 'MB01', name: 'Main Branch' }],
    filters: { selectedBranch: 'branch-1' },
    updateFilters: vi.fn(),
    summary: { total: 11, by_status: { SUBMITTED: 8, RECEIVED: 0, IN_PROGRESS: 3, REPORT_ENTERED: 0, VERIFIED: 0, COMPLETED: 0 } },
    isSummaryLoading: false,
  }),
}));

import { ImagingDashboardPage } from './ImagingDashboardPage';

describe('ImagingDashboardPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    navigate.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders summary-only imaging content and opens filtered standalone queues', async () => {
    await act(async () => root.render(<ImagingDashboardPage />));
    expect(container.textContent).toContain('Total Requests11');
    expect(container.textContent).toContain('Completed0');
    expect(container.textContent).toContain('Imaging Workflow');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();

    const inProgress = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('In Progress'));
    await act(async () => inProgress?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=imaging', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/imaging/queue?status=IN_PROGRESS&branch_id=branch-1');
  });
});
