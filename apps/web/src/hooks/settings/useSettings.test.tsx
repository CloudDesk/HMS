// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsApi } from '../../api/settings';
import { useFirstDayOfWeek } from './useSettings';

describe('useFirstDayOfWeek', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  function Consumer() {
    const { firstDayOfWeek } = useFirstDayOfWeek();
    return <span>{firstDayOfWeek}</span>;
  }

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it('retrieves the configured first day for calendar consumers', async () => {
    vi.spyOn(settingsApi, 'getFirstDayOfWeek').mockResolvedValue({ firstDayOfWeek: 'Monday' });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Consumer />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(container.textContent).toBe('Monday');
  });

  it('preserves Sunday fallback when runtime settings cannot be loaded', async () => {
    vi.spyOn(settingsApi, 'getFirstDayOfWeek').mockRejectedValue(new Error('Unavailable'));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Consumer />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(container.textContent).toBe('Sunday');
  });
});
