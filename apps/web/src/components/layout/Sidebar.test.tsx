import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'u-1',
      username: 'admin',
      fullName: 'Super Admin',
      status: 'active',
      roles: [{ id: 'r-1', code: 'SUPER_ADMIN', name: 'Administrator' }],
      permissions: ['*'],
      branches: [],
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../../hooks/settings/useSettings', () => ({
  useHospitalSettings: () => ({
    hospitalName: 'Nairobi General',
    logoUrl: '',
  }),
}));

vi.mock('./NotificationsMenu', () => ({
  NotificationsMenu: () => <button type="button">Bell</button>,
}));

vi.mock('../../routing/navigation', () => ({
  navigate: vi.fn(),
}));

describe('Sidebar redesign & navigation tests', () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockToggleCollapsed = vi.fn();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mockToggleCollapsed.mockReset();
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

  const render = async (collapsed = false, activeKey = 'patients', activeHref = '/patients/search') => {
    await act(async () => {
      root.render(
        <Sidebar
          activeHref={activeHref}
          activeKey={activeKey}
          collapsed={collapsed}
          onToggleCollapsed={mockToggleCollapsed}
        />
      );
    });
  };

  it('renders hospital branding header with hospital icon, name, enterprise subtitle and toggle button', async () => {
    await render();

    const brandIcon = container.querySelector('.brand-icon');
    expect(brandIcon).not.toBeNull();
    expect(brandIcon?.classList.contains('ph-hospital')).toBe(true);

    const logoText = container.querySelector('.logo-text');
    expect(logoText?.querySelector('h2')?.textContent).toBe('Nairobi General');
    expect(logoText?.querySelector('p')?.textContent).toBe('Enterprise');

    const toggleBtn = container.querySelector<HTMLButtonElement>('.sidebar-toggle-btn');
    expect(toggleBtn).not.toBeNull();
    await act(async () => {
      toggleBtn?.click();
    });
    expect(mockToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('highlights the active parent navigation item and active child with cyan dot', async () => {
    await render(false, 'patients', '/patients/search');

    // Patients group should have active parent
    const patientsGroup = container.querySelector('[data-sidebar-module="patients"]');
    expect(patientsGroup).not.toBeNull();

    const parentButton = patientsGroup?.querySelector('.nav-item.active');
    expect(parentButton).not.toBeNull();
    expect(parentButton?.textContent).toContain('Patients');

    // Sub navigation should be rendered with active child having cyan dot
    const activeChild = patientsGroup?.querySelector('.sub-nav-item.active');
    expect(activeChild).not.toBeNull();
    expect(activeChild?.textContent).toContain('Patients');
    expect(activeChild?.querySelector('.sub-nav-dot')).not.toBeNull();

    // Inactive child should have icon
    const inactiveChild = patientsGroup?.querySelectorAll('.sub-nav-item')[1];
    expect(inactiveChild).not.toBeNull();
    expect(inactiveChild?.textContent).toContain('Consent Attachment');
    expect(inactiveChild?.querySelector('.sub-nav-icon')).not.toBeNull();
  });

  it('renders Doctors group children with outline icons when expanded', async () => {
    await render(false, 'doctors', '/doctors/directory');

    const doctorsGroup = container.querySelector('[data-sidebar-module="doctors"]');
    expect(doctorsGroup).not.toBeNull();

    const childLinks = doctorsGroup?.querySelectorAll('.sub-nav-item');
    expect(childLinks?.length).toBeGreaterThanOrEqual(3);

    // Active child: Doctor Directory with cyan dot
    const dirChild = childLinks?.[0];
    expect(dirChild?.classList.contains('active')).toBe(true);
    expect(dirChild?.querySelector('.sub-nav-dot')).not.toBeNull();

    // Inactive child: Doctor Schedule with calendar icon
    const schedChild = childLinks?.[1];
    expect(schedChild?.classList.contains('active')).toBe(false);
    expect(schedChild?.querySelector('.ph-calendar')).not.toBeNull();

    // Inactive child: Availability with clock icon
    const availChild = childLinks?.[2];
    expect(availChild?.classList.contains('active')).toBe(false);
    expect(availChild?.querySelector('.ph-clock')).not.toBeNull();
  });

  it('renders correct submenu icons for Emergency, Billing, Insurance, and Administration', async () => {
    // 1. Emergency
    await render(false, 'emergency', '/emergency');
    const emergencyGroup = container.querySelector('[data-sidebar-module="emergency"]');
    expect(emergencyGroup?.querySelector('a[href="/emergency/queue"] .ph-users')).not.toBeNull();
    expect(emergencyGroup?.querySelector('a[href="/emergency/workspace"] .ph-activity')).not.toBeNull();

    // 2. Billing
    await render(false, 'billing', '');
    const billingGroup = container.querySelector('[data-sidebar-module="billing"]');
    expect(billingGroup?.querySelector('a[href="/billing/workspace"] .ph-receipt')).not.toBeNull();
    expect(billingGroup?.querySelector('a[href="/billing/history"] .ph-clock-counter-clockwise')).not.toBeNull();

    // 3. Insurance
    await render(false, 'insurance', '');
    const insuranceGroup = container.querySelector('[data-sidebar-module="insurance"]');
    expect(insuranceGroup?.querySelector('a[href="/insurance/payers"] .ph-buildings')).not.toBeNull();
    expect(insuranceGroup?.querySelector('a[href="/insurance/schemes"] .ph-shield-check')).not.toBeNull();
    expect(insuranceGroup?.querySelector('a[href="/insurance/policies"] .ph-file-text')).not.toBeNull();
    expect(insuranceGroup?.querySelector('a[href="/insurance/members"] .ph-users')).not.toBeNull();

    // 4. Administration
    await render(false, 'administration', '');
    const adminGroup = container.querySelector('[data-sidebar-module="administration"]');
    expect(adminGroup?.querySelector('a[href="/administration/users"] .ph-users')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/roles-permissions"] .ph-shield-check')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/departments"] .ph-buildings')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/services"] .ph-clipboard-text')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/medicines"] .ph-pill')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/branches"] .ph-tree-structure')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/consent-templates"] .ph-file-text')).not.toBeNull();
    expect(adminGroup?.querySelector('a[href="/administration/settings"] .ph-gear')).not.toBeNull();
  });

  it('applies collapsed classes when collapsed is true', async () => {
    await render(true);

    const aside = container.querySelector('aside.sidebar');
    expect(aside?.classList.contains('collapsed')).toBe(true);

    const toggleBtnIcon = container.querySelector('.sidebar-toggle-btn i');
    expect(toggleBtnIcon?.classList.contains('ph-caret-right')).toBe(true);
  });
});
