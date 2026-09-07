import { sidebarModules, type SidebarModule } from '../data/ui-foundation';
import type { AuthPermission, AuthRole } from './auth-types';

export type PermissionRequirement = {
  module: string;
  screen: string;
  action?: string;
};

const routeRequirements: Record<string, PermissionRequirement[]> = {
  '/administration': [{ module: 'Administration', screen: 'Dashboard' }],
  '/administration/users': [{ module: 'Administration', screen: 'Users' }],
  '/administration/roles-permissions': [
    { module: 'Administration', screen: 'Roles' },
    { module: 'Administration', screen: 'Permissions' },
  ],
  '/administration/departments': [{ module: 'Administration', screen: 'Departments' }],
  '/administration/services': [{ module: 'Administration', screen: 'Services' }],
  '/administration/medicines': [{ module: 'Administration', screen: 'Medicines' }],
  '/pharmacy': [{ module: 'Pharmacy', screen: 'Dispensing' }],
  '/pharmacy/orders': [{ module: 'Pharmacy', screen: 'Dispensing' }],
  '/pharmacy/inventory': [{ module: 'Pharmacy', screen: 'Medicine Inventory' }],
  '/pharmacy/queue': [{ module: 'Pharmacy', screen: 'Dispensing' }],
  '/pharmacy/dispensing': [{ module: 'Pharmacy', screen: 'Dispensing' }],
  '/laboratory': [{ module: 'Laboratory', screen: 'Orders' }],
  '/laboratory/queue': [{ module: 'Laboratory', screen: 'Orders' }],
  '/laboratory/workspace': [{ module: 'Laboratory', screen: 'Orders' }],
  '/laboratory/reports': [{ module: 'Laboratory', screen: 'Orders' }],
  '/laboratory/results': [{ module: 'Laboratory', screen: 'Orders' }],
  '/imaging': [{ module: 'Imaging', screen: 'Orders' }],
  '/imaging/queue': [{ module: 'Imaging', screen: 'Orders' }],
  '/imaging/workspace': [{ module: 'Imaging', screen: 'Orders' }],
  '/imaging/reports': [{ module: 'Imaging', screen: 'Orders' }],
  '/billing': [{ module: 'Billing', screen: 'Invoices' }],
  '/billing/workspace': [{ module: 'Billing', screen: 'Invoices' }],
  '/billing/history': [{ module: 'Billing', screen: 'Invoices' }],
  '/administration/branches': [{ module: 'Administration', screen: 'Branches' }],
  '/administration/settings': [{ module: 'Administration', screen: 'Settings' }],
  '/administration/consent-templates': [{ module: 'Administration', screen: 'Consent Templates' }],
  '/patients': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/search': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/register': [{ module: 'Patients', screen: 'Patient Records', action: 'Create' }],
  '/patients/profile': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/history': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/emr': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/documents': [
    { module: 'Patients', screen: 'Patient Records' },
    { module: 'Patients', screen: 'Patient Documents' },
  ],
  '/patients/consent': [
    { module: 'Patients', screen: 'Patient Records' },
    { module: 'Patients', screen: 'Consent' },
  ],
  '/patients/consents': [
    { module: 'Patients', screen: 'Patient Records' },
    { module: 'Patients', screen: 'Consent' },
  ],
  '/doctors': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/directory': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/profile': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/availability': [
    { module: 'Doctors', screen: 'Doctor Directory' },
    { module: 'Doctors', screen: 'Doctor Availability' },
  ],
  '/doctors/schedule': [
    { module: 'Doctors', screen: 'Doctor Directory' },
    { module: 'Doctors', screen: 'Doctor Availability' },
    { module: 'Appointments', screen: 'Appointment Records' },
  ],
  '/doctors/performance': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/appointments': [{ module: 'Appointments', screen: 'Appointment Records' }],
  '/appointments/book': [
    { module: 'Appointments', screen: 'Appointment Booking' },
    { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' },
    { module: 'Patients', screen: 'Patient Records' },
    { module: 'Doctors', screen: 'Doctor Directory' },
    { module: 'Doctors', screen: 'Doctor Availability' },
  ],
  '/appointments/calendar': [{ module: 'Appointments', screen: 'Appointment Records' }],
  '/appointments/queue': [
    { module: 'Appointments', screen: 'Appointment Records' },
    { module: 'OPD', screen: 'OPD Visits' },
  ],
  '/appointments/referrals': [
    { module: 'Appointments', screen: 'Appointment Booking' },
    { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' },
    { module: 'OPD', screen: 'OPD Referral' },
  ],
  '/opd': [{ module: 'OPD', screen: 'OPD Visits' }],
  '/opd/queue': [{ module: 'OPD', screen: 'OPD Visits' }],
  '/opd/visit': [{ module: 'OPD', screen: 'OPD Consultation' }],
  '/opd/consultation': [{ module: 'OPD', screen: 'OPD Consultation' }],
  '/admissions': [{ module: 'Admissions', screen: 'Inpatient Admissions' }],
  '/admissions/bed-availability': [{ module: 'Admissions', screen: 'Beds' }],
  '/admissions/beds': [{ module: 'Admissions', screen: 'Beds' }],
  '/admissions/inpatients': [{ module: 'Admissions', screen: 'Admission Requests' }],
  '/admissions/requests': [{ module: 'Admissions', screen: 'Admission Requests' }],
  '/admissions/workspace': [{ module: 'Admissions', screen: 'Inpatient Admissions' }],
  '/reports/library': [{ module: 'Reports', screen: 'Phase 2 Reports' }],
  '/surgery': [
    { module: 'Surgery', screen: 'Recommendations' },
    { module: 'Surgery', screen: 'Bookings' },
    { module: 'Surgery', screen: 'Schedule' },
  ],
  '/surgery/recommendations': [{ module: 'Surgery', screen: 'Recommendations' }],
  '/surgery/bookings': [{ module: 'Surgery', screen: 'Bookings' }],
  '/surgery/schedule': [{ module: 'Surgery', screen: 'Schedule' }],
  '/emergency': [{ module: 'Emergency', screen: 'Encounters' }],
  '/emergency/queue': [{ module: 'Emergency', screen: 'Encounters' }],
  '/emergency/workspace': [{ module: 'Emergency', screen: 'Encounters' }],
};

const anyPermissionRoutes = new Set(['/surgery']);

const normalize = (value: string) => value.trim().toLowerCase().replaceAll(/[_\s-]+/g, ' ');
const pathnameOnly = (value: string) => {
  const delimiterIndex = value.search(/[?#]/);
  const pathname = delimiterIndex >= 0 ? value.slice(0, delimiterIndex) : value;
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
};

export const isSuperAdministrator = (roles: AuthRole[]) =>
  roles.some((role) => role.code === 'SUPER_ADMIN');

export const hasPermission = (
  permissions: AuthPermission[],
  requirement: PermissionRequirement,
  roles: AuthRole[] = [],
) => {
  if (isSuperAdministrator(roles)) return true;

  const reqModule = normalize(requirement.module);
  const reqScreen = normalize(requirement.screen);
  const reqAction = normalize(requirement.action ?? 'View');

  return permissions.some(
    (permission) =>
      (normalize(permission.module) === reqModule &&
        normalize(permission.screen) === reqScreen &&
        normalize(permission.action) === reqAction) ||
      (permission.code &&
        normalize(permission.code) === normalize(requirement.module + '_' + requirement.screen + '_' + (requirement.action ?? 'View'))),
  );
};

export const isPermissionControlledRoute = (pathname: string) =>
  pathnameOnly(pathname) in routeRequirements;

export const canAccessRoute = (
  pathname: string,
  permissions: AuthPermission[],
  roles: AuthRole[] = [],
) => {
  const normalizedPathname = pathnameOnly(pathname);
  if (normalizedPathname === '/' || normalizedPathname === '/dashboard') return true;
  if (isSuperAdministrator(roles)) return true;

  const requirements = routeRequirements[normalizedPathname];
  if (!requirements) return false;

  const matches = anyPermissionRoutes.has(normalizedPathname) ? 'some' : 'every';
  return requirements[matches]((requirement) => hasPermission(permissions, requirement));
};

export const getAccessibleSidebarModules = (
  permissions: AuthPermission[],
  roles: AuthRole[] = [],
): SidebarModule[] => {
  if (isSuperAdministrator(roles)) return sidebarModules;

  return sidebarModules
    .map((module) => ({
      ...module,
      links: module.links.filter((link) => canAccessRoute(link.href, permissions, roles)),
    }))
    .filter((module) => module.links.length > 0);
};
