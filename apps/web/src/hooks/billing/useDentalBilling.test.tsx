import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  createDentalTreatmentInvoice: vi.fn(async () => ({
    id: 'invoice-1',
    invoice_number: 'INV-DENT-1',
  })),
}));

vi.mock('../../services/billing.service', () => ({ billingService: service }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import {
  billingKeys,
  useCreateDentalTreatmentInvoice,
} from './useBilling';

describe('Dental billing query integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let createInvoice:
    | ReturnType<typeof useCreateDentalTreatmentInvoice>['mutateAsync']
    | undefined;

  function Harness() {
    createInvoice = useCreateDentalTreatmentInvoice().mutateAsync;
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(async () => {
    service.createDentalTreatmentInvoice.mockClear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
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

  it('uses the existing billing service and refreshes dental, invoice-list, and summary state', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await createInvoice?.({
        visitId: 'visit-1',
        treatmentItemId: 'treatment-1',
      });
    });

    expect(service.createDentalTreatmentInvoice).toHaveBeenCalledWith(
      'visit-1',
      'treatment-1',
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: billingKeys.dentalTreatmentStates('visit-1'),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: billingKeys.lists() });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: billingKeys.summaries(),
    });
    expect(queryClient.getQueryData(billingKeys.detail('invoice-1'))).toEqual({
      id: 'invoice-1',
      invoice_number: 'INV-DENT-1',
    });
  });
});
