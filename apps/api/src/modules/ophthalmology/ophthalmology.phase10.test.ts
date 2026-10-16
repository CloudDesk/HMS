import mongoose, { Types } from 'mongoose';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { PatientDocumentModel, PatientModel, PatientTimelineEventModel } from '../patients/patient.model.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import { UserModel } from '../users/user.model.js';
import { OphthalmologyConsultationFinalizationModel } from './ophthalmology-consultation.model.js';
import { OphthalmologyAttachmentModel, OphthalmologyPublicationModel, OphthalmologyDashboardSnapshotModel } from './ophthalmology-phase10.model.js';
import { OphthalmologyPhase10Repository } from './ophthalmology-phase10.repository.js';
import { OphthalmologyPhase10Service } from './ophthalmology-phase10.service.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyContextModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';

describe('Ophthalmology Phase 10 publication and reporting', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new OphthalmologyPhase10Repository();
  let service: OphthalmologyPhase10Service; let storagePath: string;
  let userId: string; let branchId: string; let finalizationId: string; let resultId: string; let taskId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    storagePath = await mkdtemp(path.join(os.tmpdir(), 'hms-oph-p10-'));
    service = new OphthalmologyPhase10Service(repository, new OphthalmologyRepository(), new PatientRepository(),
      new PatientDocumentStorageService({ provider: 'local', localRootDirectory: storagePath }));
    await Promise.all([OphthalmologyAttachmentModel.init(), OphthalmologyPublicationModel.init(), OphthalmologyDashboardSnapshotModel.init(),
      OphthalmologyConsultationFinalizationModel.init(), OphthalmologyContextModel.init(), OphthalmologyTestTaskModel.init(),
      OphthalmologyTestResultModel.init(), PatientDocumentModel.init(), PatientTimelineEventModel.init()]);
  });
  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await Promise.all([OphthalmologyAttachmentModel.syncIndexes(), OphthalmologyPublicationModel.syncIndexes(), OphthalmologyDashboardSnapshotModel.syncIndexes(),
      OphthalmologyContextModel.syncIndexes(), OphthalmologyTestTaskModel.syncIndexes(), OphthalmologyTestResultModel.syncIndexes()]);
    const branch = await BranchModel.create({ code: 'OPH-P10', name: 'Phase 10', status: 'ACTIVE' }); branchId = branch._id.toString();
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const user = await UserModel.create({ username: 'oph.phase10', email: 'oph.phase10@example.test', fullName: 'Phase Ten Publisher',
      passwordHash: 'unused', roleIds: [], branchIds: [branch._id], departmentIds: [department._id], status: 'active' }); userId = user._id.toString();
    const patient = await PatientModel.create({ patientNumber: 'P10-001', firstName: 'Portal', lastName: 'Patient',
      dateOfBirth: new Date('1990-01-01'), gender: 'UNKNOWN', status: 'ACTIVE' });
    const visitId = new Types.ObjectId();
    const context = await OphthalmologyContextModel.create({ visitId, patientId: patient._id, branchId: branch._id, departmentId: department._id,
      doctorId: new Types.ObjectId(), visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OU', workflowStatus: 'CONSULTATION_COMPLETED',
      configurationVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(), version: 1, createdBy: user._id, updatedBy: user._id });
    const now = new Date(); const stationId = new Types.ObjectId();
    const task = await OphthalmologyTestTaskModel.create({ contextId: context._id, visitId, patientId: patient._id, branchId: branch._id,
      departmentId: department._id, testCatalogueVersionId: new Types.ObjectId(), workflowProfileVersionId: new Types.ObjectId(),
      testCode: 'OCT', testName: 'Optical coherence tomography', laterality: 'OD', priority: 'ROUTINE', sourceType: 'WORKFLOW',
      status: 'REVIEWED', stationId, doctorReviewRequired: true, reviewedBy: user._id, reviewedAt: now, reviewedClinicalVersion: 1,
      idempotencyKey: 'phase10-task', requestFingerprint: 'task-fingerprint', assignmentHistory: [], transitionHistory: [], routingHistory: [],
      orderedAt: new Date(now.getTime() - 60_000), startedAt: new Date(now.getTime() - 45_000), completedAt: new Date(now.getTime() - 15_000),
      version: 1, createdBy: user._id, updatedBy: user._id });
    taskId = task._id.toString();
    const result = await OphthalmologyTestResultModel.create({ taskId: task._id, contextId: context._id, visitId, patientId: patient._id,
      branchId: branch._id, departmentId: department._id, currentClinicalVersion: 1, status: 'COMPLETED', versions: [{ clinicalVersion: 1,
        status: 'COMPLETED', formType: 'OCT', formSchemaVersion: '1.0', formProfileVersionId: new Types.ObjectId(), formProfileRevision: 1,
        formProfileSnapshot: {}, laterality: 'OD', stationId, performerUserId: user._id, performedAt: now, sourceType: 'MANUAL',
        reliability: 'GOOD', comments: 'internal technician note', documentIds: [], payload: { technician_observation_codes: ['INTERNAL'] },
        completedAt: now, createdBy: user._id, createdAt: now }], version: 1, createdBy: user._id, updatedBy: user._id });
    resultId = result._id.toString();
    const finalization = await OphthalmologyConsultationFinalizationModel.create({ contextId: context._id, visitId, patientId: patient._id,
      branchId: branch._id, departmentId: department._id, status: 'COMPLETED', version: 1, deferrals: [], overrides: [], amendmentEpisodes: [],
      completions: [{ clinicalVersion: 1, configurationVersionId: new Types.ObjectId(), configurationRevision: 1, configurationSnapshot: {},
        consultationVersion: 1, clinicalReviewVersion: 1, requirementSnapshot: [], summarySnapshot: {
          clinical_review: { current: { clinical_summary: 'Approved patient summary', patient_instructions: 'Return in one month' } },
          consultation: { diagnoses: [{ code: '9B10', display: 'Cataract' }] }, tasks: [{ internal: true }], previous_results: [{ internal: true }],
        }, approverUserId: user._id, approverDoctorId: new Types.ObjectId(), approvedAt: now,
        idempotencyKey: 'completion', requestFingerprint: 'completion-fingerprint' }], createdBy: user._id, updatedBy: user._id });
    finalizationId = finalization._id.toString();
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); await rm(storagePath, { recursive: true, force: true }); });

  it('stores attachment metadata and the patient document atomically with idempotent replay', async () => {
    const data = Buffer.from('clinical-image');
    const input = { task_id: taskId, result_id: resultId, title: 'OCT image', acquired_at: new Date().toISOString(),
      provenance: 'MANUAL_UPLOAD' as const, file_name: 'oct.png', mime_type: 'image/png', file_size_bytes: data.byteLength, data };
    const attachment = await service.uploadAttachment(input, 'phase10-attachment', userId);
    expect(attachment).toMatchObject({ task_id: taskId, result_id: resultId, test_code: 'OCT', laterality: 'OD',
      review_state: 'PENDING', publication_state: 'INTERNAL' });
    expect(await PatientDocumentModel.countDocuments({ _id: attachment.patient_document_id, status: 'ACTIVE' })).toBe(1);
    expect(await service.uploadAttachment(input, 'phase10-attachment', userId)).toMatchObject({ id: attachment.id });
    expect(await OphthalmologyAttachmentModel.countDocuments()).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.attachment.uploaded' })).toBe(1);
    expect((await service.listAttachments({ branch_id: branchId, task_id: taskId }, userId)).meta.total).toBe(1);
  });

  it('publishes only an exact approved version and excludes internal review collections', async () => {
    const publication = await service.publish({ source_type: 'CONSULTATION_SUMMARY', source_id: finalizationId, source_version: 1 },
      'phase10-summary', userId);
    expect(publication).toMatchObject({ status: 'APPROVED_FOR_PORTAL', source_version: 1, version: 0 });
    expect(publication.portal_payload).not.toHaveProperty('tasks');
    expect(publication.portal_payload).not.toHaveProperty('previous_results');
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.portal.published' })).toBe(1);
    expect(await PatientTimelineEventModel.countDocuments({ eventType: 'OPHTHALMOLOGY_PORTAL_PUBLISHED' })).toBe(1);
  });

  it('replays the same publication request and rejects changed idempotency reuse', async () => {
    const input = { source_type: 'TEST_RESULT' as const, source_id: resultId, source_version: 1 };
    const first = await service.publish(input, 'phase10-result', userId);
    expect(await service.publish(input, 'phase10-result', userId)).toMatchObject({ id: first.id });
    await expect(service.publish({ source_type: 'CONSULTATION_SUMMARY', source_id: finalizationId, source_version: 1 },
      'phase10-result', userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT' });
  });

  it('requires reviewed sources and versioned reasoned withdrawal', async () => {
    await OphthalmologyTestTaskModel.updateOne({}, { $set: { status: 'COMPLETED', reviewedClinicalVersion: null } });
    await expect(service.publish({ source_type: 'TEST_RESULT', source_id: resultId, source_version: 1 }, 'unreviewed-result', userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REVIEW_REQUIRED' });
    const publication = await service.publish({ source_type: 'CONSULTATION_SUMMARY', source_id: finalizationId, source_version: 1 },
      'withdraw-summary', userId);
    const withdrawn = await service.withdraw(publication.id, { expected_version: 0, expected_status: 'APPROVED_FOR_PORTAL', reason: 'Superseded' }, userId);
    expect(withdrawn).toMatchObject({ status: 'WITHDRAWN', version: 1, withdrawal_reason: 'Superseded' });
    await expect(service.withdraw(publication.id, { expected_version: 0, expected_status: 'APPROVED_FOR_PORTAL', reason: 'Again' }, userId))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('returns bounded branch-scoped reports and turnaround values', async () => {
    const report = await service.report('TEST_TURNAROUND', { branch_id: branchId, page: 1, limit: 20 }, userId);
    expect(report.meta).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(report.data[0]).toMatchObject({ test_code: 'OCT', order_to_start_ms: 15000, start_to_completion_ms: 30000 });
    for (const type of ['STATION_QUEUE', 'PENDING_REVIEW', 'REPEAT_UNABLE', 'CLINICAL_VOLUME',
      'DIAGNOSTIC_UTILIZATION'] as const) {
      const result = await service.report(type, { branch_id: branchId, page: 1, limit: 20 }, userId);
      expect(result.meta).toMatchObject({ page: 1, limit: 20 });
    }
    const outsider = await UserModel.create({ username: 'p10.outside', email: 'p10.outside@example.test', fullName: 'Outside', passwordHash: 'x',
      roleIds: [], branchIds: [], departmentIds: [], status: 'active' });
    await expect(service.report('STATION_QUEUE', { branch_id: branchId }, outsider._id.toString()))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
  });

  it('requires a generated dashboard snapshot and refreshes authoritative task counts', async () => {
    await expect(service.dashboard({ branch_id: branchId }, userId)).rejects.toMatchObject({ code: 'DASHBOARD_NOT_READY' });
    const refreshed = await service.refreshDashboard({ branch_id: branchId }, userId);
    expect(refreshed?.metrics).toMatchObject({ reviewed: 1, waiting: 0, pending_review: 0 });
    expect(await service.dashboard({ branch_id: branchId }, userId)).toMatchObject({ metrics: { reviewed: 1 } });
  });
});
