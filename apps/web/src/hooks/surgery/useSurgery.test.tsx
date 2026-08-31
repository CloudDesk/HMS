import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  recommendations: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } })),
  bookings: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } })),
  createRecommendation: vi.fn(),
  cancelRecommendation: vi.fn(),
  createBooking: vi.fn(),
  confirmBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  cancelBooking: vi.fn(),
  completeBooking: vi.fn(),
  alternatives: vi.fn(),
}));

vi.mock('../../services/surgery.service', () => ({ surgeryService: service }));

import { surgeryKeys, useSurgery } from './useSurgery';

describe('Surgery domain query invalidation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let createBooking: ReturnType<typeof useSurgery>['createBooking']['mutateAsync'] | undefined;

  function Harness() {
    createBooking = useSurgery(
      { branch_id: 'branch-1', page: 1, limit: 100 },
      { recommendations: true, bookings: false },
    ).createBooking.mutateAsync;
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    service.createBooking.mockReset();
    service.createBooking.mockResolvedValue({ id: 'booking-1' });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it('preserves the booking payload and invalidates only the Surgery cache root', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const payload = {
      recommendation_id: 'recommendation-1', branch_id: 'branch-1', doctor_id: 'doctor-1',
      scheduled_start: '2026-09-01T10:00', hold_id: null, consent_document_id: null,
      deposit_invoice_id: null, notes: null,
    };

    await act(async () => {
      await createBooking?.(payload);
    });

    expect(service.createBooking).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: surgeryKeys.all });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
