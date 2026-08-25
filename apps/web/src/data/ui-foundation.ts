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
      { href: '/patients/search', label: 'Patients' },
      { href: '/patients/consent', label: 'Consent Attachment' },
    ],
  },
  {
    key: 'doctors',
    label: 'Doctors',
    icon: 'ph-stethoscope',
    links: [
      { href: '/doctors/directory', label: 'Doctor Directory' },
      { href: '/doctors/schedule', label: 'Doctor Schedule' },
      { href: '/doctors/availability', label: 'Availability' },
      // { href: '/doctors/performance', label: 'Performance' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: 'ph-calendar-blank',
    links: [
      { href: '/appointments/book', label: 'Book Appointment' },
      { href: '/appointments/referrals', label: 'Referral Booking' },
      { href: '/appointments/calendar', label: 'Calendar View' },
    ],
  },
  {
    key: 'opd',
    label: 'OPD',
    icon: 'ph-first-aid',
    links: [
      { href: '/opd/consultation', label: 'Consultation' },
      { href: '/opd/queue', label: 'Queue Management' },
    ],
  },
  {
    key: 'emergency',
    label: 'Emergency',
    icon: 'ph-warning-circle',
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
      { href: '/admissions/inpatients', label: 'Admission Requests' },
      { href: '/admissions/beds', label: 'Bed Management' },
    ],
  },
  {
    key: 'surgery',
    label: 'Surgery',
    icon: 'ph-scissors',
    links: [
      { href: '/surgery', label: 'Procedure Workflow' },
    ],
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: 'ph-pill',
    links: [
      { href: '/pharmacy/queue', label: 'Prescription Queue' },
      // { href: '/pharmacy/dispensing', label: 'Dispensing Workspace' },
      { href: '/pharmacy/inventory', label: 'Inventory' },
    ],
  },
  {
    key: 'laboratory',
    label: 'Laboratory',
    icon: 'ph-flask',
    links: [
      { href: '/laboratory/queue', label: 'Work Queue' },
      // { href: '/laboratory/workspace', label: 'Laboratory Workspace' },
      // { href: '/laboratory/reports', label: 'Reports' },
    ],
  },
  {
    key: 'imaging',
    label: 'Imaging',
    icon: 'ph-image-square',
    links: [
      { href: '/imaging/queue', label: 'Work Queue' },
      // { href: '/imaging/workspace', label: 'Imaging Workspace' },
      // { href: '/imaging/reports', label: 'Reports' },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: 'ph-receipt',
    links: [
      { href: '/billing/workspace', label: 'Billing Workspace' },
      { href: '/billing/history', label: 'Billing History' },
    ],
  },
  // Inventory module is disabled as per project configuration.
  // {
  //   key: 'inventory',
  //   label: 'Inventory',
  //   icon: 'ph-package',
  //   links: [
  //     { href: '/inventory', label: 'Inventory Dashboard' },
  //     { href: '/inventory/items', label: 'Item Master' },
  //     { href: '/inventory/transactions', label: 'Inventory Transactions' },
  //     { href: '/inventory/history', label: 'Inventory History' },
  //     { href: '/inventory/reports', label: 'Inventory Reports' },
  //   ],
  // },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'ph-chart-bar',
    links: [
      { href: '/reports/library', label: 'Phase 2 Reports' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: 'ph-gear',
    links: [
      { href: '/administration/users', label: 'User Management' },
      { href: '/administration/roles-permissions', label: 'Roles & Permissions' },
      { href: '/administration/departments', label: 'Department Management' },
      { href: '/administration/services', label: 'Service Catalogue' },
      { href: '/administration/medicines', label: 'Medicine Master' },
      { href: '/administration/branches', label: 'Branch Management' },
      { href: '/administration/consent-templates', label: 'Consent Templates' },
      { href: '/administration/settings', label: 'System Settings' },
    ],
  },
];
