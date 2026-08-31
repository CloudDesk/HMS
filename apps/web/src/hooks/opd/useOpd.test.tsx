import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  savePrescriptionDraft: vi.fn(async (_visitId: string, payload: unknown) => payload),
  saveClinicalOrderDraft: vi.fn(async (_visitId: string, _type: string, payload: unknown) => payload),
}));

vi.mock('../../api/opd', () => ({ opdApi: api }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import {
  opdKeys,
  useSaveOpdClinicalOrderDraft,
  useSaveOpdPrescriptionDraft,
} from './useOpd';

describe('OPD draft domain hooks', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let savePrescription: ReturnType<typeof useSaveOpdPrescriptionDraft>['mutateAsync'] | undefined;
  let saveClinicalOrder: ReturnType<typeof useSaveOpdClinicalOrderDraft>['mutateAsync'] | undefined;

  function Harness() {
    savePrescription = useSaveOpdPrescriptionDraft().mutateAsync;
    saveClinicalOrder = useSaveOpdClinicalOrderDraft().mutateAsync;
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(async () => {
    api.savePrescriptionDraft.mockClear();
    api.saveClinicalOrderDraft.mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  it('sends the unchanged prescription draft payload and invalidates its visit query', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const payload = { items: [], doctor_instructions: 'Hydrate' };

    await act(async () => {
      await savePrescription?.({ visitId: 'visit-1', payload });
    });

    expect(api.savePrescriptionDraft).toHaveBeenCalledWith('visit-1', payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: opdKeys.prescription('visit-1') });
  });

  it('sends the unchanged clinical-order draft payload and invalidates its typed query', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const payload = { priority: 'ROUTINE' as const, items: [] };

    await act(async () => {
      await saveClinicalOrder?.({ visitId: 'visit-1', type: 'LABORATORY', payload });
    });

    expect(api.saveClinicalOrderDraft).toHaveBeenCalledWith('visit-1', 'LABORATORY', payload);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: opdKeys.clinicalOrder('visit-1', 'LABORATORY'),
    });
  });
});
