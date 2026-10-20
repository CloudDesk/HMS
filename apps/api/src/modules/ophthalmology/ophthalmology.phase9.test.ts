import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdConsultationService } from '../opd/opd-consultation.service.js';
import { OpdVitalsRepository } from '../opd/opd-vitals.repository.js';
import { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { PatientTimelineEventModel, PatientModel } from '../patients/patient.model.js';
import { UserModel } from '../users/user.model.js';
import { OphthalmologyPublicationModel } from './ophthalmology-phase10.model.js';
import { OphthalmologyConsultationFinalizationModel } from './ophthalmology-consultation.model.js';
import { OphthalmologyClinicalReviewModel } from './ophthalmology-review.model.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyContextModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 9 consultation finalization', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository(); const visitRepository = new OpdVisitRepository();
  const service = new OphthalmologyService(repository, visitRepository, new NotificationService(new NotificationRepository()),
    new OpdConsultationRepository(), new AppointmentRepository(), new PatientRepository());
  let visitId: string; let userId: string; let contextId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyConsultationFinalizationModel.init(), OphthalmologyClinicalReviewModel.init(),
      OphthalmologyContextModel.init(), OphthalmologyConfigurationModel.init(), OpdVisitModel.init(), OpdConsultationModel.init(),
      PatientTimelineEventModel.init(), OphthalmologyTestTaskModel.init(), OphthalmologyTestResultModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    await Promise.all([OphthalmologyConsultationFinalizationModel.syncIndexes(), OphthalmologyClinicalReviewModel.syncIndexes(),
      OphthalmologyContextModel.syncIndexes(), OpdVisitModel.syncIndexes(), OpdConsultationModel.syncIndexes()]);
    const branch = await BranchModel.create({ code: 'OPH-P9', name: 'Ophthalmology Phase 9', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const user = await UserModel.create({ username: 'oph.phase9', email: 'oph.phase9@example.test', fullName: 'Phase Nine Doctor', passwordHash: 'not-used',
      roleIds: [], branchIds: [branch._id], departmentIds: [department._id], status: 'active' }); userId = user._id.toString();
    const doctor = await DoctorModel.create({ doctorNumber: 'OPH-P9-DOC', userId: user._id, firstName: 'Phase', lastName: 'Nine', displayName: 'Dr Phase Nine',
      specialization: 'Ophthalmology', branchId: branch._id, departmentId: department._id, status: 'ACTIVE', availability: [] });
    const patient = await PatientModel.create({ patientNumber: 'P9-001', firstName: 'Completion', lastName: 'Patient', dateOfBirth: new Date('1980-01-01'),
      gender: 'UNKNOWN', status: 'ACTIVE' });
    const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P9-001', queueTokenNumber: 1, patientId: patient._id, patientNumber: patient.patientNumber,
      patientName: 'Completion Patient', doctorId: doctor._id, doctorName: doctor.displayName, doctorSpecialization: doctor.specialization,
      branchId: branch._id, departmentId: department._id, visitDate: new Date(), checkInTime: new Date(), visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE', status: 'IN_CONSULTATION', version: 0 }); visitId = visit._id.toString();
    const config = await OphthalmologyConfigurationModel.create({ branchId: branch._id, type: 'COMPLETION_PROFILE', code: 'P9-COMPLETE',
      name: 'Phase 9 completion', revision: 3, status: 'ACTIVE', values: { visit_subtypes: ['NEW_CONSULTATION'], allow_override: true,
        required_requirements: ['ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED',
          'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED'] }, version: 0, createdBy: user._id, updatedBy: user._id });
    const context = await OphthalmologyContextModel.create({ visitId: visit._id, patientId: patient._id, branchId: branch._id, departmentId: department._id,
      doctorId: doctor._id, visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OU', workflowStatus: 'CLINICAL_REVIEW',
      configurationVersionId: config._id, workflowProfileVersionId: new Types.ObjectId(), version: 0, createdBy: user._id, updatedBy: user._id });
    contextId = context._id.toString();
    await OpdConsultationModel.create({ visitId: visit._id, patientId: patient._id, patientNumber: patient.patientNumber, patientName: 'Completion Patient',
      doctorId: doctor._id, doctorName: doctor.displayName, status: 'DRAFT', version: 0, assessment: 'Stable cataract',
      diagnoses: [{ code: '9B10', display: 'Cataract', codingSystem: 'ICD-11', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED', differential: false }],
      treatmentPlan: 'Observe', createdBy: user._id, updatedBy: user._id });
    await OphthalmologyClinicalReviewModel.create({ contextId: context._id, visitId: visit._id, patientId: patient._id, branchId: branch._id,
      departmentId: department._id, currentClinicalVersion: 1, status: 'DRAFT', versions: [{ clinicalVersion: 1,
        clinicalSummary: 'Cataract assessed and discussed', treatmentPlans: [{ _id: new Types.ObjectId(), diagnosisCode: '9B10', diagnosisLaterality: 'OU',
          treatment: 'Observe', category: 'OBSERVATION', priority: 'ROUTINE', status: 'ACTIVE', clinicalOrderIds: [], clinicianUserId: user._id }],
        followUpDecision: 'NO_FOLLOW_UP', patientInstructions: 'Return for visual change', createdBy: user._id, createdAt: new Date() }],
      version: 0, createdBy: user._id, updatedBy: user._id });
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const completion = (expectedVersion = 0, contextVersion = 0, consultationVersion = 0, reviewVersion = 0) => ({
    expected_version: expectedVersion, expected_context_version: contextVersion, expected_consultation_version: consultationVersion,
    expected_clinical_review_version: reviewVersion,
  });

  it('reviews the exact completed clinical result version and rejects stale review requests', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean(); const now = new Date(); const stationId = new Types.ObjectId();
    const task = await OphthalmologyTestTaskModel.create({ contextId: context!._id, visitId: context!.visitId, patientId: context!.patientId,
      branchId: context!.branchId, departmentId: context!.departmentId, testCatalogueVersionId: new Types.ObjectId(),
      workflowProfileVersionId: context!.workflowProfileVersionId, testCode: 'VISUAL_ACUITY', testName: 'Visual acuity', laterality: 'OU',
      priority: 'ROUTINE', sourceType: 'WORKFLOW', status: 'COMPLETED', stationId, doctorReviewRequired: true,
      idempotencyKey: 'p9-review-task', requestFingerprint: 'fingerprint', assignmentHistory: [], transitionHistory: [], routingHistory: [],
      orderedAt: now, completedAt: now, version: 0, createdBy: userId, updatedBy: userId });
    await OphthalmologyTestResultModel.create({ taskId: task._id, contextId: context!._id, visitId: context!.visitId,
      patientId: context!.patientId, branchId: context!.branchId, departmentId: context!.departmentId, currentClinicalVersion: 1,
      status: 'COMPLETED', versions: [{ clinicalVersion: 1, status: 'COMPLETED', formType: 'VISUAL_ACUITY', formSchemaVersion: '1.0',
        formProfileVersionId: new Types.ObjectId(), formProfileRevision: 1, formProfileSnapshot: {}, laterality: 'OU', stationId,
        performerUserId: userId, performedAt: now, sourceType: 'MANUAL', reliability: 'GOOD', documentIds: [], payload: { conclusion_codes: ['STABLE'] },
        completedAt: now, createdBy: userId, createdAt: now }], version: 1, createdBy: userId, updatedBy: userId });
    await expect(service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 2 }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    const reviewed = await service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 1, comment: 'Reviewed against the consultation' }, userId);
    expect(reviewed).toMatchObject({ status: 'REVIEWED', reviewed_by: userId, reviewed_clinical_version: 1, version: 1 });
    await expect(service.reviewTestResult(task._id.toString(), { expected_task_version: 0, expected_result_version: 1,
      expected_clinical_version: 1 }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('serves a minimal same-department clinical header and bound configuration without exposing generic notes', async () => {
    await OpdVisitModel.updateOne({ _id: visitId }, { $set: { notes: 'Internal shared note' } });
    const workspace = await service.getClinicalWorkspace(visitId, userId);
    expect(workspace.visit).toMatchObject({ id: visitId }); expect(workspace.visit).not.toHaveProperty('notes');
    expect(workspace.context).toMatchObject({ id: contextId });
    expect(await service.getClinicalConfiguration(visitId, userId)).toMatchObject({ type: 'COMPLETION_PROFILE' });
    await UserModel.updateOne({ _id: userId }, { $set: { departmentIds: [] } });
    await expect(service.getClinicalWorkspace(visitId, userId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getClinicalConfiguration(visitId, userId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects missing configured mandatory tests instead of passing an empty task set', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean(); if (!context) throw new Error('Missing context');
    await OphthalmologyConfigurationModel.updateOne({ _id: context.configurationVersionId }, { $set: {
      'values.required_requirements': ['MANDATORY_TESTS_REVIEWED'], 'values.mandatory_test_codes': ['VISUAL_ACUITY'] } });
    const readiness = await service.getCompletionReadiness(visitId, userId);
    expect(readiness.ready).toBe(false);
    expect(readiness.requirements[0]).toMatchObject({ code: 'MANDATORY_TESTS_REVIEWED', satisfied: false, resource_ids: [] });
    expect(readiness.requirements[0]?.details).toContain('VISUAL_ACUITY');
    await expect(service.completeConsultation(visitId, completion(), 'missing-mandatory', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments({ visitId })).toBe(0);
    await OphthalmologyConfigurationModel.updateOne({ _id: context.configurationVersionId }, { $set: { 'values.mandatory_test_codes': [] } });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
  });

  it('blocks generic OPD completion for a specialty context and for its authoritative department before context activation', async () => {
    const generic = new OpdConsultationService(new OpdConsultationRepository(), visitRepository, new OpdVitalsRepository(), new PatientRepository(), new AppointmentRepository());
    await expect(generic.complete(visitId, { expected_version: 0, expected_status: 'DRAFT' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED' });
    await OphthalmologyContextModel.deleteOne({ _id: contextId });
    await expect(generic.complete(visitId, {}, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED' });
    expect((await OpdVisitModel.findById(visitId).lean())?.status).toBe('IN_CONSULTATION');
    expect((await OpdConsultationModel.findOne({ visitId }).lean())?.status).toBe('DRAFT');
  });

  it('returns structured unmet requirements and requires an exact override snapshot', async () => {
    await OpdConsultationModel.updateOne({ visitId }, { $set: { diagnoses: [] } });
    const readiness = await service.getCompletionReadiness(visitId, userId);
    expect(readiness.ready).toBe(false);
    expect(readiness.requirements.find((item) => item.code === 'DIAGNOSIS_RECORDED')).toMatchObject({ satisfied: false });
    await expect(service.overrideCompletion(visitId, { expected_version: 0, expected_unmet_codes: ['CLINICAL_REVIEW_RECORDED'], reason: 'Incorrect snapshot' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_REQUIREMENTS_CHANGED' });
    const override = await service.overrideCompletion(visitId, { expected_version: 0, expected_unmet_codes: ['DIAGNOSIS_RECORDED'], reason: 'Urgent transfer' }, userId);
    expect(override).toMatchObject({ status: 'OPEN', version: 1, overrides: [{ unmet_codes: ['DIAGNOSIS_RECORDED'] }] });
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    await OphthalmologyConfigurationModel.updateOne({ _id: context!.configurationVersionId }, { $set: { 'values.allow_override': false } });
    await expect(service.completeConsultation(visitId, { ...completion(), expected_version: 1 }, 'override-disabled', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION' });
  });

  it('rejects ambiguous active completion profiles instead of guessing', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    await OphthalmologyConfigurationModel.create({ branchId: context!.branchId, type: 'COMPLETION_PROFILE', code: 'P9-SECOND',
      name: 'Ambiguous profile', revision: 1, status: 'ACTIVE', values: { visit_subtypes: ['NEW_CONSULTATION'],
        required_requirements: ['DIAGNOSIS_RECORDED'] }, version: 0, createdBy: userId, updatedBy: userId });
    await expect(service.getCompletionReadiness(visitId, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
  });

  it('completes OPD and specialty records atomically and replays the same idempotency key', async () => {
    expect((await service.getCompletionReadiness(visitId, userId)).ready).toBe(true);
    const completed = await service.completeConsultation(visitId, completion(), 'p9-complete-1', userId);
    expect(completed).toMatchObject({ status: 'COMPLETED', version: 1, completions: [{ clinical_version: 1, configuration_revision: 3 }] });
    expect(await service.completeConsultation(visitId, completion(), 'p9-complete-1', userId)).toMatchObject({ id: completed.id, version: 1 });
    await expect(service.completeConsultation(visitId, { ...completion(), expected_context_version: 99 }, 'p9-complete-1', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT' });
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'COMPLETED', version: 1 });
    expect(await OpdConsultationModel.findOne({ visitId }).lean()).toMatchObject({ status: 'COMPLETED', version: 1 });
    expect(await OphthalmologyContextModel.findById(contextId).lean()).toMatchObject({ workflowStatus: 'CONSULTATION_COMPLETED', version: 1 });
    expect(await PatientTimelineEventModel.countDocuments({ patientId: (await OpdVisitModel.findById(visitId).lean())!.patientId })).toBe(1);
    await expect(service.saveClinicalReviewDraft(visitId, { expected_version: 1, clinical_summary: 'Forbidden overwrite',
      treatment_plans: [], follow_up_decision: 'NO_FOLLOW_UP' }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONSULTATION_LOCKED' });
  });

  it('rejects unauthorized and concurrent completion attempts', async () => {
    const context = await OphthalmologyContextModel.findById(contextId).lean();
    const outsider = await UserModel.create({ username: 'oph.p9.outsider', email: 'oph.p9.outsider@example.test', fullName: 'Not Doctor', passwordHash: 'none',
      roleIds: [], branchIds: [context!.branchId], departmentIds: [context!.departmentId], status: 'active' });
    await expect(service.completeConsultation(visitId, completion(), 'outsider', outsider._id.toString())).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCTOR_REQUIRED' });
    const outcomes = await Promise.allSettled([0, 1].map((index) => service.completeConsultation(visitId, completion(), `p9-race-${index}`, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('rolls back shared and specialty completion when audit persistence fails', async () => {
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.completeConsultation(visitId, completion(), 'p9-rollback', userId)).rejects.toThrow('audit unavailable');
    expect(await OphthalmologyConsultationFinalizationModel.countDocuments()).toBe(0);
    expect(await OpdVisitModel.findById(visitId).lean()).toMatchObject({ status: 'IN_CONSULTATION', version: 0 });
    expect(await OpdConsultationModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
    expect(await OphthalmologyClinicalReviewModel.findOne({ visitId }).lean()).toMatchObject({ status: 'DRAFT', version: 0 });
  });

  it('corrects structured treatment plans and follow-up decisions with immutable sources and rollback', async () => {
    const completed = await service.completeConsultation(visitId, completion(), 'p9-structured', userId);
    const reopened = await service.reopenConsultation(visitId, { expected_version: completed.version, expected_status: 'COMPLETED', reason: 'Correct treatment record' }, userId);
    const episode = reopened.amendment_episodes[0]; if (!episode) throw new Error('Missing amendment episode');
    const original = await repository.getClinicalReviewByVisit(visitId); if (!original) throw new Error('Missing clinical source');
    const plans = original.current.treatment_plans.map(({ clinician_user_id, ...plan }) => { void clinician_user_id; return plan; });
    const first = plans[0]; if (!first) throw new Error('Missing plan');
    const command = { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN' as const, episode_id: episode.id, section: 'treatment_plans', before_value: original.current.treatment_plans, reason: 'Correct observation plan' };
    await expect(service.amendConsultation(visitId, { ...command, after_value: plans }, userId)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, diagnosis_code: 'FOREIGN' }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DIAGNOSIS_MISMATCH' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, id: new Types.ObjectId().toString() }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
    await expect(service.amendConsultation(visitId, { ...command, after_value: [{ ...first, referral_id: new Types.ObjectId().toString() }] }, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
    const after = [{ ...first, treatment: 'Observe with documented precautions' }];
    const failingAudit = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit failed'));
    await expect(service.amendConsultation(visitId, { ...command, after_value: after }, userId)).rejects.toThrow('audit failed'); failingAudit.mockRestore();
    expect((await repository.getClinicalReviewByVisit(visitId))?.version).toBe(original.version);
    const changed = await service.amendConsultation(visitId, { ...command, after_value: after }, userId);
    const source = await repository.getClinicalReviewByVisit(visitId); expect(source?.current.treatment_plans[0]).toMatchObject({ id: first.id, treatment: after[0]?.treatment });
    expect(source?.history[0]?.treatment_plans[0]?.treatment).toBe('Observe'); expect(source?.status).toBe('DRAFT');
    await expect(service.amendConsultation(visitId, { ...command, expected_version: changed.version, after_value: after }, userId)).rejects.toMatchObject({ statusCode: 409 });
    const decision = await service.amendConsultation(visitId, { expected_version: changed.version, expected_status: 'AMENDMENT_OPEN', episode_id: episode.id, section: 'follow_up_decision', before_value: 'NO_FOLLOW_UP', after_value: null, reason: 'Decision needs review' }, userId);
    expect((await repository.getClinicalReviewByVisit(visitId))?.current.follow_up_decision).toBeNull();
    await expect(service.completeConsultation(visitId, completion(decision.version, 2, 1, 3), 'p9-missing-decision', userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE' });
  });

  it('reopens into an append-only amendment episode and requires doctor reapproval', async () => {
    const completed = await service.completeConsultation(visitId, completion(), 'p9-original', userId);
    const source = await OphthalmologyContextModel.findById(contextId).lean(); if (!source) throw new Error('Missing context');
    const publication = await OphthalmologyPublicationModel.create({ contextId, visitId, patientId: source.patientId, branchId: source.branchId,
      departmentId: source.departmentId, sourceType: 'CONSULTATION_SUMMARY', sourceId: completed.id, sourceVersion: 1,
      status: 'APPROVED_FOR_PORTAL', portalPayload: { kind: 'CONSULTATION_SUMMARY' }, idempotencyKey: 'amendment-publication',
      requestFingerprint: 'qa', publishedBy: userId, publishedAt: new Date(), version: 0 });
    const reopened = await service.reopenConsultation(visitId, { expected_version: completed.version, expected_status: 'COMPLETED', reason: 'Correct instruction' }, userId);
    expect(await OphthalmologyPublicationModel.findById(publication._id).lean()).toMatchObject({ status: 'WITHDRAWN', version: 1 });
    const episodeId = reopened.amendment_episodes[0]!.id;
    await expect(service.amendConsultation(visitId, { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN', episode_id: episodeId,
      section: 'patient_instructions', before_value: 'wrong source', after_value: 'QA correction', reason: 'QA' }, userId)).rejects.toMatchObject({ statusCode: 409 });
    const amended = await service.amendConsultation(visitId, { expected_version: reopened.version, expected_status: 'AMENDMENT_OPEN', episode_id: episodeId,
      section: 'patient_instructions', before_value: 'Return for visual change', after_value: 'Return urgently for visual change', reason: 'Clarify urgency' }, userId);
    const approved = await service.completeConsultation(visitId, completion(amended.version, 2, 1, 2), 'p9-amendment', userId);
    const correctedReview = await repository.getClinicalReviewByVisit(visitId);
    expect(correctedReview?.current.patient_instructions).toBe('Return urgently for visual change');
    expect(correctedReview?.history[0]?.patient_instructions).toBe('Return for visual change');
    expect(correctedReview?.status).toBe('COMPLETED');
    expect(approved).toMatchObject({ status: 'COMPLETED', version: 4, completions: [{ clinical_version: 1 },
      { clinical_version: 2, supersedes_clinical_version: 1 }], amendment_episodes: [{ status: 'COMPLETED' }] });
    expect(await AuditLogModel.countDocuments({ eventType: { $in: ['ophthalmology.consultation.reopened',
      'ophthalmology.consultation.amended', 'ophthalmology.consultation.amendment_approved'] } })).toBe(3);
  });
});
