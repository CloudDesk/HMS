import { describe, expect, it } from 'vitest';
import type { AuthPermission, AuthRole } from './auth-types';
import { canAccessRoute, getAccessibleSidebarModules, hasPermission } from './access-control';

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

  it('protects implemented aliases and composite patient workspaces', () => {
    const pharmacy = [permission('Pharmacy', 'Dispensing')];
    const documentsOnly = [permission('Patients', 'Patient Documents')];
    const completeDocuments = [
      permission('Patients', 'Patient Records'),
      permission('Patients', 'Patient Documents'),
    ];

    expect(canAccessRoute('/pharmacy/orders', pharmacy)).toBe(true);
    expect(canAccessRoute('/pharmacy/orders', [])).toBe(false);
    expect(canAccessRoute('/patients/documents', documentsOnly)).toBe(false);
    expect(canAccessRoute('/patients/documents', completeDocuments)).toBe(true);
  });

  it('shows only the authorized Administration child route', () => {
    const permissions = [permission('Administration', 'Medicines')];
    const administration = getAccessibleSidebarModules(permissions)
      .find((module) => module.key === 'administration');

    expect(administration?.links).toEqual([
      { href: '/administration/medicines', label: 'Medicine Master' },
    ]);
    expect(canAccessRoute('/administration/users', permissions)).toBe(false);
    expect(canAccessRoute('/administration', permissions)).toBe(false);
  });

  it('allows the shared Surgery workspace when any independently rendered section is viewable', () => {
    expect(canAccessRoute('/surgery', [permission('Surgery', 'Bookings')])).toBe(true);
    expect(canAccessRoute('/surgery', [permission('Surgery', 'Schedule')])).toBe(true);
    expect(canAccessRoute('/surgery', [])).toBe(false);
  });

  it('derives Check In from the exact OPD visit creation permission, not a role name', () => {
    const requirement = { module: 'OPD', screen: 'OPD Visits', action: 'Create' };
    const receptionistPermissions = [
      permission('Appointments', 'Appointment Records'),
      permission('OPD', 'OPD Visits', 'Create'),
    ];
    const nursePermissions = [
      permission('Appointments', 'Appointment Records'),
      permission('OPD', 'OPD Visits', 'Edit'),
    ];
    const doctorPermissions = [
      permission('Appointments', 'Appointment Records'),
      permission('OPD', 'OPD Consultation', 'Edit'),
    ];

    expect(hasPermission(receptionistPermissions, requirement)).toBe(true);
    expect(hasPermission(nursePermissions, requirement)).toBe(false);
    expect(hasPermission(doctorPermissions, requirement)).toBe(false);
    expect(hasPermission([...doctorPermissions, ...receptionistPermissions], requirement)).toBe(true);
  });

  it('preserves the existing Super Admin all-route exception', () => {
    const roles: AuthRole[] = [{ id: 'super-role', code: 'SUPER_ADMIN', name: 'Super Administrator' }];

    expect(canAccessRoute('/billing', [], roles)).toBe(true);
    expect(canAccessRoute('/administration/users', [], roles)).toBe(true);
  });

  it('normalizes module, screen, and action strings with underscores and casing differences', () => {
    const admissionReqPermission = permission('Admissions', 'Admission Requests', 'Create');
    expect(hasPermission([admissionReqPermission], { module: 'ADMISSIONS', screen: 'ADMISSION_REQUESTS', action: 'CREATE' })).toBe(true);
    expect(hasPermission([admissionReqPermission], { module: 'admissions', screen: 'admission-requests', action: 'create' })).toBe(true);
    expect(hasPermission([admissionReqPermission], { module: 'Admissions', screen: 'Admission Requests', action: 'Create' })).toBe(true);
  });

  it('correctly evaluates admission request creation permissions across roles', () => {
    const createReq = { module: 'Admissions', screen: 'Admission Requests', action: 'Create' };
    const receptionistPermissions = [
      permission('Admissions', 'Admission Requests', 'View'),
      permission('Admissions', 'Admission Requests', 'Create'),
      permission('Admissions', 'Admission Requests', 'Validate'),
      permission('Admissions', 'Admission Requests', 'Confirm'),
      permission('Admissions', 'Admission Requests', 'Cancel'),
    ];
    const nursePermissions = [
      permission('Admissions', 'Admission Requests', 'View'),
      permission('Admissions', 'Inpatient Admissions', 'Create'),
    ];
    const doctorPermissions = [
      permission('Admissions', 'Admission Recommendations', 'Create'),
      permission('Admissions', 'Inpatient Admissions', 'Create'),
    ];
    const superAdminRole: AuthRole[] = [{id: 'sa', code: 'SUPER_ADMIN', name: 'Super Admin' }];
    const receptionistRole: AuthRole[] = [{ id: 'rec', code: 'RECEPTIONIST', name: 'Receptionist' }];
    const nurseRole: AuthRole[] = [{ id: 'gr', code: 'CLINICIAN_NURSE', name: 'Clinician / Nurse' }];
    const doctorRole: AuthRole[] = [{ id: 'doc', code: 'DOCTOR', name: 'Doctor' }];

    expect(hasPermission([], createReq, superAdminRole)).toBe(true);
    expect(hasPermission(receptionistPermissions, createReq, receptionistRole)).toBe(true);
    expect(hasPermission(nursePermissions, createReq, nurseRole)).toBe(false);
    expect(hasPermission(doctorPermissions, createReq, doctorRole)).toBe(false);
  });
});
