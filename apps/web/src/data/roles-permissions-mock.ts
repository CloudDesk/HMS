export type PermissionAction = 'View' | 'Create' | 'Edit' | 'Delete' | 'Approve' | 'Print' | 'Export';
export type RoleType = 'system' | 'custom';
export type RoleStatus = 'Active' | 'Inactive';

export type PermissionModule = {
  id: string;
  label: string;
  icon: string;
};

export type PermissionMatrix = Record<string, Record<PermissionAction, boolean>>;

export type MockRole = {
  id: string;
  name: string;
  type: RoleType;
  status: RoleStatus;
  description: string;
  users: number;
  color: string;
  permissions: PermissionMatrix;
};

export const permissionModules: PermissionModule[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ph-house' },
  { id: 'patients', label: 'Patients', icon: 'ph-users' },
  { id: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank' },
  { id: 'opd', label: 'OPD', icon: 'ph-stethoscope' },
  { id: 'emergency', label: 'Emergency', icon: 'ph-first-aid' },
  { id: 'admissions', label: 'Admissions', icon: 'ph-bed' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'ph-pill' },
  { id: 'laboratory', label: 'Laboratory', icon: 'ph-flask' },
  { id: 'imaging', label: 'Imaging', icon: 'ph-image-square' },
  { id: 'billing', label: 'Billing', icon: 'ph-receipt' },
  { id: 'inventory', label: 'Inventory', icon: 'ph-package' },
  { id: 'reports', label: 'Reports', icon: 'ph-chart-bar' },
  { id: 'administration', label: 'Administration', icon: 'ph-gear' },
];

export const permissionActions: PermissionAction[] = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Print', 'Export'];

const createMatrix = (allowedActions: PermissionAction[]): PermissionMatrix =>
  Object.fromEntries(
    permissionModules.map((module) => [
      module.id,
      Object.fromEntries(permissionActions.map((action) => [action, allowedActions.includes(action)])),
    ]),
  ) as PermissionMatrix;

const cloneMatrix = (matrix: PermissionMatrix): PermissionMatrix =>
  Object.fromEntries(
    Object.entries(matrix).map(([moduleId, permissions]) => [moduleId, { ...permissions }]),
  ) as PermissionMatrix;

const allPermissions = createMatrix(permissionActions);
const operationalPermissions = createMatrix(['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']);
const viewPrintPermissions = createMatrix(['View', 'Print']);
const billingPermissions = createMatrix(['View', 'Create', 'Edit', 'Approve', 'Print', 'Export']);
const limitedPermissions = createMatrix(['View']);

export const rolesPermissionsMockRoles: MockRole[] = [
  {
    id: 'R001',
    name: 'Super Admin',
    type: 'system',
    status: 'Active',
    description: 'Full system access across all modules and branches.',
    users: 2,
    color: '#0f172a',
    permissions: cloneMatrix(allPermissions),
  },
  {
    id: 'R002',
    name: 'Administrator',
    type: 'system',
    status: 'Active',
    description: 'Administrative access with user, branch, and settings management.',
    users: 3,
    color: '#2563eb',
    permissions: cloneMatrix(operationalPermissions),
  },
  {
    id: 'R003',
    name: 'Doctor',
    type: 'system',
    status: 'Active',
    description: 'Clinical workflow access for doctors across OPD, patients, lab and imaging.',
    users: 8,
    color: '#16a34a',
    permissions: cloneMatrix(viewPrintPermissions),
  },
  {
    id: 'R004',
    name: 'Nurse',
    type: 'system',
    status: 'Active',
    description: 'Nursing access for queue, admissions, patient profile and care coordination.',
    users: 12,
    color: '#9333ea',
    permissions: cloneMatrix(viewPrintPermissions),
  },
  {
    id: 'R005',
    name: 'Billing Officer',
    type: 'custom',
    status: 'Active',
    description: 'Billing operations, invoice creation, payment updates and billing history.',
    users: 4,
    color: '#ea580c',
    permissions: cloneMatrix(billingPermissions),
  },
  {
    id: 'R006',
    name: 'Pharmacist',
    type: 'custom',
    status: 'Active',
    description: 'Prescription queue, dispensing workspace and pharmacy inventory access.',
    users: 5,
    color: '#0d9488',
    permissions: cloneMatrix(operationalPermissions),
  },
  {
    id: 'R007',
    name: 'Receptionist',
    type: 'custom',
    status: 'Active',
    description: 'Front-desk registration, appointment booking and patient lookup access.',
    users: 6,
    color: '#0891b2',
    permissions: cloneMatrix(operationalPermissions),
  },
  {
    id: 'R008',
    name: 'Audit Viewer',
    type: 'custom',
    status: 'Inactive',
    description: 'Read-only audit, report and dashboard visibility for compliance review.',
    users: 1,
    color: '#7c3aed',
    permissions: cloneMatrix(limitedPermissions),
  },
];
