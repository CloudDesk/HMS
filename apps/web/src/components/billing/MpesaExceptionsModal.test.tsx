import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MpesaExceptionsModal } from './MpesaExceptionsModal';
import { mpesaApi, type MpesaAttemptView } from '../../api/mpesa';

vi.mock('../../api/useSettings', () => ({ useCurrencyFormatter: () => (amount: number) => `KES ${amount}` }));
vi.mock('../../auth/token-storage', () => ({ tokenStorage: {
  getAccessToken: () => 'synthetic-test-token', isAccessTokenExpired: () => false,
} }));

const attempt: MpesaAttemptView = {
  id: 'a'.repeat(64), invoiceId: 'b'.repeat(24), patientId: 'c'.repeat(24), branchId: 'd'.repeat(24),
  amount: 1, currency: 'KES', payerPhoneMasked: '********4149', environment: 'sandbox',
  submissionState: 'UNKNOWN', reportedOutcome: 'PENDING', verificationStatus: 'UNRESOLVED',
  postingStatus: 'DISABLED', version: 2, checkoutRequestId: null, merchantRequestId: null, receiptNumber: null,
  submissionError: null, verificationSource: null, verificationAttempts: 1, lastVerifiedAt: null,
  lastQueryResult: null, queryOutcome: 'UNKNOWN', conflictingEvidence: null,
  recoveryStatus: 'MANUAL_REVIEW_REQUIRED', nextReconciliationAt: null, reconciliationRetries: 5,
  billingPaymentId: null, billingPaymentNumber: null, postedAt: null, postingError: null,
  createdAt: '2026-10-29T11:00:00Z', updatedAt: '2026-10-29T11:00:00Z',
};

describe('M-PESA exception HTTP contract', () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;
  const http = vi.fn<typeof fetch>();
  beforeEach(() => {
    http.mockReset();
    window.history.replaceState(null, '', '/billing/history');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', http);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear(); container.remove(); vi.unstubAllGlobals();
  });
  async function render(open = true) {
    await act(async () => root.render(<QueryClientProvider client={client}>
      <MpesaExceptionsModal open={open} onClose={() => undefined} />
    </QueryClientProvider>));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  it('renders unresolved evidence and paginates the actual items/total envelope', async () => {
    http.mockImplementation(async (url) => Response.json({ data: {
      items: [attempt], total: 21, page: String(url).includes('page=2') ? 2 : 1, limit: 10,
    } }));
    await render();
    expect(document.body.textContent).toContain('Showing page 1 of 3 (21 exceptions)');
    expect(document.body.textContent).toContain('MANUAL_REVIEW_REQUIRED');
    expect(document.body.textContent).not.toContain('No Unresolved M-Pesa Exceptions');
    const next = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Next'));
    await act(async () => next?.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(document.body.textContent).toContain('Showing page 2 of 3');
    expect(window.location.search).toContain('mpesaExceptionsPage=2');
    expect(http.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true);
    const review = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Review Attempt'));
    await act(async () => review?.click());
    expect(window.location.search).toContain(`mpesaAttemptId=${attempt.id}`);
  });
  it('treats malformed list contracts as errors rather than empty successful queues', async () => {
    http.mockResolvedValue(Response.json({ data: { data: [], pagination: { total: 0 } } }));
    await render();
    expect(document.body.textContent).toContain('Failed to load M-Pesa exceptions');
    expect(document.body.textContent).not.toContain('No Unresolved M-Pesa Exceptions');
  });
  it('does not request exceptions while closed', async () => {
    await render(false);
    expect(http).not.toHaveBeenCalled();
  });
  it('parses invoice attempt lists through the same real HTTP envelope', async () => {
    http.mockResolvedValue(Response.json({ data: { items: [attempt], total: 1, page: 1, limit: 1 } }));
    expect(await mpesaApi.listAttempts({ invoiceId: attempt.invoiceId, limit: 1 }))
      .toEqual({ items: [attempt], total: 1, page: 1, limit: 1 });
  });
  it('retains the payment and invoice pair on payment lookup', async () => {
    const pair = { payment: { id: 'payment-test' }, invoice: { id: attempt.invoiceId } };
    http.mockResolvedValue(Response.json({ data: pair }));
    expect(await mpesaApi.getPayment(attempt.id)).toEqual(pair);
  });
});
