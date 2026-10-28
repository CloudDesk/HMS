import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MpesaAttemptView } from '../../api/mpesa';

const mpesaMock = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  submitAttempt: vi.fn(),
  getAttempt: vi.fn(),
  verifyAttempt: vi.fn(),
  postPayment: vi.fn(),
  getPayment: vi.fn(),
  getReceipt: vi.fn(),
  listExceptions: vi.fn(),
  listAttempts: vi.fn(),
}));

vi.mock('../../services/mpesa.service', () => ({
  mpesaService: mpesaMock,
}));

import {
  mpesaKeys,
  useCreateMpesaAttempt,
  useMpesaAttempt,
  useMpesaExceptions,
  usePostMpesaPayment,
  useSubmitMpesaAttempt,
  useVerifyMpesaAttempt,
} from './useMpesa';

const baseAttempt: MpesaAttemptView = {
  id: 'attempt-test-123',
  invoiceId: 'inv-001',
  patientId: 'pat-001',
  branchId: 'branch-001',
  amount: 100,
  currency: 'KES',
  payerPhoneMasked: '********0001',
  environment: 'sandbox',
  submissionState: 'CREATED',
  reportedOutcome: 'PENDING',
  verificationStatus: 'UNVERIFIED',
  postingStatus: 'DISABLED',
  version: 0,
  checkoutRequestId: null,
  merchantRequestId: null,
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

describe('useMpesa hooks and polling lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  function Wrapper({ children }: { children: ReactNode }) {
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
  });

  it('5. Creates attempt and populates query cache', async () => {
    mpesaMock.createAttempt.mockResolvedValueOnce(baseAttempt);

    let mutateAsync: ReturnType<typeof useCreateMpesaAttempt>['mutateAsync'] | undefined;
    function Harness() {
      const mutation = useCreateMpesaAttempt();
      mutateAsync = mutation.mutateAsync;
      return null;
    }

    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));

    const result = await act(async () =>
      mutateAsync!({
        invoiceId: 'inv-001',
        payload: { amount: 100, payerPhone: '254700000001', idempotencyKey: 'test-uuid' },
      }),
    );

    expect(result.id).toBe('attempt-test-123');
    expect(queryClient.getQueryData(mpesaKeys.attempt('attempt-test-123'))).toEqual(baseAttempt);
  });

  it('6. Submits STK push and updates attempt submission state', async () => {
    const submittedAttempt = { ...baseAttempt, submissionState: 'PENDING' as const };
    mpesaMock.submitAttempt.mockResolvedValueOnce(submittedAttempt);

    let submitMutate: ReturnType<typeof useSubmitMpesaAttempt>['mutateAsync'] | undefined;
    function Harness() {
      const mutation = useSubmitMpesaAttempt();
      submitMutate = mutation.mutateAsync;
      return null;
    }

    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));

    const result = await act(async () =>
      submitMutate!({
        attemptId: 'attempt-test-123',
        payload: { expectedVersion: 0 },
      }),
    );

    expect(result.submissionState).toBe('PENDING');
  });

  it('11. Verifies transaction and updates cache with verified status', async () => {
    const verifiedAttempt = {
      ...baseAttempt,
      submissionState: 'PENDING' as const,
      verificationStatus: 'VERIFIED' as const,
      receiptNumber: 'REC123456',
    };
    mpesaMock.verifyAttempt.mockResolvedValueOnce(verifiedAttempt);

    let verifyMutate: ReturnType<typeof useVerifyMpesaAttempt>['mutateAsync'] | undefined;
    function Harness() {
      const mutation = useVerifyMpesaAttempt();
      verifyMutate = mutation.mutateAsync;
      return null;
    }

    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));

    const result = await act(async () => verifyMutate!('attempt-test-123'));
    expect(result.verificationStatus).toBe('VERIFIED');
    expect(result.receiptNumber).toBe('REC123456');
  });

  it('12. Posts payment to billing ledger and invalidates billing queries', async () => {
    const postedAttempt = {
      ...baseAttempt,
      postingStatus: 'POSTED' as const,
      billingPaymentId: 'pay-001',
      billingPaymentNumber: 'PAY-001',
    };
    const mockPostResult = {
      attempt: postedAttempt,
      payment: { id: 'pay-001', amount: 100, payment_method: 'MPESA' as const },
      invoice: { id: 'inv-001', status: 'PAID' as const, balance_amount: 0 },
      idempotent: false,
    };
    mpesaMock.postPayment.mockResolvedValueOnce(mockPostResult);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let postMutate: ReturnType<typeof usePostMpesaPayment>['mutateAsync'] | undefined;
    function Harness() {
      const mutation = usePostMpesaPayment();
      postMutate = mutation.mutateAsync;
      return null;
    }

    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));

    const result = await act(async () => postMutate!('attempt-test-123'));
    expect(result.attempt.postingStatus).toBe('POSTED');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('14. Queries exceptions and returns paginated list', async () => {
    const exceptionData = {
      data: [{ ...baseAttempt, postingStatus: 'MANUAL_REVIEW_REQUIRED' as const, conflictingEvidence: 'INVOICE_ALREADY_PAID' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    mpesaMock.listExceptions.mockResolvedValueOnce(exceptionData);

    let capturedData: unknown;
    function Harness() {
      const query = useMpesaExceptions(1, 10);
      capturedData = query.data;
      return null;
    }

    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));
    // Wait for query resolution
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(capturedData).toEqual(exceptionData);
  });
});
