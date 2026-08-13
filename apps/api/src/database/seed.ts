import { PermissionCategoryModel, PermissionGroupModel, PermissionModel } from '../modules/permissions/permission.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { hashPassword } from '../shared/security/hash.js';

const administrationPermissions = {
  Dashboard: ['View'],
  Users: ['View', 'Create', 'Edit', 'ChangePassword', 'ResetPassword', 'Delete', 'Export'],
  Roles: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
  Permissions: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
  Branches: ['View', 'Create', 'Edit', 'Delete', 'Export'],
  Departments: ['View', 'Create', 'Edit', 'Delete', 'Export'],
  Services: ['View', 'Create', 'Edit', 'Delete', 'Export'],
} as const;

const patientPermissions = {
  'Patient Records': ['View', 'Create', 'Edit'],
  'Patient Documents': ['View', 'Create', 'Edit', 'Delete'],
} as const;

const doctorPermissions = {
  'Doctor Directory': ['View', 'Create', 'Edit', 'Export', 'Provision Login'],
  'Doctor Availability': ['View', 'Edit'],
} as const;

const appointmentPermissions = {
  'Appointment Records': ['View', 'Edit'],
  'Appointment Booking': ['View', 'Create', 'Edit'],
} as const;

const opdPermissions = {
  'OPD Visits': ['View', 'Create', 'Edit'],
  'OPD Vitals': ['View', 'Create'],
  'OPD Consultation': ['View', 'Edit'],
  'OPD Prescription': ['View', 'Edit'],
  'OPD Clinical Orders': ['View', 'Edit'],
  'OPD Follow-up': ['View', 'Edit'],
  'OPD Referral': ['View', 'Edit'],
} as const;

const permissionCode = (moduleName: string, screen: string, action: string) =>
  `${moduleName}_${screen}_${action}`
    .replaceAll(/([a-z])([A-Z])/g, '$1_$2')
    .replaceAll(/\s+/g, '_')
    .toUpperCase();

export const seedDatabase = async () => {
  const systemCategory = await PermissionCategoryModel.findOneAndUpdate(
    { code: 'SYSTEM' },
    {
      $setOnInsert: {
        name: 'System Management',
        description: 'System level configurations',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const administrationGroup = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: systemCategory._id, code: 'ADMINISTRATION' },
    {
      $setOnInsert: {
        name: 'Administration',
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const permissionIds = [];

  for (const [screen, actions] of Object.entries(administrationPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode('Administration', screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'Administration',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: systemCategory._id,
            groupId: administrationGroup._id,
            deletedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      permissionIds.push(permission._id);
    }
  }

  const clinicalCategory = await PermissionCategoryModel.findOneAndUpdate(
    { code: 'CLINICAL' },
    {
      $setOnInsert: {
        name: 'Clinical Operations',
        description: 'Patient, OPD, and clinical workflow permissions',
      },
    },
    { upsert: true, new: true },
  );

  const patientsGroup = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: clinicalCategory._id, code: 'PATIENTS' },
    {
      $setOnInsert: {
        name: 'Patients',
      },
    },
    { upsert: true, new: true },
  );

  for (const [screen, actions] of Object.entries(patientPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode('Patients', screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'Patients',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: clinicalCategory._id,
            groupId: patientsGroup._id,
            deletedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      permissionIds.push(permission._id);
    }
  }

  const doctorsGroup = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: clinicalCategory._id, code: 'DOCTORS' },
    {
      $setOnInsert: {
        name: 'Doctors',
      },
    },
    { upsert: true, new: true },
  );

  for (const [screen, actions] of Object.entries(doctorPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode('Doctors', screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'Doctors',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: clinicalCategory._id,
            groupId: doctorsGroup._id,
            deletedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      permissionIds.push(permission._id);
    }
  }

  const appointmentsGroup = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: clinicalCategory._id, code: 'APPOINTMENTS' },
    {
      $setOnInsert: {
        name: 'Appointments',
      },
    },
    { upsert: true, new: true },
  );

  for (const [screen, actions] of Object.entries(appointmentPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode('Appointments', screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'Appointments',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: clinicalCategory._id,
            groupId: appointmentsGroup._id,
            deletedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      permissionIds.push(permission._id);
    }
  }

  const opdGroup = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: clinicalCategory._id, code: 'OPD' },
    {
      $setOnInsert: {
        name: 'OPD',
      },
    },
    { upsert: true, new: true },
  );

  for (const [screen, actions] of Object.entries(opdPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode('OPD', screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'OPD',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: clinicalCategory._id,
            groupId: opdGroup._id,
            deletedAt: null,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      permissionIds.push(permission._id);
    }
  }

  for (const action of ['View', 'Edit', 'Export'] as const) {
    const permission = await PermissionModel.findOneAndUpdate(
      { code: `settings.${action.toLowerCase()}` },
      {
        $set: {
          name: `Settings ${action}`,
          module: 'Administration',
          screen: 'Settings',
          action,
          type: 'system',
          status: 'active',
          categoryId: systemCategory._id,
          groupId: administrationGroup._id,
          deletedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    permissionIds.push(permission._id);
  }

  const systemRoles = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Full system access',
    },
    {
      code: 'ADMINISTRATOR',
      name: 'Administrator',
      description: 'System administration without destructive capabilities',
    },
  ];
  const systemPermissionIds = await PermissionModel.distinct('_id', {
    type: 'system',
    status: 'active',
    deletedAt: null,
  });
  const administratorDefaultPermissionIds = await PermissionModel.distinct('_id', {
    module: 'Administration',
    action: { $ne: 'Delete' },
    status: 'active',
    deletedAt: null,
  });
  const doctorDefaultPermissionIds = await PermissionModel.distinct('_id', {
    module: 'Doctors',
    status: 'active',
    deletedAt: null,
    $or: [
      { screen: 'Doctor Directory', action: 'View' },
      { screen: 'Doctor Availability', action: { $in: ['View', 'Edit'] } },
    ],
  });

  const roles = [];

  for (const roleSeed of systemRoles) {
    const role = await RoleModel.findOneAndUpdate(
      { code: roleSeed.code },
      roleSeed.code === 'SUPER_ADMIN'
        ? {
            $set: {
              ...roleSeed,
              type: 'system',
              status: 'active',
              deletedAt: null,
              permissionIds: systemPermissionIds,
            },
          }
        : {
            $set: {
              ...roleSeed,
              type: 'system',
              status: 'active',
              deletedAt: null,
            },
            $setOnInsert: {
              permissionIds: administratorDefaultPermissionIds,
            },
          },
      { upsert: true, returnDocument: 'after' },
    );

    roles.push(role);
  }

  await RoleModel.findOneAndUpdate(
    { code: 'DOCTOR' },
    {
      $set: {
        name: 'Doctor',
        description: 'Clinical doctor access',
        type: 'system',
        status: 'active',
        deletedAt: null,
      },
      $setOnInsert: {
        permissionIds: doctorDefaultPermissionIds,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const superAdminRole = roles.find((role) => role.code === 'SUPER_ADMIN')!;
  const existingAdmin = await UserModel.findOne({ username: 'admin' }).select('_id').lean();

  if (existingAdmin) {
    await UserModel.updateOne(
      { _id: existingAdmin._id },
      {
        $addToSet: { roleIds: superAdminRole._id },
        $set: { deletedAt: null },
      },
    );
  } else {
    await UserModel.create({
      username: 'admin',
      email: 'admin@hms.com',
      fullName: 'System Administrator',
      passwordHash: await hashPassword('Admin123!'),
      roleIds: [superAdminRole._id],
      status: 'active',
    });
  }
};
