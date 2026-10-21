import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientDocumentModel } from '../patients/patient.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { OphthalmologyAlertModel, OphthalmologyIntakeModel } from './ophthalmology-intake.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyContextModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';
import type { SaveOphthalmologyIntakeDraftDTO } from './ophthalmology.types.js';

describe('Ophthalmology Phase 3 intake and emergency workflow', () => {
  let mongo: MongoMemoryReplSet;
  const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let branchId: string; let departmentId: string; let userId: string; let patientId: string; let visitId: string;
  let contextId: string; let complaintConfigurationId: string; let emergencyConfigurationId: string; let documentId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyIntakeModel.init(), OphthalmologyAlertModel.init(), OphthalmologyContextModel.init(),
      OphthalmologyConfigurationModel.init(), OpdVisitModel.init(), NotificationModel.init()]);
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    const branch = await BranchModel.create({ code: 'OPH-P3', name: 'Ophthalmology Phase 3', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const permission = await PermissionModel.create({ code: 'OPD.OPHTHALMOLOGY_CONSULTATION.VIEW', name: 'View Ophthalmology Consultation',
      module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View', type: 'custom', status: 'active' });
    const role = await RoleModel.create({ code: 'OPH_CLINICIAN', name: 'Ophthalmology Clinician', permissionIds: [permission._id], status: 'active' });
    const user = await UserModel.create({ username: 'oph.phase3', email: 'oph.phase3@example.test', fullName: 'Ophthalmology Clinician',
      passwordHash: 'not-used', roleIds: [role._id], branchIds: [branch._id], departmentIds: [department._id], status: 'active' });
    const doctor = await DoctorModel.create({ doctorNumber: 'OPH-P3-DOC', userId: user._id, firstName: 'Ophthalmology', lastName: 'Clinician',
      displayName: 'Dr Ophthalmology Clinician', specialization: 'Ophthalmology', branchId: branch._id, departmentId: department._id,
      status: 'ACTIVE', availability: [] });
    branchId = branch._id.toString(); departmentId = department._id.toString(); userId = user._id.toString(); patientId = new Types.ObjectId().toString();
    const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P3-001', queueTokenNumber: 1, patientId, patientNumber: 'P-OPH-P3',
      patientName: 'Phase Three Patient', doctorId: doctor._id, doctorName: doctor.displayName, doctorSpecialization: doctor.specialization,
      branchId, departmentId, visitDate: new Date(), checkInTime: new Date(), visitType: 'NEW_CONSULTATION', priority: 'ROUTINE',
      status: 'CHECKED_IN', version: 0 });
    visitId = visit._id.toString();
    const context = await OphthalmologyContextModel.create({ visitId, patientId, branchId, departmentId, doctorId: doctor._id,
      visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OD', workflowStatus: 'CHECKED_IN', configurationVersionId: new Types.ObjectId(),
      workflowProfileVersionId: new Types.ObjectId(), version: 0, createdBy: userId, updatedBy: userId });
    contextId = context._id.toString();
    const complaint = await OphthalmologyConfigurationModel.create({ branchId, type: 'COMPLAINT', code: 'DEFAULT', name: 'Complaints',
      revision: 1, status: 'ACTIVE', values: { options: [{ code: 'BLURRED_VISION', label: 'Blurred vision' },
        { code: 'PAIN', label: 'Pain', requires_description: true }] }, version: 0, createdBy: userId, updatedBy: userId });
    const emergency = await OphthalmologyConfigurationModel.create({ branchId, type: 'CLINICAL_THRESHOLD', code: 'EMERGENCY_SCREENING',
      name: 'Emergency criteria', revision: 1, status: 'ACTIVE', values: { criteria: [
        { code: 'SUDDEN_VISION_LOSS', label: 'Sudden vision loss', active: true },
        { code: 'OTHER_URGENT_CONDITION', label: 'Other urgent condition', active: true },
      ] }, version: 0, createdBy: userId, updatedBy: userId });
    complaintConfigurationId = complaint._id.toString(); emergencyConfigurationId = emergency._id.toString();
    const document = await PatientDocumentModel.create({ patientId, visitId, documentType: 'CLINICAL', title: 'Previous report',
      fileName: 'previous.pdf', mimeType: 'application/pdf', fileSizeBytes: 100, storageKey: 'test/previous.pdf', status: 'ACTIVE',
      source: 'HOSPITAL', reviewStatus: 'NOT_REQUIRED', uploadedBy: userId });
    documentId = document._id.toString();
    await OpdConsultationModel.create({ visitId, patientId, patientNumber: 'P-OPH-P3', patientName: 'Phase Three Patient', doctorId: doctor._id,
      doctorName: doctor.displayName, status: 'DRAFT', version: 0, historyPresentIllness: 'Shared presenting history',
      pastHistory: 'Shared medical history', familyHistory: 'Shared family history', allergies: 'Shared allergy record', createdBy: userId, updatedBy: userId });
  });

  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const draft = (overrides: Partial<SaveOphthalmologyIntakeDraftDTO> = {}): SaveOphthalmologyIntakeDraftDTO => ({
    expected_version: null, complaint_configuration_version_id: complaintConfigurationId,
    emergency_configuration_version_id: emergencyConfigurationId, complaint_codes: ['BLURRED_VISION'], affected_eye: 'OD',
    duration_value: 2, duration_unit: 'DAY', onset: 'GRADUAL', progression: 'STABLE', severity: 'MILD',
    associated_symptom_codes: [], description: null, no_significant_ophthalmic_history: true,
    previous_eye_disease_codes: [], previous_eye_surgeries: [], current_eye_treatments: [], previous_eye_injury_or_laser: [],
    spectacle_use: { uses: false }, contact_lens_use: { uses: false }, long_term_steroid_use: false,
    family_history_codes: [], previous_report_document_ids: [documentId], shared_medical_history_reviewed: true,
    shared_allergy_reviewed: true, emergency_criterion_codes: [], other_urgent_condition_detail: null, ...overrides,
  });

  it('persists one versioned draft and returns shared history without duplicating it', async () => {
    const created = await service.saveIntakeDraft(visitId, draft(), userId);
    expect(created).toMatchObject({ context_id: contextId, status: 'DRAFT', version: 0, previous_report_document_ids: [documentId] });
    const updated = await service.saveIntakeDraft(visitId, draft({ expected_version: 0, progression: 'IMPROVING' }), userId);
    expect(updated).toMatchObject({ progression: 'IMPROVING', version: 1 });
    const view = await service.getIntake(visitId, userId);
    expect(view.shared_history).toEqual({ history_present_illness: 'Shared presenting history', past_history: 'Shared medical history',
      family_history: 'Shared family history', allergies: 'Shared allergy record' });
    await expect(service.saveIntakeDraft(visitId, draft({ expected_version: 0 }), userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('rejects conflicting history and cross-patient previous-report references', async () => {
    await expect(service.saveIntakeDraft(visitId, draft({ previous_eye_disease_codes: ['CATARACT'] }), userId))
      .rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED' });
    const foreignDocument = await PatientDocumentModel.create({ patientId: new Types.ObjectId(), documentType: 'CLINICAL', title: 'Foreign',
      fileName: 'foreign.pdf', mimeType: 'application/pdf', fileSizeBytes: 100, storageKey: 'test/foreign.pdf', status: 'ACTIVE',
      source: 'HOSPITAL', reviewStatus: 'NOT_REQUIRED', uploadedBy: userId });
    await expect(service.saveIntakeDraft(visitId, draft({ previous_report_document_ids: [foreignDocument._id.toString()] }), userId))
      .rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID' });
  });

  it('completes emergency intake atomically, routes without diagnosis, and permits exact-version acknowledgement', async () => {
    const intake = await service.saveIntakeDraft(visitId, draft({ onset: 'SUDDEN', emergency_criterion_codes: ['SUDDEN_VISION_LOSS'] }), userId);
    const result = await service.completeIntake(visitId, { expected_version: intake.version, expected_status: 'DRAFT', expected_context_version: 0 }, userId);
    expect(result.intake).toMatchObject({ status: 'COMPLETED', version: 1 });
    expect(result.alert).toMatchObject({ status: 'ACTIVE', criterion_codes: ['SUDDEN_VISION_LOSS'], notified_user_ids: [userId], version: 1 });
    expect(await NotificationModel.countDocuments({ recipientUserId: userId, relatedEntityId: result.alert?.id })).toBe(1);
    expect((await OpdConsultationModel.findOne({ visitId }).lean())?.diagnoses).toEqual([]);
    expect((await repository.getContextByVisit(visitId))?.workflow_status).toBe('AWAITING_DOCTOR');
    const rerouted = await service.routeEmergency(visitId, result.alert!.id,
      { expected_version: result.alert!.version, expected_status: 'ACTIVE' }, userId);
    expect(rerouted.version).toBe(result.alert!.version);
    expect(await NotificationModel.countDocuments({ relatedEntityId: result.alert?.id })).toBe(1);
    const nonClinician = await UserModel.create({ username: 'oph.phase3.viewer', email: 'oph.phase3.viewer@example.test',
      fullName: 'Ophthalmology Viewer', passwordHash: 'not-used', roleIds: [], branchIds: [branchId], departmentIds: [departmentId], status: 'active' });
    await expect(service.acknowledgeAlert(visitId, result.alert!.id,
      { expected_version: result.alert!.version, expected_status: 'ACTIVE' }, nonClinician._id.toString()))
      .rejects.toMatchObject({ statusCode: 403, code: 'OPHTHALMOLOGY_SCOPE_DENIED' });
    const acknowledged = await service.acknowledgeAlert(visitId, result.alert!.id,
      { expected_version: result.alert!.version, expected_status: 'ACTIVE', note: 'Reviewed immediately' }, userId);
    expect(acknowledged).toMatchObject({ status: 'ACKNOWLEDGED', acknowledged_by: userId, acknowledgement_note: 'Reviewed immediately', version: 2 });
    expect(await repository.getAlert(result.alert!.id)).toMatchObject({ status: 'ACKNOWLEDGED', version: 2 });
    expect((await repository.getContextByVisit(visitId))?.workflow_status).toBe('AWAITING_DOCTOR');
    await expect(service.acknowledgeAlert(visitId, result.alert!.id,
      { expected_version: result.alert!.version, expected_status: 'ACTIVE' }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    await expect(service.acknowledgeAlert(visitId, result.alert!.id,
      { expected_version: acknowledged.version, expected_status: 'ACTIVE' }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
    expect(await repository.getAlert(result.alert!.id)).toMatchObject({ status: 'ACKNOWLEDGED', version: 2 });
    expect(await AuditLogModel.countDocuments({ eventType: { $in: ['ophthalmology.intake.completed', 'ophthalmology.emergency_alert.created',
      'ophthalmology.emergency_alert.acknowledged'] } })).toBe(3);
  });

  it('rolls back completion when emergency routing has no eligible ophthalmologist', async () => {
    const intake = await service.saveIntakeDraft(visitId, draft({ onset: 'SUDDEN', emergency_criterion_codes: ['SUDDEN_VISION_LOSS'] }), userId);
    await DoctorModel.updateOne({ userId }, { $set: { status: 'INACTIVE' } });
    await expect(service.completeIntake(visitId, { expected_version: intake.version, expected_status: 'DRAFT', expected_context_version: 0 }, userId))
      .rejects.toMatchObject({ statusCode: 409, code: 'OPHTHALMOLOGY_ROUTING_REQUIRED' });
    expect(await repository.getIntakeByContext(contextId)).toMatchObject({ status: 'DRAFT', version: 0 });
    expect(await OphthalmologyAlertModel.countDocuments()).toBe(0);
    expect((await repository.getContextByVisit(visitId))?.workflow_status).toBe('CHECKED_IN');
  });

  it('blocks completion for unconfigured complaint codes and preserves the draft', async () => {
    const intake = await service.saveIntakeDraft(visitId, draft({ complaint_codes: ['UNKNOWN_COMPLAINT'] }), userId);
    await expect(service.completeIntake(visitId, { expected_version: intake.version, expected_status: 'DRAFT', expected_context_version: 0 }, userId))
      .rejects.toMatchObject({ statusCode: 400, code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
    expect(await repository.getIntakeByContext(contextId)).toMatchObject({ status: 'DRAFT', version: 0 });
  });
});
