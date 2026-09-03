// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('../routing/navigation', () => ({ navigate }));

vi.mock('../hooks/pharmacy/usePharmacyDispensingFeature', () => ({
  usePharmacyDispensingFeature: () => ({
    branches: [{ id: 'branch-1', code: 'MB01', name: 'Main Branch' }],
    activeBranchId: 'branch-1',
    pendingCount: 6,
    confirmedCount: 9,
    summaryLoading: false,
    summaryError: false,
    listLoading: false,
    listError: '',
    dispensings: [{
      prescription_id: 'prescription-1',
      patient_name: 'David George',
      patient_number: 'HMS-001',
      source_type: 'OPD_VISIT',
      doctor_name: 'Dr. Anderson',
      items: [{ id: 'item-1' }],
      submitted_at: '2026-09-01T10:42:00.000Z',
    }],
  }),
}));

import { PharmacyQueueDashboardPage } from './PharmacyQueueDashboardPage';

describe('PharmacyQueueDashboardPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows read-only live summary details without the dispensing table or actions', async () => {
    await act(async () => root.render(<PharmacyQueueDashboardPage />));

    expect(container.textContent).toContain('Pending Prescriptions6');
    expect(container.textContent).toContain('Dispensed Prescriptions9');
    expect(container.textContent).toContain('Completion Rate60%');
    expect(container.textContent).toContain('David George');
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toContain('Open Dispensing');

    const pendingCard = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Pending Prescriptions'));
    await act(async () => pendingCard?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/queue?status=PENDING&branch=branch-1');

    const dispensedCard = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Dispensed Prescriptions'));
    await act(async () => dispensedCard?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/queue?status=CONFIRMED&branch=branch-1');

    const prescriptionCard = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('David George'));
    await act(async () => prescriptionCard?.click());
    expect(navigate).toHaveBeenCalledWith('/dashboard?tab=pharmacy', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/pharmacy/queue?status=PENDING&prescription=prescription-1&branch=branch-1');
  });
});
