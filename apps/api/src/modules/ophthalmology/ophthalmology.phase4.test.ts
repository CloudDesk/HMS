import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyAlertModel } from './ophthalmology-intake.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyContextModel, OphthalmologyStationModel, OphthalmologyWorkflowProfileModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 4 test queue orchestration', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string; let departmentId: string; let userId: string; let patientId: string; let visitId: string;
  let catalogueId: string; let stationId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyTestTaskModel.init(), OphthalmologyAlertModel.init(), OphthalmologyContextModel.init(), OphthalmologyConfigurationModel.init(),
      OphthalmologyStationModel.init(), OphthalmologyWorkflowProfileModel.init(), OpdVisitModel.init(), OpdClinicalOrderModel.init()]);
  });
  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-P4', name: 'Ophthalmology Phase 4', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const permissions = await PermissionModel.create([{ code: 'OPD.OPH_TEST.START', name: 'Start Ophthalmology Test', module: 'OPD',
      screen: 'Ophthalmology Test Queue', action: 'Start', type: 'custom', status: 'active' }]);
    const role = await RoleModel.create({ code: 'OPH_TECH', name: 'Ophthalmology Technician', permissionIds: permissions.map((item) => item._id), status: 'active' });
    const user = await UserModel.create({ username: 'oph.phase4', email: 'oph.phase4@example.test', fullName: 'Ophthalmology Technician',
      passwordHash: 'not-used', roleIds: [role._id], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString(); patientId = new Types.ObjectId().toString();
    const doctorId = new Types.ObjectId(); const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P4-001', queueTokenNumber: 1,
      patientId, patientNumber: 'P-OPH-P4', patientName: 'Phase Four Patient', doctorId, doctorName: 'Dr Ophthalmology',
      doctorSpecialization: 'Ophthalmology', branchId, departmentId, visitDate: new Date(), checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'CHECKED_IN', version: 0 }); visitId = visit._id.toString();
    const workflow = await OphthalmologyWorkflowProfileModel.create({ branchId, visitSubtype: 'NEW_CONSULTATION', name: 'Standard', revision: 1,
      status: 'ACTIVE', stages: [{ code: 'PRELIMINARY', name: 'Preliminary', mode: 'PARALLEL', testCodes: ['VISUAL_ACUITY'], bypassAllowed: false }],
      version: 0, createdBy: userId, updatedBy: userId });
    await OphthalmologyContextModel.create({ visitId, patientId, branchId, departmentId, doctorId,
      visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OU', workflowStatus: 'CHECKED_IN', configurationVersionId: new Types.ObjectId(),
      workflowProfileVersionId: workflow._id, version: 0, createdBy: userId, updatedBy: userId });
    const catalogue = await OphthalmologyConfigurationModel.create({ branchId, type: 'TEST_CATALOGUE', code: 'DEFAULT', name: 'Tests', revision: 1,
      status: 'ACTIVE', values: { tests: [{ code: 'VISUAL_ACUITY', name: 'Visual Acuity', active: true }] }, version: 0, createdBy: userId, updatedBy: userId });
    catalogueId = catalogue._id.toString();
    const station = await OphthalmologyStationModel.create({ branchId, departmentId, code: 'VA', name: 'Visual Acuity', status: 'ACTIVE',
      supportedTestTypes: ['VISUAL_ACUITY'], memberUserIds: [user._id], devices: [{ code: 'ETDRS', name: 'ETDRS Chart', status: 'ACTIVE',
        calibrationStatus: 'NOT_REQUIRED' }], version: 0, createdBy: userId, updatedBy: userId }); stationId = station._id.toString();
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const create = (key = 'phase4-create-001') => service.createTestTask(visitId, { expected_context_version: 0,
    test_catalogue_version_id: catalogueId, test_code: 'VISUAL_ACUITY', workflow_stage_code: 'PRELIMINARY', laterality: 'OU',
    priority: 'ROUTINE', source_type: 'WORKFLOW' }, key, userId);

  it('creates one task idempotently and rejects reuse with a different payload', async () => {
    const task = await create(); expect(task).toMatchObject({ status: 'ORDERED', test_code: 'VISUAL_ACUITY', version: 0 });
    const reordered = await service.createTestTask(visitId, { source_type: 'WORKFLOW', priority: 'ROUTINE', laterality: 'OU',
      workflow_stage_code: 'PRELIMINARY', test_code: 'VISUAL_ACUITY', test_catalogue_version_id: catalogueId, expected_context_version: 0 },
    'phase4-create-001', userId);
    expect(reordered.id).toBe(task.id); expect(await OphthalmologyTestTaskModel.countDocuments()).toBe(1);
    await expect(service.createTestTask(visitId, { expected_context_version: 0, test_catalogue_version_id: catalogueId,
      test_code: 'VISUAL_ACUITY', workflow_stage_code: 'PRELIMINARY', laterality: 'OD', priority: 'ROUTINE', source_type: 'WORKFLOW' },
    'phase4-create-001', userId)).rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT' });
  });

  it('exposes only the task encounter header and matching active clinical profiles', async () => {
    const task = await create(); await OpdVisitModel.updateOne({ _id: visitId }, { $set: { notes: 'Private generic note' } });
    const header = await service.getTaskWorkspace(task.id, userId); expect(header.visit.id).toBe(visitId); expect(header.visit).not.toHaveProperty('notes');
    for (const [code, testCodes] of [['MATCH', ['visual_acuity']], ['OTHER', ['OTHER_TEST']]] as const) await OphthalmologyConfigurationModel.create({ branchId, type: 'FORM_PROFILE', code, name: code, revision: 1, status: 'ACTIVE', values: { form_type: 'VISUAL_ACUITY', schema_version: '1.0', test_codes: testCodes }, version: 0, createdBy: userId, updatedBy: userId });
    const profiles = await service.listTaskClinicalConfigurations(task.id, { type: 'FORM_PROFILE', page: 1, limit: 1 }, userId);
    expect(profiles.meta.total).toBe(1); expect(profiles.data[0]?.code).toBe('MATCH');
    await UserModel.updateOne({ _id: userId }, { $set: { departmentIds: [] } });
    await expect(service.getTaskWorkspace(task.id, userId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.listTaskClinicalConfigurations(task.id, { type: 'FORM_PROFILE' }, userId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns scoped station/device metadata and only eligible assignees before pagination', async () => {
    const task = await create(); const actor = await UserModel.findById(userId).lean();
    const eligible = await UserModel.create({ username: 'eligible', fullName: 'Second Technician', email: 'second@example.test', passwordHash: 'unused', roleIds: actor!.roleIds, branchIds: [branchId], departmentIds: [departmentId], status: 'active' });
    const ineligible = await UserModel.create({ username: 'ineligible', fullName: 'No Start Permission', email: 'hidden@example.test', passwordHash: 'unused', roleIds: [], branchIds: [branchId], departmentIds: [departmentId], status: 'active' });
    await OphthalmologyStationModel.updateOne({ _id: stationId }, { $addToSet: { memberUserIds: { $each: [eligible._id, ineligible._id] } } });
    const stations = await service.listAssignmentStations(task.id, { page: 1, limit: 1 }, userId);
    expect(stations.meta.total).toBe(1); expect(stations.data[0]).not.toHaveProperty('member_user_ids');
    expect(await service.getAssignmentStation(task.id, stationId, {}, userId)).toMatchObject({ actor_eligible: true, devices: [{ code: 'ETDRS' }] });
    const first = await service.listAssignmentMembers(task.id, { station_id: stationId, page: 1, limit: 1 }, userId);
    const second = await service.listAssignmentMembers(task.id, { station_id: stationId, page: 2, limit: 1 }, userId);
    expect(first.meta.total).toBe(2); expect(second.meta.total).toBe(2);
    expect(new Set([...first.data, ...second.data].map((row) => row.id))).toEqual(new Set([userId, eligible.id]));
    expect(Object.keys(first.data[0] ?? {}).sort()).toEqual(['full_name', 'id']);
    await UserModel.updateOne({ _id: eligible._id }, { $set: { status: 'inactive' } });
    expect((await service.listAssignmentMembers(task.id, { station_id: stationId }, userId)).meta.total).toBe(1);
    await expect(service.assignTestTask(task.id, { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: ineligible.id }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_ASSIGNMENT_DENIED' });
  });
  it('rejects incompatible stations, foreign target encounters and unauthorized department lookups', async () => {
    const task = await create();
    await OphthalmologyStationModel.updateOne({ _id: stationId }, { $set: { supportedTestTypes: ['OTHER_TEST'] } });
    expect((await service.listAssignmentStations(task.id, {}, userId)).meta.total).toBe(0);
    await expect(service.getAssignmentStation(task.id, stationId, {}, userId)).rejects.toMatchObject({ statusCode: 404 });
    const raw = await OphthalmologyTestTaskModel.findById(task.id).lean();
    const target = await OphthalmologyTestTaskModel.create({ ...raw, _id: new Types.ObjectId(), contextId: new Types.ObjectId(), idempotencyKey: 'foreign-context' });
    await expect(service.listAssignmentStations(task.id, { target_task_id: target.id }, userId)).rejects.toMatchObject({ statusCode: 409 });
    await UserModel.updateOne({ _id: userId }, { $set: { departmentIds: [] } });
    await expect(service.listAssignmentStations(task.id, {}, userId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('enforces exact versions while assigning, calling, and starting with an eligible device', async () => {
    const task = await create(); const assigned = await service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId);
    await expect(service.assignTestTask(task.id, { expected_status: 'ORDERED', expected_version: 0, station_id: stationId }, userId))
      .rejects.toMatchObject({ statusCode: 409 });
    const called = await service.callTestTask(task.id, { expected_status: 'PATIENT_WAITING', expected_version: assigned.version }, userId);
    const started = await service.startTestTask(task.id, { expected_status: 'PATIENT_CALLED', expected_version: called.version, device_code: 'ETDRS' }, userId);
    expect(started).toMatchObject({ status: 'IN_PROGRESS', device_code: 'ETDRS', assigned_user_id: userId, version: 3 });
  });

  it('lets a scoped creator discover its own unassigned order without exposing it to other department users', async () => {
    const task = await create('unassigned-discovery');
    expect((await service.listTestTasks({ branch_id: branchId }, userId)).data.map((row) => row.id)).toContain(task.id);
    expect(await service.getTestTask(task.id, userId)).toMatchObject({ id: task.id, status: 'ORDERED' });
  });

  it('allows only one concurrent assignment and scopes the queue to station members', async () => {
    const task = await create(); const attempts = await Promise.allSettled([service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId), service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId)]);
    expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect((await service.listTestTasks({ branch_id: branchId, page: 1, limit: 10 }, userId)).data).toHaveLength(1);
    const outsider = await UserModel.create({ username: 'oph.phase4.outsider', email: 'oph.phase4.outsider@example.test', fullName: 'Outsider',
      passwordHash: 'not-used', roleIds: [], branchIds: [branchId], departmentIds: [departmentId], status: 'active' });
    expect((await service.listTestTasks({ branch_id: branchId }, outsider._id.toString())).data).toHaveLength(0);
    await expect(service.getTestTask(task.id, outsider._id.toString())).rejects.toMatchObject({ statusCode: 403, code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
  });

  it('returns a called patient to waiting without inventing a lifecycle status', async () => {
    const task = await create(); const assigned = await service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId);
    const called = await service.callTestTask(task.id, { expected_status: 'PATIENT_WAITING', expected_version: assigned.version }, userId);
    const waiting = await service.patientUnavailable(task.id,
      { expected_status: 'PATIENT_CALLED', expected_version: called.version, reason: 'Patient temporarily away' }, userId);
    expect(waiting.status).toBe('PATIENT_WAITING'); expect(waiting.transition_history.at(-1)?.action).toBe('PATIENT_UNAVAILABLE');
  });

  it('records unable-to-perform with doctor routing and permits controlled cancellation', async () => {
    const task = await create(); const assigned = await service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId);
    const called = await service.callTestTask(task.id, { expected_status: 'PATIENT_WAITING', expected_version: assigned.version }, userId);
    const started = await service.startTestTask(task.id, { expected_status: 'PATIENT_CALLED', expected_version: called.version }, userId);
    const unable = await service.unableTestTask(task.id,
      { expected_status: 'IN_PROGRESS', expected_version: started.version, reason: 'Patient could not cooperate' }, userId);
    expect(unable).toMatchObject({ status: 'UNABLE_TO_PERFORM', doctor_review_required: true });
    expect(unable.routing_history.at(-1)?.target).toBe('OPHTHALMOLOGIST');
    const cancellable = await create('phase4-create-cancel');
    const cancelled = await service.cancelTestTask(cancellable.id,
      { expected_status: 'ORDERED', expected_version: 0, reason: 'Test no longer required' }, userId);
    expect(cancelled).toMatchObject({ status: 'CANCELLED', version: 1 });
    const invalid = await create('phase4-create-blank-reason');
    await expect(service.cancelTestTask(invalid.id, { expected_status: 'ORDERED', expected_version: 0, reason: '   ' }, userId))
      .rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_REASON_REQUIRED' });
  });

  it('atomically routes a completed source to an existing ordered next task', async () => {
    const source = await create(); const target = await create('phase4-create-next');
    await OphthalmologyTestTaskModel.updateOne({ _id: source.id }, { $set: { status: 'COMPLETED' } });
    const routed = await service.routeTestTask(source.id, { expected_status: 'COMPLETED', expected_version: 0, target: 'NEXT_STATION',
      next_task_id: target.id, station_id: stationId, assigned_user_id: userId, reason: 'Continue configured sequence' }, userId);
    expect(routed.routing_history.at(-1)).toMatchObject({ target: 'NEXT_STATION', target_task_id: target.id, target_station_id: stationId });
    expect(await repository.getTestTask(target.id)).toMatchObject({ status: 'PATIENT_WAITING', assigned_user_id: userId, version: 1 });
  });

  it('atomically marks the original repeat-required and creates one linked waiting task', async () => {
    const task = await create(); await OphthalmologyTestTaskModel.updateOne({ _id: task.id }, { $set: { status: 'COMPLETED' } });
    const repeat = await service.repeatTestTask(task.id, { expected_status: 'COMPLETED', expected_version: 0, station_id: stationId,
      assigned_user_id: userId, reason: 'Result quality insufficient' }, 'phase4-repeat-001', userId);
    expect(repeat).toMatchObject({ status: 'PATIENT_WAITING', repeat_of_task_id: task.id });
    expect(await repository.getTestTask(task.id)).toMatchObject({ status: 'REPEAT_REQUIRED', repeat_task_id: repeat.id, version: 1 });
    expect((await service.repeatTestTask(task.id, { expected_status: 'COMPLETED', expected_version: 0, station_id: stationId,
      assigned_user_id: userId, reason: 'Result quality insufficient' }, 'phase4-repeat-001', userId)).id).toBe(repeat.id);
  });

  it('blocks routine task starting when an unacknowledged emergency alert exists, but permits emergency tasks', async () => {
    const task = await create('emergency-guard-test');
    const assigned = await service.assignTestTask(task.id,
      { expected_status: 'ORDERED', expected_version: 0, station_id: stationId, assigned_user_id: userId }, userId);
    const called = await service.callTestTask(task.id, { expected_status: 'PATIENT_WAITING', expected_version: assigned.version }, userId);

    const alert = await OphthalmologyAlertModel.create({
      contextId: new Types.ObjectId((await service.getTestTask(task.id, userId)).context_id),
      intakeId: new Types.ObjectId(), visitId: new Types.ObjectId(visitId),
      patientId: new Types.ObjectId(patientId), branchId: new Types.ObjectId(branchId), departmentId: new Types.ObjectId(departmentId),
      type: 'EMERGENCY_SCREENING', status: 'ACTIVE', sourceVersion: 1, criterionCodes: ['SUDDEN_VISION_LOSS'],
      reason: 'Sudden vision loss', notifiedUserIds: [], triggeredBy: new Types.ObjectId(userId), triggeredAt: new Date(), version: 0,
    });

    await expect(service.startTestTask(task.id, { expected_status: 'PATIENT_CALLED', expected_version: called.version }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED' });

    await OphthalmologyAlertModel.updateOne({ _id: alert._id }, { $set: { status: 'ACKNOWLEDGED' } });

    const started = await service.startTestTask(task.id, { expected_status: 'PATIENT_CALLED', expected_version: called.version, device_code: 'ETDRS' }, userId);
    expect(started).toMatchObject({ status: 'IN_PROGRESS' });
  });

    it('keeps clinical-order linkage read-only and records operational audit history', async () => {
    const order = await OpdClinicalOrderModel.create({ sourceType: 'OPD_VISIT', sourceId: visitId, visitId, patientId,
      patientNumber: 'P-OPH-P4', patientName: 'Phase Four Patient', doctorId: new Types.ObjectId(), doctorName: 'Dr Ophthalmology', branchId,
      orderType: 'IMAGING', status: 'SUBMITTED', priority: 'ROUTINE', items: [{ serviceId: new Types.ObjectId(), serviceName: 'Fundus Image',
        investigationName: 'Visual Acuity', category: 'Ophthalmology' }], submittedAt: new Date() }); const itemId = order.items[0]!._id.toString();
    const task = await service.createTestTask(visitId, { expected_context_version: 0, test_catalogue_version_id: catalogueId,
      test_code: 'VISUAL_ACUITY', laterality: 'OU', priority: 'ROUTINE', source_type: 'CLINICAL_ORDER_ITEM', source_order_id: order._id.toString(),
      source_order_item_id: itemId }, 'phase4-order-001', userId);
    expect(task).toMatchObject({ source_order_type: 'IMAGING', source_order_item_id: itemId });
    expect((await OpdClinicalOrderModel.findById(order._id).lean())?.status).toBe('SUBMITTED');
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.test_task.created' })).toBe(1);
  });
});
