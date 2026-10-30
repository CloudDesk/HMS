import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = {
  id: 'u-1',
  username: 'admin',
  fullName: 'Super Admin',
  status: 'active',
  roles: [{ id: 'r-1', code: 'SUPER_ADMIN', name: 'Super Admin' }],
  permissions: ['*'],
  branches: [{ id: 'b-1', name: 'Main Branch' }],
};

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../../hooks/settings/useSettings', () => ({
  useHospitalSettings: () => ({
    hospitalName: 'HMS Hospital',
    logoUrl: null,
  }),
}));

let currentPathname = '/dashboard';

vi.mock('../../routing/navigation', () => ({
  useAppLocation: () => ({
    pathname: currentPathname,
    search: '',
  }),
  navigate: (to: string) => {
    currentPathname = to;
  },
}));

import { DashboardLayout } from './DashboardLayout';

describe('DashboardLayout — Final Verification of Header Removal & Mobile Drawer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    currentPathname = '/dashboard';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders children inside .main-content and does NOT render .top-header on dashboard', async () => {
    currentPathname = '/dashboard';
    await act(async () => {
      root.render(
        <DashboardLayout title="Hospital Overview" breadcrumbs={['Home', 'Dashboard']}>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </DashboardLayout>,
      );
    });

    expect(container.querySelector('.top-header')).toBeNull();
    expect(container.querySelector('.header-title-area')).toBeNull();
    expect(container.querySelector('.main-content')).not.toBeNull();
    expect(container.querySelector('[data-testid="dashboard-content"]')).not.toBeNull();
  });

  it('contains document scrolling only while the dashboard is mounted', async () => {
    expect(document.body.classList.contains('dashboard-open')).toBe(false);
    expect(document.documentElement.classList.contains('dashboard-open')).toBe(false);
    await act(async () => {
      root.render(<DashboardLayout><div>Workspace</div></DashboardLayout>);
    });
    expect(document.body.classList.contains('dashboard-open')).toBe(true);
    expect(document.documentElement.classList.contains('dashboard-open')).toBe(true);
    await act(async () => root.render(null));
    expect(document.body.classList.contains('dashboard-open')).toBe(false);
    expect(document.documentElement.classList.contains('dashboard-open')).toBe(false);
  });

  it('does NOT render .top-header across representative module routes', async () => {
    const representativeRoutes = [
      { path: '/patients', title: 'Patient Directory' },
      { path: '/appointments', title: 'Appointments' },
      { path: '/opd', title: 'OPD Queue' },
      { path: '/doctors', title: 'Doctor Directory' },
      { path: '/nursing', title: 'Nursing Station' },
      { path: '/pharmacy', title: 'Pharmacy' },
      { path: '/laboratory', title: 'Laboratory' },
      { path: '/imaging', title: 'Imaging' },
      { path: '/billing', title: 'Billing' },
      { path: '/insurance', title: 'Insurance' },
      { path: '/administration', title: 'Administration' },
      { path: '/reports', title: 'Reports' },
    ];

    for (const route of representativeRoutes) {
      currentPathname = route.path;
      await act(async () => {
        root.render(
          <DashboardLayout title={route.title} breadcrumbs={['Home', route.title]}>
            <div data-testid={`content-${route.path}`}>Module Content for {route.title}</div>
          </DashboardLayout>,
        );
      });

      expect(container.querySelector('.top-header')).toBeNull();
      expect(container.querySelector('.breadcrumbs')).toBeNull();
      const content = container.querySelector(`[data-testid="content-${route.path}"]`);
      expect(content).not.toBeNull();
    }
  });

  it('renders the mobile header button and controls sidebar drawer opening and closing', async () => {
    currentPathname = '/patients';
    await act(async () => {
      root.render(
        <DashboardLayout title="Patient Directory">
          <div>Patient Content</div>
        </DashboardLayout>,
      );
    });

    const mobileHeader = container.querySelector('.dashboard-mobile-header');
    expect(mobileHeader).not.toBeNull();

    const mobileBtn = mobileHeader?.querySelector<HTMLButtonElement>('button.mobile-menu-btn');
    expect(mobileBtn).not.toBeNull();
    expect(mobileBtn?.getAttribute('aria-label')).toBe('Open navigation');

    const sidebar = container.querySelector('aside.sidebar');
    const backdrop = container.querySelector('button.sidebar-backdrop');
    expect(sidebar?.classList.contains('mobile-open')).toBe(false);
    expect(backdrop?.classList.contains('open')).toBe(false);

    // Click mobile menu button to open drawer
    await act(async () => {
      mobileBtn?.click();
    });

    expect(sidebar?.classList.contains('mobile-open')).toBe(true);
    expect(backdrop?.classList.contains('open')).toBe(true);

    // Click backdrop to close drawer
    await act(async () => {
      (backdrop as HTMLButtonElement)?.click();
    });

    expect(sidebar?.classList.contains('mobile-open')).toBe(false);
    expect(backdrop?.classList.contains('open')).toBe(false);
  });
});
