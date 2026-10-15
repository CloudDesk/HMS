import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { UserModel } from '../users/user.model.js';
import {
  OphthalmologyConfigurationModel,
  OphthalmologyContextModel,
  OphthalmologyStationModel,
  OphthalmologyWorkflowProfileModel,
} from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';
import { assertOphthalmologyLaterality } from './ophthalmology-laterality.js';

describe('Ophthalmology Phase 2 foundation', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string;
  let departmentId: string;
  let userId: string;
  let visitId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      OphthalmologyConfigurationModel.init(), OphthalmologyContextModel.init(),
      OphthalmologyStationModel.init(), OphthalmologyWorkflowProfileModel.init(), OpdVisitModel.init(),
    ]);
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-BRANCH', name: 'Ophthalmology Branch', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const user = await UserModel.create({ username: 'phase2.user', email: 'phase2@example.test', fullName: 'Phase Two User',
      passwordHash: 'not-used-in-test', roleIds: [], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString();
    const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P2-001', queueTokenNumber: 1,
      patientId: new Types.ObjectId(), patientNumber: 'P-OPH-001', patientName: 'Ophthalmology Patient',
      doctorId: new Types.ObjectId(), doctorName: 'Dr Ophthalmology', doctorSpecialization: 'Ophthalmology',
      branchId: branch._id, departmentId: department._id, visitDate: new Date(), checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CHECKED_IN', version: 0 });
    visitId = visit._id.toString();
  });

  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it('activates a versioned configuration and prospectively supersedes the prior active revision', async () => {
    const first = await service.createConfiguration({ branch_id: branchId, type: 'COMPLETION_PROFILE', code: 'DEFAULT', name: 'Initial', values: {} }, userId);
    const activeFirst = await service.activateConfiguration(first.id, { expected_version: first.version, expected_status: 'DRAFT' }, userId);
    expect(activeFirst).toMatchObject({ status: 'ACTIVE', revision: 1, version: 1 });

    const second = await service.createConfiguration({ branch_id: branchId, type: 'COMPLETION_PROFILE', code: 'DEFAULT', name: 'Replacement', values: {} }, userId);
    const activeSecond = await service.activateConfiguration(second.id, { expected_version: second.version, expected_status: 'DRAFT' }, userId);
    expect(activeSecond).toMatchObject({ status: 'ACTIVE', revision: 2, version: 1 });
    expect(await repository.getConfiguration(first.id)).toMatchObject({ status: 'INACTIVE', version: 2 });
  });

  it('creates an idempotent scoped context only with active branch configuration and matching workflow bindings', async () => {
    const configuration = await OphthalmologyConfigurationModel.create({ branchId, type: 'COMPLETION_PROFILE', code: 'DEFAULT',
      name: 'Completion', revision: 1, status: 'ACTIVE', values: {}, version: 0, createdBy: userId, updatedBy: userId });
    const workflow = await OphthalmologyWorkflowProfileModel.create({ branchId, visitSubtype: 'NEW_CONSULTATION', name: 'New consultation',
      revision: 1, status: 'ACTIVE', stages: [{ code: 'INTAKE', name: 'Intake', mode: 'SEQUENTIAL', testCodes: [], bypassAllowed: false }],
      version: 0, createdBy: userId, updatedBy: userId });
    const input = { visit_subtype: 'NEW_CONSULTATION' as const, affected_eye: 'OD' as const,
      configuration_version_id: configuration._id.toString(), workflow_profile_version_id: workflow._id.toString() };
    const first = await service.createContext(visitId, input, userId);
    const retried = await service.createContext(visitId, input, userId);
    expect(retried.id).toBe(first.id);
    expect(first).toMatchObject({ branch_id: branchId, department_id: departmentId, workflow_status: 'CHECKED_IN', version: 0 });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.context.created' })).toBe(1);
  });

  it('rejects context activation for a non-Ophthalmology authoritative department', async () => {
    const other = await DepartmentModel.create({ code: 'GENERAL_OPD', name: 'General OPD', branchIds: [branchId], status: 'ACTIVE', isClinical: true });
    await OpdVisitModel.updateOne({ _id: visitId }, { $set: { departmentId: other._id } });
    await expect(service.getContext(visitId, userId)).rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_DEPARTMENT_REQUIRED' });
  });

  it('enforces subtype mapping while preserving WALK_IN as an arrival-channel compatibility value', async () => {
    const visit = await new OpdVisitRepository().getById(visitId);
    expect(visit).toBeDefined();
    await expect(service.createContext(visitId, {
      visit_subtype: 'POST_OPERATIVE', affected_eye: 'OU', configuration_version_id: new Types.ObjectId().toString(),
      workflow_profile_version_id: new Types.ObjectId().toString(),
    }, userId)).rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT' });
    await OpdVisitModel.updateOne({ _id: visitId }, { $set: { visitType: 'WALK_IN' } });
    await expect(service.createContext(visitId, {
      visit_subtype: 'POST_OPERATIVE', affected_eye: 'OU', configuration_version_id: new Types.ObjectId().toString(),
      workflow_profile_version_id: new Types.ObjectId().toString(),
    }, userId)).rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
  });

  it('rejects invalid context laterality and stale context updates', async () => {
    await expect(OphthalmologyContextModel.create({ visitId, patientId: new Types.ObjectId(), branchId, departmentId,
      doctorId: new Types.ObjectId(), visitSubtype: 'NEW_CONSULTATION', affectedEye: 'NOT_APPLICABLE', workflowStatus: 'CHECKED_IN',
      configurationVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(), version: 0, createdBy: userId, updatedBy: userId }))
      .rejects.toMatchObject({ name: 'ValidationError' });

    const configuration = await OphthalmologyConfigurationModel.create({ branchId, type: 'COMPLETION_PROFILE', code: 'DEFAULT',
      name: 'Completion', revision: 1, status: 'ACTIVE', values: {}, version: 0, createdBy: userId, updatedBy: userId });
    const workflow = await OphthalmologyWorkflowProfileModel.create({ branchId, visitSubtype: 'NEW_CONSULTATION', name: 'New consultation',
      revision: 1, status: 'ACTIVE', stages: [{ code: 'INTAKE', name: 'Intake', mode: 'SEQUENTIAL', testCodes: [], bypassAllowed: false }],
      version: 0, createdBy: userId, updatedBy: userId });
    const context = await service.createContext(visitId, { visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OD',
      configuration_version_id: configuration._id.toString(), workflow_profile_version_id: workflow._id.toString() }, userId);
    await expect(service.updateContext(visitId, { expected_version: context.version + 1, affected_eye: 'OS' }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('validates station members against active branch and Ophthalmology department scope', async () => {
    const station = await service.createStation({ branch_id: branchId, department_id: departmentId, code: 'VA', name: 'Visual Acuity',
      supported_test_types: ['VISUAL_ACUITY'], member_user_ids: [userId] }, userId);
    expect(station).toMatchObject({ code: 'VA', status: 'ACTIVE', member_user_ids: [userId], version: 0 });
    await expect(service.updateStation(station.id, { expected_version: 0, member_user_ids: [new Types.ObjectId().toString()] }, userId))
      .rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_ASSIGNMENT_DENIED' });
    await expect(service.updateStation(station.id, { expected_version: 1, name: 'Stale edit' }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    const deactivated = await service.deactivateStation(station.id, { expected_version: 0, expected_status: 'ACTIVE', reason: 'Room reassigned' }, userId);
    expect(deactivated).toMatchObject({ status: 'INACTIVE', version: 1 });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.station.deactivated' })).toBe(1);
  });

  it('enforces the approved laterality subsets for each record type', () => {
    expect(() => assertOphthalmologyLaterality('MEASUREMENT_IMAGE', 'OD')).not.toThrow();
    expect(() => assertOphthalmologyLaterality('MEASUREMENT_IMAGE', 'OU')).toThrowError();
    expect(() => assertOphthalmologyLaterality('BILATERAL_FINDING_TREATMENT', 'OU')).not.toThrow();
    expect(() => assertOphthalmologyLaterality('DIAGNOSIS', 'NOT_APPLICABLE')).not.toThrow();
    expect(() => assertOphthalmologyLaterality('DIAGNOSIS', 'NOT_SPECIFIED')).toThrowError();
    expect(() => assertOphthalmologyLaterality('CONTEXT', 'NOT_SPECIFIED')).not.toThrow();
  });

  it('returns deterministic paginated configuration results', async () => {
    for (const code of ['A', 'B', 'C']) {
      await service.createConfiguration({ branch_id: branchId, type: 'REASON', code, name: `Reason ${code}` }, userId);
    }
    const page = await service.listConfigurations({ branch_id: branchId, type: 'REASON', page: 2, limit: 2 }, userId);
    expect(page.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.code).toBe('C');
  });

  it('validates workflow optimistic concurrency and device calibration dates', async () => {
    const workflow = await service.createWorkflowProfile({ branch_id: branchId, visit_subtype: 'NEW_CONSULTATION', name: 'New visit',
      stages: [{ code: 'INTAKE', name: 'Intake', mode: 'SEQUENTIAL', test_codes: [], bypass_allowed: false }] }, userId);
    await expect(service.updateWorkflowProfile(workflow.id, { expected_version: 1, name: 'Stale' }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    await expect(service.createStation({ branch_id: branchId, department_id: departmentId, code: 'OCT', name: 'OCT', devices: [{
      code: 'OCT-1', name: 'OCT Device', calibration_status: 'CURRENT', calibrated_at: '2026-10-15T10:00:00.000Z',
      calibration_due_at: '2026-10-14T10:00:00.000Z',
    }] }, userId)).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('denies cross-branch configuration access', async () => {
    const other = await BranchModel.create({ code: 'OTHER', name: 'Other Branch', status: 'ACTIVE' });
    await expect(service.listConfigurations({ branch_id: other._id.toString() }, userId))
      .rejects.toMatchObject({ statusCode: 403, code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
  });
});
