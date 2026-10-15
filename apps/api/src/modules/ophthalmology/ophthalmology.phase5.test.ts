import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { OphthalmologyCoreTestFormType, SaveOphthalmologyTestResultDraftDTO } from './ophthalmology.types.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyStationModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 5 core clinical test results', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string; let departmentId: string; let userId: string; let patientId: string; let contextId: string; let visitId: string; let stationId: string;
  const forms: Array<[OphthalmologyCoreTestFormType, Record<string, unknown>]> = [
    ['VISUAL_ACUITY', { chart_type: 'SNELLEN', test_distance: { value: 6, unit: 'm' }, distance: { OD: { unaided: '6/6' }, OS: { unaided: '6/9' } }, conclusion_codes: [] }],
    ['LENSOMETRY', { optical_power: { OD: { sphere: -1, cylinder: -0.5, axis: 90 }, OS: { sphere: -1.25, cylinder: -0.25, axis: 80 } }, lens_type: 'SINGLE_VISION' }],
    ['AUTOREFRACTION_KERATOMETRY', { cycloplegic: false, readings: { OD: [{ sphere: -1, cylinder: -0.5, axis: 90 }], OS: [{ sphere: -1.25, cylinder: -0.25, axis: 80 }] }, selected_reading_index: { OD: 0, OS: 0 }, spherical_equivalent: { OD: -1.25, OS: -1.375 }, keratometry: { OD: { k1: 43, k1_axis: 90, k2: 44, k2_axis: 180 }, OS: { k1: 43.5, k1_axis: 85, k2: 44.5, k2_axis: 175 } } }],
    ['OBJECTIVE_REFRACTION', { method: 'DRY', working_distance: { value: 67, unit: 'cm' }, raw_power: { OD: { sphere: -1 }, OS: { sphere: -1.25 } }, final_power: { OD: { sphere: -1, cylinder: -0.5, axis: 90 }, OS: { sphere: -1.25, cylinder: -0.25, axis: 80 } } }],
    ['SUBJECTIVE_REFRACTION', { final_power: { OD: { sphere: -1, cylinder: -0.5, axis: 90 }, OS: { sphere: -1.25, cylinder: -0.25, axis: 80 } }, bcva: { OD: '6/6', OS: '6/6' }, acceptance: 'ACCEPTED', fogging: false }],
    ['INTRAOCULAR_PRESSURE', { method: 'GOLDMANN', measured_at: '2026-10-15T05:30:00.000Z', position: 'SITTING', readings: { OD: [15, 16], OS: [16, 16] }, selected_reading_index: { OD: 1, OS: 1 }, final_iop: { OD: 16, OS: 16 }, unit: 'mmHg' }],
    ['SLIT_LAMP_ANTERIOR_SEGMENT', { eyes: { OD: { cornea: { status: 'NORMAL' }, lens: { status: 'NORMAL' } }, OS: { cornea: { status: 'NORMAL' }, lens: { status: 'NORMAL' } } } }],
    ['POSTERIOR_FUNDUS_EXAM', { dilation_required: false, method: 'DIRECT', eyes: { OD: { optic_disc: { status: 'NORMAL' }, macula: { status: 'NORMAL' } }, OS: { optic_disc: { status: 'NORMAL' }, macula: { status: 'NORMAL' } } } }],
  ];

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyTestTaskModel.init(), OphthalmologyTestResultModel.init(), OphthalmologyConfigurationModel.init(), OphthalmologyStationModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-P5', name: 'Ophthalmology Phase 5', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const permission = await PermissionModel.create({ code: 'OPD.OPH_TEST.START', name: 'Start Ophthalmology Test', module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start', type: 'custom', status: 'active' });
    const role = await RoleModel.create({ code: 'OPH_P5_TECH', name: 'Ophthalmology Phase 5 Technician', permissionIds: [permission._id], status: 'active' });
    const user = await UserModel.create({ username: 'oph.phase5', email: 'oph.phase5@example.test', fullName: 'Phase Five Technician', passwordHash: 'not-used', roleIds: [role._id], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString(); patientId = new Types.ObjectId().toString();
    contextId = new Types.ObjectId().toString(); visitId = new Types.ObjectId().toString();
    const station = await OphthalmologyStationModel.create({ branchId, departmentId, code: 'CORE', name: 'Core Tests', status: 'ACTIVE',
      supportedTestTypes: forms.map(([form]) => form), memberUserIds: [user._id], devices: [{ code: 'MANUAL', name: 'Manual Entry', status: 'ACTIVE', calibrationStatus: 'NOT_REQUIRED' }], version: 0, createdBy: userId, updatedBy: userId });
    stationId = station._id.toString();
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const createTaskAndProfile = async (form: OphthalmologyCoreTestFormType, suffix = '') => {
    const profile = await OphthalmologyConfigurationModel.create({ branchId, type: 'FORM_PROFILE', code: `${form}${suffix}`, name: `${form} form`, revision: 1,
      status: 'ACTIVE', values: { form_type: form, schema_version: '1.0', test_codes: [form], ...(form === 'INTRAOCULAR_PRESSURE'
        ? { iop_thresholds: { low: 10, high: 21, asymmetry: 5, low_code: 'LOW', high_code: 'ELEVATED',
          asymmetry_code: 'ASYMMETRY', within_code: 'WITHIN_CONFIGURED_RANGE' } } : {}) }, version: 0, createdBy: userId, updatedBy: userId });
    const task = await OphthalmologyTestTaskModel.create({ contextId, visitId, patientId, branchId, departmentId,
      testCatalogueVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(), testCode: form, testName: form,
      laterality: 'OU', priority: 'ROUTINE', sourceType: 'WORKFLOW', status: 'IN_PROGRESS', stationId, assignedUserId: userId,
      deviceCode: 'MANUAL', doctorReviewRequired: false, idempotencyKey: `p5-${form}-${suffix || '1'}`, requestFingerprint: 'test',
      orderedAt: new Date(), startedAt: new Date(), version: 0, createdBy: userId, updatedBy: userId });
    return { task, profile };
  };
  const draft = (form: OphthalmologyCoreTestFormType, profileId: string, payload: Record<string, unknown>): SaveOphthalmologyTestResultDraftDTO => ({
    expected_task_status: 'IN_PROGRESS', expected_task_version: 0, expected_result_version: null, form_type: form,
    form_schema_version: '1.0', form_profile_version_id: profileId, performed_at: '2026-10-15T05:30:00.000Z', source_type: 'MANUAL',
    reliability: 'GOOD', document_ids: [], payload,
  });

  it.each(forms)('saves and atomically completes the %s FSD form', async (form, payload) => {
    const { task, profile } = await createTaskAndProfile(form); const saved = await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload), userId);
    expect(saved).toMatchObject({ status: 'DRAFT', version: 0, current: { form_type: form, clinical_version: 1 } });
    const completed = await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    expect(completed).toMatchObject({ status: 'COMPLETED', version: 1, current: { status: 'COMPLETED', form_type: form } });
    expect(await repository.getTestTask(task._id.toString())).toMatchObject({ status: 'COMPLETED', version: 2 });
  });

  it('updates one intended draft and rejects stale concurrent completion', async () => {
    const [form, payload] = forms[0]!; const { task, profile } = await createTaskAndProfile(form);
    const first = await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload), userId);
    const revised = await service.saveTestResultDraft(task._id.toString(), { ...draft(form, profile._id.toString(), payload), expected_task_status: 'DRAFT',
      expected_task_version: 1, expected_result_version: first.version, comments: 'rechecked' }, userId);
    expect(revised.history).toHaveLength(1); expect(revised).toMatchObject({ version: 1, current: { comments: 'rechecked' } });
    const outcomes = await Promise.allSettled([0, 1].map(() => service.completeTestResult(task._id.toString(), {
      expected_task_status: 'DRAFT', expected_task_version: 2, expected_result_version: 1 }, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it.each(forms)('retains completed %s history through a reasoned correction', async (form, payload) => {
    const { task, profile } = await createTaskAndProfile(form);
    await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload), userId);
    await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    const amended = await service.amendTestResult(task._id.toString(), { ...draft(form, profile._id.toString(), payload), comments: 'Corrected',
      expected_task_status: 'COMPLETED', expected_task_version: 2, expected_result_version: 1, source_type: 'MANUAL_CORRECTION', reason: 'Transcription correction' }, userId);
    expect(amended.history).toHaveLength(2); expect(amended.current).toMatchObject({ clinical_version: 2, supersedes_clinical_version: 1,
      source_type: 'MANUAL_CORRECTION', amendment_reason: 'Transcription correction' });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.test_result.amended' })).toBe(1);
  });

  it.each(forms)('rejects incomplete %s completion without losing its draft', async (form) => {
    const { task, profile } = await createTaskAndProfile(form);
    await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), {}), userId);
    await expect(service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1,
      expected_result_version: 0 }, userId)).rejects.toMatchObject({ statusCode: 400 });
    expect(await repository.getTestResult(task._id.toString())).toMatchObject({ status: 'DRAFT', version: 0 });
    expect(await repository.getTestTask(task._id.toString())).toMatchObject({ status: 'DRAFT', version: 1 });
  });

  it('enforces structural, reliability, adapter, profile, and document controls', async () => {
    const [form, payload] = forms[1]!; const { task, profile } = await createTaskAndProfile(form);
    await expect(service.saveTestResultDraft(task._id.toString(), { ...draft(form, profile._id.toString(), payload), reliability: 'POOR' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED' });
    await expect(service.saveTestResultDraft(task._id.toString(), { ...draft(form, profile._id.toString(), payload), source_type: 'DEVICE_IMPORT' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_ADAPTER_NOT_CONFIGURED' });
    await expect(service.saveTestResultDraft(task._id.toString(), { ...draft(form, profile._id.toString(), { optical_power: { OD: { axis: 181 } } }) }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_RANGE_INVALID' });
    await expect(service.saveTestResultDraft(task._id.toString(), { ...draft(form, new Types.ObjectId().toString(), payload) }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
    const foreign = await PatientDocumentModel.create({ patientId: new Types.ObjectId(), documentType: 'CLINICAL', title: 'Wrong patient', fileName: 'x.pdf',
      mimeType: 'application/pdf', fileSizeBytes: 1, storageKey: 'wrong/x.pdf', source: 'HOSPITAL', reviewStatus: 'NOT_REQUIRED', status: 'ACTIVE' });
    await expect(service.saveTestResultDraft(task._id.toString(), { ...draft(form, profile._id.toString(), payload), document_ids: [foreign._id.toString()] }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID' });
  });

  it('applies configured completion rules and keeps bound configuration prospective', async () => {
    const form: OphthalmologyCoreTestFormType = 'INTRAOCULAR_PRESSURE'; const { task, profile } = await createTaskAndProfile(form);
    await OphthalmologyConfigurationModel.updateOne({ _id: profile._id }, { $set: { values: { form_type: form, schema_version: '1.0',
      test_codes: [form], required_fields: ['final_iop.OD'], numeric_ranges: { 'final_iop.OD': { min: 1, max: 20 } },
      allowed_values: { method: ['GOLDMANN'] }, iop_thresholds: { low: 10, high: 21, asymmetry: 5, low_code: 'LOW',
        high_code: 'ELEVATED', asymmetry_code: 'ASYMMETRY', within_code: 'WITHIN_CONFIGURED_RANGE' } } } });
    const invalid = { ...forms[5]![1], readings: { OD: [15, 21], OS: [16, 16] }, final_iop: { OD: 21, OS: 16 } };
    await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), invalid), userId);
    await expect(service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1,
      expected_result_version: 0 }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_RANGE_INVALID' });
    await OphthalmologyTestResultModel.updateOne({ taskId: task._id }, { $set: { 'versions.0.payload.final_iop.OD': 18,
      'versions.0.payload.readings.OD.1': 18 } });
    await OphthalmologyConfigurationModel.updateOne({ _id: profile._id }, { $set: { status: 'INACTIVE' } });
    const completed = await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1,
      expected_result_version: 0 }, userId);
    expect(completed.current.form_profile_snapshot).toMatchObject({ numeric_ranges: { 'final_iop.OD': { max: 20 } } });
  });

  it('rolls back result and task state when audit persistence fails', async () => {
    const [form, payload] = forms[0]!; const { task, profile } = await createTaskAndProfile(form);
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload), userId)).rejects.toThrow('audit unavailable');
    expect(await OphthalmologyTestResultModel.countDocuments()).toBe(0);
    expect(await repository.getTestTask(task._id.toString())).toMatchObject({ status: 'IN_PROGRESS', version: 0 });
  });
});
