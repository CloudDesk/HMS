import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { PermissionRepository } from '../permissions/permission.repository.js';
import { PermissionService } from '../permissions/permission.service.js';
import { RoleModel } from '../roles/role.model.js';
import { RoleRepository } from '../roles/role.repository.js';
import { RoleService } from '../roles/role.service.js';
import { UserModel } from './user.model.js';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';

const metadata = { ipAddress: '127.0.0.1', userAgent: 'user-authorization-test' };

describe('user privilege protection', () => {
  let mongodb: MongoMemoryServer;
  let service: UserService;
  let roleService: RoleService;
  let permissionService: PermissionService;
  let branchId: string;
  let departmentId: string;
  let lowRoleId: string;
  let managerRoleId: string;
  let higherRoleId: string;
  let superAdminRoleId: string;
  let actorId: string;

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();

    const permissions = await PermissionModel.create([
      {
        code: 'TEST_USERS_VIEW',
        name: 'Test users view',
        module: 'Test',
        screen: 'Users',
        action: 'View',
        type: 'system',
        status: 'active',
      },
      {
        code: 'TEST_USERS_EDIT',
        name: 'Test users edit',
        module: 'Test',
        screen: 'Users',
        action: 'Edit',
        type: 'system',
        status: 'active',
      },
      {
        code: 'TEST_USERS_ADMIN',
        name: 'Test users administer',
        module: 'Test',
        screen: 'Users',
        action: 'Administer',
        type: 'system',
        status: 'active',
      },
    ]);
    const [viewPermission, editPermission, adminPermission] = permissions;

    const roles = await RoleModel.create([
      {
        code: 'TEST_LOW',
        name: 'Test Low',
        permissionIds: [viewPermission._id],
        status: 'active',
      },
      {
        code: 'TEST_MANAGER',
        name: 'Test Manager',
        permissionIds: [viewPermission._id, editPermission._id],
        status: 'active',
      },
      {
        code: 'TEST_HIGHER',
        name: 'Test Higher',
        permissionIds: [viewPermission._id, editPermission._id, adminPermission._id],
        status: 'active',
      },
      {
        code: 'SUPER_ADMIN',
        name: 'Super Administrator',
        permissionIds: permissions.map((permission) => permission._id),
        type: 'system',
        status: 'active',
      },
    ]);
    [lowRoleId, managerRoleId, higherRoleId, superAdminRoleId] = roles.map((role) =>
      role._id.toString(),
    );

    const branch = await BranchModel.create({ code: 'SEC', name: 'Security Branch', status: 'ACTIVE' });
    const department = await DepartmentModel.create({
      code: 'SEC',
      name: 'Security Department',
      branchIds: [branch._id],
      status: 'ACTIVE',
    });
    branchId = branch._id.toString();
    departmentId = department._id.toString();

    const actor = await createUser('manager', [managerRoleId]);
    actorId = actor._id.toString();

    permissionService = new PermissionService(new PermissionRepository());
    const roleRepository = new RoleRepository();
    service = new UserService(
      new UserRepository(),
      roleRepository,
      permissionService,
      undefined,
    );
    roleService = new RoleService(roleRepository, permissionService);
  });

  const createUser = (name: string, roleIds: string[]) =>
    UserModel.create({
      _id: new Types.ObjectId(),
      employeeCode: `EMP-${name}`,
      username: name,
      email: `${name}@example.test`,
      fullName: name,
      passwordHash: 'existing-password-hash',
      roleIds,
      branchIds: [],
      departmentIds: [],
      status: 'active',
    });

  const createInput = (name: string, roleIds: string[]) => ({
    employeeCode: `EMP-${name}`,
    username: name,
    email: `${name}@example.test`,
    fullName: name,
    password: 'StrongPass1!',
    branches: [{ id: branchId, isPrimary: true }],
    departments: [{ id: departmentId, isPrimary: true }],
    roleIds,
  });

  it('rejects SUPER_ADMIN assignment by a non-SUPER_ADMIN actor', async () => {
    await expect(
      service.create(createInput('attempted-super-admin', [superAdminRoleId]), actorId, metadata),
    ).rejects.toMatchObject({ statusCode: 403, code: 'SUPER_ADMIN_ASSIGNMENT_FORBIDDEN' });

    expect(await UserModel.exists({ username: 'attempted-super-admin' })).toBeNull();
  });

  it('rejects create and update role assignments above the actor authority', async () => {
    await expect(
      service.create(createInput('attempted-higher-user', [higherRoleId]), actorId, metadata),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ROLE_ASSIGNMENT_EXCEEDS_AUTHORITY' });

    const lowerUser = await createUser('lower-update-target', [lowRoleId]);
    await expect(
      service.update(lowerUser._id.toString(), { roleIds: [higherRoleId] }, actorId, metadata),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ROLE_ASSIGNMENT_EXCEEDS_AUTHORITY' });
  });

  it('rejects modification of a higher-privileged user', async () => {
    const target = await createUser('higher-target', [higherRoleId]);

    await expect(
      service.update(target._id.toString(), { fullName: 'Changed by manager' }, actorId, metadata),
    ).rejects.toMatchObject({ statusCode: 403, code: 'PRIVILEGED_USER_MODIFICATION_FORBIDDEN' });

    expect((await UserModel.findById(target._id).lean())?.fullName).toBe('higher-target');
  });

  it('does not allow the role assignment endpoint to bypass authority checks', async () => {
    const target = await createUser('role-assignment-target', [lowRoleId]);

    await expect(
      roleService.assignUser(
        higherRoleId,
        { userId: target._id.toString() },
        actorId,
        metadata,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ROLE_ASSIGNMENT_EXCEEDS_AUTHORITY' });

    expect(await UserModel.exists({ _id: target._id, roleIds: higherRoleId })).toBeNull();
  });

  it('rejects indirect modification of higher-privileged users through their role', async () => {
    await expect(
      roleService.update(higherRoleId, { name: 'Manager-controlled name' }, actorId, metadata),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PRIVILEGED_ROLE_MODIFICATION_FORBIDDEN',
    });
    await expect(
      permissionService.replaceRolePermissions(
        higherRoleId,
        { permissionIds: [] },
        actorId,
        metadata,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PRIVILEGED_ROLE_MODIFICATION_FORBIDDEN',
    });
  });

  it('rejects password reset of an equal-privileged user', async () => {
    const target = await createUser('equal-target', [managerRoleId]);
    const originalPasswordHash = target.passwordHash;

    await expect(
      service.resetPassword(
        target._id.toString(),
        { newPassword: 'ReplacementPass1!' },
        actorId,
        metadata,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PRIVILEGED_USER_PASSWORD_RESET_FORBIDDEN',
    });

    expect((await UserModel.findById(target._id).lean())?.passwordHash).toBe(originalPasswordHash);
  });

  it('preserves authorized administrator management of lower-privileged users', async () => {
    const administrator = await createUser('authorized-administrator', [higherRoleId]);
    const administratorId = administrator._id.toString();
    const created = await service.create(
      createInput('authorized-created-user', [lowRoleId]),
      administratorId,
      metadata,
    );

    await expect(
      service.update(created.id, { fullName: 'Authorized Update' }, administratorId, metadata),
    ).resolves.toMatchObject({ fullName: 'Authorized Update' });
    await expect(
      service.resetPassword(
        created.id,
        { newPassword: 'ReplacementPass1!' },
        administratorId,
        metadata,
      ),
    ).resolves.toEqual({ ok: true });
  });
});
