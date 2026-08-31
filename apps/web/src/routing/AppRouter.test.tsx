// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
  let resolveOpdPage: ((module: { OpdVisitPage: () => string }) => void) | undefined;
  const opdPage = new Promise<{ OpdVisitPage: () => string }>((resolve) => {
    resolveOpdPage = resolve;
  });

  return {
    pathname: '/opd/visit',
    status: 'authenticated',
    permissions: [] as Array<{ code: string; module: string; screen: string; action: string }>,
    roles: [{ id: 'super-admin-role', code: 'SUPER_ADMIN', name: 'Super Administrator' }],
    navigate: vi.fn(),
    opdPage,
    resolveOpdPage: () => resolveOpdPage?.({ OpdVisitPage: () => 'Lazy OPD workspace' }),
  };
});

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    status: testState.status,
    user: {
      id: 'staff-user',
      username: 'staff',
      email: 'staff@example.test',
      fullName: 'Staff User',
      status: 'active',
      patientId: null,
      branches: [],
      permissions: testState.permissions,
      roles: testState.roles,
    },
  }),
}));

vi.mock('./navigation', () => ({
  isPublicRoute: (pathname: string) => ['/login', '/forgot-password', '/reset-password'].includes(pathname),
  navigate: testState.navigate,
  useAppLocation: () => ({ pathname: testState.pathname, search: '' }),
}));

vi.mock('../components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../pages/OpdVisitPage', () => testState.opdPage);

import { AppRouter } from './AppRouter';

describe('M-009 lazy staff routes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.pathname = '/opd/visit';
    testState.status = 'authenticated';
    testState.permissions = [];
    testState.roles = [{ id: 'super-admin-role', code: 'SUPER_ADMIN', name: 'Super Administrator' }];
    testState.navigate.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows the shared loading fallback and then renders a representative lazy route', async () => {
    await act(async () => {
      root.render(<AppRouter />);
    });

    expect(container.textContent).toContain('Loading page');
    expect(container.textContent).not.toContain('Lazy OPD workspace');

    await act(async () => {
      testState.resolveOpdPage();
      await testState.opdPage;
    });

    expect(container.textContent).toContain('Lazy OPD workspace');
  });

  it('preserves the protected-route redirect for unauthenticated staff', async () => {
    testState.status = 'unauthenticated';

    await act(async () => {
      root.render(<AppRouter />);
    });

    expect(testState.navigate).toHaveBeenCalledWith(
      '/login?redirect=%2Fopd%2Fvisit',
      { replace: true },
    );
  });

  it.each(['/billing', '/administration', '/administration/users'])(
    'blocks a Doctor from manually opening %s',
    async (pathname) => {
      testState.pathname = pathname;
      testState.roles = [{ id: 'doctor-role', code: 'DOCTOR', name: 'Doctor' }];

      await act(async () => {
        root.render(<AppRouter />);
      });

      expect(container.textContent).toContain('Access denied');
      expect(container.textContent).toContain('You do not have permission to open this page.');
    },
  );
});
