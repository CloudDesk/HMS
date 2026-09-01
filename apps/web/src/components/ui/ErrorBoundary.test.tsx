import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// @vitest-environment jsdom

const ThrowingComponent = () => {
  throw new Error('Test render crash');
};

describe('ErrorBoundary component', () => {
  it('renders children normally when no error occurs', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <div>Normal Content</div>
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('Normal Content');

    await act(async () => root.unmount());
    container.remove();
  });

  it('catches rendering errors and displays fallback UI', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('An unexpected error occurred');
    expect(container.querySelector('button')?.textContent).toContain('Try Again');

    await act(async () => root.unmount());
    container.remove();
    consoleErrorSpy.mockRestore();
  });
});
