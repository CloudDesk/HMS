import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ canView: true, active: true, isError: false, isLoading: false, scopeError: false, refresh: vi.fn(), openInvoice: vi.fn() }));
vi.mock('../../hooks/ophthalmology/useOphthalmologyBillingFeature', () => ({ useOphthalmologyBillingFeature: () => ({ ...state,
  query: { isError: state.isError, isLoading: state.isLoading, isFetching: false, data: { meta: { totalPages: 2 } } },
  page: 1, visitId: 'visit', setPage: vi.fn(), invoices: state.isError || state.scopeError ? [] : [
    { id: 'one', invoice_number: 'INV-1', source_type: 'OPD', visit_id: 'visit', status: 'PARTIALLY_PAID', total_amount: 100, paid_amount: 30, balance_amount: 70 },
    { id: 'two', invoice_number: 'INV-2', source_type: 'OPD', visit_id: 'other', status: 'PAID', total_amount: 50, paid_amount: 50, balance_amount: 0 },
  ],
}) }));
import { OphthalmologyBillingCard } from './OphthalmologyBillingCard';
describe('Ophthalmology invoice status display', () => {
  let root: Root; let container: HTMLDivElement;
  const render = async () => act(async () => root.render(<OphthalmologyBillingCard workspace={{ visitId: 'visit', canView: true, scopeError: false, visitQuery: { isError: false }, contextQuery: { isError: false, refetch: vi.fn() } }} />));
  beforeEach(() => { Object.assign(state, { canView: true, active: true, isError: false, isLoading: false, scopeError: false }); vi.clearAllMocks(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('shows authoritative payments and distinguishes encounters without claiming journey completion', async () => {
    await render(); expect(container.textContent).toContain('Partially Paid'); expect(container.textContent).toContain('70.00');
    expect(container.textContent).toContain('Current encounter'); expect(container.textContent).toContain('Other encounter');
    expect(container.textContent).toContain('paginated across encounters');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Open invoice');
    await act(async () => button?.click()); expect(state.openInvoice).toHaveBeenCalledWith('one');
  });
  it('hides stale payments on failure and provides retry', async () => {
    state.isError = true; await render(); expect(container.querySelector('[role="alert"]')).not.toBeNull(); expect(container.querySelector('table')).toBeNull();
    await act(async () => container.querySelector('button')?.click()); expect(state.refresh).toHaveBeenCalledOnce();
    state.isError = false; state.scopeError = true; await render(); expect(container.textContent).toContain('do not match'); expect(container.querySelector('table')).toBeNull();
  });
  it('shows permission and loading states', async () => {
    state.canView = false; await render(); expect(container.textContent).toContain('permission is required'); expect(container.querySelector('table')).toBeNull();
    state.canView = true; state.isLoading = true; await render(); expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading invoices');
  });
});
