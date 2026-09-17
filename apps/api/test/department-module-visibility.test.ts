import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DepartmentRepository } from '../src/modules/departments/department.repository.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';

describe('configurable department module visibility', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('defaults to no hidden modules and persists configured module keys', async () => {
    const branch = await BranchModel.create({ code: 'VIS01', name: 'Visibility Branch', status: 'ACTIVE' });
    const actor = await UserModel.create({
      username: 'visibility-admin',
      email: 'visibility-admin@example.test',
      fullName: 'Visibility Admin',
      passwordHash: 'test',
      roleIds: [],
      branchIds: [branch._id],
      departmentIds: [],
      status: 'active',
    });
    const repository = new DepartmentRepository();
    const created = await repository.create({
      code: 'DENT-VIS',
      name: 'Dental Visibility',
      branch_ids: [String(branch._id)],
      isClinical: true,
    }, String(actor._id));

    expect(created.hiddenModules).toEqual([]);

    const updated = await repository.update(created.id, { hiddenModules: ['surgery', 'emergency'] }, String(actor._id));
    expect(updated.hiddenModules).toEqual(['surgery', 'emergency']);
  });

  it('returns assigned department visibility in the authenticated access context', async () => {
    const branch = await BranchModel.create({ code: 'VIS02', name: 'Auth Visibility Branch', status: 'ACTIVE' });
    const department = await DepartmentModel.create({
      code: 'DENT-AUTH',
      name: 'Dental Auth Visibility',
      branchIds: [branch._id],
      status: 'ACTIVE',
      isClinical: true,
      hiddenModules: ['surgery'],
    });
    const role = await RoleModel.create({
      code: 'DOCTOR_VISIBILITY_TEST',
      name: 'Doctor Visibility Test',
      type: 'system',
      status: 'active',
      permissionIds: [],
    });
    const user = await UserModel.create({
      username: 'visibility-doctor',
      email: 'visibility-doctor@example.test',
      fullName: 'Visibility Doctor',
      passwordHash: 'test',
      roleIds: [role._id],
      branchIds: [branch._id],
      departmentIds: [department._id],
      status: 'active',
    });

    const context = await new AuthRepository().getUserAccessContext(String(user._id));

    expect(context.departments).toEqual([{
      id: String(department._id),
      code: 'DENT-AUTH',
      name: 'Dental Auth Visibility',
      hiddenModules: ['surgery'],
    }]);
  });
});
