import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdFollowUpModel } from '../opd/opd-follow-up.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientModel } from '../patients/patient.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { OphthalmologySpecializedTestFormType, SaveOphthalmologyTestResultDraftDTO } from './ophthalmology.types.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyStationModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 7 contact lens and paediatric assessments', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string; let departmentId: string; let userId: string; let patientId: string; let contextId: string; let visitId: string;
  let stationId: string; let opticalProductId: string; let drugOptionId: string; let followUpId: string;
  const forms: OphthalmologySpecializedTestFormType[] = ['CONTACT_LENS', 'PAEDIATRIC_VISION'];

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyTestTaskModel.init(), OphthalmologyTestResultModel.init(), OphthalmologyConfigurationModel.init(),
      OphthalmologyStationModel.init(), PatientModel.init(), OpdFollowUpModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-P7', name: 'Ophthalmology Phase 7', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const start = await PermissionModel.create({ code: 'OPD.OPH_P7.START', name: 'Start specialized test', module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start', type: 'custom', status: 'active' });
    const role = await RoleModel.create({ code: 'OPH_P7_TECH', name: 'Phase 7 Optometrist', permissionIds: [start._id], status: 'active' });
    const user = await UserModel.create({ username: 'oph.phase7', email: 'oph.phase7@example.test', fullName: 'Phase Seven Optometrist', passwordHash: 'not-used',
      roleIds: [role._id], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    const patient = await PatientModel.create({ patientNumber: 'P7-001', firstName: 'Child', lastName: 'Patient', dateOfBirth: new Date('2016-06-10T00:00:00.000Z'),
      gender: 'UNKNOWN', parentGuardian: 'Recorded guardian', status: 'ACTIVE' });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString(); patientId = patient._id.toString();
    contextId = new Types.ObjectId().toString(); visitId = new Types.ObjectId().toString();
    const station = await OphthalmologyStationModel.create({ branchId, departmentId, code: 'SPECIALIZED', name: 'Specialized Assessments', status: 'ACTIVE',
      supportedTestTypes: forms, memberUserIds: [user._id], devices: [{ code: 'MANUAL', name: 'Manual Entry', status: 'ACTIVE', calibrationStatus: 'NOT_REQUIRED' }],
      version: 0, createdBy: userId, updatedBy: userId }); stationId = station._id.toString();
    const optical = await OphthalmologyConfigurationModel.create({ branchId, type: 'OPTICAL_PRODUCT', code: 'CL-SOFT', name: 'Configured soft lens', revision: 1,
      status: 'ACTIVE', values: { product_type: 'CONTACT_LENS' }, version: 0, createdBy: userId, updatedBy: userId }); opticalProductId = optical._id.toString();
    const drug = await OphthalmologyConfigurationModel.create({ branchId, type: 'DRUG_OPTION', code: 'CYCLO', name: 'Configured cycloplegic', revision: 1,
      status: 'ACTIVE', values: { route: 'OPHTHALMIC' }, version: 0, createdBy: userId, updatedBy: userId }); drugOptionId = drug._id.toString();
    const followUp = await OpdFollowUpModel.create({ visitId, consultationId: new Types.ObjectId(), patientId, patientNumber: 'P7-001', patientName: 'Child Patient',
      originatingDoctorId: new Types.ObjectId(), originatingDoctorName: 'Doctor', followUpType: 'CLINICAL_REVIEW', nextVisitDate: new Date('2026-10-22T05:30:00.000Z'),
      reminderType: 'NONE', status: 'DRAFT', createdBy: userId, updatedBy: userId }); followUpId = followUp._id.toString();
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const contactLensPayload = (stage: 'TRIAL' | 'FINAL' = 'TRIAL') => ({ record_stage: stage,
    lens_details: { OD: { optical_product_version_id: opticalProductId, lens_type: 'SOFT', brand: 'CONFIGURED_BRAND', material: 'SILICONE_HYDROGEL',
      base_curve: 8.6, diameter: 14.2, sphere: -1, cylinder: -0.5, axis: 90 }, OS: { optical_product_version_id: opticalProductId,
      lens_type: 'SOFT', brand: 'CONFIGURED_BRAND', material: 'SILICONE_HYDROGEL', base_curve: 8.6, diameter: 14.2, sphere: -1.25 } },
    trial_lens: { OD: { number: 'T-OD-1', wearing_schedule: 'DAILY', replacement_schedule: 'MONTHLY' },
      OS: { number: 'T-OS-1', wearing_schedule: 'DAILY', replacement_schedule: 'MONTHLY' } },
    fit_assessment: { OD: { centration: 'CENTRAL', coverage: 'FULL', movement: 'ACCEPTABLE', push_up: 'ACCEPTABLE', rotation: 5 },
      OS: { centration: 'CENTRAL', coverage: 'FULL', movement: 'ACCEPTABLE', push_up: 'ACCEPTABLE' } },
    over_refraction: { OD: { sphere: 0, cylinder: 0 }, OS: { sphere: 0, cylinder: 0 } },
    visual_acuity: { OD: { distance: '6/6' }, OS: { distance: '6/6' } }, comfort: { OD: 'GOOD', OS: 'GOOD' },
    ocular_response: { OD: { corneal: 'CLEAR', conjunctival: 'QUIET', tear_exchange: 'ADEQUATE' },
      OS: { corneal: 'CLEAR', conjunctival: 'QUIET', tear_exchange: 'ADEQUATE' } }, outcome: 'ACCEPTED',
    education: { insertion_removal_training: true, hygiene_instructions_provided: true, wear_schedule_counselling: true, warning_signs_explained: true },
    follow_up: { required: true, recommended_date: '2026-10-22T05:30:00.000Z', follow_up_id: followUpId, instructions: 'Return for fit review' } });
  const paediatricPayload = () => ({ assessment_methods: ['LEA'], cycloplegic_refraction: { medication_configuration_version_id: drugOptionId,
    administered_at: '2026-10-15T05:00:00.000Z', examined_at: '2026-10-15T05:25:00.000Z',
    eyes: { OD: { sphere: 1, cylinder: -0.5, axis: 90 }, OS: { sphere: 1.25, cylinder: -0.25, axis: 80 } } },
    alignment: { OD: { status: 'ORTHOTROPIC' }, OS: { status: 'ORTHOTROPIC' } },
    red_reflex: { OD: { status: 'NORMAL' }, OS: { status: 'NORMAL' } }, amblyopia_assessment: { suspected: false },
    binocular_vision: { stereopsis: { method: 'TNO', result: 60 }, colour_vision: { method: 'ISHIHARA', result: 'NORMAL' }, findings: [] },
    cooperation: 'GOOD' as const, parent_reported: { symptom_codes: [], notes: 'No parent concerns' },
    birth_development_history: { birth_history: 'TERM', developmental_concerns: false }, result_codes: ['AGE_APPROPRIATE'] });

  const createTaskAndProfile = async (form: OphthalmologySpecializedTestFormType, suffix = '', laterality: 'OD' | 'OS' | 'OU' = 'OU',
    patient = patientId) => {
    const profile = await OphthalmologyConfigurationModel.create({ branchId, type: 'FORM_PROFILE', code: `${form}${suffix}`, name: `${form} form`, revision: 1,
      status: 'ACTIVE', values: { form_type: form, schema_version: '1.0', test_codes: [form], ...(form === 'PAEDIATRIC_VISION'
        ? { paediatric_max_age_years: 18 } : {}) }, version: 0, createdBy: userId, updatedBy: userId });
    const task = await OphthalmologyTestTaskModel.create({ contextId, visitId, patientId: patient, branchId, departmentId,
      testCatalogueVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(), testCode: form, testName: form,
      laterality, priority: 'ROUTINE', sourceType: 'WORKFLOW', status: 'IN_PROGRESS', stationId, assignedUserId: userId, deviceCode: 'MANUAL',
      doctorReviewRequired: false, idempotencyKey: `p7-${form}-${suffix || new Types.ObjectId()}`, requestFingerprint: 'test', orderedAt: new Date(),
      startedAt: new Date(), version: 0, createdBy: userId, updatedBy: userId }); return { task, profile };
  };
  const draft = (form: OphthalmologySpecializedTestFormType, profileId: string, payload: Record<string, unknown>): SaveOphthalmologyTestResultDraftDTO => ({
    expected_task_status: 'IN_PROGRESS', expected_task_version: 0, expected_result_version: null, form_type: form, form_schema_version: '1.0',
    form_profile_version_id: profileId, performed_at: '2026-10-15T05:30:00.000Z', source_type: 'MANUAL', reliability: 'GOOD', document_ids: [], payload,
  });

  it.each(forms)('persists, completes, reads, and audits %s', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); const data = form === 'CONTACT_LENS' ? contactLensPayload() : paediatricPayload();
    const saved = await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), data), userId);
    const completed = await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: saved.version }, userId);
    expect(completed).toMatchObject({ status: 'COMPLETED', current: { form_type: form, status: 'COMPLETED' } });
    if (form === 'PAEDIATRIC_VISION') expect(completed.current.payload).toMatchObject({ age_at_assessment_months: 124, guardian_recorded: true });
    expect(await service.getTestResult(task._id.toString(), userId)).toMatchObject({ id: completed.id });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.test_result.completed' })).toBe(1);
  });

  it.each(forms)('preserves %s through controlled amendment', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); const data = form === 'CONTACT_LENS' ? contactLensPayload() : paediatricPayload();
    await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), data), userId);
    await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    const amended = await service.amendTestResult(task._id.toString(), { ...draft(form, profile._id.toString(), data), expected_task_status: 'COMPLETED',
      expected_task_version: 2, expected_result_version: 1, source_type: 'MANUAL_CORRECTION', reason: 'Verified correction' }, userId);
    expect(amended.history).toHaveLength(2); expect(amended.current).toMatchObject({ clinical_version: 2, supersedes_clinical_version: 1 });
  });

  it.each(forms)('rejects incomplete %s completion without losing its draft', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), {}), userId);
    await expect(service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_REQUIRED' });
    expect(await repository.getTestResult(task._id.toString())).toMatchObject({ status: 'DRAFT' });
  });

  it('enforces contact lens configuration, education, follow-up, laterality, and final review routing', async () => {
    const invalid = await createTaskAndProfile('CONTACT_LENS', 'INVALID'); const data = contactLensPayload();
    const od = (data.lens_details as Record<string, Record<string, unknown>>).OD!; od.optical_product_version_id = new Types.ObjectId().toString();
    await expect(service.saveTestResultDraft(invalid.task._id.toString(), draft('CONTACT_LENS', invalid.profile._id.toString(), data), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
    const laterality = await createTaskAndProfile('CONTACT_LENS', 'LATERALITY', 'OD');
    await expect(service.saveTestResultDraft(laterality.task._id.toString(), draft('CONTACT_LENS', laterality.profile._id.toString(), contactLensPayload()), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID' });
    const education = await createTaskAndProfile('CONTACT_LENS', 'EDU'); const noTraining = contactLensPayload();
    noTraining.education.insertion_removal_training = false; await service.saveTestResultDraft(education.task._id.toString(), draft('CONTACT_LENS', education.profile._id.toString(), noTraining), userId);
    await expect(service.completeTestResult(education.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED' });
    const final = await createTaskAndProfile('CONTACT_LENS', 'FINAL'); await service.saveTestResultDraft(final.task._id.toString(),
      draft('CONTACT_LENS', final.profile._id.toString(), contactLensPayload('FINAL')), userId);
    await service.completeTestResult(final.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    expect(await repository.getTestTask(final.task._id.toString())).toMatchObject({ doctor_review_required: true });
  });

  it('rejects wrong follow-up context and a past recommendation date', async () => {
    const { task, profile } = await createTaskAndProfile('CONTACT_LENS', 'FOLLOW'); const wrong = contactLensPayload();
    wrong.follow_up.follow_up_id = new Types.ObjectId().toString();
    await expect(service.saveTestResultDraft(task._id.toString(), draft('CONTACT_LENS', profile._id.toString(), wrong), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT' });
    const past = await createTaskAndProfile('CONTACT_LENS', 'PAST'); const pastData = contactLensPayload(); pastData.follow_up.follow_up_id = null;
    pastData.follow_up.recommended_date = '2026-10-14T05:30:00.000Z';
    await expect(service.saveTestResultDraft(past.task._id.toString(), draft('CONTACT_LENS', past.profile._id.toString(), pastData), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_INVALID' });
  });

  it('derives paediatric context and validates configured age, medication, timing, and cooperation', async () => {
    const age = await createTaskAndProfile('PAEDIATRIC_VISION', 'AGE'); await OphthalmologyConfigurationModel.updateOne({ _id: age.profile._id },
      { $set: { 'values.paediatric_max_age_years': 5 } });
    await expect(service.saveTestResultDraft(age.task._id.toString(), draft('PAEDIATRIC_VISION', age.profile._id.toString(), paediatricPayload()), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_AGE_INVALID' });
    const drug = await createTaskAndProfile('PAEDIATRIC_VISION', 'DRUG'); const wrongDrug = paediatricPayload();
    wrongDrug.cycloplegic_refraction.medication_configuration_version_id = new Types.ObjectId().toString();
    await expect(service.saveTestResultDraft(drug.task._id.toString(), draft('PAEDIATRIC_VISION', drug.profile._id.toString(), wrongDrug), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
    const unable = await createTaskAndProfile('PAEDIATRIC_VISION', 'UNABLE'); const unableData = { ...paediatricPayload(), cooperation: 'UNABLE', result_codes: ['AGE_APPROPRIATE'] };
    await service.saveTestResultDraft(unable.task._id.toString(), draft('PAEDIATRIC_VISION', unable.profile._id.toString(), unableData), userId);
    await expect(service.completeTestResult(unable.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED' });
  });

  it('enforces scoped visibility, concurrent completion, and transactional rollback', async () => {
    const { task, profile } = await createTaskAndProfile('CONTACT_LENS', 'SAFE'); await service.saveTestResultDraft(task._id.toString(),
      draft('CONTACT_LENS', profile._id.toString(), contactLensPayload()), userId);
    const outsider = await UserModel.create({ username: 'outsider.p7', email: 'outsider.p7@example.test', fullName: 'Outsider', passwordHash: 'not-used',
      roleIds: [], branchIds: [], departmentIds: [], status: 'active' });
    await expect(service.getTestResult(task._id.toString(), outsider._id.toString())).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
    const outcomes = await Promise.allSettled([0, 1].map(() => service.completeTestResult(task._id.toString(), {
      expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const rollback = await createTaskAndProfile('PAEDIATRIC_VISION', 'ROLLBACK'); vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.saveTestResultDraft(rollback.task._id.toString(), draft('PAEDIATRIC_VISION', rollback.profile._id.toString(), paediatricPayload()), userId))
      .rejects.toThrow('audit unavailable');
    expect(await OphthalmologyTestResultModel.countDocuments({ taskId: rollback.task._id })).toBe(0);
  });
});
