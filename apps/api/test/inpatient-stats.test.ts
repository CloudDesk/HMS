import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { connect, disconnect } from 'mongoose';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { AdmissionRequestModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { env } from '../src/config/env.js';
import { Types } from 'mongoose';

describe('Inpatient Admission Stats', async () => {
  let repo: InpatientAdmissionRepository;
  let service: InpatientAdmissionService;
  
  const branch1Id = new Types.ObjectId();
  const branch2Id = new Types.ObjectId();
  const dept1Id = new Types.ObjectId();
  const dept2Id = new Types.ObjectId();
  const adminRoleId = new Types.ObjectId();
  
  const superAdminId = new Types.ObjectId();
  const branch1UserId = new Types.ObjectId();
  const branch1Dept1UserId = new Types.ObjectId();
  
  before(async () => {
    await connect(env.DATABASE_URL);
    const seqService = new SequenceService();
    repo = new InpatientAdmissionRepository(seqService);
    // @ts-expect-error This focused repository test intentionally supplies service stubs.
    service = new InpatientAdmissionService(repo, {}, {}, {});

    await BranchModel.create([
      { _id: branch1Id, name: 'Branch 1', status: 'ACTIVE', code: 'B1' },
      { _id: branch2Id, name: 'Branch 2', status: 'ACTIVE', code: 'B2' }
    ]);
    
    await DepartmentModel.create([
      { _id: dept1Id, name: 'Cardiology', branchIds: [branch1Id, branch2Id], status: 'ACTIVE', code: 'CARD' },
      { _id: dept2Id, name: 'Surgery', branchIds: [branch1Id], status: 'ACTIVE', code: 'SURG' }
    ]);
    
    await RoleModel.create([
      { _id: adminRoleId, code: 'SUPER_ADMIN', name: 'Super Admin', status: 'active', permissions: [] }
    ]);
    
    await UserModel.create([
      { _id: superAdminId, email: 'admin@test.com', firstName: 'Admin', lastName: 'User', status: 'active', roleIds: [adminRoleId] },
      { _id: branch1UserId, email: 'b1@test.com', firstName: 'B1', lastName: 'User', status: 'active', branchIds: [branch1Id] },
      { _id: branch1Dept1UserId, email: 'b1d1@test.com', firstName: 'B1D1', lastName: 'User', status: 'active', branchIds: [branch1Id], departmentIds: [dept1Id] }
    ]);
    
    // Create requests
    const createReq = (branchId: Types.ObjectId, deptId: Types.ObjectId, status: string, count: number) => {
      return Array.from({ length: count }).map((_, i) => ({
        requestNumber: `AR-${branchId}-${deptId}-${status}-${i}`,
        patientId: new Types.ObjectId(),
        patientNumber: 'P1',
        patientName: 'Test',
        branchId: branchId,
        departmentId: deptId,
        departmentName: 'Dept',
        recommendingDoctorId: new Types.ObjectId(),
        recommendingDoctorName: 'Dr. Test',
        sourceType: 'DIRECT',
        admissionType: 'MEDICAL',
        priority: 'ROUTINE',
        reason: 'Test',
        status: status,
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId()
      }));
    };
    
    await AdmissionRequestModel.insertMany([
      ...createReq(branch1Id, dept1Id, 'PENDING_VALIDATION', 40),
      ...createReq(branch1Id, dept2Id, 'PENDING_VALIDATION', 40),
      ...createReq(branch1Id, dept1Id, 'READY_FOR_CONFIRMATION', 10),
      ...createReq(branch1Id, dept2Id, 'READY_FOR_CONFIRMATION', 10),
      ...createReq(branch1Id, dept1Id, 'CONFIRMED', 40),
      ...createReq(branch1Id, dept1Id, 'CANCELLED', 10),
      // Branch 2 noise
      ...createReq(branch2Id, dept1Id, 'PENDING_VALIDATION', 100),
    ]);
  });

  after(async () => {
    await BranchModel.deleteMany({});
    await DepartmentModel.deleteMany({});
    await RoleModel.deleteMany({});
    await UserModel.deleteMany({});
    await AdmissionRequestModel.deleteMany({});
    await disconnect();
  });

  test('Aggregation correctness for Super Admin (all departments in branch)', async () => {
    const stats = await service.getRequestStatusCounts(superAdminId.toString(), branch1Id.toString());
    assert.equal(stats.pendingValidation, 80);
    assert.equal(stats.readyForConfirmation, 20);
    assert.equal(stats.confirmed, 40);
    assert.equal(stats.cancelled, 10);
  });

  test('Department isolation (only Cardiology)', async () => {
    const stats = await service.getRequestStatusCounts(branch1Dept1UserId.toString(), branch1Id.toString());
    assert.equal(stats.pendingValidation, 40); // Only dept1
    assert.equal(stats.readyForConfirmation, 10);
    assert.equal(stats.confirmed, 40);
    assert.equal(stats.cancelled, 10);
  });

  test('Branch isolation', async () => {
    const stats = await service.getRequestStatusCounts(superAdminId.toString(), branch2Id.toString());
    assert.equal(stats.pendingValidation, 100);
    assert.equal(stats.readyForConfirmation, 0);
  });
  
  test('Empty result', async () => {
    // Delete all
    await AdmissionRequestModel.deleteMany({});
    const stats = await service.getRequestStatusCounts(superAdminId.toString(), branch1Id.toString());
    assert.equal(stats.pendingValidation, 0);
    assert.equal(stats.readyForConfirmation, 0);
    assert.equal(stats.confirmed, 0);
    assert.equal(stats.cancelled, 0);
  });
});
