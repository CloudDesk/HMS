import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientModel, PatientTimelineEventModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { OpdDentalExaminationRepository } from '../src/modules/opd/opd-dental-examination.repository.js';
import { OpdDentalExaminationService } from '../src/modules/opd/opd-dental-examination.service.js';
import { OpdVisitRepository } from '../src/modules/opd/opd-visit.repository.js';
import { OpdConsultationRepository } from '../src/modules/opd/opd-consultation.repository.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import {
  isPermanentFdiTooth,
  isPrimaryFdiTooth,
  isValidFdiTooth,
  saveOpdDentalExaminationSchema,
} from '../src/modules/opd/opd-dental-examination.schemas.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import {
  BillingInvoiceItemModel,
  BillingInvoiceModel,
  BillingPaymentModel,
} from '../src/modules/billing/billing.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { env } from '../src/config/env.js';

describe('Dental OPD Consultation Foundation - Backend Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let dentalService: OpdDentalExaminationService;
  let dentalRepo: OpdDentalExaminationRepository;
  let visitRepo: OpdVisitRepository;
  let consultationRepo: OpdConsultationRepository;
  let patientRepo: PatientRepository;

  const branchId = createObjectId();
  const branch2Id = createObjectId();
  const dentalDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const patientId = createObjectId();
  const doctorDocId = createObjectId();
  const doctorUserId = createObjectId();
  const doctor2UserId = createObjectId();
  const cardioDoctorUserId = createObjectId();
  const cardioDoctorDocId = createObjectId();
  const nurseUserId = createObjectId();
  const receptionistUserId = createObjectId();
  const phase7ProcedureId = createObjectId();

  let dentalVisitId: string;
  let cardioVisitId: string;
  let branch2DentalVisitId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(branch2Id), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Surgery',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
      {
        _id: new Types.ObjectId(cardioDeptId),
        name: 'Cardiology',
        code: 'CARD',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
      {
        _id: new Types.ObjectId(),
        name: 'Reception',
        code: 'RECP',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Nursing',
        code: 'NURS',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Pharmacy',
        code: 'PHAR',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Laboratory',
        code: 'LAB',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Imaging Radiology',
        code: 'RAD',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(),
        name: 'Billing Finance',
        code: 'BILL',
        branchIds: [new Types.ObjectId(branchId), new Types.ObjectId(branch2Id)],
        status: 'ACTIVE',
      },
    ]);

    await seedDatabase();

    await ServiceModel.create({
      _id: new Types.ObjectId(phase7ProcedureId),
      code: 'DENT-P7-COMPOSITE',
      name: 'Composite Restoration',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 275.5,
      status: 'ACTIVE',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-1001',
      firstName: 'Dental',
      lastName: 'Patient',
      gender: 'MALE',
      dateOfBirth: new Date('1995-05-15'),
      branchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    const nurseRole = await RoleModel.findOne({ code: 'CLINICIAN_NURSE' }).lean();
    const receptionistRole = await RoleModel.findOne({ code: 'RECEPTIONIST' }).lean();
    const { hashPassword } = await import('../src/shared/security/hash.js');
    const defaultPasswordHash = await hashPassword('Password123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(doctorUserId),
        username: 'dentist_user',
        email: 'dentist@hms.com',
        fullName: 'Dr. Dentist',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(doctor2UserId),
        username: 'other_branch_doctor',
        email: 'other_doc@hms.com',
        fullName: 'Dr. Other Branch',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        branchIds: [new Types.ObjectId(branch2Id)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(nurseUserId),
        username: 'nurse_user',
        email: 'nurse@hms.com',
        fullName: 'Nurse User',
        passwordHash: defaultPasswordHash,
        roleIds: [nurseRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(receptionistUserId),
        username: 'reception_user',
        email: 'reception@hms.com',
        fullName: 'Reception User',
        passwordHash: defaultPasswordHash,
        roleIds: [receptionistRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(cardioDoctorUserId),
        username: 'cardio_doctor_user',
        email: 'cardio_doc@hms.com',
        fullName: 'Dr. Cardio Doctor',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(cardioDeptId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(doctorDocId),
        userId: new Types.ObjectId(doctorUserId),
        doctorNumber: 'DOC-DENT-01',
        firstName: 'Doctor',
        lastName: 'Dentist',
        displayName: 'Dr. Dentist',
        specialization: 'Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(cardioDoctorDocId),
        userId: new Types.ObjectId(cardioDoctorUserId),
        doctorNumber: 'DOC-CARD-01',
        firstName: 'Doctor',
        lastName: 'Cardio',
        displayName: 'Dr. Cardio',
        specialization: 'Cardiology',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(cardioDeptId),
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(doctor2UserId),
        doctorNumber: 'DOC-OTHER-01',
        firstName: 'Other',
        lastName: 'BranchDoc',
        displayName: 'Dr. Other Branch',
        specialization: 'Dentistry',
        branchId: new Types.ObjectId(branch2Id),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: [],
      },
    ]);

    dentalRepo = new OpdDentalExaminationRepository();
    visitRepo = new OpdVisitRepository();
    consultationRepo = new OpdConsultationRepository();
    patientRepo = new PatientRepository();
    dentalService = new OpdDentalExaminationService(
      dentalRepo,
      visitRepo,
      consultationRepo,
      patientRepo,
    );

    const built = await buildApp();
    app = built.app;
    await BillingInvoiceItemModel.syncIndexes();
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await OpdDentalExaminationModel.deleteMany({});
    await OpdVisitModel.deleteMany({});
    await PatientTimelineEventModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    await BillingPaymentModel.deleteMany({});
    await BillingInvoiceItemModel.deleteMany({});
    await BillingInvoiceModel.deleteMany({});

    const dentalVisit = await OpdVisitModel.create({
      visitNumber: 'OPD-DENT-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-1001',
      patientName: 'Dental Patient',
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Dentist',
      doctorSpecialization: 'Dentistry',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'READY_FOR_CONSULTATION',
    });
    dentalVisitId = dentalVisit._id.toString();

    const cardioVisit = await OpdVisitModel.create({
      visitNumber: 'OPD-CARD-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-1001',
      patientName: 'Dental Patient',
      doctorId: new Types.ObjectId(),
      doctorName: 'Dr. Cardio',
      doctorSpecialization: 'Cardiology',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(cardioDeptId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'READY_FOR_CONSULTATION',
    });
    cardioVisitId = cardioVisit._id.toString();

    const branch2DentalVisit = await OpdVisitModel.create({
      visitNumber: 'OPD-DENT-SB01',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-1001',
      patientName: 'Dental Patient',
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Dentist',
      doctorSpecialization: 'Dentistry',
      branchId: new Types.ObjectId(branch2Id),
      departmentId: new Types.ObjectId(dentalDeptId),
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'READY_FOR_CONSULTATION',
    });
    branch2DentalVisitId = branch2DentalVisit._id.toString();
  }, 90000);

  describe('1. FDI Tooth Number & Validation Helper Tests', () => {
    it('accurately identifies permanent FDI teeth (11-18, 21-28, 31-38, 41-48)', () => {
      const validPermanent = [
        11, 12, 13, 14, 15, 16, 17, 18,
        21, 22, 23, 24, 25, 26, 27, 28,
        31, 32, 33, 34, 35, 36, 37, 38,
        41, 42, 43, 44, 45, 46, 47, 48,
      ];
      for (const tooth of validPermanent) {
        expect(isPermanentFdiTooth(tooth)).toBe(true);
        expect(isPrimaryFdiTooth(tooth)).toBe(false);
        expect(isValidFdiTooth(tooth)).toBe(true);
      }
    });

    it('accurately identifies primary FDI teeth (51-55, 61-65, 71-75, 81-85)', () => {
      const validPrimary = [
        51, 52, 53, 54, 55,
        61, 62, 63, 64, 65,
        71, 72, 73, 74, 75,
        81, 82, 83, 84, 85,
      ];
      for (const tooth of validPrimary) {
        expect(isPrimaryFdiTooth(tooth)).toBe(true);
        expect(isPermanentFdiTooth(tooth)).toBe(false);
        expect(isValidFdiTooth(tooth)).toBe(true);
      }
    });

    it('rejects invalid numbers that fall outside FDI standard', () => {
      const invalid = [0, 9, 10, 19, 20, 29, 30, 39, 40, 49, 50, 56, 59, 66, 76, 86, 90, 99, -1, 100];
      for (const tooth of invalid) {
        expect(isValidFdiTooth(tooth)).toBe(false);
      }
    });

    it('validates schema rejects dentition mismatch (e.g. tooth 11 marked as PRIMARY)', () => {
      const invalidPayload = {
        teeth: [
          {
            tooth_number: 11,
            dentition: 'PRIMARY',
            status: 'PRESENT',
            surfaces: ['OCCLUSAL'],
            conditions: ['CARIES'],
          },
        ],
      };
      const result = saveOpdDentalExaminationSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('validates schema rejects invalid tooth surface', () => {
      const invalidPayload = {
        teeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['INVALID_SURFACE'],
            conditions: ['CARIES'],
          },
        ],
      };
      const result = saveOpdDentalExaminationSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('validates schema rejects invalid pocket depth (negative or >20mm)', () => {
      const negativeResult = saveOpdDentalExaminationSchema.safeParse({
        teeth: [
          {
            tooth_number: 21,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['BUCCAL'],
            conditions: [],
            pocket_depth_mm: -2,
          },
        ],
      });
      expect(negativeResult.success).toBe(false);

      const excessiveResult = saveOpdDentalExaminationSchema.safeParse({
        teeth: [
          {
            tooth_number: 21,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['BUCCAL'],
            conditions: [],
            pocket_depth_mm: 25,
          },
        ],
      });
      expect(excessiveResult.success).toBe(false);
    });

    it('accepts valid payload with both permanent and primary teeth', () => {
      const validPayload = {
        dental_history: {
          chief_complaint: 'Tooth pain on upper right molar',
          pain_scale: 6,
          bleeding_gums: true,
          sensitivity_hot_cold_sweet: true,
          bruxism: false,
          habits: ['SMOKING'],
          medical_alerts: ['HYPERTENSION'],
        },
        soft_tissue: {
          gingiva_condition: 'MILD_GINGIVITIS',
          calculus_plaque: 'MODERATE',
          oral_mucosa: 'NORMAL',
          tongue_palate_floor: 'NORMAL',
          tmj_evaluation: 'NORMAL',
          occlusion_class: 'CLASS_I',
        },
        teeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['OCCLUSAL', 'MESIAL'],
            conditions: ['CARIES'],
            mobility: 'GRADE_I',
            pocket_depth_mm: 4,
          },
          {
            tooth_number: 55,
            dentition: 'PRIMARY',
            status: 'PRESENT',
            surfaces: ['DISTAL'],
            conditions: ['RESTORATION'],
          },
        ],
        treatment_plan_items: [
          {
            tooth_number: 16,
            procedure_name: 'Composite Restoration',
            surfaces: ['OCCLUSAL', 'MESIAL'],
            estimated_cost: 1500,
            priority: 'ROUTINE',
          },
        ],
      };
      const result = saveOpdDentalExaminationSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('2. Dental Context Validation', () => {
    it('allows Dental Examination on a Dental OPD visit', async () => {
      const exam = await dentalService.getByVisit(dentalVisitId, doctorUserId);
      expect(exam).toBeNull(); // No record yet, but context check succeeded without error
    });

    it('rejects Dental Examination on non-Dental visit (e.g. Cardiology)', async () => {
      await expect(
        dentalService.getByVisit(cardioVisitId, doctorUserId),
      ).rejects.toThrow('OPD visit is not associated with Dental department or specialization');
    });

    it('rejects save draft on non-Dental visit', async () => {
      await expect(
        dentalService.saveDraft(
          cardioVisitId,
          {
            dental_history: { chief_complaint: 'Pain' },
          },
          doctorUserId,
        ),
      ).rejects.toThrow('OPD visit is not associated with Dental department or specialization');
    });
  });

  describe('3. CRUD & Idempotent Upsert', () => {
    it('saves draft dental examination and links to consultation', async () => {
      const draft = await dentalService.saveDraft(
        dentalVisitId,
        {
          dental_history: {
            chief_complaint: 'Bleeding gums when brushing',
            bleeding_gums: true,
            pain_scale: 3,
          },
          soft_tissue: {
            gingiva_condition: 'MILD_GINGIVITIS',
          },
          teeth: [
            {
              tooth_number: 11,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['BUCCAL'],
              conditions: ['PLAQUE'],
            },
          ],
        },
        doctorUserId,
      );

      expect(draft).toBeDefined();
      expect(draft.status).toBe('DRAFT');
      expect(draft.visit_id).toBe(dentalVisitId);
      expect(draft.dental_history?.chief_complaint).toBe('Bleeding gums when brushing');
      expect(draft.dental_history?.bleeding_gums).toBe(true);
      expect(draft.teeth).toHaveLength(1);
      expect(draft.teeth[0].tooth_number).toBe(11);
      expect(draft.consultation_id).toBeTruthy();
    });

    it('retrieves existing dental examination', async () => {
      await dentalService.saveDraft(
        dentalVisitId,
        {
          dental_history: { chief_complaint: 'Initial' },
        },
        doctorUserId,
      );

      const retrieved = await dentalService.getByVisit(dentalVisitId, doctorUserId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.dental_history?.chief_complaint).toBe('Initial');
    });

    it('updates draft examination on repeated saves without duplicating records', async () => {
      await dentalService.saveDraft(
        dentalVisitId,
        {
          dental_history: { chief_complaint: 'First draft' },
        },
        doctorUserId,
      );

      const updated = await dentalService.saveDraft(
        dentalVisitId,
        {
          dental_history: { chief_complaint: 'Updated draft' },
          teeth: [
            {
              tooth_number: 21,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['DISTAL'],
              conditions: ['CARIES'],
            },
          ],
        },
        doctorUserId,
      );

      expect(updated.dental_history?.chief_complaint).toBe('Updated draft');
      expect(updated.teeth).toHaveLength(1);

      const count = await OpdDentalExaminationModel.countDocuments({
        visitId: new Types.ObjectId(dentalVisitId),
      });
      expect(count).toBe(1);
    });
  });

  describe('4. Scoping & Access Control', () => {
    it('rejects access from user belonging to another branch', async () => {
      await expect(
        dentalService.getByVisit(dentalVisitId, doctor2UserId),
      ).rejects.toThrow('OPD visit not found'); // Filtered by branch scope
    });

    it('rejects save draft from user of another branch', async () => {
      await expect(
        dentalService.saveDraft(
          dentalVisitId,
          { dental_history: { chief_complaint: 'Cross branch' } },
          doctor2UserId,
        ),
      ).rejects.toThrow('OPD visit not found');
    });
  });

  describe('5. Completion & Immutability', () => {
    it('rejects completion if no clinical findings or treatment plan items provided', async () => {
      await expect(
        dentalService.complete(dentalVisitId, {}, doctorUserId),
      ).rejects.toThrow('At least one clinical dental finding, soft tissue evaluation, tooth assessment, or treatment plan item is required');
    });

    it('completes dental examination and sets status and completedAt', async () => {
      const completed = await dentalService.complete(
        dentalVisitId,
        {
          dental_history: { chief_complaint: 'Severe toothache' },
          teeth: [
            {
              tooth_number: 46,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['OCCLUSAL'],
              conditions: ['CARIES', 'PULPITIS'],
            },
          ],
          treatment_plan_items: [
            {
              tooth_number: 46,
              procedure_name: 'Root Canal Treatment',
              priority: 'URGENT',
            },
          ],
        },
        doctorUserId,
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completed_at).toBeInstanceOf(Date);

      // Verify patient timeline event recorded
      const timelineEvent = await PatientTimelineEventModel.findOne({
        patientId: new Types.ObjectId(patientId),
        eventType: 'OPD_DENTAL_EXAMINATION_COMPLETED',
      }).lean();
      expect(timelineEvent).toBeDefined();

      // Verify audit event recorded
      const auditLog = await AuditLogModel.findOne({
        eventType: 'opd.dental_examination.completed',
      }).lean();
      expect(auditLog).toBeDefined();
    });

    it('prevents subsequent modification of completed dental examination', async () => {
      await dentalService.complete(
        dentalVisitId,
        {
          dental_history: { chief_complaint: 'Severe toothache' },
          teeth: [
            {
              tooth_number: 46,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['OCCLUSAL'],
              conditions: ['PULPITIS'],
            },
          ],
        },
        doctorUserId,
      );

      await expect(
        dentalService.saveDraft(
          dentalVisitId,
          { dental_history: { chief_complaint: 'Trying to modify completed' } },
          doctorUserId,
        ),
      ).rejects.toThrow('A completed dental examination cannot be modified');

      await expect(
        dentalService.complete(
          dentalVisitId,
          { dental_history: { chief_complaint: 'Trying to complete again' } },
          doctorUserId,
        ),
      ).rejects.toThrow('A completed dental examination cannot be modified');
    });
  });

  describe('6. HTTP API & RBAC Routes via Fastify', () => {
    it('Doctor can view and update dental examination via HTTP', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;
      expect(token).toBeTruthy();

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dental_history: { chief_complaint: 'HTTP save draft test' },
          teeth: [
            {
              tooth_number: 14,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['OCCLUSAL'],
              conditions: ['CARIES'],
            },
          ],
        },
      });
      expect(putRes.statusCode).toBe(200);
      expect(putRes.json().data.dental_history.chief_complaint).toBe('HTTP save draft test');
    });

    it('Receptionist is blocked by RBAC with 403 Forbidden', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'reception_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;
      expect(token).toBeTruthy();

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(403);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dental_history: { chief_complaint: 'Receptionist unauthorized edit' },
        },
      });
      expect(putRes.statusCode).toBe(403);
    });

    it('Nurse is blocked from editing Dental Examination with 403 Forbidden', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'nurse_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;
      expect(token).toBeTruthy();

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dental_history: { chief_complaint: 'Nurse unauthorized edit' },
        },
      });
      expect(putRes.statusCode).toBe(403);
    });

    it('Receptionist and Nurse are blocked from completing Dental Examination with 403 Forbidden', async () => {
      const loginRec = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'reception_user', password: 'Password123!' },
      });
      const recToken = loginRec.json().data?.tokens?.accessToken;

      const recCompleteRes = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination/complete`,
        headers: { authorization: `Bearer ${recToken}` },
        payload: { dental_history: { chief_complaint: 'Complete attempt' } },
      });
      expect(recCompleteRes.statusCode).toBe(403);

      const loginNurse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'nurse_user', password: 'Password123!' },
      });
      const nurseToken = loginNurse.json().data?.tokens?.accessToken;

      const nurseCompleteRes = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination/complete`,
        headers: { authorization: `Bearer ${nurseToken}` },
        payload: { dental_history: { chief_complaint: 'Complete attempt' } },
      });
      expect(nurseCompleteRes.statusCode).toBe(403);
    });

    it('Unauthenticated request without token is rejected with 401 Unauthorized', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
      });
      expect(getRes.statusCode).toBe(401);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        payload: { dental_history: { chief_complaint: 'Anonymous' } },
      });
      expect(putRes.statusCode).toBe(401);
    });
  });

  describe('7. Organization & Multi-Tenancy Isolation Tests', () => {
    it('Organization/Branch A user accessing Branch A Dental visit is allowed', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('Organization/Branch A user accessing Branch B Dental visit via GET is rejected', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${branch2DentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Organization/Branch A user accessing Branch B Dental visit via PUT is rejected', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${branch2DentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dental_history: { chief_complaint: 'Cross branch attack' } },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Organization/Branch A user accessing Branch B Dental visit via Complete is rejected', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${branch2DentalVisitId}/dental-examination/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dental_history: { chief_complaint: 'Cross branch attack' } },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Attempting to submit client-controlled organizationId, branchId, patientId, doctorId is rejected by schema', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dental_history: { chief_complaint: 'Normal complaint' },
          organizationId: createObjectId(),
          branchId: createObjectId(),
          patientId: createObjectId(),
          doctorId: createObjectId(),
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('8. Doctor Ownership & Scoping Tests', () => {
    it('Doctor from another department (Cardiology) is rejected with DEPARTMENT_ACCESS_DENIED via HTTP', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'cardio_doctor_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(403);
      expect(getRes.json().error?.code).toBe('DEPARTMENT_ACCESS_DENIED');

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dental_history: { chief_complaint: 'Cardiologist tampering dental exam' } },
      });
      expect(putRes.statusCode).toBe(403);
      expect(putRes.json().error?.code).toBe('DEPARTMENT_ACCESS_DENIED');
    });

    it('Doctor from another branch is rejected with 404 or BRANCH_ACCESS_DENIED via HTTP', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'other_branch_doctor', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect([403, 404]).toContain(res.statusCode);
    });

    it('Super Admin can view and access Dental Examination across departments', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'admin', password: 'Admin123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const res = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('9. Concurrency, Atomic Upsert & Race Condition Tests', () => {
    it('Multiple concurrent PUT requests result in exactly one Dental Examination document without race duplicates', async () => {
      const promises = [1, 2, 3, 4, 5].map((idx) =>
        dentalService.saveDraft(
          dentalVisitId,
          {
            dental_history: { chief_complaint: `Concurrent save attempt ${idx}` },
            teeth: [
              {
                tooth_number: 11,
                dentition: 'PERMANENT',
                status: 'PRESENT',
                surfaces: ['OCCLUSAL'],
                conditions: [`CARIES_${idx}`],
              },
            ],
          },
          doctorUserId,
        ),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);

      const count = await OpdDentalExaminationModel.countDocuments({
        visitId: new Types.ObjectId(dentalVisitId),
        deletedAt: null,
      });
      expect(count).toBe(1);

      const finalRecord = await dentalService.getByVisit(dentalVisitId, doctorUserId);
      expect(finalRecord).toBeDefined();
      expect(finalRecord?.teeth).toHaveLength(1);
    });
  });

  describe('10. Clinical Completeness, Audit & Immutability Verification', () => {
    it('rejects completion of an empty dental examination', async () => {
      await expect(
        dentalService.complete(
          dentalVisitId,
          { dental_history: null, soft_tissue: null, teeth: [], treatment_plan_items: [] },
          doctorUserId,
        ),
      ).rejects.toThrow('At least one clinical dental finding');
    });

    it('Doctor HTTP complete creates timeline event and audit log with correct context', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      const token = loginRes.json().data?.tokens?.accessToken;

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination/complete`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          dental_history: { chief_complaint: 'Tooth ache finished' },
          teeth: [
            {
              tooth_number: 16,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['OCCLUSAL', 'MESIAL'],
              conditions: ['CARIES'],
            },
          ],
        },
      });
      expect(completeRes.statusCode).toBe(200);
      expect(completeRes.json().data.status).toBe('COMPLETED');
      expect(completeRes.json().data.completed_at).toBeTruthy();

      const timelineEvents = await PatientTimelineEventModel.find({
        patientId: new Types.ObjectId(patientId),
        eventType: 'OPD_DENTAL_EXAMINATION_COMPLETED',
      }).lean();
      expect(timelineEvents).toHaveLength(1);
      expect(timelineEvents[0].createdBy.toString()).toBe(doctorUserId);

      const auditLogs = await AuditLogModel.find({
        eventType: 'opd.dental_examination.completed',
      }).lean();
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].metadataJson?.patientId).toBe(patientId);
      expect(auditLogs[0].metadataJson?.visitId).toBe(dentalVisitId);
      expect(auditLogs[0].metadataJson?.teeth).toBeUndefined();

      const putAfterComplete = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dental_history: { chief_complaint: 'Trying to tamper after completion' } },
      });
      expect(putAfterComplete.statusCode).toBe(400);
      expect(putAfterComplete.json().error?.code).toBe('EXAMINATION_COMPLETED');

      const getAfterComplete = await app.inject({
        method: 'GET',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getAfterComplete.statusCode).toBe(200);
      expect(getAfterComplete.json().data.status).toBe('COMPLETED');
    });
  });

  describe('11. Phase 5 Treatment Plan & Procedure Workflow Hardening Verification', () => {
    let freshDentalVisitId: string;
    let dentistToken: string;
    const restorationId = createObjectId();
    const rctId = createObjectId();

    beforeAll(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: 'dentist_user', password: 'Password123!' },
      });
      dentistToken = loginRes.json().data?.tokens?.accessToken;
      await ServiceModel.create([
        { _id: restorationId, code: 'DENT-REST-P6', name: 'Composite Restoration', serviceType: 'PROCEDURE', departmentId: dentalDeptId, standardPrice: 150, status: 'ACTIVE' },
        { _id: rctId, code: 'DENT-RCT-P6', name: 'Root Canal Treatment', serviceType: 'PROCEDURE', departmentId: dentalDeptId, standardPrice: 350, status: 'ACTIVE' },
      ]);
    });

    beforeEach(async () => {
      const visit = await OpdVisitModel.create({
        visitNumber: `DENT-P5-${Date.now()}`,
        patientId: new Types.ObjectId(patientId),
        patientNumber: 'P001',
        patientName: 'John Doe',
        doctorId: new Types.ObjectId(doctorDocId),
        doctorName: 'Dr. Dentist',
        doctorSpecialization: 'Dental Surgeon',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        visitDate: new Date(),
        checkInTime: new Date(),
        visitType: 'NEW_CONSULTATION',
        priority: 'ROUTINE',
        status: 'READY_FOR_CONSULTATION',
      });
      freshDentalVisitId = visit._id.toString();
    });


    it('Phase 6 preserves the examination, diagnosis and catalogue treatment relationship on reload', async () => {
      const headers = { authorization: `Bearer ${dentistToken}` };
      const base = `/api/opd/visits/${freshDentalVisitId}`;
      const assessment = 'K02.9 - Dental caries, unspecified [Tooth #36]\nK02.9 - Dental caries, unspecified [Tooth #16]\nK05.1 - Chronic gingivitis';
      expect((await app.inject({ method: 'PUT', url: base + '/consultation', headers, payload: { assessment } })).statusCode).toBe(200);
      const teeth = [36, 16].map((tooth_number) => ({ tooth_number, dentition: 'PERMANENT', status: 'PRESENT', conditions: ['CARIOUS'], surfaces: ['DISTAL'], mobility: 'GRADE_I', pocket_depth_mm: 4, notes: 'Clinical test finding' }));
      const saved = await app.inject({ method: 'PUT', url: base + '/dental-examination', headers, payload: {
        teeth, dental_history: { chief_complaint: 'Molar pain', bleeding_gums: false }, soft_tissue: { oral_mucosa: 'Normal' },
        treatment_plan_items: [36,16].map((tooth_number) => ({ tooth_number, service_id: restorationId, procedure_name: 'Composite Restoration', priority: 'URGENT', status: 'ACCEPTED', estimated_cost: 150, notes: 'Distal restoration' })),
      } });
      expect(saved.statusCode).toBe(200);
      // An omitted section must survive a partial draft update.
      expect((await app.inject({ method: 'PUT', url: base + '/dental-examination', headers, payload: { soft_tissue: { oral_mucosa: 'Normal mucosa' } } })).statusCode).toBe(200);
      const reloaded = (await app.inject({ method: 'GET', url: base + '/dental-examination', headers })).json().data;
      expect(reloaded.teeth).toMatchObject(teeth);
      expect(reloaded.dental_history).toMatchObject({ chief_complaint: 'Molar pain', bleeding_gums: false });
      expect(reloaded.treatment_plan_items).toHaveLength(2);
      expect(reloaded.treatment_plan_items[0]).toMatchObject({ tooth_number: 36, service_id: restorationId, priority: 'URGENT', status: 'ACCEPTED', estimated_cost: 150, notes: 'Distal restoration' });
      expect((await app.inject({ method: 'GET', url: base + '/consultation', headers })).json().data.assessment).toBe(assessment);
      expect((await app.inject({ method: 'POST', url: base + '/dental-examination/complete', headers, payload: {} })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: base + '/dental-examination', headers })).json().data.teeth).toMatchObject(teeth);
      expect((await app.inject({ method: 'PUT', url: base + '/consultation', headers, payload: { assessment: 'Changed diagnosis' } })).json().error.code).toBe('EXAMINATION_COMPLETED');
      expect((await app.inject({ method: 'PUT', url: base + '/dental-examination', headers, payload: { teeth: [] } })).json().error.code).toBe('EXAMINATION_COMPLETED');
    });

    it('Phase 6 rejects invalid diagnosis FDI tags and invalid, inactive or wrong department services', async () => {
      const headers = { authorization: `Bearer ${dentistToken}` };
      const base = `/api/opd/visits/${freshDentalVisitId}`;
      for (const tooth of ['99', '-1', '36.5', 'abc']) {
        expect((await app.inject({ method: 'PUT', url: base + '/consultation', headers, payload: { assessment: `K02.9 - Caries [Tooth #${tooth}]` } })).statusCode).toBe(400);
      }
      for (const service of [
        { code: 'P6-INACTIVE', status: 'INACTIVE', departmentId: dentalDeptId, serviceType: 'PROCEDURE' },
        { code: 'P6-CARDIO', status: 'ACTIVE', departmentId: cardioDeptId, serviceType: 'PROCEDURE' },
        { code: 'P6-LAB', status: 'ACTIVE', departmentId: dentalDeptId, serviceType: 'LAB_TEST' },
      ]) {
        const record = await ServiceModel.create({ ...service, name: service.code, standardPrice: 100 });
        const result = await app.inject({ method: 'PUT', url: base + '/dental-examination', headers, payload: { treatment_plan_items: [{ service_id: record.id, procedure_name: 'Invalid procedure' }] } });
        expect(result.json().error.code).toBe('INVALID_DENTAL_SERVICE');
      }
      for (const service_id of ['invalid', createObjectId()]) {
        expect((await app.inject({ method: 'PUT', url: base + '/dental-examination', headers, payload: { treatment_plan_items: [{ service_id, procedure_name: 'Unavailable procedure' }] } })).statusCode).toBe(400);
      }
    });

    it('Phase 6 cannot complete an explicitly cleared examination using old findings', async () => {
      await dentalService.saveDraft(freshDentalVisitId, { teeth: [{ tooth_number: 36, dentition: 'PERMANENT', status: 'PRESENT', surfaces: [], conditions: ['CARIOUS'] }] }, doctorUserId);
      await expect(dentalService.complete(freshDentalVisitId, { teeth: [], dental_history: null, soft_tissue: null, treatment_plan_items: [] }, doctorUserId)).rejects.toMatchObject({ code: 'DENTAL_FINDINGS_REQUIRED' });
      expect((await dentalService.getByVisit(freshDentalVisitId, doctorUserId))?.status).toBe('DRAFT');
    });

    it('Phase 6 repository rejects a stale draft write after completion', async () => {
      const visit = await visitRepo.getById(freshDentalVisitId, await visitRepo.resolveBranchScope(doctorUserId));
      expect(visit).toBeTruthy();
      if (!visit) throw new Error('Missing test visit');
      await dentalService.complete(freshDentalVisitId, { dental_history: { chief_complaint: 'Pain' } }, doctorUserId);
      await expect(dentalRepo.saveForVisit({ visit, status: 'DRAFT', teeth: [] }, doctorUserId)).rejects.toMatchObject({ code: 'EXAMINATION_CONFLICT' });
      expect((await dentalRepo.getByVisit(freshDentalVisitId))?.status).toBe('COMPLETED');
    });

    it('rejects invalid treatment plan priority values server-side', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          treatment_plan_items: [
            {
              procedure_name: 'Filling',
              priority: 'INVALID_PRIORITY',
            },
          ],
        },
      });

      expect(putRes.statusCode).toBe(400);
      expect(putRes.json().error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid treatment plan status lifecycle values server-side', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          treatment_plan_items: [
            {
              procedure_name: 'Extraction',
              status: 'NOT_A_REAL_STATUS',
            },
          ],
        },
      });

      expect(putRes.statusCode).toBe(400);
      expect(putRes.json().error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid FDI tooth number in treatment plan items', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          treatment_plan_items: [
            {
              tooth_number: 99,
              procedure_name: 'Invalid Tooth Procedure',
            },
          ],
        },
      });

      expect(putRes.statusCode).toBe(400);
      expect(putRes.json().error?.code).toBe('VALIDATION_ERROR');
    });

    it('persists multiple independent treatment-plan items without collapsing and supports selective update/delete', async () => {
      // 1. Save 2 independent procedures: Tooth #16 Restoration & Tooth #36 RCT
      const saveRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          dental_history: { chief_complaint: 'Pain in molar teeth' },
          treatment_plan_items: [
            {
              service_id: restorationId,
              tooth_number: 16,
              procedure_name: 'Composite Restoration',
              priority: 'ROUTINE',
              estimated_cost: 150,
              status: 'PROPOSED',
              notes: 'Distal-occlusal composite',
            },
            {
              service_id: rctId,
              tooth_number: 36,
              procedure_name: 'Root Canal Treatment',
              priority: 'URGENT',
              estimated_cost: 350,
              status: 'ACCEPTED',
              notes: 'Severe pulpitis',
            },
          ],
        },
      });

      expect(saveRes.statusCode).toBe(200);
      const items = saveRes.json().data.treatment_plan_items;
      expect(items).toHaveLength(2);
      expect(items[0].tooth_number).toBe(16);
      expect(items[0].procedure_name).toBe('Composite Restoration');
      expect(items[0].service_id).toBe(restorationId);
      expect(items[0].priority).toBe('ROUTINE');
      expect(items[0].status).toBe('PROPOSED');

      expect(items[1].tooth_number).toBe(36);
      expect(items[1].procedure_name).toBe('Root Canal Treatment');
      expect(items[1].service_id).toBe(rctId);
      expect(items[1].priority).toBe('URGENT');
      expect(items[1].status).toBe('ACCEPTED');

      const item1Id = items[0].id;
      const item2Id = items[1].id;
      expect(item1Id).toBeTruthy();
      expect(item2Id).toBeTruthy();
      expect(item1Id).not.toBe(item2Id);

      // 2. Update item 1 status to IN_PROGRESS while keeping item 2 intact
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          treatment_plan_items: [
            {
              id: item1Id,
              service_id: restorationId,
              tooth_number: 16,
              procedure_name: 'Composite Restoration',
              priority: 'ROUTINE',
              estimated_cost: 150,
              status: 'IN_PROGRESS',
              notes: 'Distal-occlusal composite started',
            },
            {
              id: item2Id,
              service_id: rctId,
              tooth_number: 36,
              procedure_name: 'Root Canal Treatment',
              priority: 'URGENT',
              estimated_cost: 350,
              status: 'ACCEPTED',
              notes: 'Severe pulpitis',
            },
          ],
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const updatedItems = updateRes.json().data.treatment_plan_items;
      expect(updatedItems).toHaveLength(2);
      expect(updatedItems[0].status).toBe('IN_PROGRESS');
      expect(updatedItems[1].status).toBe('ACCEPTED');

      // 3. Delete item 1 and verify item 2 remains intact
      const deleteRes = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${freshDentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          treatment_plan_items: [
            {
              id: item2Id,
              service_id: rctId,
              tooth_number: 36,
              procedure_name: 'Root Canal Treatment',
              priority: 'URGENT',
              estimated_cost: 350,
              status: 'ACCEPTED',
              notes: 'Severe pulpitis',
            },
          ],
        },
      });

      expect(deleteRes.statusCode).toBe(200);
      const remainingItems = deleteRes.json().data.treatment_plan_items;
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0].tooth_number).toBe(36);
      expect(remainingItems[0].procedure_name).toBe('Root Canal Treatment');
    });
  });

  describe('12. Phase 7 Dental billing integration', () => {
    let dentistToken: string;
    let billingToken: string;
    let branch2BillingToken: string;
    let nurseToken: string;
    let receptionistToken: string;
    let adminToken: string;

    const accessTokenFor = async (username: string) => {
      const user = await UserModel.findOne({ username }).lean();
      if (!user) throw new Error(`Expected seeded user ${username}`);
      return signJwt(
        { sub: user._id.toString(), username: user.username },
        env.auth.accessTokenSecret,
        env.auth.accessTokenTtlSeconds,
      );
    };

    beforeAll(async () => {
      dentistToken = await accessTokenFor('dentist_user');
      billingToken = await accessTokenFor('billing_mb01');
      branch2BillingToken = await accessTokenFor('billing');
      nurseToken = await accessTokenFor('nurse_user');
      receptionistToken = await accessTokenFor('reception_user');
      adminToken = await accessTokenFor('admin');
    });

    const saveTreatment = async (
      status: 'PROPOSED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED' = 'PROPOSED',
      serviceId: string | null = phase7ProcedureId,
    ) => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {
          teeth: [
            {
              tooth_number: 36,
              dentition: 'PERMANENT',
              status: 'PRESENT',
              surfaces: ['DISTAL'],
              conditions: ['CARIOUS'],
            },
          ],
          treatment_plan_items: [
            {
              service_id: serviceId,
              tooth_number: 36,
              procedure_name: 'Client supplied procedure name',
              estimated_cost: 1,
              priority: 'ROUTINE',
              status,
              notes: 'Clinical plan note',
            },
          ],
        },
      });
      expect(response.statusCode).toBe(200);
      return response.json().data.treatment_plan_items[0].id as string;
    };

    const billingUrl = (itemId: string, visitId = dentalVisitId) =>
      `/api/billing/dental/visits/${visitId}/treatment-items/${itemId}/invoice`;

    it('creates an existing HMS invoice from a persisted catalogue treatment using the authoritative price and source reference', async () => {
      const itemId = await saveTreatment('ACCEPTED');
      const response = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        patient_id: patientId,
        visit_id: dentalVisitId,
        branch_id: branchId,
        total_amount: 275.5,
        balance_amount: 275.5,
        status: 'DRAFT',
        items: [
          {
            service_id: phase7ProcedureId,
            service_name: 'Composite Restoration',
            service_type: 'PROCEDURE',
            originating_order_id: itemId,
            unit_price: 275.5,
          },
        ],
      });
      const states = await app.inject({
        method: 'GET',
        url: `/api/billing/dental/visits/${dentalVisitId}/treatment-items`,
        headers: { authorization: `Bearer ${billingToken}` },
      });
      expect(states.statusCode).toBe(200);
      expect(states.json().data[0]).toMatchObject({
        treatment_item_id: itemId,
        invoice_id: response.json().data.id,
        invoice_status: 'DRAFT',
        unit_price: 275.5,
      });
      expect(
        await AuditLogModel.countDocuments({
          eventType: 'billing.invoice.created',
          'metadataJson.dentalTreatmentItemId': itemId,
        }),
      ).toBe(1);
    });

    it('rejects unauthenticated, doctor, nurse and receptionist mutation attempts while preserving SUPER_ADMIN access', async () => {
      const itemId = await saveTreatment();
      const attempts = [
        undefined,
        dentistToken,
        nurseToken,
        receptionistToken,
      ];
      for (const token of attempts) {
        const response = await app.inject({
          method: 'POST',
          url: billingUrl(itemId),
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
          payload: {},
        });
        expect(response.statusCode).toBe(token ? 403 : 401);
      }

      const adminResponse = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(adminResponse.statusCode).toBe(201);
    });

    it('rejects cross-branch access and rejects client attempts to spoof financial or relational context', async () => {
      const itemId = await saveTreatment();
      const crossBranch = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${branch2BillingToken}` },
        payload: {},
      });
      expect(crossBranch.statusCode).toBe(404);

      const otherPatientId = new Types.ObjectId();
      await PatientModel.create({
        _id: otherPatientId,
        patientNumber: 'P-DENT-P7-OTHER',
        firstName: 'Other',
        lastName: 'Dental Patient',
        gender: 'FEMALE',
        dateOfBirth: new Date('1992-04-12'),
        branchId: new Types.ObjectId(branchId),
        status: 'ACTIVE',
      });
      const otherVisit = await OpdVisitModel.create({
        visitNumber: 'OPD-DENT-P7-OTHER',
        patientId: otherPatientId,
        patientNumber: 'P-DENT-P7-OTHER',
        patientName: 'Other Dental Patient',
        doctorId: new Types.ObjectId(doctorDocId),
        doctorName: 'Dr. Dentist',
        doctorSpecialization: 'Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        visitDate: new Date(),
        checkInTime: new Date(),
        visitType: 'NEW_CONSULTATION',
        priority: 'ROUTINE',
        status: 'READY_FOR_CONSULTATION',
      });
      await OpdDentalExaminationModel.create({
        visitId: otherVisit._id,
        patientId: otherPatientId,
        patientNumber: 'P-DENT-P7-OTHER',
        patientName: 'Other Dental Patient',
        doctorId: new Types.ObjectId(doctorDocId),
        doctorName: 'Dr. Dentist',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        treatmentPlanItems: [],
      });
      const crossPatient = await app.inject({
        method: 'POST',
        url: billingUrl(itemId, otherVisit._id.toString()),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(crossPatient.statusCode).toBe(404);
      expect(crossPatient.json().error.code).toBe(
        'DENTAL_TREATMENT_ITEM_NOT_FOUND',
      );

      const spoofed = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {
          patient_id: createObjectId(),
          branch_id: createObjectId(),
          department_id: createObjectId(),
          doctor_id: createObjectId(),
          price: 0.01,
          currency: 'SPOOF',
        },
      });
      expect(spoofed.statusCode).toBe(400);
      expect(spoofed.json().error.code).toBe('VALIDATION_ERROR');
      expect(await BillingInvoiceModel.countDocuments()).toBe(0);
    });

    it('rejects custom, declined, cancelled, missing, inactive and wrong-department services', async () => {
      for (const status of ['DECLINED', 'CANCELLED'] as const) {
        const itemId = await saveTreatment(status);
        const response = await app.inject({
          method: 'POST',
          url: billingUrl(itemId),
          headers: { authorization: `Bearer ${billingToken}` },
          payload: {},
        });
        expect(response.statusCode).toBe(409);
        await OpdDentalExaminationModel.deleteMany({});
      }

      const customId = await saveTreatment('PROPOSED', null);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: billingUrl(customId),
            headers: { authorization: `Bearer ${billingToken}` },
            payload: {},
          })
        ).json().error.code,
      ).toBe('DENTAL_SERVICE_REQUIRED');
      await OpdDentalExaminationModel.deleteMany({});

      const inactiveId = await saveTreatment();
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { status: 'INACTIVE' } },
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: billingUrl(inactiveId),
            headers: { authorization: `Bearer ${billingToken}` },
            payload: {},
          })
        ).json().error.code,
      ).toBe('INVALID_DENTAL_SERVICE');
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { status: 'ACTIVE' } },
      );
      await OpdDentalExaminationModel.deleteMany({});

      const missingServiceItemId = await saveTreatment();
      await OpdDentalExaminationModel.updateOne(
        { 'treatmentPlanItems._id': missingServiceItemId },
        {
          $set: {
            'treatmentPlanItems.$.serviceId': new Types.ObjectId(),
          },
        },
      );
      expect(
        (
          await app.inject({
            method: 'POST',
            url: billingUrl(missingServiceItemId),
            headers: { authorization: `Bearer ${billingToken}` },
            payload: {},
          })
        ).json().error.code,
      ).toBe('INVALID_DENTAL_SERVICE');
      await OpdDentalExaminationModel.deleteMany({});

      const wrongDepartmentService = await ServiceModel.create({
        code: `DENT-P7-WRONG-${Date.now()}`,
        name: 'Wrong Department Procedure',
        serviceType: 'PROCEDURE',
        departmentId: new Types.ObjectId(cardioDeptId),
        standardPrice: 999,
        status: 'ACTIVE',
      });
      await OpdDentalExaminationModel.create({
        visitId: dentalVisitId,
        patientId,
        patientNumber: 'P-1001',
        patientName: 'Dental Patient',
        doctorId: doctorDocId,
        doctorName: 'Dr. Dentist',
        branchId,
        departmentId: dentalDeptId,
        treatmentPlanItems: [
          {
            serviceId: wrongDepartmentService.id,
            procedureName: wrongDepartmentService.name,
            status: 'PROPOSED',
          },
        ],
      });
      const examination = await OpdDentalExaminationModel.findOne().lean();
      const invalidItemId = examination?.treatmentPlanItems[0]?._id?.toString();
      if (!invalidItemId) {
        throw new Error('Expected wrong-department treatment item id');
      }
      const wrongDepartment = await app.inject({
        method: 'POST',
        url: billingUrl(invalidItemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(wrongDepartment.json().error.code).toBe('INVALID_DENTAL_SERVICE');
    });

    it('rejects deleted, non-procedure and unrelated treatment references without creating an audit event', async () => {
      await saveTreatment();
      const unrelatedItem = await app.inject({
        method: 'POST',
        url: billingUrl(createObjectId()),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(unrelatedItem.statusCode).toBe(404);
      expect(unrelatedItem.json().error.code).toBe(
        'DENTAL_TREATMENT_ITEM_NOT_FOUND',
      );

      const deletedServiceItemId = await saveTreatment();
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { deletedAt: new Date() } },
      );
      const deletedService = await app.inject({
        method: 'POST',
        url: billingUrl(deletedServiceItemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(deletedService.statusCode).toBe(409);
      expect(deletedService.json().error.code).toBe('INVALID_DENTAL_SERVICE');
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { deletedAt: null } },
      );
      await OpdDentalExaminationModel.deleteMany({});

      const wrongTypeItemId = await saveTreatment();
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { serviceType: 'GENERAL' } },
      );
      const wrongType = await app.inject({
        method: 'POST',
        url: billingUrl(wrongTypeItemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(wrongType.statusCode).toBe(409);
      expect(wrongType.json().error.code).toBe('INVALID_DENTAL_SERVICE');
      await ServiceModel.updateOne(
        { _id: phase7ProcedureId },
        { $set: { serviceType: 'PROCEDURE' } },
      );

      expect(await BillingInvoiceModel.countDocuments()).toBe(0);
      expect(
        await AuditLogModel.countDocuments({
          eventType: 'billing.invoice.created',
        }),
      ).toBe(0);
    });

    it('rejects a non-Dental visit even if a malformed Dental examination record exists', async () => {
      const cardioProcedure = await ServiceModel.create({
        code: `CARD-P7-${Date.now()}`,
        name: 'Cardiology Procedure',
        serviceType: 'PROCEDURE',
        departmentId: new Types.ObjectId(cardioDeptId),
        standardPrice: 500,
        status: 'ACTIVE',
      });
      const malformed = await OpdDentalExaminationModel.create({
        visitId: cardioVisitId,
        patientId,
        patientNumber: 'P-1001',
        patientName: 'Dental Patient',
        doctorId: cardioDoctorDocId,
        doctorName: 'Dr. Cardio Doctor',
        branchId,
        departmentId: cardioDeptId,
        treatmentPlanItems: [
          {
            serviceId: cardioProcedure._id,
            procedureName: cardioProcedure.name,
            status: 'PROPOSED',
          },
        ],
      });
      const itemId = malformed.treatmentPlanItems[0]?._id?.toString();
      if (!itemId) throw new Error('Expected malformed treatment item id');

      const response = await app.inject({
        method: 'POST',
        url: billingUrl(itemId, cardioVisitId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('NOT_DENTAL_VISIT');
      expect(await BillingInvoiceModel.countDocuments()).toBe(0);
    });

    it('rolls back invoice creation when invoice-item validation fails', async () => {
      const invalidItemService = await ServiceModel.create({
        code: `DENT-P7-ROLLBACK-${Date.now()}`,
        name: '   ',
        serviceType: 'PROCEDURE',
        departmentId: new Types.ObjectId(dentalDeptId),
        standardPrice: 125,
        status: 'ACTIVE',
      });
      const itemId = await saveTreatment(
        'PROPOSED',
        invalidItemService._id.toString(),
      );

      const response = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(response.statusCode).toBe(400);
      expect(await BillingInvoiceModel.countDocuments()).toBe(0);
      expect(await BillingInvoiceItemModel.countDocuments()).toBe(0);
      expect(
        await AuditLogModel.countDocuments({
          eventType: 'billing.invoice.created',
        }),
      ).toBe(0);
    });

    it('is idempotent for repeated and simultaneous billing requests', async () => {
      const itemId = await saveTreatment('COMPLETED');
      const request = () =>
        app.inject({
          method: 'POST',
          url: billingUrl(itemId),
          headers: { authorization: `Bearer ${billingToken}` },
          payload: {},
        });
      const [first, second] = await Promise.all([request(), request()]);
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(first.json().data.id).toBe(second.json().data.id);
      expect(await BillingInvoiceModel.countDocuments()).toBe(1);
      expect(await BillingInvoiceItemModel.countDocuments()).toBe(1);

      const repeated = await request();
      expect(repeated.json().data.id).toBe(first.json().data.id);
      expect(await BillingInvoiceModel.countDocuments()).toBe(1);
    });

    it('bills a completed examination without mutating its locked clinical state', async () => {
      const itemId = await saveTreatment('PROPOSED');
      const complete = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${dentalVisitId}/dental-examination/complete`,
        headers: { authorization: `Bearer ${dentistToken}` },
        payload: {},
      });
      expect(complete.statusCode).toBe(200);
      const before = await OpdDentalExaminationModel.findOne().lean();

      const billed = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      expect(billed.statusCode).toBe(201);
      const after = await OpdDentalExaminationModel.findOne().lean();
      expect(after?.status).toBe('COMPLETED');
      expect(after?.updatedAt).toEqual(before?.updatedAt);
      expect(after?.treatmentPlanItems).toEqual(before?.treatmentPlanItems);
    });

    it('continues through the existing invoice payment and receipt workflow', async () => {
      const itemId = await saveTreatment();
      const created = await app.inject({
        method: 'POST',
        url: billingUrl(itemId),
        headers: { authorization: `Bearer ${billingToken}` },
        payload: {},
      });
      const invoiceId = created.json().data.id as string;
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/billing/invoices/${invoiceId}`,
            headers: { authorization: `Bearer ${billingToken}` },
            payload: { status: 'PENDING' },
          })
        ).statusCode,
      ).toBe(200);
      const payment = await app.inject({
        method: 'POST',
        url: `/api/billing/invoices/${invoiceId}/payments`,
        headers: { authorization: `Bearer ${billingToken}` },
        payload: { amount: 275.5, payment_method: 'CASH' },
      });
      expect(payment.statusCode).toBe(201);
      expect(payment.json().data.invoice.status).toBe('PAID');
      const receipt = await app.inject({
        method: 'GET',
        url: `/api/billing/payments/${payment.json().data.payment.id}/receipt`,
        headers: { authorization: `Bearer ${billingToken}` },
      });
      expect(receipt.statusCode).toBe(200);
      expect(receipt.json().data.invoice.id).toBe(invoiceId);
      expect(
        await AuditLogModel.countDocuments({
          eventType: {
            $in: ['billing.payment.collected', 'billing.receipt.generated'],
          },
        }),
      ).toBe(2);
    });
  });
});
