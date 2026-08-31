import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const review = vi.hoisted(() => vi.fn(async () => ({ id: 'document-1' })));

vi.mock('../../services/patient-documents.service', () => ({
  patientDocumentsService: { review },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { patientsKeys, useReviewPatientDocument } from './usePatients';

describe('patient document review domain mutation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let mutation: ReturnType<typeof useReviewPatientDocument> | undefined;

  function Harness() {
    mutation = useReviewPatientDocument({ notifyOnError: false });
    return null;
  }

  beforeEach(async () => {
    review.mockClear();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const Wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    await act(async () => root.render(<Wrapper><Harness /></Wrapper>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it('passes the review contract unchanged and invalidates affected patient caches', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const payload = { review_status: 'VERIFIED' as const, review_notes: null };

    await act(async () => {
      await mutation?.mutateAsync({ patientId: 'patient-1', documentId: 'document-1', payload });
    });

    expect(review).toHaveBeenCalledWith('patient-1', 'document-1', payload);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: patientsKeys.documentsAll() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: patientsKeys.history('patient-1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: patientsKeys.timelines() });
  });
});
