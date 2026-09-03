// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('../routing/navigation', () => ({ navigate }));
vi.mock('../hooks/pharmacy/usePharmacyInventoryFeature', () => ({
  usePharmacyInventoryFeature: () => ({
    branches: [{ id: 'branch-1', code: 'MB01', name: 'Main Branch' }],
    activeBranchId: 'branch-1',
    isLoading: false,
    summary: {
      total_medicines: 10,
      stocked_medicines: 8,
      total_available_quantity: 1250,
      low_stock_medicines: 2,
      out_of_stock_medicines: 1,
      expiring_soon_medicines: 3,
      expired_medicines: 1,
      expiry_warning_days: 30,
    },
  }),
}));

import { PharmacyInventoryDashboardPage } from './PharmacyInventoryDashboardPage';

describe('PharmacyInventoryDashboardPage', () => {
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

  it('shows summary-only inventory content and links alerts to filtered inventory', async () => {
    await act(async () => root.render(<PharmacyInventoryDashboardPage />));

    expect(container.textContent).toContain('Medicines Stocked8');
    expect(container.textContent).toContain('Stock Coverage');
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toContain('Register Batch');

    const stocked = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Medicines Stocked'));
    await act(async () => stocked?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy-inventory', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/inventory?branch_id=branch-1');

    navigate.mockClear();
    const totalUnits = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Total Units'));
    await act(async () => totalUnits?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy-inventory', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/inventory?branch_id=branch-1');

    navigate.mockClear();
    const lowStock = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Low Stock'));
    await act(async () => lowStock?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy-inventory', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/inventory?branch_id=branch-1&stock_state=LOW_STOCK');
  });
});
