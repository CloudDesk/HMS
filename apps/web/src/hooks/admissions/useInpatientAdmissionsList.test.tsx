import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.hoisted(() => vi.fn(async () => ({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } })));
vi.mock('../../services/inpatient-admissions.service', () => ({ inpatientAdmissionsService: { list } }));

import { inpatientAdmissionsKeys, useInpatientAdmissionsList, useRefreshInpatientAdmissions } from './useInpatientAdmissionsList';

describe('inpatient admission list domain hook', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let refresh: ReturnType<typeof useRefreshInpatientAdmissions> | undefined;

  function Harness() {
    useInpatientAdmissionsList({ branch_id: 'branch-1', status: 'ADMITTED' });
    refresh = useRefreshInpatientAdmissions();
    return null;
  }

  beforeEach(async () => {
    list.mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it('preserves list parameters and refresh invalidation scope', async () => {
    expect(list).toHaveBeenCalledWith({ branch_id: 'branch-1', status: 'ADMITTED' });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => { await refresh?.(); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: inpatientAdmissionsKeys.all });
  });
});
