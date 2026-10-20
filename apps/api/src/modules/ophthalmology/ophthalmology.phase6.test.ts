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
import type { OphthalmologyAdvancedTestFormType, SaveOphthalmologyTestResultDraftDTO } from './ophthalmology.types.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyStationModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 6 advanced diagnostic results', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string; let departmentId: string; let userId: string; let patientId: string; let contextId: string; let visitId: string;
  let stationId: string; let documentId: string;
  const formTypes: OphthalmologyAdvancedTestFormType[] = ['PACHYMETRY', 'COLOUR_VISION', 'MOTILITY_SQUINT_BINOCULAR', 'DRY_EYE',
    'VISUAL_FIELD', 'OCT', 'FUNDUS_PHOTOGRAPHY', 'CORNEAL_TOPOGRAPHY', 'BIOMETRY_IOL', 'B_SCAN', 'GONIOSCOPY'];

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyTestTaskModel.init(), OphthalmologyTestResultModel.init(), OphthalmologyConfigurationModel.init(), OphthalmologyStationModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-P6', name: 'Ophthalmology Phase 6', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const start = await PermissionModel.create({ code: 'OPD.OPH_P6.START', name: 'Start advanced test', module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start', type: 'custom', status: 'active' });
    const role = await RoleModel.create({ code: 'OPH_P6_TECH', name: 'Phase 6 Technician', permissionIds: [start._id], status: 'active' });
    const user = await UserModel.create({ username: 'oph.phase6', email: 'oph.phase6@example.test', fullName: 'Phase Six Technician', passwordHash: 'not-used',
      roleIds: [role._id], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString(); patientId = new Types.ObjectId().toString();
    contextId = new Types.ObjectId().toString(); visitId = new Types.ObjectId().toString();
    const station = await OphthalmologyStationModel.create({ branchId, departmentId, code: 'ADVANCED', name: 'Advanced Diagnostics', status: 'ACTIVE',
      supportedTestTypes: formTypes, memberUserIds: [user._id], devices: [{ code: 'MANUAL', name: 'Manual Entry', status: 'ACTIVE', calibrationStatus: 'NOT_REQUIRED' }],
      version: 0, createdBy: userId, updatedBy: userId }); stationId = station._id.toString();
    const document = await PatientDocumentModel.create({ patientId, documentType: 'CLINICAL', title: 'Advanced test attachment', fileName: 'result.pdf',
      mimeType: 'application/pdf', fileSizeBytes: 100, storageKey: 'ophthalmology/result.pdf', source: 'HOSPITAL', reviewStatus: 'NOT_REQUIRED', status: 'ACTIVE' });
    documentId = document._id.toString();
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const payload = (form: OphthalmologyAdvancedTestFormType): Record<string, unknown> => ({
    PACHYMETRY: { method: 'OPTICAL', repeat_readings: { OD: [540, 542], OS: [535, 537] }, average_thickness: { OD: 541, OS: 536 },
      thickness_unit: 'um', quality: { OD: 'GOOD', OS: 'GOOD' }, technician_impression_codes: ['NORMAL'], report_document_id: documentId },
    COLOUR_VISION: { method: 'ISHIHARA', testing_eye: 'OU', plates_shown: 10, correct: 9, incorrect: 1, score_percent: 90,
      result: 'NORMAL', reliability: 'GOOD' },
    MOTILITY_SQUINT_BINOCULAR: { assessment_methods: ['COVER_UNCOVER'], fixing_eye: 'ALTERNATING', measurements: { distance: { value: 2, unit: 'PD' } },
      ocular_movements: { OD: { abduction: 0 }, OS: { abduction: 0 } }, nystagmus: false, diplopia: false, abnormal_head_posture: false,
      stereopsis: { method: 'TNO', result: 60 }, worth_four_dot: { result: 'FUSION' }, impression_codes: ['ORTHOPHORIA'] },
    DRY_EYE: { symptom_codes: ['DRYNESS'], questionnaire_score: 4, schirmer: { OD: { value: 15, unit: 'mm', duration_minutes: 5 },
      OS: { value: 14, unit: 'mm', duration_minutes: 5 } }, tbut_seconds: { OD: 10, OS: 11 }, meibum: { OD: 'CLEAR', OS: 'CLEAR' },
      blink: { status: 'COMPLETE' }, corneal_sensation: { OD: 'NORMAL', OS: 'NORMAL' }, impression_codes: ['NO_FINDINGS'] },
    VISUAL_FIELD: { machine: 'HFA', program: '24-2', strategy: 'SITA_STANDARD', eye: 'OD', correction_used: { sphere: -1 },
      pupil_diameter: 4, fixation_target: 'CENTRAL', reliability_indices: { fixation_losses: 0, false_positive: 1, false_negative: 0 },
      result_indices: { mean_deviation: -1, pattern_standard_deviation: 1.5, visual_field_index: 98 }, clinical_pattern: { hemifield: 'WITHIN_LIMITS' },
      comparison: { outcome: 'NOT_COMPARED' }, report_document_id: documentId, impression: 'RELIABLE' },
    OCT: { oct_type: 'MACULA', eye: 'OU', requested_scans: ['MACULAR_CUBE'], scan_quality: 'GOOD', signal_strength: 8,
      measurements: { OD: { central_macular_thickness: 250 }, OS: { central_macular_thickness: 252 } }, segmentation_error: false, artefact: false,
      comparison: { outcome: 'NOT_COMPARED' }, report_document_id: documentId, image_document_ids: [documentId], technician_observation_codes: ['SUCCESSFUL'] },
    FUNDUS_PHOTOGRAPHY: { image_sets: [{ eye: 'OD', image_type: 'COLOUR', fields: ['MACULA', 'DISC'], dilatation: 'DILATED', quality: 'GOOD',
      image_document_ids: [documentId], visible_abnormality_codes: [], repeat_required: false }] },
    CORNEAL_TOPOGRAPHY: { keratometry: { OD: { k1: 43, k1_axis: 90, k2: 44, k2_axis: 180, average_k: 43.5, corneal_astigmatism: 1 },
      OS: { k1: 43.5, k1_axis: 80, k2: 44.5, k2_axis: 170, average_k: 44, corneal_astigmatism: 1 } },
      corneal_thickness: { OD: { value: 540, unit: 'um' }, OS: { value: 535, unit: 'um' } }, scan_quality: { OD: 'GOOD', OS: 'GOOD' },
      map_document_ids: [documentId], impression_codes: ['REGULAR_ASTIGMATISM'] },
    BIOMETRY_IOL: { measurements: { OD: { axial_length: { value: 23.5, unit: 'mm' }, k1: 43, k1_axis: 90, k2: 44, k2_axis: 180 },
      OS: { axial_length: { value: 23.7, unit: 'mm' }, k1: 43.2, k1_axis: 85, k2: 44.2, k2_axis: 175 } }, target_refraction: { OD: -0.25, OS: -0.25 },
      calculations: { OD: [{ formula: 'CONFIGURED_FORMULA', iol_model: 'CATALOGUE_IOL', iol_power: 21, predicted_refraction: -0.2 }],
        OS: [{ formula: 'CONFIGURED_FORMULA', iol_model: 'CATALOGUE_IOL', iol_power: 20.5, predicted_refraction: -0.3 }] },
      measurement_quality: { OD: 'GOOD', OS: 'GOOD' }, proposed_iol: { OD: { model: 'CATALOGUE_IOL', power: 21 }, OS: { model: 'CATALOGUE_IOL', power: 20.5 } },
      backup_iol: { OD: { model: 'CATALOGUE_IOL', power: 20.5 }, OS: { model: 'CATALOGUE_IOL', power: 20 } }, selection_status: 'PROPOSED', report_document_id: documentId },
    B_SCAN: { eye: 'OU', indication: 'MEDIA_OPACITY', probe_orientation: 'TRANSVERSE', gain: 60, findings: { OD: { vitreous: 'CLEAR', retina: 'ATTACHED' },
      OS: { vitreous: 'CLEAR', retina: 'ATTACHED' } }, lesion: { OD: { present: false }, OS: { present: false } }, image_document_ids: [documentId],
      report_document_id: documentId, technician_observation: 'Acquisition completed' },
    GONIOSCOPY: { eyes: { OD: { quadrants: { superior: { angle_grade: '3', pigmentation: 'MILD', pas: false, neovascularization: false },
      inferior: { angle_grade: '3', pigmentation: 'MILD', pas: false, neovascularization: false } }, overall: { lens: 'GOLDMANN', technique: 'STATIC' } },
      OS: { quadrants: { superior: { angle_grade: '3', pigmentation: 'MILD', pas: false, neovascularization: false },
      inferior: { angle_grade: '3', pigmentation: 'MILD', pas: false, neovascularization: false } }, overall: { lens: 'GOLDMANN', technique: 'STATIC' } } } },
  } satisfies Record<OphthalmologyAdvancedTestFormType, Record<string, unknown>>)[form];

  const createTaskAndProfile = async (form: OphthalmologyAdvancedTestFormType, suffix = '', laterality: 'OD' | 'OS' | 'OU' = 'OU') => {
    const profile = await OphthalmologyConfigurationModel.create({ branchId, type: 'FORM_PROFILE', code: `${form}${suffix}`, name: `${form} form`, revision: 1,
      status: 'ACTIVE', values: { form_type: form, schema_version: '1.0', test_codes: [form], ...(form === 'VISUAL_FIELD' ? { comparison_units: { 'result_indices.mean_deviation': 'QA_UNIT' } } : {}), ...(form === 'GONIOSCOPY'
        ? { required_quadrants: ['superior', 'inferior'] } : {}) }, version: 0, createdBy: userId, updatedBy: userId });
    const task = await OphthalmologyTestTaskModel.create({ contextId, visitId, patientId, branchId, departmentId,
      testCatalogueVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(), testCode: form, testName: form,
      laterality, priority: 'ROUTINE', sourceType: 'WORKFLOW', status: 'IN_PROGRESS', stationId, assignedUserId: userId, deviceCode: 'MANUAL',
      doctorReviewRequired: false, idempotencyKey: `p6-${form}-${suffix || new Types.ObjectId()}`, requestFingerprint: 'test', orderedAt: new Date(),
      startedAt: new Date(), version: 0, createdBy: userId, updatedBy: userId }); return { task, profile };
  };
  const draft = (form: OphthalmologyAdvancedTestFormType, profileId: string, data: Record<string, unknown>, performedAt = '2026-10-15T05:30:00.000Z'):
    SaveOphthalmologyTestResultDraftDTO => ({ expected_task_status: 'IN_PROGRESS', expected_task_version: 0, expected_result_version: null,
      form_type: form, form_schema_version: '1.0', form_profile_version_id: profileId, performed_at: performedAt, source_type: 'MANUAL',
      reliability: 'GOOD', document_ids: [], payload: data });

  it.each(formTypes)('persists, completes, and reads the %s FSD form', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); const saved = await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload(form)), userId);
    const completed = await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: saved.version }, userId);
    expect(completed).toMatchObject({ status: 'COMPLETED', current: { form_type: form, status: 'COMPLETED' } });
    if (form === 'FUNDUS_PHOTOGRAPHY') expect((completed.current.payload.image_sets as Array<Record<string, unknown>>)[0]?.image_count).toBe(1);
    expect(await service.getTestResult(task._id.toString(), userId)).toMatchObject({ id: completed.id, current: { form_type: form } });
    expect(await repository.getTestTask(task._id.toString())).toMatchObject({ doctor_review_required: ['BIOMETRY_IOL', 'B_SCAN'].includes(form) });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.test_result.completed' })).toBe(1);
  });

  it.each(formTypes)('retains %s history through a controlled correction', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), payload(form)), userId);
    await service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    const amended = await service.amendTestResult(task._id.toString(), { ...draft(form, profile._id.toString(), payload(form)), expected_task_status: 'COMPLETED',
      expected_task_version: 2, expected_result_version: 1, source_type: 'MANUAL_CORRECTION', reason: 'Verified transcription correction' }, userId);
    expect(amended.history).toHaveLength(2); expect(amended.current).toMatchObject({ clinical_version: 2, supersedes_clinical_version: 1 });
  });

  it.each(formTypes)('rejects incomplete %s completion and preserves its draft', async (form) => {
    const { task, profile } = await createTaskAndProfile(form); await service.saveTestResultDraft(task._id.toString(), draft(form, profile._id.toString(), {}), userId);
    await expect(service.completeTestResult(task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_REQUIRED' });
    expect(await repository.getTestResult(task._id.toString())).toMatchObject({ status: 'DRAFT' });
  });

  it('validates retained calculations and conditional positive findings', async () => {
    const pachy = await createTaskAndProfile('PACHYMETRY', 'CALC'); const wrongAverage = payload('PACHYMETRY');
    (wrongAverage.average_thickness as Record<string, number>).OD = 999;
    await service.saveTestResultDraft(pachy.task._id.toString(), draft('PACHYMETRY', pachy.profile._id.toString(), wrongAverage), userId);
    await expect(service.completeTestResult(pachy.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_CALCULATION_INVALID' });
    const oct = await createTaskAndProfile('OCT', 'ARTEFACT'); const artefact = { ...payload('OCT'), artefact: true };
    await service.saveTestResultDraft(oct.task._id.toString(), draft('OCT', oct.profile._id.toString(), artefact), userId);
    await expect(service.completeTestResult(oct.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED' });
  });

  it('accepts only an eligible exact prior version for progression', async () => {
    const prior = await createTaskAndProfile('VISUAL_FIELD', 'PRIOR');
    await service.saveTestResultDraft(prior.task._id.toString(), draft('VISUAL_FIELD', prior.profile._id.toString(), payload('VISUAL_FIELD'), '2026-10-15T04:30:00.000Z'), userId);
    const completed = await service.completeTestResult(prior.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId);
    const current = await createTaskAndProfile('VISUAL_FIELD', 'CURRENT'); const compared = { ...payload('VISUAL_FIELD'),
      comparison: { outcome: 'STABLE', result_id: completed.id, clinical_version: 1 } };
    for (const incompatible of [{ ...compared, program: 'QA_OTHER_PROTOCOL' }, { ...compared, eye: 'OS' }]) {
      await expect(service.saveTestResultDraft(current.task._id.toString(), draft('VISUAL_FIELD', current.profile._id.toString(), incompatible), userId))
        .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE' });
    }
    await OphthalmologyConfigurationModel.updateOne({ _id: current.profile._id }, { $set: { 'values.comparison_units': { 'result_indices.mean_deviation': 'WRONG_UNIT' } } });
    await expect(service.saveTestResultDraft(current.task._id.toString(), draft('VISUAL_FIELD', current.profile._id.toString(), compared), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE' });
    await OphthalmologyConfigurationModel.updateOne({ _id: current.profile._id }, { $set: { 'values.comparison_units': { 'result_indices.mean_deviation': 'QA_UNIT' } } });
    await service.saveTestResultDraft(current.task._id.toString(), draft('VISUAL_FIELD', current.profile._id.toString(), compared), userId);
    await expect(service.completeTestResult(current.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .resolves.toMatchObject({ status: 'COMPLETED' });
    const candidates = await service.priorResultComparisons(current.task._id.toString(), { expected_result_version: 1, page: 1, limit: 1 }, userId);
    expect(candidates).toMatchObject({ task_id: current.task._id.toString(), meta: { total: 1, limit: 1 }, data: [{ result_id: completed.id, clinical_version: 1, eligible: true, reason: null }] });
    expect(candidates.data[0]).not.toHaveProperty('payload'); expect(candidates.data[0]).not.toHaveProperty('profile');
    await expect(service.priorResultComparisons(current.task._id.toString(), { expected_result_version: 0 }, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect((await service.priorResultComparisons(current.task._id.toString(), { expected_result_version: 1, page: 2, limit: 1 }, userId)).data).toEqual([]);
    const invalid = await createTaskAndProfile('OCT', 'INVALID'); const wrongForm = { ...payload('OCT'),
      comparison: { outcome: 'WORSENED', result_id: completed.id, clinical_version: 1 } };
    await expect(service.saveTestResultDraft(invalid.task._id.toString(), draft('OCT', invalid.profile._id.toString(), wrongForm), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE' });
  });

  it('rejects task-eye conflicts, final IOL claims, review bypass, and foreign nested documents', async () => {
    const field = await createTaskAndProfile('VISUAL_FIELD', 'EYE', 'OD');
    await expect(service.saveTestResultDraft(field.task._id.toString(), draft('VISUAL_FIELD', field.profile._id.toString(), { ...payload('VISUAL_FIELD'), eye: 'OS' }), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID' });
    const iol = await createTaskAndProfile('BIOMETRY_IOL', 'FINAL');
    await service.saveTestResultDraft(iol.task._id.toString(), draft('BIOMETRY_IOL', iol.profile._id.toString(), { ...payload('BIOMETRY_IOL'), selection_status: 'FINAL' }), userId);
    await expect(service.completeTestResult(iol.task._id.toString(), { expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REVIEW_REQUIRED' });
    const scan = await createTaskAndProfile('B_SCAN', 'REVIEW');
    await expect(service.saveTestResultDraft(scan.task._id.toString(), draft('B_SCAN', scan.profile._id.toString(), {
      ...payload('B_SCAN'), doctor_review_status: 'REVIEWED' }), userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_RESULT_INVALID' });
    const foreign = await PatientDocumentModel.create({ patientId: new Types.ObjectId(), documentType: 'CLINICAL', title: 'Foreign image', fileName: 'x.jpg',
      mimeType: 'image/jpeg', fileSizeBytes: 1, storageKey: 'foreign/x.jpg', source: 'HOSPITAL', reviewStatus: 'NOT_REQUIRED', status: 'ACTIVE' });
    const photo = await createTaskAndProfile('FUNDUS_PHOTOGRAPHY', 'DOC'); const photoPayload = payload('FUNDUS_PHOTOGRAPHY');
    ((photoPayload.image_sets as Array<Record<string, unknown>>)[0]!).image_document_ids = [foreign._id.toString()];
    await expect(service.saveTestResultDraft(photo.task._id.toString(), draft('FUNDUS_PHOTOGRAPHY', photo.profile._id.toString(), photoPayload), userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID' });
  });

  it('enforces scoped visibility, one-winner completion, and transactional rollback', async () => {
    const { task, profile } = await createTaskAndProfile('OCT', 'SAFE'); await service.saveTestResultDraft(task._id.toString(), draft('OCT', profile._id.toString(), payload('OCT')), userId);
    const outsider = await UserModel.create({ username: 'outsider.p6', email: 'outsider.p6@example.test', fullName: 'Outsider', passwordHash: 'not-used',
      roleIds: [], branchIds: [], departmentIds: [], status: 'active' });
    await expect(service.getTestResult(task._id.toString(), outsider._id.toString())).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
    const outcomes = await Promise.allSettled([0, 1].map(() => service.completeTestResult(task._id.toString(), {
      expected_task_status: 'DRAFT', expected_task_version: 1, expected_result_version: 0 }, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const rollback = await createTaskAndProfile('DRY_EYE', 'ROLLBACK'); vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.saveTestResultDraft(rollback.task._id.toString(), draft('DRY_EYE', rollback.profile._id.toString(), payload('DRY_EYE')), userId)).rejects.toThrow('audit unavailable');
    expect(await OphthalmologyTestResultModel.countDocuments({ taskId: rollback.task._id })).toBe(0);
  });
});
