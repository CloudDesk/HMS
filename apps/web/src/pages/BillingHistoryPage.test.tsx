// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingHistoryPage } from './BillingHistoryPage';

const testState = vi.hoisted(() => ({ feature: vi.fn() }));

vi.mock('../hooks/billing/useBillingHistoryFeature', () => ({
  useBillingHistoryFeature: () => testState.feature(),
}));
vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ search: '' }),
}));
vi.mock('../api/useSettings', () => ({
  useCurrencyFormatter: () => (value: number) => `KES ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
}));

const mockInvoices = [
  {
    id: 'inv-1',
    invoice_number: 'INV-20260923-CDB73DF8',
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    patient_id: 'patient-1',
    patient_name: 'Mark P',
    patient_number: 'HMS-2026-000028',
    source_type: 'OPD' as const,
    encounter_id: 'enc-1',
    visit_number: 'OPD-2026-000059',
    invoice_date: '2026-09-23T10:00:00.000Z',
    total_amount: 40000,
    paid_amount: 40000,
    balance_amount: 0,
    status: 'PAID' as const,
    created_at: '2026-09-23T10:00:00.000Z',
    items: [],
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-20260924-EFA91B12',
    branch_id: 'branch-1',
    branch_name: 'Emergency Ward',
    patient_id: 'patient-2',
    patient_name: 'Sarah Connor',
    patient_number: 'HMS-2026-000045',
    source_type: 'EMERGENCY' as const,
    encounter_id: 'enc-2',
    visit_number: 'EMG-2026-000012',
    invoice_date: '2026-09-24T14:30:00.000Z',
    total_amount: 25000,
    paid_amount: 10000,
    balance_amount: 15000,
    status: 'PARTIALLY_PAID' as const,
    created_at: '2026-09-24T14:30:00.000Z',
    items: [],
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-20260920-ABC12345',
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    patient_id: 'patient-3',
    patient_name: 'Alice Wonder',
    patient_number: 'HMS-2026-000001',
    source_type: 'PROCEDURE' as const,
    encounter_id: 'enc-3',
    visit_number: 'PRC-2026-000030',
    invoice_date: '2026-09-20T08:00:00.000Z',
    total_amount: 45000,
    paid_amount: 0,
    balance_amount: 45000,
    status: 'DRAFT' as const,
    created_at: '2026-09-20T08:00:00.000Z',
    items: [],
  },
];

describe('BillingHistoryPage UI, Layout & Sorting', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    testState.feature.mockReturnValue({
      state: {
        page: 1,
        invoiceNumber: '',
        patientId: '',
        status: '',
        dateFrom: '',
        dateTo: '',
        branchId: '',
        invoiceInput: '',
        meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
      },
      capabilities: { canCreate: true },
      queries: {
        branches: [{ id: 'branch-1', name: 'Main Branch' }],
        branchesQuery: { data: { data: [{ id: 'branch-1', name: 'Main Branch' }] } },
        patientsQuery: { data: { data: [{ id: 'patient-1', patient_number: 'HMS-001', first_name: 'Mark', last_name: 'P' }] } },
        invoicesQuery: {
          data: { data: mockInvoices, meta: { total: 3, page: 1, limit: 10, totalPages: 1 } },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        },
      },
      actions: {
        setInvoiceInput: vi.fn(),
        updateFilters: vi.fn(),
        clearFilters: vi.fn(),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders all 9 table columns with colgroup percentages summing to 100%', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const table = container.querySelector('.billing-history-table');
    expect(table).not.toBeNull();

    // Check colgroup
    const cols = container.querySelectorAll('.billing-history-table colgroup col');
    expect(cols).toHaveLength(9);

    const widths = Array.from(cols).map((col) => (col as HTMLElement).style.width);
    expect(widths).toEqual(['13.5%', '15%', '10.5%', '8.5%', '10.5%', '10.5%', '12%', '12.5%', '7%']);

    const numericSum = widths.reduce((sum, w) => sum + parseFloat(w), 0);
    expect(numericSum).toBeCloseTo(100, 1);

    // Check header columns
    const headers = container.querySelectorAll('.billing-history-table thead th');
    expect(headers).toHaveLength(9);
    expect(headers[0]?.textContent).toContain('Invoice Number');
    expect(headers[1]?.textContent).toContain('Patient');
    expect(headers[2]?.textContent).toContain('Source');
    expect(headers[3]?.textContent).toContain('Invoice Date');
    expect(headers[4]?.textContent).toContain('Total');
    expect(headers[5]?.textContent).toContain('Paid');
    expect(headers[6]?.textContent).toContain('Balance');
    expect(headers[7]?.textContent).toContain('Status');

    // Check amount alignment classes
    expect(headers[4]?.className).toContain('align-right');
    expect(headers[5]?.className).toContain('align-right');
    expect(headers[6]?.className).toContain('align-right');
    expect(headers[7]?.className).toContain('align-center');
    expect(headers[8]?.className).toContain('align-center');

    // Verify sortable class on columns 0-7 and NOT on actions column (index 8)
    for (let i = 0; i <= 7; i++) {
      expect(headers[i]?.className).toContain('sortable');
    }
    expect(headers[8]?.className).not.toContain('sortable');
  });

  it('renders invoice details with prominent patient name, muted monospace MRN, and branch', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows).toHaveLength(3);

    // Row 1: Paid invoice
    const row1 = rows[0]!;
    expect(row1.querySelector('.billing-invoice-code')?.textContent).toBe('INV-20260923-CDB73DF8');
    expect(row1.querySelector('.billing-invoice-branch')?.textContent).toBe('Main Branch');
    expect(row1.querySelector('.billing-patient-name')?.textContent).toBe('Mark P');
    expect(row1.querySelector('.billing-patient-mrn')?.textContent).toBe('HMS-2026-000028');

    // Source badge
    const sourceBadge = row1.querySelector('.billing-source-badge');
    expect(sourceBadge?.textContent).toBe('OPD Encounter');
    expect(sourceBadge?.className).toContain('source-opd');

    // Amounts
    expect(row1.querySelector('.col-total-cell')?.textContent).toContain('KES 40,000.00');
    expect(row1.querySelector('.col-paid-cell')?.textContent).toContain('KES 40,000.00');
    expect(row1.querySelector('.col-balance-cell')?.textContent).toContain('KES 0.00');
    expect(row1.querySelector('.billing-balance-clear')).not.toBeNull();

    // Status
    expect(row1.querySelector('.billing-status')?.textContent).toBe('Paid');

    // Action button
    const actionBtn = row1.querySelector('.billing-action-btn');
    expect(actionBtn).not.toBeNull();
    expect(actionBtn?.getAttribute('aria-label')).toBe('View INV-20260923-CDB73DF8');
  });

  it('renders partially paid invoice with due balance highlighted in red', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const rows = container.querySelectorAll('.billing-history-table tbody tr');
    const row2 = rows[1]!;

    expect(row2.querySelector('.billing-invoice-code')?.textContent).toBe('INV-20260924-EFA91B12');
    expect(row2.querySelector('.billing-patient-name')?.textContent).toBe('Sarah Connor');
    expect(row2.querySelector('.billing-source-badge')?.textContent).toBe('Emergency Encounter');
    expect(row2.querySelector('.billing-source-badge')?.className).toContain('source-emergency');

    expect(row2.querySelector('.col-total-cell')?.textContent).toContain('KES 25,000.00');
    expect(row2.querySelector('.col-paid-cell')?.textContent).toContain('KES 10,000.00');
    expect(row2.querySelector('.col-balance-cell')?.textContent).toContain('KES 15,000.00');
    expect(row2.querySelector('.billing-balance-due')).not.toBeNull();
    expect(row2.querySelector('.billing-status')?.textContent).toBe('Partially Paid');
  });

  it('supports functional sorting on numeric currency columns (Total, Paid, Balance)', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const headers = container.querySelectorAll('.billing-history-table thead th');
    const totalTh = headers[4] as HTMLTableCellElement; // Total

    // Click Total -> asc: 25000, 40000, 45000
    act(() => {
      totalTh.click();
    });

    let rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.col-total-cell')?.textContent).toContain('KES 25,000.00');
    expect(rows[1]?.querySelector('.col-total-cell')?.textContent).toContain('KES 40,000.00');
    expect(rows[2]?.querySelector('.col-total-cell')?.textContent).toContain('KES 45,000.00');
    expect(totalTh.getAttribute('aria-sort')).toBe('ascending');

    // Click Total again -> desc: 45000, 40000, 25000
    act(() => {
      totalTh.click();
    });

    rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.col-total-cell')?.textContent).toContain('KES 45,000.00');
    expect(rows[1]?.querySelector('.col-total-cell')?.textContent).toContain('KES 40,000.00');
    expect(rows[2]?.querySelector('.col-total-cell')?.textContent).toContain('KES 25,000.00');
    expect(totalTh.getAttribute('aria-sort')).toBe('descending');

    // Click Balance -> asc: 0, 15000, 45000
    const balanceTh = headers[6] as HTMLTableCellElement;
    act(() => {
      balanceTh.click();
    });

    rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.col-balance-cell')?.textContent).toContain('KES 0.00');
    expect(rows[1]?.querySelector('.col-balance-cell')?.textContent).toContain('KES 15,000.00');
    expect(rows[2]?.querySelector('.col-balance-cell')?.textContent).toContain('KES 45,000.00');
  });

  it('supports functional sorting on patient names and dates', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const headers = container.querySelectorAll('.billing-history-table thead th');
    const patientTh = headers[1] as HTMLTableCellElement; // Patient

    // Click Patient -> asc: Alice Wonder, Mark P, Sarah Connor
    act(() => {
      patientTh.click();
    });

    let rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.billing-patient-name')?.textContent).toBe('Alice Wonder');
    expect(rows[1]?.querySelector('.billing-patient-name')?.textContent).toBe('Mark P');
    expect(rows[2]?.querySelector('.billing-patient-name')?.textContent).toBe('Sarah Connor');

    // Click Patient again -> desc: Sarah Connor, Mark P, Alice Wonder
    act(() => {
      patientTh.click();
    });

    rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.billing-patient-name')?.textContent).toBe('Sarah Connor');
    expect(rows[1]?.querySelector('.billing-patient-name')?.textContent).toBe('Mark P');
    expect(rows[2]?.querySelector('.billing-patient-name')?.textContent).toBe('Alice Wonder');

    // Click Date -> asc: Sep 20, Sep 23, Sep 24
    const dateTh = headers[3] as HTMLTableCellElement;
    act(() => {
      dateTh.click();
    });

    rows = container.querySelectorAll('.billing-history-table tbody tr');
    expect(rows[0]?.querySelector('.billing-invoice-code')?.textContent).toBe('INV-20260920-ABC12345');
    expect(rows[1]?.querySelector('.billing-invoice-code')?.textContent).toBe('INV-20260923-CDB73DF8');
    expect(rows[2]?.querySelector('.billing-invoice-code')?.textContent).toBe('INV-20260924-EFA91B12');
  });

  it('renders filter form with labeled fields, wrapping classes, and search/clear buttons', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    expect(container.querySelector('.billing-filter-card')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-invoice')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-patient')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-status')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-date-from')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-date-to')).not.toBeNull();
    expect(container.querySelector('.billing-filter-field.col-branch')).not.toBeNull();
    expect(container.querySelector('.billing-filter-actions')).not.toBeNull();

    const searchBtn = container.querySelector('.billing-filter-actions button[type="submit"]');
    expect(searchBtn?.textContent).toContain('Search');

    const clearBtn = container.querySelector('.billing-filter-actions button.btn-secondary');
    expect(clearBtn?.textContent).toContain('Clear');
  });

  it('renders pagination bar with record summary and page navigation controls', () => {
    act(() => {
      root.render(<BillingHistoryPage />);
    });

    const pagination = container.querySelector('.um-pagination');
    expect(pagination).not.toBeNull();
    expect(container.querySelector('.um-showing')?.textContent).toBe('Showing 1–3 of 3');
    expect(container.querySelector('.um-page-size select')).not.toBeNull();
    expect(container.querySelectorAll('.um-page-controls .pg-btn')).toHaveLength(3);
  });

  it('renders medical loading state when invoices query is loading', () => {
    testState.feature.mockReturnValue({
      state: { page: 1, invoiceNumber: '', patientId: '', status: '', dateFrom: '', dateTo: '', branchId: '', invoiceInput: '', meta: { total: 0, page: 1, limit: 10, totalPages: 1 } },
      capabilities: { canCreate: true },
      queries: {
        branches: [],
        branchesQuery: { data: { data: [] } },
        patientsQuery: { data: { data: [] } },
        invoicesQuery: { data: null, isLoading: true, isError: false, refetch: vi.fn() },
      },
      actions: { setInvoiceInput: vi.fn(), updateFilters: vi.fn(), clearFilters: vi.fn() },
    });

    act(() => {
      root.render(<BillingHistoryPage />);
    });

    expect(container.textContent).toContain('Loading billing history...');
  });

  it('renders empty state when no invoices match the filters', () => {
    testState.feature.mockReturnValue({
      state: { page: 1, invoiceNumber: '', patientId: '', status: '', dateFrom: '', dateTo: '', branchId: '', invoiceInput: '', meta: { total: 0, page: 1, limit: 10, totalPages: 1 } },
      capabilities: { canCreate: true },
      queries: {
        branches: [],
        branchesQuery: { data: { data: [] } },
        patientsQuery: { data: { data: [] } },
        invoicesQuery: { data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() },
      },
      actions: { setInvoiceInput: vi.fn(), updateFilters: vi.fn(), clearFilters: vi.fn() },
    });

    act(() => {
      root.render(<BillingHistoryPage />);
    });

    expect(container.textContent).toContain('No invoices match the selected filters.');
  });
});
