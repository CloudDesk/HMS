import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUser } from '../../auth/auth-types';
import { SidebarUtilityBar } from './SidebarUtilityBar';
import { notificationsApi } from '../../api/notifications';

const mocks = vi.hoisted(() => ({ logout: vi.fn(), setBranch: vi.fn(), navigate: vi.fn() }));
let user: AuthUser;
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user, status: 'authenticated', logout: mocks.logout }) }));
vi.mock('../../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: 'a', setActiveBranchId: mocks.setBranch }) }));
vi.mock('../../routing/navigation', () => ({ navigate: mocks.navigate }));
vi.mock('../../api/notifications', () => ({ notificationsApi: { listMe: vi.fn(), markAsRead: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
const click = async (element: Element | null) => {
  expect(element).not.toBeNull();
  await act(async () => { element?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};
const utility = (name: string) => document.querySelector(`[role="dialog"] [data-utility="${name}"]`) ?? container.querySelector(`[data-utility="${name}"]`);
const button = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((item) => item.textContent?.trim() === text) ?? null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  user = { id: 'u', username: 'clinician', fullName: 'Test Clinician', email: 'test@example.test', status: 'active', patientId: null,
    roles: [{ id: 'r', name: 'Doctor', code: 'DOCTOR' }], permissions: [], branches: [{ id: 'a', name: 'Branch A', code: 'A' }, { id: 'b', name: 'Branch B', code: 'B' }] };
  vi.mocked(notificationsApi.listMe).mockResolvedValue({ data: [], meta: { total: 0 } });
  container = document.createElement('div'); container.className = 'dashboard-container'; document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(<QueryClientProvider client={client}><SidebarUtilityBar /></QueryClientProvider>)); };

describe('Sidebar utility interactions', () => {
  it('toggles and switches one dialog at a time; Escape and backdrop restore focus', async () => {
    await render();
    await click(utility('notifications'));
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close Notifications');
    await click(utility('user'));
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Test Clinician');
    expect(utility('user')?.getAttribute('aria-expanded')).toBe('true');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(utility('user'));
    await click(utility('notifications'));
    await click(document.querySelector('[data-testid="sidebar-utility-backdrop"]'));
    expect(document.activeElement).toBe(utility('notifications'));
    await click(utility('notifications'));
    await click(utility('notifications'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('wraps keyboard focus within panel and utility controls', async () => {
    await render(); await click(utility('user'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    // Sign out is no longer a standalone footer button; last footer control is the user avatar button
    expect(document.activeElement).toBe(utility('user'));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close Your account');
  });

  it('uses existing branch state from the account panel and closes on selection', async () => {
    await render(); await click(utility('user')); await click(button('Branch A'));
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    await click(button('Branch B'));
    expect(mocks.setBranch).toHaveBeenCalledExactlyOnceWith('b');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(utility('user'));
  });

  it('preserves settings permissions and omits nonexistent account destinations', async () => {
    await render(); await click(utility('user'));
    expect(button('System Settings')).toBeNull();
    expect(button('Profile')).toBeNull(); expect(button('Help')).toBeNull();
    await click(utility('user'));
    user.permissions = [{ code: 'settings-view', module: 'Administration', screen: 'Settings', action: 'View' }];
    await render(); await click(utility('user')); await click(button('System Settings'));
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/administration/settings');
  });

  it('confirms sign out and invokes the existing logout only on confirmation', async () => {
    await render();
    // Sign out is now inside the User Account panel — open user panel first
    await click(utility('user'));
    expect(mocks.logout).not.toHaveBeenCalled();
    // Click Sign out in the user panel → ConfirmDialog opens (user panel closes)
    await click(button('Sign out'));
    await click(button('Cancel'));
    expect(mocks.logout).not.toHaveBeenCalled();
    // Open user panel again and confirm sign out
    await click(utility('user'));
    await click(button('Sign out'));
    await click(button('Sign out')); // confirm in the ConfirmDialog
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it('shows real unread count and updates after mark-all succeeds', async () => {
    const notification = { id: 'n', title: 'Referral', message: 'A referral was received', type: 'REFERRAL' as const, is_read: false,
      recipient_role: null, recipient_user_id: 'u', recipient_branch_id: 'a', related_entity_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    let unread = true;
    vi.mocked(notificationsApi.listMe).mockImplementation(async () => ({ data: unread ? [notification] : [], meta: { total: unread ? 1 : 0 } }));
    vi.mocked(notificationsApi.markAsRead).mockImplementation(async () => { unread = false; return { ...notification, is_read: true }; });
    await render();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(utility('notifications')?.getAttribute('aria-label')).toContain('1 unread');
    await click(utility('notifications')); await click(button('Mark all read'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(notificationsApi.markAsRead).toHaveBeenCalledExactlyOnceWith('n');
    expect(utility('notifications')?.getAttribute('aria-label')).toBe('Notifications');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('No notifications');
  });

  it('renders only notifications and user account in the footer; standalone branch and signout are absent', async () => {
    await render();
    expect(utility('notifications')).not.toBeNull();
    expect(utility('user')).not.toBeNull();
    expect(utility('branch')).toBeNull();
    expect(utility('signout')).toBeNull();
  });
});
