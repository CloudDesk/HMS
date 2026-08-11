import { PermissionCategoryModel, PermissionGroupModel, PermissionModel } from '../modules/permissions/permission.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { hashPassword } from '../shared/security/hash.js';

const administrationPermissions = {
  Users: ['View', 'Create', 'Edit', 'ChangePassword', 'ResetPassword', 'Delete'],
  Roles: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
  Permissions: ['View', 'Create', 'Edit', 'Assign', 'Delete'],
  Branches: ['View', 'Create', 'Edit', 'Delete'],
  Departments: ['View', 'Create', 'Edit', 'Delete'],
  Services: ['View', 'Create', 'Edit', 'Delete'],
} as const;

const permissionCode = (screen: string, action: string) =>
  `ADMINISTRATION_${screen}_${action}`.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

export const seedDatabase = async () => {
  const category = await PermissionCategoryModel.findOneAndUpdate(
    { code: 'SYSTEM' },
    {
      $setOnInsert: {
        name: 'System Management',
        description: 'System level configurations',
      },
    },
    { upsert: true, new: true },
  );

  const group = await PermissionGroupModel.findOneAndUpdate(
    { categoryId: category._id, code: 'ADMINISTRATION' },
    {
      $setOnInsert: {
        name: 'Administration',
      },
    },
    { upsert: true, new: true },
  );

  const permissionIds = [];

  for (const [screen, actions] of Object.entries(administrationPermissions)) {
    for (const action of actions) {
      const permission = await PermissionModel.findOneAndUpdate(
        { code: permissionCode(screen, action) },
        {
          $set: {
            name: `${screen} ${action}`,
            module: 'Administration',
            screen,
            action,
            type: 'system',
            status: 'active',
            categoryId: category._id,
            groupId: group._id,
            deletedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      permissionIds.push(permission._id);
    }
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

  const roles = [];

  for (const roleSeed of systemRoles) {
    const role = await RoleModel.findOneAndUpdate(
      { code: roleSeed.code },
      {
        $set: {
          ...roleSeed,
          type: 'system',
          status: 'active',
          permissionIds,
          deletedAt: null,
        },
      },
      { upsert: true, new: true },
    );

    roles.push(role);
  }

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
