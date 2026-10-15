import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase } from '../../database/seed.js';
import { BranchModel } from '../branches/branch.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';

describe('Ophthalmology Phase 2 permission seed', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await BranchModel.create([
      { code: 'MB01', name: 'Main Branch', status: 'ACTIVE' },
      { code: 'SB01', name: 'Secondary Branch', status: 'ACTIVE' },
    ]);
    await seedDatabase();
  });

  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it('seeds the complete DEC-07 inventory and grants it automatically only to SUPER_ADMIN', async () => {
    const permissions = await PermissionModel.find({ module: 'OPD', screen: /^Ophthalmology /, status: 'active', deletedAt: null }).lean();
    expect(permissions).toHaveLength(37);
    expect(new Set(permissions.map((item) => `${item.screen}:${item.action}`))).toEqual(new Set([
      ...['View', 'Create', 'Edit', 'Deactivate'].map((action) => `Ophthalmology Configuration:${action}`),
      ...['View', 'Edit', 'Escalate'].map((action) => `Ophthalmology Intake:${action}`),
      ...['View', 'Assign', 'Reassign', 'Call', 'Start', 'Edit', 'Complete', 'Cancel'].map((action) => `Ophthalmology Test Queue:${action}`),
      ...['View', 'Review', 'Request Repeat', 'Amend'].map((action) => `Ophthalmology Test Review:${action}`),
      ...['View', 'Edit', 'Diagnose', 'Prescribe', 'Complete', 'Override', 'Reopen', 'Amend'].map((action) => `Ophthalmology Consultation:${action}`),
      ...['View', 'Create', 'Edit', 'Approve', 'Cancel'].map((action) => `Ophthalmology Optical Prescription:${action}`),
      ...['View', 'Publish', 'Withdraw'].map((action) => `Ophthalmology Portal Publication:${action}`),
      ...['View', 'Export'].map((action) => `Ophthalmology Reports:${action}`),
    ]));

    const permissionIds = new Set(permissions.map((item) => item._id.toString()));
    const roles = await RoleModel.find({ status: 'active', deletedAt: null }).lean();
    const superAdmin = roles.find((role) => role.code === 'SUPER_ADMIN');
    expect(superAdmin).toBeDefined();
    expect([...permissionIds].every((id) => (superAdmin?.permissionIds ?? []).some((permissionId) => permissionId.toString() === id))).toBe(true);
    for (const role of roles.filter((item) => item.code !== 'SUPER_ADMIN')) {
      expect((role.permissionIds ?? []).some((permissionId) => permissionIds.has(permissionId.toString()))).toBe(false);
    }
  });
});
