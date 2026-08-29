import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  list: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } })),
  summary: vi.fn(async () => ({})),
  get: vi.fn(async () => null),
  create: vi.fn(),
  linkPatient: vi.fn(),
  triage: vi.fn(),
  overridePriority: vi.fn(),
  call: vi.fn(),
  consultation: vi.fn(),
  order: vi.fn(),
  disposition: vi.fn(),
  reasonAction: vi.fn(),
}));

vi.mock('../../services/emergency.service', () => ({ emergencyService: service }));

import { emergencyKeys, useEmergency } from './useEmergency';

describe('Emergency domain query invalidation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let saveTriage: ReturnType<typeof useEmergency>['triage']['mutateAsync'] | undefined;

  function Harness() {
    saveTriage = useEmergency(
      { branch_id: 'branch-1', page: 1, limit: 100 },
      'encounter-1',
      true,
    ).triage.mutateAsync;
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    service.triage.mockReset();
    service.triage.mockResolvedValue({ id: 'encounter-1', patient_name: 'Emergency Patient' });
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

  it('preserves mutation payloads and refreshes only Emergency detail/list/summary cache', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const payload = {
      level: 'LEVEL_2_HIGH' as const,
      area: 'Resuscitation',
      vitals: { pulse: 118 },
      abcde: {
        airway: 'Patent',
        breathing: 'Laboured',
        circulation: 'Stable',
        disability: 'Alert',
        exposure: 'Clear',
      },
    };

    await act(async () => {
      await saveTriage?.({ id: 'encounter-1', body: payload });
    });

    expect(service.triage).toHaveBeenCalledWith('encounter-1', 'branch-1', payload);
    expect(queryClient.getQueryData(emergencyKeys.detail('encounter-1', 'branch-1'))).toEqual(
      expect.objectContaining({ id: 'encounter-1' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['emergency', 'list'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['emergency', 'summary'] });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
