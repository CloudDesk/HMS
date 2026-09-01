// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionQueuePage } from './PrescriptionQueuePage';

const testState = vi.hoisted(() => ({ feature: vi.fn() }));

vi.mock('../hooks/pharmacy/usePharmacyDispensingFeature', () => ({
  usePharmacyDispensingFeature: () => testState.feature(),
}));
vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ search: '' }),
}));
vi.mock('../api/useSettings', () => ({
  useCurrencyFormatter: () => (value: number) => `KES ${value.toFixed(2)}`,
}));
vi.mock('../components/ui/Modal', () => ({
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div>,
}));

const line = (id: string, name: string, quantity: number, unitPrice: number) => ({
  id,
  prescriptionItemId: `prescription-${id}`,
  prescribedMedicineName: name,
  requestedQuantity: quantity,
  medicineId: `medicine-${id}`,
  selectedMedicineName: name,
  batchId: `batch-${id}`,
  batchNumberSnapshot: `BATCH-${id}`,
  availableQuantitySnapshot: 20,
  unitPriceSnapshot: unitPrice,
  confirmedQuantity: quantity,
  pharmacistInstructions: '',
  batchNumber: `BATCH-${id}`,
  availableQuantity: 20,
  unitPrice,
  lineTotal: quantity * unitPrice,
  batchOptions: [{ id: `batch-${id}`, medicine_id: `medicine-${id}`, batch_number: `BATCH-${id}`, quantity_on_hand: 20, unit_price: unitPrice, expiry_date: '2027-09-01' }],
  insufficientStock: false,
  invalidQuantity: false,
});

describe('PrescriptionQueuePage dispensing detail', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const detail = {
      id: 'dispensing-1',
      prescription_id: 'prescription-1',
      patient_id: 'patient-1',
      source_type: 'OPD_VISIT',
      encounter_id: 'visit-1',
      admission_id: null,
      procedure_id: null,
      patient_number: 'HMS-2026-000015',
      patient_name: 'Unknown Female #1',
      doctor_name: 'Dr. Anderson James',
      visit_id: 'visit-1',
      branch_id: 'branch-1',
      status: 'DRAFT',
      version: 0,
      items: [],
      invoice_id: null,
      invoice_number: null,
      submitted_at: '2026-09-01T14:48:00.000Z',
      confirmed_at: null,
      cancelled_at: null,
      reversed_at: null,
      reversal_reason: null,
      created_at: '2026-09-01T14:48:00.000Z',
      updated_at: '2026-09-01T14:48:00.000Z',
    };
    testState.feature.mockReturnValue({
      branches: [{ id: 'branch-1', code: 'NBO', name: 'Nairobi' }],
      activeBranchId: 'branch-1',
      permissions: { canView: true, canEdit: true, canDispense: true, canCancel: true, canReverse: true },
      dispensings: [detail],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      pendingCount: 1,
      dispensedTodayCount: 0,
      listLoading: false,
      listError: '',
      refetch: vi.fn(),
      selectedPrescriptionId: 'prescription-1',
      detail,
      detailLoading: false,
      detailError: '',
      actionError: '',
      isDirty: false,
      isMutating: false,
      batchesLoading: false,
      lines: [line('1', 'Paracetamol', 2, 100), line('2', 'Amoxicillin', 1, 350)],
      dispensingTotal: 550,
      actions: {
        openDispensing: vi.fn(), closeDispensing: vi.fn(), selectBatch: vi.fn(), setConfirmedQuantity: vi.fn(),
        setInstructions: vi.fn(), saveDraft: vi.fn(), confirmDispensing: vi.fn(), cancelDispensing: vi.fn(), reverseDispensing: vi.fn(),
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the persisted source, each batch price, line totals, and grand total', async () => {
    await act(async () => root.render(<PrescriptionQueuePage />));

    const text = container.textContent ?? '';
    expect(text.match(/OPD Consultation/g)).toHaveLength(2);
    expect(text).toContain('KES 100.00');
    expect(text).toContain('KES 200.00');
    expect(text).toContain('KES 350.00');
    expect(text).toContain('KES 550.00');
  });

  it('renders Emergency from the same persisted source contract', async () => {
    const state = testState.feature();
    state.detail.source_type = 'EMERGENCY_ENCOUNTER';
    state.dispensings[0].source_type = 'EMERGENCY_ENCOUNTER';
    testState.feature.mockReturnValue(state);

    await act(async () => root.render(<PrescriptionQueuePage />));

    expect((container.textContent ?? '').match(/Emergency/g)).toHaveLength(2);
  });

  it('prevents confirmation while a line has insufficient stock', async () => {
    const state = testState.feature();
    state.lines[0].insufficientStock = true;
    testState.feature.mockReturnValue(state);

    await act(async () => root.render(<PrescriptionQueuePage />));

    const confirm = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm Dispensing'),
    );
    expect(confirm?.disabled).toBe(true);
  });
});
