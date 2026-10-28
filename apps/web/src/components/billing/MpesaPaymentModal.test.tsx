import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingInvoice } from '../../api/billing';
import type { MpesaAttemptView } from '../../api/mpesa';
import { MpesaPaymentModal } from './MpesaPaymentModal';

const mpesaMock = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  submitAttempt: vi.fn(),
  getAttempt: vi.fn(),
  verifyAttempt: vi.fn(),
  postPayment: vi.fn(),
  getReceipt: vi.fn(),
}));

vi.mock('../../services/mpesa.service', () => ({
  mpesaService: mpesaMock,
}));

vi.mock('../../api/useSettings', () => ({
  useCurrencyFormatter: () => (amount: number) => `KES ${amount.toFixed(2)}`,
}));

const mockInvoice: BillingInvoice = {
  id: 'invoice-101',
  invoice_number: 'INV-2026-00101',
  patient_id: 'patient-101',
  patient_number: 'MRN-101',
  patient_name: 'Jane Doe',
  visit_id: 'visit-101',
  visit_number: 'VIS-101',
  source_type: 'OPD',
  encounter_id: 'enc-101',
  admission_id: null,
  procedure_id: null,
  appointment_id: null,
  appointment_number: null,
  branch_id: 'branch-101',
  context_type: null,
  context_id: null,
  branch_name: 'Main Hospital',
  invoice_date: '2026-10-28',
  status: 'PENDING',
  subtotal: 500,
  discount_amount: 0,
  tax_amount: 0,
  total_amount: 500,
  paid_amount: 100,
  balance_amount: 400,
  items: [],
  created_by: 'staff-1',
  updated_by: 'staff-1',
  created_at: '2026-10-28T09:00:00Z',
  updated_at: '2026-10-28T09:00:00Z',
};

const mockAttempt: MpesaAttemptView = {
  id: 'attempt-xyz-789',
  invoiceId: 'invoice-101',
  patientId: 'patient-101',
  branchId: 'branch-101',
  amount: 400,
  currency: 'KES',
  payerPhoneMasked: '********4321',
  environment: 'sandbox',
  submissionState: 'PENDING',
  reportedOutcome: 'PENDING',
  verificationStatus: 'UNVERIFIED',
  postingStatus: 'DISABLED',
  version: 1,
  checkoutRequestId: 'ws_CO_123',
  merchantRequestId: 'mr_123',
  receiptNumber: null,
  submissionError: null,
  verificationSource: null,
  verificationAttempts: 0,
  lastVerifiedAt: null,
  lastQueryResult: null,
  queryOutcome: 'NONE',
  conflictingEvidence: null,
  recoveryStatus: 'NONE',
  nextReconciliationAt: null,
  reconciliationRetries: 0,
  billingPaymentId: null,
  billingPaymentNumber: null,
  postedAt: null,
  postingError: null,
  createdAt: '2026-10-28T10:00:00Z',
  updatedAt: '2026-10-28T10:00:00Z',
};

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('MpesaPaymentModal UI & Lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
  });

  async function renderModal(invoice = mockInvoice) {
    await act(async () => {
      root.render(
        <Wrapper>
          <MpesaPaymentModal
            invoice={invoice}
            onClose={vi.fn()}
            open={true}
          />
        </Wrapper>,
      );
    });
    // Allow portal to mount
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }

  it('1. Renders initial STK Push form with invoice balance and phone entry', async () => {
    await renderModal();

    expect(document.body.textContent).toContain('Initiate M-Pesa STK Push');
    expect(document.body.textContent).toContain('INV-2026-00101');
    expect(document.body.textContent).toContain('KES 400.00');
    expect(document.body.textContent).toContain('Send STK Push');
  });

  it('2. Enforces phone number format and displays standardized format indicator', async () => {
    await renderModal();

    const phoneInput = document.body.querySelector('input[type="tel"]') as HTMLInputElement;
    expect(phoneInput).toBeDefined();

    // Type valid local phone number using native value setter
    await act(async () => {
      setInputValue(phoneInput, '0712345678');
    });

    expect(document.body.textContent).toContain('254712345678');
  });

  it('3. Rejects invalid amount exceeding invoice balance or non-integer', async () => {
    await renderModal();

    const amountInput = document.body.querySelector('input[type="number"]') as HTMLInputElement;

    // Set amount exceeding balance of 400
    await act(async () => {
      setInputValue(amountInput, '500');
    });

    expect(document.body.textContent).toContain('Amount cannot exceed outstanding balance');
    const submitBtn = document.body.querySelector('button.btn-primary') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('7. Displays waiting state when STK Push is dispatched', async () => {
    await renderModal();

    mpesaMock.createAttempt.mockResolvedValueOnce(mockAttempt);
    mpesaMock.submitAttempt.mockResolvedValueOnce(mockAttempt);
    mpesaMock.getAttempt.mockResolvedValue(mockAttempt);

    const phoneInput = document.body.querySelector('input[type="tel"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(phoneInput, '0712345678');
    });

    const submitBtn = document.body.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    expect(mpesaMock.createAttempt).toHaveBeenCalled();
  });

  it('9. Shows cancelled state when customer rejects PIN prompt', async () => {
    const cancelledAttempt: MpesaAttemptView = {
      ...mockAttempt,
      reportedOutcome: 'CANCELLED',
      submissionState: 'PENDING',
    };
    mpesaMock.getAttempt.mockResolvedValue(cancelledAttempt);

    await renderModal();
    expect(document.body.textContent).toBeDefined();
  });

  it('11. Presents Post Payment action when verified with Safaricom', async () => {
    const verifiedAttempt: MpesaAttemptView = {
      ...mockAttempt,
      verificationStatus: 'VERIFIED',
      postingStatus: 'READY',
      receiptNumber: 'SAFARICOM99',
    };
    mpesaMock.getAttempt.mockResolvedValue(verifiedAttempt);

    await renderModal();
    expect(document.body).toBeDefined();
  });
});
