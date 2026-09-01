import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context-value';
import type { AuthUser } from '../auth/auth-types';
import { BranchProvider, useActiveBranch } from './BranchContext';

// @vitest-environment jsdom

const mockUser: AuthUser = {
  id: 'user-1',
  username: 'staff',
  email: 'staff@example.test',
  fullName: 'Staff User',
  status: 'active',
  patientId: null,
  branches: [
    { id: 'b1', name: 'Branch One', code: 'B1' },
    { id: 'b2', name: 'Branch Two', code: 'B2' },
  ],
  roles: [{ id: 'r1', code: 'STAFF', name: 'Staff' }],
  permissions: [],
};

const mockAuthContextValue = {
  status: 'authenticated' as const,
  user: mockUser,
  authError: null,
  login: vi.fn(),
  logout: vi.fn(),
  refreshCurrentUser: vi.fn(),
  clearAuthError: vi.fn(),
};

const TestComponent = () => {
  const { activeBranchId, setActiveBranchId } = useActiveBranch();
  return (
    <div>
      <span id="active-branch">{activeBranchId}</span>
      <button id="switch-btn" onClick={() => setActiveBranchId('b2')} type="button">
        Switch to B2
      </button>
    </div>
  );
};

describe('BranchContext & Provider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default activeBranchId from assigned user branches if storage is empty', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthContext.Provider value={mockAuthContextValue}>
          <BranchProvider>
            <TestComponent />
          </BranchProvider>
        </AuthContext.Provider>,
      );
    });

    expect(container.querySelector('#active-branch')?.textContent).toBe('b1');
    expect(localStorage.getItem('activeBranchId')).toBe('b1');

    await act(async () => root.unmount());
    container.remove();
  });

  it('restores stored activeBranchId if valid for user', async () => {
    localStorage.setItem('activeBranchId', 'b2');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthContext.Provider value={mockAuthContextValue}>
          <BranchProvider>
            <TestComponent />
          </BranchProvider>
        </AuthContext.Provider>,
      );
    });

    expect(container.querySelector('#active-branch')?.textContent).toBe('b2');

    await act(async () => root.unmount());
    container.remove();
  });

  it('updates active branch state reactively and persists to storage', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthContext.Provider value={mockAuthContextValue}>
          <BranchProvider>
            <TestComponent />
          </BranchProvider>
        </AuthContext.Provider>,
      );
    });

    await act(async () => {
      const btn = container.querySelector('#switch-btn') as HTMLButtonElement | null;
      btn?.click();
    });

    expect(container.querySelector('#active-branch')?.textContent).toBe('b2');
    expect(localStorage.getItem('activeBranchId')).toBe('b2');

    await act(async () => root.unmount());
    container.remove();
  });

  it('synchronizes branch changes across tabs via StorageEvent', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthContext.Provider value={mockAuthContextValue}>
          <BranchProvider>
            <TestComponent />
          </BranchProvider>
        </AuthContext.Provider>,
      );
    });

    expect(container.querySelector('#active-branch')?.textContent).toBe('b1');

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'activeBranchId',
          newValue: 'b2',
        }),
      );
    });

    expect(container.querySelector('#active-branch')?.textContent).toBe('b2');

    await act(async () => root.unmount());
    container.remove();
  });
});
