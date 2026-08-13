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
  '/patients/search': [{ module: 'Patients', screen: 'Patient Records' }],
  '/patients/register': [{ module: 'Patients', screen: 'Patient Records', action: 'Create' }],
  '/patients/profile': [{ module: 'Patients', screen: 'Patient Records' }],
  '/doctors': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/directory': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/profile': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/doctors/availability': [{ module: 'Doctors', screen: 'Doctor Availability' }],
  '/doctors/schedule': [{ module: 'Doctors', screen: 'Doctor Availability' }],
  '/doctors/performance': [{ module: 'Doctors', screen: 'Doctor Directory' }],
  '/appointments': [{ module: 'Appointments', screen: 'Appointment Records' }],
  '/appointments/book': [{ module: 'Appointments', screen: 'Appointment Booking' }],
  '/appointments/calendar': [{ module: 'Appointments', screen: 'Appointment Records' }],
  '/appointments/queue': [{ module: 'Appointments', screen: 'Appointment Records' }],
  '/opd': [{ module: 'OPD', screen: 'OPD Visits' }],
  '/opd/queue': [{ module: 'OPD', screen: 'OPD Visits' }],
  '/opd/visit': [{ module: 'OPD', screen: 'OPD Visits' }],
  '/opd/consultation': [{ module: 'OPD', screen: 'OPD Consultation' }],
};

const normalize = (value: string) => value.trim().toLowerCase();
const isSuperAdministrator = (roles: AuthRole[]) => roles.some((role) => role.code === 'SUPER_ADMIN');

export const hasPermission = (
  permissions: AuthPermission[],
  requirement: PermissionRequirement,
) => permissions.some(
  (permission) =>
    normalize(permission.module) === normalize(requirement.module) &&
    normalize(permission.screen) === normalize(requirement.screen) &&
    normalize(permission.action) === normalize(requirement.action ?? 'View'),
);

export const isPermissionControlledRoute = (pathname: string) => pathname in routeRequirements;

export const canAccessRoute = (
  pathname: string,
  permissions: AuthPermission[],
  roles: AuthRole[] = [],
) => {
  if (pathname === '/' || pathname === '/dashboard') return true;
  if (isSuperAdministrator(roles)) return true;

  const requirements = routeRequirements[pathname];
  if (!requirements) return false;

  return requirements.every((requirement) => hasPermission(permissions, requirement));
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
