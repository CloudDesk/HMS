import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionModel } from './permission.model.js';
import { PermissionRepository } from './permission.repository.js';
import { RoleModel } from '../roles/role.model.js';

describe('M-012 permission expansion role counts', () => {
  let mongodb: MongoMemoryServer;
  let repository: PermissionRepository;

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
    repository = new PermissionRepository();
  });

  it('returns unchanged ordered permissions with exact batched role counts and zero defaults', async () => {
    const [alpha, beta, gamma] = await PermissionModel.create([
      { code: 'M012_ALPHA', name: 'Alpha permission', module: 'M-012', screen: 'Permissions', action: 'Alpha', description: 'Alpha description', type: 'system', status: 'active' },
      { code: 'M012_BETA', name: 'Beta permission', module: 'M-012', screen: 'Permissions', action: 'Beta', type: 'custom', status: 'active' },
      { code: 'M012_GAMMA', name: 'Gamma permission', module: 'M-012', screen: 'Permissions', action: 'Gamma', type: 'custom', status: 'inactive' },
    ]);
    await RoleModel.create([
      { code: 'M012_ROLE_ONE', name: 'M-012 Role One', permissionIds: [alpha._id, beta._id], status: 'active' },
      { code: 'M012_ROLE_TWO', name: 'M-012 Role Two', permissionIds: [alpha._id, alpha._id], status: 'inactive' },
      { code: 'M012_ROLE_DELETED', name: 'M-012 Deleted Role', permissionIds: [gamma._id], status: 'active', deletedAt: new Date() },
    ]);
    const roleCountDocuments = vi.spyOn(RoleModel, 'countDocuments');
    const roleAggregate = vi.spyOn(RoleModel, 'aggregate');

    try {
      const result = await repository.list({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.total).toBe(3);
      expect(result.permissions.map((permission) => permission.name)).toEqual([
        'Alpha permission',
        'Beta permission',
        'Gamma permission',
      ]);
      expect(result.permissions.map((permission) => permission.roleCount)).toEqual([2, 1, 0]);
      expect(result.permissions[0]).toMatchObject({
        id: alpha._id.toString(),
        code: 'M012_ALPHA',
        name: 'Alpha permission',
        module: 'M-012',
        screen: 'Permissions',
        action: 'Alpha',
        description: 'Alpha description',
        type: 'system',
        status: 'active',
        categoryId: null,
        categoryCode: null,
        categoryName: null,
        groupId: null,
        groupCode: null,
        groupName: null,
        roleCount: 2,
        deletedAt: null,
      });
      expect(roleAggregate).toHaveBeenCalledTimes(1);
      expect(roleCountDocuments).not.toHaveBeenCalled();
    } finally {
      roleAggregate.mockRestore();
      roleCountDocuments.mockRestore();
    }
  });

  it('preserves the existing role-count ordering behavior', async () => {
    const [alpha, beta, gamma] = await PermissionModel.create([
      { code: 'M012_SORT_ALPHA', name: 'Alpha', module: 'M-012', screen: 'Sort', action: 'Alpha', type: 'custom', status: 'active' },
      { code: 'M012_SORT_BETA', name: 'Beta', module: 'M-012', screen: 'Sort', action: 'Beta', type: 'custom', status: 'active' },
      { code: 'M012_SORT_GAMMA', name: 'Gamma', module: 'M-012', screen: 'Sort', action: 'Gamma', type: 'custom', status: 'active' },
    ]);
    await RoleModel.create([
      { code: 'M012_SORT_ROLE_ONE', name: 'Sort Role One', permissionIds: [beta._id, gamma._id], status: 'active' },
      { code: 'M012_SORT_ROLE_TWO', name: 'Sort Role Two', permissionIds: [gamma._id], status: 'active' },
    ]);

    const result = await repository.list({
      page: 1,
      limit: 10,
      sortBy: 'roleCount',
      sortOrder: 'desc',
    });

    expect(result.permissions.map((permission) => [permission.id, permission.roleCount])).toEqual([
      [gamma._id.toString(), 2],
      [beta._id.toString(), 1],
      [alpha._id.toString(), 0],
    ]);
  });

  it('uses one grouped query in every multi-permission expansion path', async () => {
    const [alpha, beta] = await PermissionModel.create([
      { code: 'M012_PATH_ALPHA', name: 'Path Alpha', module: 'M-012', screen: 'Paths', action: 'Alpha', type: 'custom', status: 'active' },
      { code: 'M012_PATH_BETA', name: 'Path Beta', module: 'M-012', screen: 'Paths', action: 'Beta', type: 'custom', status: 'active' },
    ]);
    const role = await RoleModel.create({
      code: 'M012_PATH_ROLE',
      name: 'Path Role',
      permissionIds: [alpha._id, beta._id],
      status: 'active',
    });
    const roleCountDocuments = vi.spyOn(RoleModel, 'countDocuments');
    const roleAggregate = vi.spyOn(RoleModel, 'aggregate');

    try {
      await repository.findPermissionsByIds([alpha._id.toString(), beta._id.toString()]);
      expect(roleAggregate).toHaveBeenCalledTimes(1);

      roleAggregate.mockClear();
      await repository.getPermissionsByRole(role._id.toString());
      expect(roleAggregate).toHaveBeenCalledTimes(1);

      roleAggregate.mockClear();
      await repository.getAllActivePermissions();
      expect(roleAggregate).toHaveBeenCalledTimes(1);
      expect(roleCountDocuments).not.toHaveBeenCalled();
    } finally {
      roleAggregate.mockRestore();
      roleCountDocuments.mockRestore();
    }
  });
});
