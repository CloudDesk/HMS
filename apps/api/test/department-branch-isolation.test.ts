import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DepartmentRepository } from '../src/modules/departments/department.repository.js';
import { DepartmentService } from '../src/modules/departments/department.service.js';
import { BranchRepository } from '../src/modules/branches/branch.repository.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';

describe('Department Branch-Isolation (Fix H10)', () => {
  let repository: DepartmentRepository;
  let service: DepartmentService;
  let branchRepo: BranchRepository;

  const branchA = createObjectId();
  const branchB = createObjectId();
  const branchC = createObjectId();

  beforeAll(async () => {
    await setupTestDatabase();
    repository = new DepartmentRepository();
    branchRepo = new BranchRepository();
    service = new DepartmentService(repository, branchRepo);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await BranchModel.create([
      { _id: new Types.ObjectId(branchA), code: 'BR-A', name: 'Branch A', status: 'ACTIVE' },
      { _id: new Types.ObjectId(branchB), code: 'BR-B', name: 'Branch B', status: 'ACTIVE' },
      { _id: new Types.ObjectId(branchC), code: 'BR-C', name: 'Branch C', status: 'ACTIVE' },
    ]);
  });

  it('1. A department assigned to the requested branch is returned', async () => {
    const dept = await DepartmentModel.create({
      code: 'CARD-A',
      name: 'Cardiology Branch A',
      branchIds: [new Types.ObjectId(branchA)],
      status: 'ACTIVE',
      isClinical: true,
    });

    const result = await service.list({ branch_id: branchA });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(dept._id.toString());
    expect(result.data[0].code).toBe('CARD-A');
  });

  it('2. A multi-branch department is returned for each assigned branch', async () => {
    const multiDept = await DepartmentModel.create({
      code: 'GEN-MED',
      name: 'General Medicine Multi',
      branchIds: [new Types.ObjectId(branchA), new Types.ObjectId(branchB)],
      status: 'ACTIVE',
      isClinical: true,
    });

    const resA = await service.list({ branch_id: branchA });
    expect(resA.data.some((d) => d.id === multiDept._id.toString())).toBe(true);

    const resB = await service.list({ branch_id: branchB });
    expect(resB.data.some((d) => d.id === multiDept._id.toString())).toBe(true);

    const resC = await service.list({ branch_id: branchC });
    expect(resC.data.some((d) => d.id === multiDept._id.toString())).toBe(false);
  });

  it('3. A department assigned only to another branch is excluded', async () => {
    await DepartmentModel.create({
      code: 'DERM-B',
      name: 'Dermatology Branch B Only',
      branchIds: [new Types.ObjectId(branchB)],
      status: 'ACTIVE',
      isClinical: true,
    });

    const resA = await service.list({ branch_id: branchA });
    expect(resA.data.some((d) => d.code === 'DERM-B')).toBe(false);
  });

  it('4. A department with missing branchIds and no matching branchId is excluded', async () => {
    // Insert raw document without branchIds or branchId
    const db = mongoose.connection.db!;
    await db.collection('departments').insertOne({
      code: 'NO-BRANCHIDS',
      name: 'Unassigned Missing BranchIds Dept',
      status: 'ACTIVE',
      isClinical: false,
      hiddenModules: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resA = await service.list({ branch_id: branchA });
    expect(resA.data.some((d) => d.code === 'NO-BRANCHIDS')).toBe(false);

    const resB = await service.list({ branch_id: branchB });
    expect(resB.data.some((d) => d.code === 'NO-BRANCHIDS')).toBe(false);
  });

  it('5. A department with an empty branchIds array and no matching branchId is excluded', async () => {
    const db = mongoose.connection.db!;
    await db.collection('departments').insertOne({
      code: 'EMPTY-BRANCHIDS',
      name: 'Unassigned Empty BranchIds Dept',
      branchIds: [],
      status: 'ACTIVE',
      isClinical: false,
      hiddenModules: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resA = await service.list({ branch_id: branchA });
    expect(resA.data.some((d) => d.code === 'EMPTY-BRANCHIDS')).toBe(false);

    const resB = await service.list({ branch_id: branchB });
    expect(resB.data.some((d) => d.code === 'EMPTY-BRANCHIDS')).toBe(false);
  });

  it('6. A valid legacy branchId record remains visible to its assigned branch', async () => {
    const db = mongoose.connection.db!;
    const legacyId = new Types.ObjectId();
    await db.collection('departments').insertOne({
      _id: legacyId,
      code: 'LEGACY-DEPT',
      name: 'Legacy Single Branch Dept',
      branchId: new Types.ObjectId(branchA),
      branchIds: [],
      status: 'ACTIVE',
      isClinical: true,
      hiddenModules: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resA = await service.list({ branch_id: branchA });
    const foundA = resA.data.find((d) => d.code === 'LEGACY-DEPT');
    expect(foundA).toBeDefined();
    expect(foundA?.id).toBe(legacyId.toString());
    expect(foundA?.branch_ids).toContain(branchA);

    // Should NOT be visible to branch B
    const resB = await service.list({ branch_id: branchB });
    expect(resB.data.some((d) => d.code === 'LEGACY-DEPT')).toBe(false);
  });

  it('7. Unscoped administrative listing retains its intended behavior', async () => {
    await DepartmentModel.create({
      code: 'DEPT-A',
      name: 'Branch A Dept',
      branchIds: [new Types.ObjectId(branchA)],
      status: 'ACTIVE',
    });
    await DepartmentModel.create({
      code: 'DEPT-B',
      name: 'Branch B Dept',
      branchIds: [new Types.ObjectId(branchB)],
      status: 'ACTIVE',
    });
    const db = mongoose.connection.db!;
    await db.collection('departments').insertOne({
      code: 'DEPT-UNASSIGNED',
      name: 'Unassigned Global Dept',
      branchIds: [],
      status: 'ACTIVE',
      isClinical: false,
      hiddenModules: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Unscoped query (no branch_id filter)
    const result = await service.list({});
    expect(result.meta.total).toBe(3);
    const codes = result.data.map((d) => d.code);
    expect(codes).toContain('DEPT-A');
    expect(codes).toContain('DEPT-B');
    expect(codes).toContain('DEPT-UNASSIGNED');
  });

  it('8. Existing search, sorting, pagination, and filters remain intact', async () => {
    await DepartmentModel.create([
      {
        code: 'P-CARD-1',
        name: 'Cardiology 1',
        description: 'Heart clinic',
        branchIds: [new Types.ObjectId(branchA)],
        status: 'ACTIVE',
        isClinical: true,
      },
      {
        code: 'P-CARD-2',
        name: 'Cardiology 2',
        description: 'Heart surgery',
        branchIds: [new Types.ObjectId(branchA)],
        status: 'INACTIVE',
        isClinical: true,
      },
      {
        code: 'P-ADMIN',
        name: 'Admin Department',
        description: 'General administration',
        branchIds: [new Types.ObjectId(branchA)],
        status: 'ACTIVE',
        isClinical: false,
      },
    ]);

    // Search within branchA
    const searchRes = await service.list({ branch_id: branchA, search: 'Heart' });
    expect(searchRes.data).toHaveLength(2);
    expect(searchRes.data.every((d) => d.name.includes('Cardiology'))).toBe(true);

    // Status filter within branchA
    const activeRes = await service.list({ branch_id: branchA, status: 'ACTIVE' });
    expect(activeRes.data).toHaveLength(2);
    expect(activeRes.data.some((d) => d.code === 'P-CARD-2')).toBe(false);

    // isClinical filter within branchA
    const clinicalRes = await service.list({ branch_id: branchA, isClinical: true });
    expect(clinicalRes.data).toHaveLength(2);
    expect(clinicalRes.data.some((d) => d.code === 'P-ADMIN')).toBe(false);

    // Sorting by name asc
    const sortAscRes = await service.list({ branch_id: branchA, sortBy: 'name', sortOrder: 'asc' });
    expect(sortAscRes.data[0].name).toBe('Admin Department');

    // Sorting by name desc
    const sortDescRes = await service.list({ branch_id: branchA, sortBy: 'name', sortOrder: 'desc' });
    expect(sortDescRes.data[0].name).toBe('Cardiology 2');

    // Pagination
    const page1 = await service.list({ branch_id: branchA, page: 1, limit: 2, sortBy: 'name', sortOrder: 'asc' });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.totalPages).toBe(2);

    const page2 = await service.list({ branch_id: branchA, page: 2, limit: 2, sortBy: 'name', sortOrder: 'asc' });
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].name).toBe('Cardiology 2');
  });
});
