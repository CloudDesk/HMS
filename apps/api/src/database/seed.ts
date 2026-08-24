import type { Types } from 'mongoose';
import { AuditLogModel } from '../modules/auth/auth.model.js';
import { BranchModel } from '../modules/branches/branch.model.js';
import { DepartmentModel } from '../modules/departments/department.model.js';
import { PermissionCategoryModel, PermissionGroupModel, PermissionModel } from '../modules/permissions/permission.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { ServiceModel } from '../modules/services/service.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { hashPassword } from '../shared/security/hash.js';

type PermissionDefinition = {
  code?: string;
  module: string;
  screen: string;
  action: string;
  category: 'SYSTEM' | 'CLINICAL' | 'FINANCE';
  group: string;
};

type RoleDefinition = {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
};

const permissionCode = (moduleName: string, screen: string, action: string) =>
  `${moduleName}_${screen}_${action}`
    .replaceAll(/([a-z])([A-Z])/g, '$1_$2')
    .replaceAll(/\s+/g, '_')
    .toUpperCase();

const permission = (
  module: string,
  screen: string,
  action: string,
  category: PermissionDefinition['category'],
  group: string,
): PermissionDefinition => ({ module, screen, action, category, group });

const expandPermissions = (
  module: string,
  screens: Record<string, readonly string[]>,
  category: PermissionDefinition['category'],
  group: string,
) => Object.entries(screens).flatMap(([screen, actions]) =>
  actions.map((action) => permission(module, screen, action, category, group)),
);

const permissionDefinitions: PermissionDefinition[] = [
  ...expandPermissions('Administration', {
    Dashboard: ['View'],
    Users: ['View', 'Create', 'Edit', 'ChangePassword', 'ResetPassword', 'Delete', 'Export'],
    Roles: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
    Permissions: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
    Branches: ['View', 'Create', 'Edit', 'Delete', 'Export'],
    Departments: ['View', 'Create', 'Edit', 'Delete', 'Export'],
    Services: ['View', 'Create', 'Edit', 'Delete', 'Export'],
    Medicines: ['View', 'Create', 'Edit', 'Delete', 'Export'],
  }, 'SYSTEM', 'ADMINISTRATION'),
  ...expandPermissions('Patients', {
    'Patient Records': ['View', 'Create', 'Edit'],
    'Patient Documents': ['View', 'Create', 'Edit', 'Delete'],
  }, 'CLINICAL', 'PATIENTS'),
  ...expandPermissions('Doctors', {
    'Doctor Directory': ['View', 'Create', 'Edit', 'Export', 'Provision Login'],
    'Doctor Availability': ['View', 'Edit'],
  }, 'CLINICAL', 'DOCTORS'),
  ...expandPermissions('Appointments', {
    'Appointment Records': ['View', 'Edit'],
    'Appointment Booking': ['View', 'Create', 'Edit'],
  }, 'CLINICAL', 'APPOINTMENTS'),
  ...expandPermissions('OPD', {
    'OPD Visits': ['View', 'Create', 'Edit'],
    'OPD Vitals': ['View', 'Create', 'Edit'],
    'OPD Consultation': ['View', 'Edit'],
    'OPD Prescription': ['View', 'Edit'],
    'OPD Clinical Orders': ['View', 'Edit'],
    'OPD Follow-up': ['View', 'Edit'],
    'OPD Referral': ['View', 'Edit'],
  }, 'CLINICAL', 'OPD'),
  ...expandPermissions('Pharmacy', {
    'Medicine Inventory': ['View', 'RegisterBatch', 'RecordMovement', 'AdjustStock', 'EditBatch', 'ConfigureLowStock'],
    Dispensing: ['View', 'Edit', 'Dispense', 'Cancel', 'Reverse', 'UpdateStatus'],
  }, 'CLINICAL', 'PHARMACY'),
  ...expandPermissions('Admissions', {
    Wards: ['View', 'Create', 'Edit', 'ChangeStatus'],
    Beds: ['View', 'Create', 'Edit', 'ChangeStatus'],
    'Admission Policy': ['View', 'Edit'],
    'Bed Holds': ['View', 'Create', 'Release', 'Cancel'],
    'Bed Transfers': ['View', 'Create', 'Complete', 'Cancel', 'CrossBranch'],
    'Inpatient Admissions': ['View', 'Create'],
    'Admission Recommendations': ['View', 'Create', 'Cancel'],
    'Admission Requests': ['View', 'Create', 'Validate', 'Confirm', 'Cancel'],
  }, 'CLINICAL', 'ADMISSIONS'),
  ...expandPermissions('Surgery', {
    Recommendations: ['View', 'Create', 'Cancel'],
    Bookings: ['View', 'Create', 'Confirm', 'Reschedule', 'Cancel', 'Complete'],
    Schedule: ['View'],
  }, 'CLINICAL', 'SURGERY'),
  ...expandPermissions('Emergency', {
    Encounters: ['View', 'Register', 'Edit'],
    Triage: ['View', 'Assess', 'OverridePriority'],
    Consultation: ['View', 'Edit'],
    Orders: ['View', 'Create'],
    Disposition: ['View', 'Discharge', 'Transfer', 'ConvertToIP', 'MarkLeft', 'MarkNoShow', 'Cancel'],
    'Patient Linking': ['Link', 'Correct'],
  }, 'CLINICAL', 'EMERGENCY'),
  ...expandPermissions('Laboratory', {
    Orders: ['View', 'Edit', 'EnterResult', 'VerifyResult'],
  }, 'CLINICAL', 'LABORATORY'),
  ...expandPermissions('Imaging', {
    Orders: ['View', 'Edit', 'EnterReport', 'VerifyReport'],
  }, 'CLINICAL', 'IMAGING'),
  ...expandPermissions('Billing', {
    Invoices: ['View', 'Create', 'Edit', 'Cancel', 'CollectPayment', 'ViewReceipt'],
  }, 'FINANCE', 'BILLING'),
  ...['View', 'Edit', 'Export'].map((action) => ({
    ...permission('Administration', 'Settings', action, 'SYSTEM', 'ADMINISTRATION'),
    code: `settings.${action.toLowerCase()}`,
  })),
];

const code = (moduleName: string, screen: string, action: string) =>
  permissionCode(moduleName, screen, action);

const administratorPermissionCodes = [
  code('Administration', 'Dashboard', 'View'),
  ...['View', 'Create', 'Edit', 'ChangePassword', 'ResetPassword', 'Export'].map((action) => code('Administration', 'Users', action)),
  ...['View', 'Create', 'Edit', 'Assign'].map((action) => code('Administration', 'Roles', action)),
  ...['View', 'Create', 'Edit', 'Assign'].map((action) => code('Administration', 'Permissions', action)),
  ...['Branches', 'Departments', 'Services', 'Medicines'].flatMap((screen) =>
    ['View', 'Create', 'Edit', 'Export'].map((action) => code('Administration', screen, action))),
  ...['View', 'Edit', 'Export'].map((action) => `settings.${action.toLowerCase()}`),
  ...['View', 'Create', 'Edit', 'ChangeStatus'].flatMap((action) => [code('Admissions', 'Wards', action), code('Admissions', 'Beds', action)]),
  ...['View', 'Edit'].map((action) => code('Admissions', 'Admission Policy', action)),
  ...['View', 'Create', 'Release', 'Cancel'].map((action) => code('Admissions', 'Bed Holds', action)),
  ...['View', 'Create', 'Complete', 'Cancel', 'CrossBranch'].map((action) => code('Admissions', 'Bed Transfers', action)),
  ...['View', 'Create'].map((action) => code('Admissions', 'Inpatient Admissions', action)),
  ...['View', 'Create', 'Cancel'].map((action) => code('Admissions', 'Admission Recommendations', action)),
  ...['View', 'Create', 'Validate', 'Confirm', 'Cancel'].map((action) => code('Admissions', 'Admission Requests', action)),
  ...['View', 'Create', 'Cancel'].map((action) => code('Surgery', 'Recommendations', action)),
  ...['View', 'Create', 'Confirm', 'Reschedule', 'Cancel', 'Complete'].map((action) => code('Surgery', 'Bookings', action)),
  code('Surgery', 'Schedule', 'View'),
  ...['View', 'Register', 'Edit'].map((action) => code('Emergency', 'Encounters', action)),
  ...['View', 'Assess', 'OverridePriority'].map((action) => code('Emergency', 'Triage', action)),
  ...['View', 'Edit'].map((action) => code('Emergency', 'Consultation', action)),
  ...['View', 'Create'].map((action) => code('Emergency', 'Orders', action)),
  ...['View', 'Discharge', 'Transfer', 'ConvertToIP', 'MarkLeft', 'MarkNoShow', 'Cancel'].map((action) => code('Emergency', 'Disposition', action)),
  ...['Link', 'Correct'].map((action) => code('Emergency', 'Patient Linking', action)),
  ...['View', 'Create', 'Edit', 'Export', 'Provision Login'].map((action) => code('Doctors', 'Doctor Directory', action)),
  ...['View', 'Edit'].map((action) => code('Doctors', 'Doctor Availability', action)),
];

const roleDefinitions: RoleDefinition[] = [
  {
    code: 'ADMINISTRATOR',
    name: 'Administrator',
    description: 'Phase 1 administrative configuration without routine clinical workflow access',
    permissionCodes: administratorPermissionCodes,
  },
  {
    code: 'RECEPTIONIST',
    name: 'Receptionist',
    description: 'Patient registration, appointments, visit registration, and referral coordination',
    permissionCodes: [
      ...['View', 'Create', 'Edit'].map((action) => code('Patients', 'Patient Records', action)),
      ...['View', 'Create'].map((action) => code('Patients', 'Patient Documents', action)),
      code('Doctors', 'Doctor Directory', 'View'),
      code('Doctors', 'Doctor Availability', 'View'),
      ...['View', 'Create', 'Edit'].map((action) => code('Appointments', 'Appointment Booking', action)),
      ...['View', 'Edit'].map((action) => code('Appointments', 'Appointment Records', action)),
      ...['View', 'Create', 'Edit'].map((action) => code('OPD', 'OPD Visits', action)),
      ...['View', 'Create', 'Edit'].map((action) => code('OPD', 'OPD Vitals', action)),
      ...['View', 'Edit'].map((action) => code('OPD', 'OPD Referral', action)),
      ...['View', 'Create', 'Validate', 'Confirm', 'Cancel'].map((action) => code('Admissions', 'Admission Requests', action)),
      ...['Wards', 'Beds'].map((screen) => code('Admissions', screen, 'View')),
      code('Admissions', 'Admission Policy', 'View'),
      ...['View', 'Create', 'Release', 'Cancel'].map((action) => code('Admissions', 'Bed Holds', action)),
      code('Admissions', 'Inpatient Admissions', 'View'),
      ...['View', 'Create', 'Confirm', 'Reschedule', 'Cancel'].map((action) => code('Surgery', 'Bookings', action)),
      code('Surgery', 'Recommendations', 'View'),
      code('Surgery', 'Schedule', 'View'),
      ...['View', 'Register'].map((action) => code('Emergency', 'Encounters', action)),
      code('Emergency', 'Triage', 'View'),
      code('Emergency', 'Patient Linking', 'Link'),
    ],
  },
  {
    code: 'CLINICIAN_NURSE',
    name: 'Clinician / Nurse',
    description: 'Clinical queue support, patient document access, and vital-sign recording',
    permissionCodes: [
      code('Patients', 'Patient Records', 'View'),
      ...['View', 'Create'].map((action) => code('Patients', 'Patient Documents', action)),
      code('Appointments', 'Appointment Records', 'View'),
      code('Doctors', 'Doctor Directory', 'View'),
      code('Doctors', 'Doctor Availability', 'View'),
      ...['View', 'Edit'].map((action) => code('OPD', 'OPD Visits', action)),
      ...['View', 'Create'].map((action) => code('OPD', 'OPD Vitals', action)),
      ...['Wards', 'Beds'].map((screen) => code('Admissions', screen, 'View')),
      code('Admissions', 'Admission Requests', 'View'),
      code('Emergency', 'Encounters', 'View'),
      ...['View', 'Assess'].map((action) => code('Emergency', 'Triage', action)),
      code('Emergency', 'Consultation', 'View'),
    ],
  },
  {
    code: 'DOCTOR',
    name: 'Doctor',
    description: 'Phase 1 doctor consultation and clinical ordering access',
    permissionCodes: [
      ...['View', 'Edit'].map((action) => code('Patients', 'Patient Records', action)),
      ...['View', 'Create'].map((action) => code('Patients', 'Patient Documents', action)),
      code('Doctors', 'Doctor Directory', 'View'),
      ...['View', 'Edit'].map((action) => code('Doctors', 'Doctor Availability', action)),
      code('Appointments', 'Appointment Records', 'View'),
      ...['View', 'Edit'].map((action) => code('OPD', 'OPD Visits', action)),
      code('OPD', 'OPD Vitals', 'View'),
      ...['OPD Consultation', 'OPD Prescription', 'OPD Clinical Orders', 'OPD Follow-up', 'OPD Referral'].flatMap((screen) =>
        ['View', 'Edit'].map((action) => code('OPD', screen, action))),
      ...['View', 'Create', 'Cancel'].map((action) => code('Admissions', 'Admission Recommendations', action)),
      ...['View', 'Create', 'Cancel'].map((action) => code('Surgery', 'Recommendations', action)),
      ...['View', 'Create', 'Confirm', 'Reschedule', 'Cancel', 'Complete'].map((action) => code('Surgery', 'Bookings', action)),
      code('Surgery', 'Schedule', 'View'),
      code('Emergency', 'Encounters', 'View'),
      code('Emergency', 'Triage', 'View'),
      ...['View', 'Edit'].map((action) => code('Emergency', 'Consultation', action)),
      ...['View', 'Create'].map((action) => code('Emergency', 'Orders', action)),
      ...['View', 'Discharge', 'Transfer', 'ConvertToIP', 'MarkLeft'].map((action) => code('Emergency', 'Disposition', action)),
      code('Emergency', 'Patient Linking', 'Link'),
    ],
  },
  {
    code: 'PHARMACY_USER',
    name: 'Pharmacy User',
    description: 'Prescription review, medicine inventory, and Phase 1 dispensing access',
    permissionCodes: [
      code('OPD', 'OPD Prescription', 'View'),
      ...['View', 'RegisterBatch', 'RecordMovement', 'AdjustStock', 'EditBatch', 'ConfigureLowStock'].map((action) =>
        code('Pharmacy', 'Medicine Inventory', action)),
      ...['View', 'Edit', 'Dispense', 'Cancel', 'Reverse', 'UpdateStatus'].map((action) => code('Pharmacy', 'Dispensing', action)),
    ],
  },
  {
    code: 'LABORATORY_USER',
    name: 'Laboratory User',
    description: 'Laboratory queue processing, result entry, and verification',
    permissionCodes: ['View', 'Edit', 'EnterResult', 'VerifyResult'].map((action) => code('Laboratory', 'Orders', action)),
  },
  {
    code: 'IMAGING_USER',
    name: 'Imaging User',
    description: 'Imaging queue processing, report entry, and verification',
    permissionCodes: ['View', 'Edit', 'EnterReport', 'VerifyReport'].map((action) => code('Imaging', 'Orders', action)),
  },
  {
    code: 'BILLING_AUTHORIZED',
    name: 'Billing Authorized',
    description: 'Reusable permission profile for authorized Phase 1 billing users',
    permissionCodes: [
      ...['View', 'Create', 'Edit', 'Cancel', 'CollectPayment', 'ViewReceipt'].map((action) => code('Billing', 'Invoices', action)),
      code('Administration', 'Services', 'View'),
      code('Patients', 'Patient Records', 'View'),
      code('OPD', 'OPD Visits', 'View'),
    ],
  },
];

const initialUsers = [
  { username: 'receptionist', fullName: 'Initial Receptionist', employeeCode: 'SEED-RECEPTION', roleCode: 'RECEPTIONIST', branchCode: 'MB01', departmentTerms: ['reception'] },
  { username: 'nurse', fullName: 'Initial Nurse', employeeCode: 'SEED-NURSE', roleCode: 'CLINICIAN_NURSE', branchCode: 'MB01', departmentTerms: ['nursing'] },
  { username: 'pharmacy', fullName: 'Initial Pharmacy User', employeeCode: 'SEED-PHARMACY', roleCode: 'PHARMACY_USER', branchCode: 'MB01', departmentTerms: ['pharmacy'] },
  { username: 'laboratory', fullName: 'Initial Laboratory User', employeeCode: 'SEED-LABORATORY', roleCode: 'LABORATORY_USER', branchCode: 'SB01', departmentTerms: ['laboratory', 'lab'] },
  { username: 'imaging', fullName: 'Initial Imaging User', employeeCode: 'SEED-IMAGING', roleCode: 'IMAGING_USER', branchCode: 'SB01', departmentTerms: ['imaging', 'radiology'] },
  { username: 'billing', fullName: 'Initial Billing User', employeeCode: 'SEED-BILLING', roleCode: 'BILLING_AUTHORIZED', branchCode: 'SB01', departmentTerms: ['billing', 'finance'] },
  { username: 'receptionist_sb01', fullName: 'Secondary Branch Receptionist', employeeCode: 'SEED-SB01-RECEPTION', roleCode: 'RECEPTIONIST', branchCode: 'SB01', departmentTerms: ['reception'] },
  { username: 'nurse_sb01', fullName: 'Secondary Branch Nurse', employeeCode: 'SEED-SB01-NURSE', roleCode: 'CLINICIAN_NURSE', branchCode: 'SB01', departmentTerms: ['nursing'] },
  { username: 'pharmacy_sb01', fullName: 'Secondary Branch Pharmacy User', employeeCode: 'SEED-SB01-PHARMACY', roleCode: 'PHARMACY_USER', branchCode: 'SB01', departmentTerms: ['pharmacy'] },
  { username: 'laboratory_mb01', fullName: 'Main Branch Laboratory User', employeeCode: 'SEED-MB01-LABORATORY', roleCode: 'LABORATORY_USER', branchCode: 'MB01', departmentTerms: ['laboratory', 'lab'] },
  { username: 'imaging_mb01', fullName: 'Main Branch Imaging User', employeeCode: 'SEED-MB01-IMAGING', roleCode: 'IMAGING_USER', branchCode: 'MB01', departmentTerms: ['imaging', 'radiology'] },
  { username: 'billing_mb01', fullName: 'Main Branch Billing User', employeeCode: 'SEED-MB01-BILLING', roleCode: 'BILLING_AUTHORIZED', branchCode: 'MB01', departmentTerms: ['billing', 'finance'] },
] as const;

const sameIds = (left: Types.ObjectId[], right: Types.ObjectId[]) => {
  const a = left.map(String).sort();
  const b = right.map(String).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

export const seedDatabase = async () => {
  const changes: {
    permissionsCreated: string[];
    permissionsDeprecated: string[];
    rolesCreated: string[];
    rolesReconciled: string[];
    usersCreated: string[];
    usersReconciled: string[];
  } = {
    permissionsCreated: [],
    permissionsDeprecated: [],
    rolesCreated: [],
    rolesReconciled: [],
    usersCreated: [],
    usersReconciled: [],
  };

  const serviceTypeBackfill = await ServiceModel.updateMany(
    { $or: [{ serviceType: { $exists: false } }, { serviceType: null }] },
    { $set: { serviceType: 'GENERAL' } },
  );
  const departmentBranchBackfill = await DepartmentModel.collection.updateMany(
    {
      $and: [
        { $or: [{ branchIds: { $exists: false } }, { branchIds: { $size: 0 } }] },
        { branchId: { $type: 'objectId' } },
      ],
    },
    [{ $set: { branchIds: ['$branchId'] } }, { $unset: 'branchId' }],
  );

  const categories = new Map<string, Types.ObjectId>();
  for (const category of [
    { code: 'SYSTEM', name: 'System Management', description: 'System level configurations' },
    { code: 'CLINICAL', name: 'Clinical Operations', description: 'Patient, OPD, and clinical workflow permissions' },
    { code: 'FINANCE', name: 'Finance Operations', description: 'Billing and payment permissions' },
  ]) {
    const record = await PermissionCategoryModel.findOneAndUpdate(
      { code: category.code },
      { $set: category },
      { upsert: true, returnDocument: 'after' },
    );
    categories.set(category.code, record._id);
  }

  const groupNames: Record<string, string> = {
    ADMINISTRATION: 'Administration', PATIENTS: 'Patients', DOCTORS: 'Doctors',
    APPOINTMENTS: 'Appointments', OPD: 'OPD', PHARMACY: 'Pharmacy',
    LABORATORY: 'Laboratory', IMAGING: 'Imaging', BILLING: 'Billing', SURGERY: 'Surgery', EMERGENCY: 'Emergency',
  };
  const groups = new Map<string, Types.ObjectId>();
  for (const definition of permissionDefinitions) {
    const groupKey = `${definition.category}:${definition.group}`;
    if (groups.has(groupKey)) continue;
    const record = await PermissionGroupModel.findOneAndUpdate(
      { categoryId: categories.get(definition.category), code: definition.group },
      { $set: { name: groupNames[definition.group] } },
      { upsert: true, returnDocument: 'after' },
    );
    groups.set(groupKey, record._id);
  }

  const permissionsByCode = new Map<string, Types.ObjectId>();
  for (const definition of permissionDefinitions) {
    const generatedCode = definition.code ?? code(definition.module, definition.screen, definition.action);
    const existing = await PermissionModel.findOne({ code: generatedCode }).select('_id').lean();
    const record = await PermissionModel.findOneAndUpdate(
      { code: generatedCode },
      { $set: {
        name: `${definition.screen} ${definition.action}`,
        module: definition.module,
        screen: definition.screen,
        action: definition.action,
        type: 'system',
        status: 'active',
        categoryId: categories.get(definition.category),
        groupId: groups.get(`${definition.category}:${definition.group}`),
        deletedAt: null,
      } },
      { upsert: true, returnDocument: 'after' },
    );
    if (!existing) changes.permissionsCreated.push(generatedCode);
    permissionsByCode.set(generatedCode, record._id);
  }

  const legacyCodes = ['MANAGE_BRANCHES', 'MANAGE_DEPARTMENTS', 'MANAGE_ROLES', 'MANAGE_SERVICES', 'MANAGE_USERS'];
  const legacyPermissions = await PermissionModel.find({ code: { $in: legacyCodes }, status: { $ne: 'inactive' } })
    .select('_id code').lean();
  if (legacyPermissions.length > 0) {
    await PermissionModel.updateMany(
      { _id: { $in: legacyPermissions.map((item) => item._id) } },
      { $set: { status: 'inactive' } },
    );
    await RoleModel.updateMany({}, { $pull: { permissionIds: { $in: legacyPermissions.map((item) => item._id) } } });
    changes.permissionsDeprecated.push(...legacyPermissions.map((item) => item.code));
  }

  const duplicateSettingsCodes = ['ADMINISTRATION_SETTINGS_VIEW', 'ADMINISTRATION_SETTINGS_EDIT', 'ADMINISTRATION_SETTINGS_EXPORT'];
  const duplicateSettingsPermissions = await PermissionModel.find({
    code: { $in: duplicateSettingsCodes }, status: { $ne: 'inactive' },
  }).select('_id code').lean();
  if (duplicateSettingsPermissions.length > 0) {
    await PermissionModel.updateMany(
      { _id: { $in: duplicateSettingsPermissions.map((item) => item._id) } },
      { $set: { status: 'inactive' } },
    );
    await RoleModel.updateMany({}, {
      $pull: { permissionIds: { $in: duplicateSettingsPermissions.map((item) => item._id) } },
    });
    changes.permissionsDeprecated.push(...duplicateSettingsPermissions.map((item) => item.code));
  }

  const activeSystemPermissionIds = await PermissionModel.distinct('_id', {
    type: 'system', status: 'active', deletedAt: null,
  });
  const superAdmin = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).select('_id permissionIds').lean();
  const superAdminRole = await RoleModel.findOneAndUpdate(
    { code: 'SUPER_ADMIN' },
    { $set: {
      name: 'Super Administrator',
      description: 'Restricted platform/bootstrap break-glass access',
      type: 'system', status: 'active', deletedAt: null,
      permissionIds: activeSystemPermissionIds,
    } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!superAdmin) changes.rolesCreated.push('SUPER_ADMIN');
  else if (!sameIds(superAdmin.permissionIds ?? [], activeSystemPermissionIds)) changes.rolesReconciled.push('SUPER_ADMIN');

  const roleIdsByCode = new Map<string, Types.ObjectId>();
  roleIdsByCode.set('SUPER_ADMIN', superAdminRole._id);
  for (const definition of roleDefinitions) {
    const requiredIds = definition.permissionCodes.map((permissionCodeValue) => {
      const id = permissionsByCode.get(permissionCodeValue);
      if (!id) throw new Error(`Seed permission is missing: ${permissionCodeValue}`);
      return id;
    });
    const existing = await RoleModel.findOne({ code: definition.code }).select('_id permissionIds').lean();
    const role = await RoleModel.findOneAndUpdate(
      { code: definition.code },
      { $set: {
        name: definition.name,
        description: definition.description,
        type: 'system', status: 'active', deletedAt: null,
        permissionIds: requiredIds,
      } },
      { upsert: true, returnDocument: 'after' },
    );
    roleIdsByCode.set(definition.code, role._id);
    if (!existing) changes.rolesCreated.push(definition.code);
    else if (!sameIds(existing.permissionIds ?? [], requiredIds)) changes.rolesReconciled.push(definition.code);
  }

  const existingAdmin = await UserModel.findOne({ username: /^admin$/i }).select('_id roleIds deletedAt').lean();
  if (existingAdmin) {
    const needsSuperAdmin = !(existingAdmin.roleIds ?? []).some((id) => String(id) === String(superAdminRole._id));
    const needsRestore = Boolean(existingAdmin.deletedAt);
    if (needsSuperAdmin || needsRestore) {
      await UserModel.updateOne(
        { _id: existingAdmin._id },
        { $addToSet: { roleIds: superAdminRole._id }, $set: { deletedAt: null } },
      );
      changes.usersReconciled.push('admin');
    }
  } else {
    const adminPassword = process.env.HMS_SEED_ADMIN_PASSWORD ?? (process.env.APP_ENV === 'prod' ? undefined : 'Admin123!');
    if (!adminPassword) throw new Error('HMS_SEED_ADMIN_PASSWORD is required to create the bootstrap administrator');
    await UserModel.create({
      username: 'admin', email: 'admin@hms.com', fullName: 'System Administrator',
      passwordHash: await hashPassword(adminPassword), roleIds: [superAdminRole._id], status: 'active',
    });
    changes.usersCreated.push('admin');
  }

  const branchCodes = [...new Set(initialUsers.map((user) => user.branchCode))];
  const activeBranches = await BranchModel.find({
    code: { $in: branchCodes }, status: 'ACTIVE', deletedAt: null,
  }).lean();
  const branchesByCode = new Map(activeBranches.map((branch) => [branch.code, branch]));
  const missingBranchCodes = branchCodes.filter((branchCode) => !branchesByCode.has(branchCode));
  if (missingBranchCodes.length > 0) {
    throw new Error(`Active seed branches are missing: ${missingBranchCodes.join(', ')}`);
  }

  const activeDepartments = await DepartmentModel.find({
    branchIds: { $in: activeBranches.map((branch) => branch._id) }, status: 'ACTIVE', deletedAt: null,
  }).sort({ name: 1, _id: 1 }).lean();

  const operationalPassword = process.env.HMS_SEED_OPERATIONAL_PASSWORD ??
    (process.env.APP_ENV === 'prod' ? undefined : 'HmsPhase1Dev123!');
  for (const userSeed of initialUsers) {
    const roleId = roleIdsByCode.get(userSeed.roleCode)!;
    const existingUser = await UserModel.findOne({ username: new RegExp(`^${userSeed.username}$`, 'i') })
      .select('_id').lean();
    if (existingUser) continue;

    const branch = branchesByCode.get(userSeed.branchCode)!;
    const department = activeDepartments.find((item) =>
      item.branchIds.map(id => String(id)).includes(String(branch._id)) &&
      userSeed.departmentTerms.some((term) => `${item.code} ${item.name}`.toLowerCase().includes(term)));
    if (!department) {
      console.warn(`[Seeder Warning] An active ${userSeed.departmentTerms.join('/')} department is required in branch ${userSeed.branchCode} to seed ${userSeed.username}`);
      continue;
    }

    if (!operationalPassword) {
      throw new Error('HMS_SEED_OPERATIONAL_PASSWORD is required to create Phase 1 operational users');
    }
    await UserModel.create({
      username: userSeed.username,
      email: `${userSeed.username}@seed.hms.local`,
      fullName: userSeed.fullName,
      employeeCode: userSeed.employeeCode,
      jobTitle: userSeed.fullName.replace('Initial ', ''),
      employeeType: 'Development seed',
      passwordHash: await hashPassword(operationalPassword),
      roleIds: [roleId], branchIds: [branch._id], departmentIds: [department._id],
      status: 'active',
    });
    changes.usersCreated.push(userSeed.username);
  }

  const changed = serviceTypeBackfill.modifiedCount > 0 || departmentBranchBackfill.modifiedCount > 0 || Object.values(changes).some((items) => items.length > 0);
  if (changed) {
    await AuditLogModel.create({
      eventType: 'rbac.phase1_seed_reconciled',
      metadataJson: {
        ...changes,
        serviceTypesBackfilled: serviceTypeBackfill.modifiedCount,
        departmentBranchScopesBackfilled: departmentBranchBackfill.modifiedCount,
        branchCodes,
      },
    });
  }
};
