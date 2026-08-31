import { describe, expect, it } from 'vitest';
import type { AuthPermission, AuthRole } from './auth-types';
import { canAccessRoute, getAccessibleSidebarModules } from './access-control';

const permission = (module: string, screen: string, action = 'View'): AuthPermission => ({
  code: `${module}_${screen}_${action}`,
  module,
  screen,
  action,
});

const doctorRole: AuthRole[] = [{ id: 'doctor-role', code: 'DOCTOR', name: 'Doctor' }];

describe('staff route access control', () => {
  it('blocks billing and administration routes without their permissions', () => {
    const permissions = [
      permission('Doctors', 'Doctor Directory'),
      permission('Appointments', 'Appointment Records'),
    ];

    expect(canAccessRoute('/billing', permissions, doctorRole)).toBe(false);
    expect(canAccessRoute('/billing/workspace', permissions, doctorRole)).toBe(false);
    expect(canAccessRoute('/administration', permissions, doctorRole)).toBe(false);
    expect(canAccessRoute('/administration/users', permissions, doctorRole)).toBe(false);
  });

  it('allows routes only when the database permission tuple grants them', () => {
    const permissions = [
      permission('Billing', 'Invoices'),
      permission('Administration', 'Dashboard'),
    ];

    expect(canAccessRoute('/billing?status=PENDING', permissions)).toBe(true);
    expect(canAccessRoute('/administration/', permissions)).toBe(true);
    expect(canAccessRoute('/administration/users', permissions)).toBe(false);
  });

  it('keeps read-only admission navigation visible without granting bed mutations', () => {
    const permissions = [
      permission('Admissions', 'Beds'),
      permission('Admissions', 'Admission Requests'),
    ];
    const modules = getAccessibleSidebarModules(permissions);
    const admissions = modules.find((module) => module.key === 'admissions');

    expect(canAccessRoute('/admissions/beds', permissions)).toBe(true);
    expect(canAccessRoute('/admissions/inpatients', permissions)).toBe(true);
    expect(admissions?.links.map((link) => link.href)).toContain('/admissions/beds');
    expect(admissions?.links.map((link) => link.href)).toContain('/admissions/inpatients');
  });

  it('preserves the existing Super Admin all-route exception', () => {
    const roles: AuthRole[] = [{ id: 'super-role', code: 'SUPER_ADMIN', name: 'Super Administrator' }];

    expect(canAccessRoute('/billing', [], roles)).toBe(true);
    expect(canAccessRoute('/administration/users', [], roles)).toBe(true);
  });
});
