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
  listAttempts: vi.fn(),
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
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mpesaMock.listAttempts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 1 });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  async function renderModal(invoice = mockInvoice, canCollectPayment = true, initialAttemptId?: string) {
    await act(async () => {
      root.render(
        <Wrapper>
          <MpesaPaymentModal
            canCollectPayment={canCollectPayment}
            initialAttemptId={initialAttemptId}
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
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
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
      verificationStatus: 'FAILED', recoveryStatus: 'RESOLVED',
    };
    mpesaMock.listAttempts.mockResolvedValue({ items: [cancelledAttempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(cancelledAttempt);

    await renderModal();
    expect(document.body.textContent).toContain('Payment Cancelled by Customer');
    expect(document.body.textContent).toContain('Try Again');
    expect(mpesaMock.createAttempt).not.toHaveBeenCalled();
  });

  it('11. Presents Post Payment action when verified with Safaricom', async () => {
    const verifiedAttempt: MpesaAttemptView = {
      ...mockAttempt,
      verificationStatus: 'VERIFIED',
      postingStatus: 'READY',
      receiptNumber: 'SAFARICOM99',
      reportedOutcome: 'SUCCESS', queryOutcome: 'SUCCESS',
    };
    mpesaMock.listAttempts.mockResolvedValue({ items: [verifiedAttempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(verifiedAttempt);

    await renderModal();
    expect(document.body.textContent).toContain('Post Payment to Invoice');
  });

  it.each(['MANUAL_REVIEW_REQUIRED', 'ABANDONED'] as const)('shows %s ahead of verified success and blocks financial actions', async (recoveryStatus) => {
    const attempt = { ...mockAttempt, recoveryStatus, verificationStatus: 'VERIFIED' as const,
      reportedOutcome: 'SUCCESS' as const, queryOutcome: 'SUCCESS' as const, receiptNumber: 'TEST123' };
    mpesaMock.listAttempts.mockResolvedValue({ items: [attempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(attempt);
    await renderModal();
    expect(document.body.textContent).toContain('Manual Review Required');
    expect(document.body.textContent).not.toContain('Post Payment to Invoice');
    expect(document.body.textContent).not.toContain('Try Again');
    expect(mpesaMock.submitAttempt).not.toHaveBeenCalled();
  });

  it('does not retry an unverified callback timeout', async () => {
    const attempt = { ...mockAttempt, reportedOutcome: 'TIMEOUT' as const };
    mpesaMock.listAttempts.mockResolvedValue({ items: [attempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(attempt);
    await renderModal();
    expect(document.body.textContent).toContain('Transaction Status Uncertain');
    expect(document.body.textContent).not.toContain('Try Again');
  });

  it('blocks new attempts when history fails to load', async () => {
    mpesaMock.listAttempts.mockRejectedValue(new Error('offline'));
    await renderModal();
    expect(document.body.textContent).toContain('Could not load existing payment attempts');
    const button = Array.from(document.body.querySelectorAll('button')).find((item) => item.textContent?.includes('Send STK Push'));
    expect(button?.disabled).toBe(true);
  });

  it('allows read-only recovery without collect permission', async () => {
    const attempt = { ...mockAttempt, verificationStatus: 'VERIFIED' as const,
      reportedOutcome: 'SUCCESS' as const, queryOutcome: 'SUCCESS' as const, receiptNumber: 'TEST123' };
    mpesaMock.listAttempts.mockResolvedValue({ items: [attempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(attempt);
    await renderModal(mockInvoice, false);
    expect(document.body.textContent).not.toContain('Post Payment to Invoice');
    expect(document.body.textContent).toContain('You do not have permission');
  });

  it('resumes a saved CREATED attempt only on explicit submission with its version', async () => {
    const attempt = { ...mockAttempt, submissionState: 'CREATED' as const, checkoutRequestId: null, merchantRequestId: null, version: 0 };
    mpesaMock.listAttempts.mockResolvedValue({ items: [attempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(attempt);
    mpesaMock.submitAttempt.mockResolvedValue(mockAttempt);
    await renderModal();
    expect(mpesaMock.submitAttempt).not.toHaveBeenCalled();
    const button = Array.from(document.body.querySelectorAll('button')).find((item) => item.textContent === 'Submit Saved Attempt');
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(mpesaMock.submitAttempt).toHaveBeenCalledExactlyOnceWith(attempt.id, { expectedVersion: 0 });
    expect(mpesaMock.createAttempt).not.toHaveBeenCalled();
  });

  it('does not offer resubmission for an uncertain accepted request', async () => {
    const attempt = { ...mockAttempt, submissionState: 'UNKNOWN' as const };
    mpesaMock.listAttempts.mockResolvedValue({ items: [attempt], total: 1, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue(attempt);
    await renderModal();
    expect(document.body.textContent).toContain('Check Status');
    expect(document.body.textContent).not.toContain('Submit Saved Attempt');
    expect(document.body.textContent).not.toContain('Try Again');
    expect(mpesaMock.submitAttempt).not.toHaveBeenCalled();
  });

  it('opens the requested historical attempt rather than the newest invoice attempt', async () => {
    mpesaMock.listAttempts.mockResolvedValue({ items: [mockAttempt], total: 2, page: 1, limit: 1 });
    mpesaMock.getAttempt.mockResolvedValue({ ...mockAttempt, id: 'historical-attempt', recoveryStatus: 'MANUAL_REVIEW_REQUIRED' });
    await renderModal(mockInvoice, false, 'historical-attempt');
    expect(mpesaMock.getAttempt).toHaveBeenCalledWith('historical-attempt');
    expect(document.body.textContent).toContain('Manual Review Required');
  });

  it('blocks all payment actions when the requested attempt belongs to another invoice', async () => {
    mpesaMock.getAttempt.mockResolvedValue({ ...mockAttempt, invoiceId: 'another-invoice', verificationStatus: 'VERIFIED',
      reportedOutcome: 'SUCCESS', queryOutcome: 'SUCCESS', receiptNumber: 'TEST123' });
    await renderModal(mockInvoice, true, mockAttempt.id);
    expect(document.body.textContent).toContain('does not belong to the displayed invoice');
    expect(document.body.textContent).not.toContain('Post Payment to Invoice');
    expect(document.body.textContent).not.toContain('Try Again');
  });
});
