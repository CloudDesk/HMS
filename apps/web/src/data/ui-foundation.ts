export type SidebarLink = {
  label: string;
  href: string;
};

export type SidebarModule = {
  key: string;
  label: string;
  icon: string;
  links: SidebarLink[];
};

export const sidebarModules: SidebarModule[] = [
  {
    key: 'patients',
    label: 'Patients',
    icon: 'ph-users',
    links: [
      { href: '/patients/search', label: 'Search Patients' },
      { href: '/patients/register', label: 'Patient Registration' },
      // Patient profile, history, documents, EMR, and consents are record-scoped views.
      // They remain routable from patient search/profile actions with ?id=..., not as standalone sidebar entries.
    ],
  },
  {
    key: 'doctors',
    label: 'Doctors',
    icon: 'ph-stethoscope',
    links: [
      { href: '/doctors', label: 'Dashboard' },
      { href: '/doctors/directory', label: 'Doctor Directory' },
      { href: '/doctors/schedule', label: 'Doctor Schedule' },
      { href: '/doctors/availability', label: 'Availability' },
      { href: '/doctors/performance', label: 'Performance' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: 'ph-calendar-blank',
    links: [
      { href: '/appointments', label: 'Appointment Dashboard' },
      { href: '/appointments/book', label: 'Book Appointment' },
      { href: '/appointments/calendar', label: 'Calendar View' },
      // { href: '/appointments/availability', label: 'Doctor Availability' },
      { href: '/appointments/queue', label: 'Queue Management' },
    ],
  },
  {
    key: 'opd',
    label: 'OPD',
    icon: 'ph-first-aid',
    links: [
      { href: '/opd', label: 'Dashboard' },
      { href: '/opd/queue', label: 'Waiting Queue' },
      // OPD visit and consultation workspaces require a visit id and are opened from the queue.
    ],
  },
  {
    key: 'emergency',
    label: 'Emergency',
    icon: 'ph-star',
    links: [
      { href: '/emergency', label: 'Dashboard' },
      { href: '/emergency/queue', label: 'Emergency Queue' },
      { href: '/emergency/workspace', label: 'Emergency Workspace' },
    ],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    icon: 'ph-bed',
    links: [
      { href: '/admissions', label: 'Dashboard' },
      { href: '/admissions/requests', label: 'Admission Requests' },
      { href: '/admissions/beds', label: 'Bed Management' },
      { href: '/admissions/workspace', label: 'Inpatient Workspace' },
    ],
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: 'ph-pill',
    links: [
      { href: '/pharmacy', label: 'Dashboard' },
      { href: '/pharmacy/queue', label: 'Prescription Queue' },
      { href: '/pharmacy/dispensing', label: 'Dispensing Workspace' },
      { href: '/pharmacy/inventory', label: 'Inventory' },
    ],
  },
  {
    key: 'laboratory',
    label: 'Laboratory',
    icon: 'ph-flask',
    links: [
      { href: '/laboratory', label: 'Dashboard' },
      { href: '/laboratory/queue', label: 'Work Queue' },
      { href: '/laboratory/workspace', label: 'Laboratory Workspace' },
      { href: '/laboratory/reports', label: 'Reports' },
    ],
  },
  {
    key: 'imaging',
    label: 'Imaging',
    icon: 'ph-image-square',
    links: [
      { href: '/imaging', label: 'Dashboard' },
      { href: '/imaging/queue', label: 'Work Queue' },
      { href: '/imaging/workspace', label: 'Imaging Workspace' },
      { href: '/imaging/reports', label: 'Reports' },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: 'ph-receipt',
    links: [
      { href: '/billing', label: 'Billing Dashboard' },
      { href: '/billing/workspace', label: 'Billing Workspace' },
      { href: '/billing/history', label: 'Billing History' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'ph-package',
    links: [
      { href: '/inventory', label: 'Inventory Dashboard' },
      { href: '/inventory/items', label: 'Item Master' },
      { href: '/inventory/transactions', label: 'Inventory Transactions' },
      { href: '/inventory/history', label: 'Inventory History' },
      { href: '/inventory/reports', label: 'Inventory Reports' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'ph-chart-bar',
    links: [
      { href: '/reports', label: 'Reports Dashboard' },
      { href: '/reports/library', label: 'Report Library' },
      { href: '/reports/builder', label: 'Report Builder' },
      { href: '/reports/scheduled', label: 'Scheduled Reports' },
      { href: '/reports/history', label: 'Report History' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: 'ph-gear',
    links: [
      { href: '/administration', label: 'Administration Dashboard' },
      { href: '/administration/users', label: 'User Management' },
      { href: '/administration/roles-permissions', label: 'Roles & Permissions' },
      { href: '/administration/departments', label: 'Department Management' },
      { href: '/administration/services', label: 'Service Catalogue' },
      { href: '/administration/branches', label: 'Branch Management' },
      { href: '/administration/settings', label: 'System Settings' },
    ],
  },
];

export const mockNotifications = [
  {
    id: 'nt-1',
    title: 'Lab queue threshold reached',
    description: '12 orders are waiting for sample collection.',
    time: '8 min ago',
    tone: 'orange' as const,
  },
  {
    id: 'nt-2',
    title: 'Emergency bed released',
    description: 'ICU bed E-04 is marked available.',
    time: '21 min ago',
    tone: 'green' as const,
  },
  {
    id: 'nt-3',
    title: 'Daily billing export ready',
    description: 'Finance summary is available for review.',
    time: '1 hr ago',
    tone: 'blue' as const,
  },
];

export const mockUser = {
  name: 'Dr. Peter Odhiambo',
  role: 'Administrator',
  initials: 'PO',
};
