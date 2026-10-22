import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';
import type { BillingInvoiceList } from '../../api/billing';
import type { CompletionWorkspace } from './useOphthalmologyCompletionFeature';
const state = vi.hoisted(() => ({ permissions: [] as AuthPermission[], search: '?id=visit&section=completion',
  data: undefined as BillingInvoiceList | undefined, error: false, scopeError: false, refetch: vi.fn(), query: vi.fn(), navigate: vi.fn() }));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [] } }) }));
vi.mock('../../routing/navigation', () => ({ useAppLocation: () => ({ search: state.search }), navigate: state.navigate }));
vi.mock('../billing/useBilling', () => ({ useBillingInvoices: (...args: unknown[]) => {
  state.query(...args); return { data: state.data, isError: state.error, isFetching: false, refetch: state.refetch };
} }));
import { useOphthalmologyBillingFeature } from './useOphthalmologyBillingFeature';
describe('Ophthalmology billing handoff', () => {
  let root: Root; let container: HTMLDivElement; let feature: ReturnType<typeof useOphthalmologyBillingFeature>;
  const workspace = (): CompletionWorkspace => ({ visitId: 'visit', visit: { patient_id: 'patient', branch_id: 'branch', department_id: 'department', status: 'COMPLETED' },
    context: { id: 'context', version: 1, configuration_version_id: 'configuration', workflow_status: 'CONSULTATION_COMPLETED' },
    canView: true, scopeError: state.scopeError, visitQuery: { isError: false }, contextQuery: { isError: false, refetch: vi.fn() } });
  const grant = () => { state.permissions = [
    { module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View', code: 'Ophthalmology Consultation.View' },
    { module: 'Billing', screen: 'Invoices', action: 'View', code: 'Invoices.View' },
  ]; };
  function Harness() { feature = useOphthalmologyBillingFeature(workspace()); return null; }
  beforeEach(() => { state.permissions = []; state.search = '?id=visit&section=completion'; state.data = undefined; state.error = false; state.scopeError = false;
    vi.clearAllMocks(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('gates requests and manual refresh by both permissions, active area and encounter scope', async () => {
    await act(async () => root.render(<Harness />)); expect(state.query).toHaveBeenLastCalledWith(expect.anything(), false);
    await feature.refresh(); expect(state.refetch).not.toHaveBeenCalled();
    grant(); await act(async () => root.render(<Harness />));
    expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ patient_id: 'patient', branch_id: 'branch', page: 1, limit: 20 }), true);
    await feature.refresh(); expect(state.refetch).toHaveBeenCalledOnce();
    state.scopeError = true; await act(async () => root.render(<Harness />)); expect(feature.active).toBe(false);
    state.scopeError = false; state.search = '?section=intake'; await act(async () => root.render(<Harness />)); expect(feature.active).toBe(false);
  });
  it('normalizes pagination and preserves encounter URL context', async () => {
    grant(); state.search += '&billing_page=-3'; state.data = { data: [], meta: { page: 1, limit: 20, total: 21, totalPages: 2 } };
    await act(async () => root.render(<Harness />)); expect(feature.page).toBe(1);
    feature.setPage(2); expect(state.navigate).toHaveBeenCalledWith('/opd/ophthalmology?id=visit&section=completion&billing_page=2');
    state.navigate.mockClear(); feature.setPage(3); expect(state.navigate).not.toHaveBeenCalled();
  });
  it('preserves multiple invoices, hides failed or foreign data and guards invoice navigation', async () => {
    grant();
    const invoice = { id: 'invoice-1', invoice_number: 'INV-1', patient_id: 'patient', patient_number: null, patient_name: null, visit_id: 'visit', visit_number: null,
      source_type: 'OPD' as const, encounter_id: 'visit', admission_id: null, procedure_id: null, appointment_id: null, appointment_number: null, branch_id: 'branch',
      context_type: null, context_id: null, branch_name: null, invoice_date: '2026-10-22', status: 'PARTIALLY_PAID' as const, subtotal: 100, discount_amount: 0,
      tax_amount: 0, total_amount: 100, paid_amount: 30, balance_amount: 70, items: [], created_by: null, updated_by: null, created_at: '', updated_at: '' };
    state.data = { data: [invoice, { ...invoice, id: 'invoice-2' }], meta: { page: 1, totalPages: 1, total: 2, limit: 20 } };
    await act(async () => root.render(<Harness />)); expect(feature.invoices).toHaveLength(2); expect(feature.invoices[0]?.balance_amount).toBe(70);
    feature.openInvoice('unknown'); expect(state.navigate).not.toHaveBeenCalled(); feature.openInvoice('invoice-2'); expect(state.navigate).toHaveBeenCalledWith('/billing/workspace?id=invoice-2');
    state.error = true; await act(async () => root.render(<Harness />)); expect(feature.invoices).toEqual([]);
    state.error = false; state.data.data = [{ ...invoice, patient_id: 'other' }]; await act(async () => root.render(<Harness />)); expect(feature.scopeError).toBe(true); expect(feature.invoices).toEqual([]);
    state.data.data = [{ ...invoice, branch_id: 'other' }]; await act(async () => root.render(<Harness />)); expect(feature.scopeError).toBe(true);
  });
});
