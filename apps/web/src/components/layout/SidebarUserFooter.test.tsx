import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockUser = {
  id: 'u-1',
  username: 'admin',
  fullName: 'Super Admin',
  email: 'admin@example.test',
  status: 'active',
  roles: [{ id: 'r-1', code: 'SUPER_ADMIN', name: 'Super Admin' }],
  permissions: [],
  branches: [],
};

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

vi.mock('./NotificationsMenu', () => ({
  NotificationsMenu: ({ variant }: { variant?: string }) => (
    <div data-testid="notifications-menu" data-variant={variant}>
      <button type="button">Bell</button>
    </div>
  ),
}));
vi.mock('../../routing/navigation', () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }));

import { SidebarUserFooter } from './SidebarUserFooter';

describe('SidebarUserFooter', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mockLogout.mockClear();
    mockNavigate.mockClear();
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

  const openAccount = async () => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.sidebar-account-trigger')?.click();
    });
    return document.querySelector<HTMLDivElement>('.sidebar-account-popover');
  };

  it('renders compact footer and opens real account details from the avatar', async () => {
    await act(async () => {
      root.render(<SidebarUserFooter />);
    });

    const avatar = container.querySelector('.sidebar-user-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar?.textContent).toBe('SA');

    const notifications = container.querySelector('[data-testid="notifications-menu"]');
    expect(notifications).not.toBeNull();
    expect(notifications?.getAttribute('data-variant')).toBe('sidebar');

    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
    expect(container.querySelector('.sidebar-signout-btn')).toBeNull();
    const panel = await openAccount();
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.querySelector('.sidebar-user-name')?.textContent).toBe('Super Admin');
    expect(panel?.textContent).toContain('admin@example.test');
    expect(panel?.querySelector('.sidebar-account-status-text')?.textContent).toBe('Active');
    expect(panel?.querySelector('.sidebar-account-status-dot.active')).not.toBeNull();
    expect(panel?.querySelector('a')?.getAttribute('href')).toBe('/administration/settings');
    const signoutBtn = panel?.querySelector('.sidebar-signout-btn');
    expect(signoutBtn?.textContent).toContain('Sign out');
  });

  it('triggers logout on sign out button click', async () => {
    await act(async () => {
      root.render(<SidebarUserFooter />);
    });

    const panel = await openAccount();
    const signoutBtn = panel?.querySelector<HTMLButtonElement>('.sidebar-signout-btn');
    expect(signoutBtn).not.toBeNull();

    await act(async () => {
      signoutBtn?.click();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('applies collapsed class when collapsed prop is true', async () => {
    await act(async () => {
      root.render(<SidebarUserFooter collapsed={true} />);
    });

    const footer = container.querySelector('.sidebar-footer-user');
    expect(footer?.classList.contains('collapsed')).toBe(true);
    expect(await openAccount()).not.toBeNull();
  });

  it('dismisses with Escape, close, outside pointer and keyboard focus leaving the popup', async () => {
    await act(async () => { root.render(<SidebarUserFooter />); });
    await openAccount();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close account');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('.sidebar-account-trigger'));
    await openAccount();
    await act(async () => { document.querySelector<HTMLButtonElement>('[aria-label="Close account"]')?.click(); });
    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
    await openAccount();
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
    await openAccount();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="notifications-menu"] button')?.focus(); });
    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
  });

  it('hides settings when the existing route permission is missing', async () => {
    const roles = mockUser.roles;
    mockUser.roles = [];
    try {
      await act(async () => { root.render(<SidebarUserFooter />); });
      const panel = await openAccount();
      expect(panel?.querySelector('a[href="/administration/settings"]')).toBeNull();
      expect(panel?.querySelector('.sidebar-signout-btn')).not.toBeNull();
    } finally {
      mockUser.roles = roles;
    }
  });

  it('opens the existing settings route through SPA navigation and dismisses the popup', async () => {
    await act(async () => { root.render(<SidebarUserFooter />); });
    const panel = await openAccount();
    await act(async () => { panel?.querySelector<HTMLAnchorElement>('a[href="/administration/settings"]')?.click(); });
    expect(mockNavigate).toHaveBeenCalledWith('/administration/settings');
    expect(document.querySelector('.sidebar-account-popover')).toBeNull();
  });
});
