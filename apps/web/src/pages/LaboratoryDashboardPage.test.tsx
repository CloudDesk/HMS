// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('../routing/navigation', () => ({ navigate }));
vi.mock('../hooks/laboratory/useLaboratoryQueueFeature', () => ({
  useLaboratoryQueueFeature: () => ({
    branches: [{ id: 'branch-1', code: 'MB01', name: 'Main Branch' }],
    filters: { selectedBranch: 'branch-1' },
    updateFilters: vi.fn(),
    summary: {
      total: 12,
      by_status: { SUBMITTED: 10, RECEIVED: 0, SAMPLE_COLLECTED: 0, IN_PROGRESS: 1, RESULT_ENTERED: 1, VERIFIED: 0, COMPLETED: 0 },
    },
    isSummaryLoading: false,
  }),
}));

import { LaboratoryDashboardPage } from './LaboratoryDashboardPage';

describe('LaboratoryDashboardPage', () => {
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

  it('renders summary-only laboratory content and opens the filtered standalone queue', async () => {
    await act(async () => root.render(<LaboratoryDashboardPage />));

    expect(container.textContent).toContain('Total Orders12');
    expect(container.textContent).toContain('Laboratory Workflow');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();

    const totalOrders = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Total Orders'));
    await act(async () => totalOrders?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=laboratory', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/laboratory/queue?branch_id=branch-1');

    navigate.mockClear();
    const submitted = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('New Orders'));
    await act(async () => submitted?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=laboratory', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/laboratory/queue?status=SUBMITTED&branch_id=branch-1');
  });
});
