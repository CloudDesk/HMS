import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { NotificationRepository } from '../notifications/notification.repository.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdFollowUpModel } from '../opd/opd-follow-up.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import { PatientModel } from '../patients/patient.model.js';
import { UserModel } from '../users/user.model.js';
import { OphthalmologyClinicalReviewModel, OphthalmologyOpticalPrescriptionModel } from './ophthalmology-review.model.js';
import { OphthalmologyConfigurationModel, OphthalmologyContextModel } from './ophthalmology.model.js';
import { OphthalmologyRepository } from './ophthalmology.repository.js';
import { OphthalmologyService } from './ophthalmology.service.js';

describe('Ophthalmology Phase 8 doctor review and prescriptions', () => {
  let mongo: MongoMemoryReplSet; const repository = new OphthalmologyRepository();
  const service = new OphthalmologyService(repository, new OpdVisitRepository(), new NotificationService(new NotificationRepository()));
  let visitId: string; let userId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
    await Promise.all([OphthalmologyClinicalReviewModel.init(), OphthalmologyOpticalPrescriptionModel.init(),
      OphthalmologyContextModel.init(), OphthalmologyConfigurationModel.init(), OpdVisitModel.init(), OpdConsultationModel.init()]);
  });
  beforeEach(async () => {
    vi.restoreAllMocks(); await mongoose.connection.db?.dropDatabase();
    await Promise.all([OphthalmologyClinicalReviewModel.syncIndexes(), OphthalmologyOpticalPrescriptionModel.syncIndexes(),
      OphthalmologyContextModel.syncIndexes(), OpdVisitModel.syncIndexes(), OpdConsultationModel.syncIndexes()]);
    const branch = await BranchModel.create({ code: 'OPH-P8', name: 'Ophthalmology Phase 8', status: 'ACTIVE' });
    const department = await DepartmentModel.create({ code: 'OPHTHALMOLOGY', name: 'Ophthalmology', branchIds: [branch._id], status: 'ACTIVE', isClinical: true });
    const user = await UserModel.create({ username: 'oph.phase8', email: 'oph.phase8@example.test', fullName: 'Phase Eight Doctor', passwordHash: 'not-used',
      roleIds: [], branchIds: [branch._id], departmentIds: [department._id], status: 'active' }); userId = user._id.toString();
    const doctor = await DoctorModel.create({ doctorNumber: 'OPH-P8-DOC', userId: user._id, firstName: 'Phase', lastName: 'Eight', displayName: 'Dr Phase Eight',
      specialization: 'Ophthalmology', branchId: branch._id, departmentId: department._id, status: 'ACTIVE', availability: [] });
    const patient = await PatientModel.create({ patientNumber: 'P8-001', firstName: 'Review', lastName: 'Patient', dateOfBirth: new Date('1980-01-01'),
      gender: 'UNKNOWN', status: 'ACTIVE' });
    const visit = await OpdVisitModel.create({ visitNumber: 'OPH-P8-001', queueTokenNumber: 1, patientId: patient._id, patientNumber: patient.patientNumber,
      patientName: 'Review Patient', doctorId: doctor._id, doctorName: doctor.displayName, doctorSpecialization: doctor.specialization,
      branchId: branch._id, departmentId: department._id, visitDate: new Date(), checkInTime: new Date(), visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE', status: 'IN_CONSULTATION', version: 0 }); visitId = visit._id.toString();
    const config = await OphthalmologyConfigurationModel.create({ branchId: branch._id, type: 'CLINICAL_THRESHOLD', code: 'P8-CLINICAL',
      name: 'Phase 8 clinical options', revision: 1, status: 'ACTIVE', values: { lens_types: ['SINGLE_VISION', 'PROGRESSIVE'],
        lens_materials: ['CR39', 'POLYCARBONATE'], coating_codes: ['ANTI_REFLECTIVE', 'UV'] }, version: 0, createdBy: user._id, updatedBy: user._id });
    await OphthalmologyContextModel.create({ visitId: visit._id, patientId: patient._id, branchId: branch._id, departmentId: department._id,
      doctorId: doctor._id, visitSubtype: 'NEW_CONSULTATION', affectedEye: 'OU', workflowStatus: 'AWAITING_DOCTOR',
      configurationVersionId: config._id, workflowProfileVersionId: new Types.ObjectId(), version: 0, createdBy: user._id, updatedBy: user._id });
    await OpdConsultationModel.create({ visitId: visit._id, patientId: patient._id, patientNumber: patient.patientNumber, patientName: 'Review Patient',
      doctorId: doctor._id, doctorName: doctor.displayName, status: 'DRAFT', version: 0, diagnoses: [{ code: '9B10', display: 'Cataract',
        codingSystem: 'ICD-11', type: 'PRIMARY', laterality: 'OU', status: 'CONFIRMED', differential: false }],
      treatmentPlan: 'Discuss options', createdBy: user._id, updatedBy: user._id });
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  const review = () => ({ expected_version: 0, clinical_summary: 'Bilateral cataract reviewed with the patient', treatment_plans: [{
    diagnosis_code: '9B10', diagnosis_laterality: 'OU' as const, treatment: 'Monitor and discuss surgery', category: 'OBSERVATION',
    priority: 'ROUTINE' as const, status: 'ACTIVE' as const, clinical_order_ids: [],
  }] });
  const optical = () => ({ expected_version: 0, prescription_type: 'DISTANCE' as const,
    power: { OD: { sphere: -1, cylinder: -0.5, axis: 90 }, OS: { sphere: -1.25 } },
    pupillary_distance: { format: 'BINOCULAR' as const, binocular: 62 }, lens_type: 'SINGLE_VISION', material: 'CR39',
    coating_codes: ['ANTI_REFLECTIVE'], usage_instructions: 'Use for distance vision', valid_until: '2027-10-15T00:00:00.000Z', review_date: null });

  it('persists a diagnosis-linked treatment plan and exposes the consolidated doctor review', async () => {
    const saved = await service.saveClinicalReviewDraft(visitId, review(), userId);
    expect(saved).toMatchObject({ status: 'DRAFT', current_clinical_version: 1,
      current: { treatment_plans: [{ diagnosis_code: '9B10', diagnosis_laterality: 'OU' }] } });
    const projection = await service.getDoctorReview(visitId, userId);
    expect(projection).toMatchObject({ context: { visit_id: visitId }, clinical_review: { id: saved.id } });
    expect(await AuditLogModel.countDocuments({ eventType: 'ophthalmology.clinical_review.draft_saved' })).toBe(1);
  });

  it('rejects diagnosis mismatch and stale concurrent clinical review updates', async () => {
    const wrong = review(); wrong.treatment_plans[0]!.diagnosis_code = 'WRONG';
    await expect(service.saveClinicalReviewDraft(visitId, wrong, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DIAGNOSIS_MISMATCH' });
    const outcomes = await Promise.allSettled([0, 1].map(() => service.saveClinicalReviewDraft(visitId, review(), userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  });

  it('links a shared follow-up without a branch field and rejects foreign or deleted references', async () => {
    const consultation = await OpdConsultationModel.findOne({ visitId }).lean();
    if (!consultation) throw new Error('Missing consultation fixture');
    const followUp = await OpdFollowUpModel.create({ visitId, consultationId: consultation._id,
      patientId: consultation.patientId, patientNumber: consultation.patientNumber, patientName: consultation.patientName,
      originatingDoctorId: consultation.doctorId, originatingDoctorName: consultation.doctorName,
      status: 'DRAFT', reminderType: 'NONE' });
    expect(followUp.toObject()).not.toHaveProperty('branchId');
    const body = { ...review(), treatment_plans: review().treatment_plans.map((plan) => ({ ...plan, follow_up_id: followUp.id })) };
    const saved = await service.saveClinicalReviewDraft(visitId, body, userId);
    expect(saved.current.treatment_plans[0]?.follow_up_id).toBe(followUp.id);
    const update = { ...body, expected_version: saved.version };
    for (const invalid of [
      { visitId: new Types.ObjectId(), patientId: consultation.patientId, deletedAt: null },
      { visitId: new Types.ObjectId(visitId), patientId: new Types.ObjectId(), deletedAt: null },
      { visitId: new Types.ObjectId(visitId), patientId: consultation.patientId, deletedAt: new Date() },
    ]) {
      await OpdFollowUpModel.updateOne({ _id: followUp._id }, { $set: invalid });
      await expect(service.saveClinicalReviewDraft(visitId, update, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_REFERENCE_MISMATCH' });
      expect((await repository.getClinicalReviewByVisit(visitId))?.version).toBe(saved.version);
    }
  });

  it('versions and approves a separately governed optical prescription', async () => {
    const draft = await service.saveOpticalPrescriptionDraft(visitId, optical(), userId);
    const outsider = await UserModel.create({ username: 'oph.phase8.non-doctor', email: 'oph.phase8.non-doctor@example.test', fullName: 'Non Doctor',
      passwordHash: 'not-used', roleIds: [], branchIds: [draft.branch_id], departmentIds: [draft.department_id], status: 'active' });
    await expect(service.approveOpticalPrescription(visitId, { expected_version: draft.version, expected_status: 'DRAFT' }, outsider._id.toString()))
      .rejects.toMatchObject({ code: 'OPHTHALMOLOGY_DOCTOR_REQUIRED' });
    const outcomes = await Promise.allSettled([0, 1].map(() => service.approveOpticalPrescription(visitId,
      { expected_version: draft.version, expected_status: 'DRAFT' }, userId)));
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const approved = outcomes.find((item) => item.status === 'fulfilled')!;
    if (approved.status !== 'fulfilled') throw new Error('Expected one approval');
    expect(approved.value).toMatchObject({ status: 'APPROVED', current: { status: 'APPROVED', approver_user_id: userId } });
    await expect(service.saveOpticalPrescriptionDraft(visitId, optical(), userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_VERSION_CONFLICT' });
  });

  it('enforces optical conditional/configuration validation and transaction rollback', async () => {
    const invalid = optical(); invalid.power.OD = { sphere: -1, cylinder: -0.5 } as typeof invalid.power.OD;
    await expect(service.saveOpticalPrescriptionDraft(visitId, invalid, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED' });
    const badLens = optical(); badLens.lens_type = 'UNCONFIGURED';
    await expect(service.saveOpticalPrescriptionDraft(visitId, badLens, userId)).rejects.toMatchObject({ code: 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED' });
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.saveOpticalPrescriptionDraft(visitId, optical(), userId)).rejects.toThrow('audit unavailable');
    expect(await OphthalmologyOpticalPrescriptionModel.countDocuments()).toBe(0);
  });
});
