import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogout = vi.fn();
const mockUser = {
  id: 'u-1',
  username: 'admin',
  fullName: 'Super Admin',
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

import { SidebarUserFooter } from './SidebarUserFooter';

describe('SidebarUserFooter', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockLogout.mockClear();
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

  it('renders avatar with user initials, display name, and active status', async () => {
    await act(async () => {
      root.render(<SidebarUserFooter />);
    });

    const avatar = container.querySelector('.sidebar-user-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar?.textContent).toBe('SA');

    const name = container.querySelector('.sidebar-user-name');
    expect(name?.textContent).toBe('Super Admin');

    const status = container.querySelector('.sidebar-user-status');
    expect(status?.textContent).toContain('Active');
    expect(status?.querySelector('.status-dot-active')).not.toBeNull();

    const notifications = container.querySelector('[data-testid="notifications-menu"]');
    expect(notifications).not.toBeNull();
    expect(notifications?.getAttribute('data-variant')).toBe('sidebar');

    const signoutBtn = container.querySelector('.sidebar-signout-btn');
    expect(signoutBtn?.textContent).toContain('Sign out');
  });

  it('triggers logout on sign out button click', async () => {
    await act(async () => {
      root.render(<SidebarUserFooter />);
    });

    const signoutBtn = container.querySelector<HTMLButtonElement>('.sidebar-signout-btn');
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
  });
});
