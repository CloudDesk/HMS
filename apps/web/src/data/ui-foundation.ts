export type SidebarLink = {
  label: string;
  href: string;
  icon?: string;
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
      { href: '/patients/search', label: 'Patients', icon: 'ph-users' },
      { href: '/patients/consent', label: 'Consent Attachment', icon: 'ph-file-text' },
    ],
  },
  {
    key: 'doctors',
    label: 'Doctors',
    icon: 'ph-stethoscope',
    links: [
      { href: '/doctors/directory', label: 'Doctor Directory', icon: 'ph-user' },
      { href: '/doctors/schedule', label: 'Doctor Schedule', icon: 'ph-calendar' },
      { href: '/doctors/availability', label: 'Availability', icon: 'ph-clock' },
      // { href: '/doctors/performance', label: 'Performance', icon: 'ph-chart-line' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: 'ph-calendar-blank',
    links: [
      { href: '/appointments/book', label: 'Book Appointment', icon: 'ph-calendar-plus' },
      { href: '/appointments/referrals', label: 'Referral Booking', icon: 'ph-arrow-square-out' },
      { href: '/appointments/calendar', label: 'Calendar View', icon: 'ph-calendar-blank' },
      { href: '/appointments/queue', label: 'Queue Management', icon: 'ph-users' },
    ],
  },
  {
    key: 'opd',
    label: 'OPD',
    icon: 'ph-first-aid',
    links: [
      { href: '/opd/consultation', label: 'Consultation', icon: 'ph-chats-circle' },
      { href: '/opd/queue', label: 'Waiting Queue', icon: 'ph-clock' },
    ],
  },
  {
    key: 'emergency',
    label: 'Emergency',
    icon: 'ph-warning-circle',
    links: [
      { href: '/emergency', label: 'Dashboard', icon: 'ph-squares-four' },
      { href: '/emergency/queue', label: 'Emergency Queue', icon: 'ph-users' },
      { href: '/emergency/workspace', label: 'Emergency Workspace', icon: 'ph-activity' },
    ],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    icon: 'ph-bed',
    links: [
      { href: '/admissions/inpatients', label: 'Admission Requests', icon: 'ph-user-plus' },
      { href: '/admissions/beds', label: 'Bed Management', icon: 'ph-bed' },
      { href: '/admissions/workspace', label: 'Inpatient Workspace', icon: 'ph-clipboard-text' },
    ],
  },
  {
    key: 'surgery',
    label: 'Surgery',
    icon: 'ph-scissors',
    links: [
      { href: '/surgery', label: 'Procedure Workflow', icon: 'ph-scissors' },
    ],
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: 'ph-pill',
    links: [
      { href: '/pharmacy/queue', label: 'Prescription Queue', icon: 'ph-clipboard-text' },
      // { href: '/pharmacy/dispensing', label: 'Dispensing Workspace', icon: 'ph-pill' },
      { href: '/pharmacy/inventory', label: 'Inventory', icon: 'ph-package' },
    ],
  },
  {
    key: 'laboratory',
    label: 'Laboratory',
    icon: 'ph-flask',
    links: [
      { href: '/laboratory/queue', label: 'Work Queue', icon: 'ph-flask' },
      // { href: '/laboratory/workspace', label: 'Laboratory Workspace', icon: 'ph-flask' },
      // { href: '/laboratory/reports', label: 'Reports', icon: 'ph-file-text' },
    ],
  },
  {
    key: 'imaging',
    label: 'Imaging',
    icon: 'ph-image-square',
    links: [
      { href: '/imaging/queue', label: 'Work Queue', icon: 'ph-scan' },
      // { href: '/imaging/workspace', label: 'Imaging Workspace', icon: 'ph-scan' },
      // { href: '/imaging/reports', label: 'Reports', icon: 'ph-file-text' },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: 'ph-receipt',
    links: [
      { href: '/billing/workspace', label: 'Billing Workspace', icon: 'ph-receipt' },
      { href: '/billing/history', label: 'Billing History', icon: 'ph-clock-counter-clockwise' },
    ],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    icon: 'ph-shield-check',
    links: [
      { href: '/insurance/payers', label: 'Payers', icon: 'ph-buildings' },
      { href: '/insurance/schemes', label: 'Schemes', icon: 'ph-shield-check' },
      { href: '/insurance/policies', label: 'Policies', icon: 'ph-file-text' },
      { href: '/insurance/members', label: 'Members', icon: 'ph-users' },
      { href: '/insurance/benefits', label: 'Benefit Configuration', icon: 'ph-sliders' },
      { href: '/insurance/sha-mappings', label: 'SHA Service Mapping', icon: 'ph-git-fork' },
    ],
  },
  // Inventory module is disabled as per project configuration.
  // {
  //   key: 'inventory',
  //   label: 'Inventory',
  //   icon: 'ph-package',
  //   links: [
  //     { href: '/inventory', label: 'Inventory Dashboard', icon: 'ph-squares-four' },
  //     { href: '/inventory/items', label: 'Item Master', icon: 'ph-package' },
  //     { href: '/inventory/transactions', label: 'Inventory Transactions', icon: 'ph-arrows-left-right' },
  //     { href: '/inventory/history', label: 'Inventory History', icon: 'ph-clock-counter-clockwise' },
  //     { href: '/inventory/reports', label: 'Inventory Reports', icon: 'ph-chart-bar' },
  //   ],
  // },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'ph-chart-bar',
    links: [
      { href: '/reports/library', label: 'Reports', icon: 'ph-chart-bar' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: 'ph-gear',
    links: [
      { href: '/administration/users', label: 'User Management', icon: 'ph-users' },
      { href: '/administration/roles-permissions', label: 'Roles & Permissions', icon: 'ph-shield-check' },
      { href: '/administration/departments', label: 'Department Management', icon: 'ph-buildings' },
      { href: '/administration/services', label: 'Service Catalogue', icon: 'ph-clipboard-text' },
      { href: '/administration/medicines', label: 'Medicine Master', icon: 'ph-pill' },
      { href: '/administration/branches', label: 'Branch Management', icon: 'ph-tree-structure' },
      { href: '/administration/consent-templates', label: 'Consent Templates', icon: 'ph-file-text' },
      { href: '/administration/settings', label: 'System Settings', icon: 'ph-gear' },
    ],
  },
];
