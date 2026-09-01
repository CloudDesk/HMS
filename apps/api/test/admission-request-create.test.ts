import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Types, type ClientSession } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientModel, PatientTimelineEventModel } from '../src/modules/patients/patient.model.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { OpdReferralModel } from '../src/modules/opd/opd-referral.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { OpdVisitRepository } from '../src/modules/opd/opd-visit.repository.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { InpatientAdmissionModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import type { CreateAdmissionRequestDTO } from '../src/modules/inpatient-admissions/inpatient-admission.types.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import type { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';

type SeededAdmissionContext = {
  actorId: string;
  branchId: string;
  departmentId: string;
  doctorId: string;
  patientId: string;
  service: InpatientAdmissionService;
};

type FakeSession = {
  ended: boolean;
  withTransaction: (callback: () => Promise<void>) => Promise<void>;
  endSession: () => Promise<void>;
};

const id = () => new Types.ObjectId();

const createService = () => {
  const sequenceService = new SequenceService();
  const repository = new InpatientAdmissionRepository(sequenceService);
  const patients = new PatientService(
    new PatientRepository(),
    {} as PatientDocumentStorageService,
    sequenceService,
  );

  return new InpatientAdmissionService(
    repository,
    {} as ConstructorParameters<typeof InpatientAdmissionService>[1],
    patients,
    {} as ConstructorParameters<typeof InpatientAdmissionService>[3],
    new OpdVisitRepository(),
    {} as ConstructorParameters<typeof InpatientAdmissionService>[5],
    {} as ConstructorParameters<typeof InpatientAdmissionService>[6],
    {} as ConstructorParameters<typeof InpatientAdmissionService>[7],
    {} as ConstructorParameters<typeof InpatientAdmissionService>[8],
  );
};

const seedAdmissionContext = async (): Promise<SeededAdmissionContext> => {
  const roleId = id();
  const actorId = id();
  const branchId = id();
  const departmentId = id();
  const doctorId = id();
  const patientId = id();

  await Promise.all([
    RoleModel.create({ _id: roleId, code: 'SUPER_ADMIN', name: 'Super Admin', type: 'system', permissionIds: [], status: 'active' }),
    BranchModel.create({ _id: branchId, code: 'MB', name: 'Main Branch', status: 'ACTIVE' }),
    DepartmentModel.create({
      _id: departmentId,
      code: 'ENT',
      name: 'ENT',
      branchIds: [branchId],
      status: 'ACTIVE',
      isClinical: true,
      createdBy: actorId,
      updatedBy: actorId,
    }),
    UserModel.create({
      _id: actorId,
      username: 'admission-admin',
      email: 'admission-admin@example.test',
      fullName: 'Admission Admin',
      passwordHash: 'unused',
      roleIds: [roleId],
      branchIds: [branchId],
      departmentIds: [],
      status: 'active',
    }),
    PatientModel.create({
      _id: patientId,
      patientNumber: 'HMS-2026-000016',
      firstName: 'Anushya',
      lastName: 'George',
      dateOfBirth: new Date('2000-06-07T00:00:00.000Z'),
      gender: 'FEMALE',
      phone: '9876543223',
      registrationBranchId: branchId,
      status: 'ACTIVE',
    }),
    DoctorModel.create({
      _id: doctorId,
      doctorNumber: 'DR-TEST-001',
      firstName: 'Tendai',
      lastName: 'Chikore',
      displayName: 'Dr. Tendai Chikore',
      specialization: 'ENT',
      branchId,
      departmentId,
      status: 'ACTIVE',
      availability: [],
    }),
  ]);

  return {
    actorId: actorId.toString(),
    branchId: branchId.toString(),
    departmentId: departmentId.toString(),
    doctorId: doctorId.toString(),
    patientId: patientId.toString(),
    service: createService(),
  };
};

const directPayload = (context: SeededAdmissionContext): CreateAdmissionRequestDTO => ({
  patient_id: context.patientId,
  branch_id: context.branchId,
  department_id: context.departmentId,
  recommending_doctor_id: context.doctorId,
  source_type: 'DIRECT',
  source_id: null,
  admission_type: 'INPATIENT',
  priority: 'ROUTINE',
  reason: 'Patient requires inpatient admission.',
  notes: null,
});

describe('InpatientAdmissionService.createRequest', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 120_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('creates a Direct Admission request and records timeline/audit side effects', async () => {
    const context = await seedAdmissionContext();

    const result = await context.service.createRequest(directPayload(context), context.actorId, {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(result.patient_number).toBe('HMS-2026-000016');
    expect(result.source_type).toBe('DIRECT');
    expect(result.source_id).toBeNull();
    expect(result.status).toBe('PENDING_VALIDATION');
    expect(await PatientTimelineEventModel.countDocuments({ patientId: context.patientId, eventType: 'ADMISSION_REQUEST_CREATED' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'admissions.request.created' })).toBe(1);
  });

  it('creates an admission request from an existing OPD visit source', async () => {
    const context = await seedAdmissionContext();
    const visit = await OpdVisitModel.create({
      visitNumber: 'OPD-TEST-001',
      patientId: context.patientId,
      patientNumber: 'HMS-2026-000016',
      patientName: 'Anushya George',
      doctorId: context.doctorId,
      doctorName: 'Dr. Tendai Chikore',
      doctorSpecialization: 'ENT',
      branchId: context.branchId,
      departmentId: context.departmentId,
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'URGENT',
      status: 'COMPLETED',
      reason: 'OPD recommendation',
      notes: 'Needs admission',
      createdBy: context.actorId,
      updatedBy: context.actorId,
    });

    const result = await context.service.createRequest({
      ...directPayload(context),
      source_type: 'OPD_VISIT',
      source_id: visit._id.toString(),
      priority: 'URGENT',
      reason: 'OPD recommendation',
    }, context.actorId, {});

    expect(result.source_type).toBe('OPD_VISIT');
    expect(result.source_id).toBe(visit._id.toString());
    expect(result.source_reference).toBe('OPD-TEST-001');
  });

  it('creates an admission request from an existing submitted referral source', async () => {
    const context = await seedAdmissionContext();
    const visit = await OpdVisitModel.create({
      visitNumber: 'OPD-TEST-002',
      patientId: context.patientId,
      patientNumber: 'HMS-2026-000016',
      patientName: 'Anushya George',
      doctorId: context.doctorId,
      doctorName: 'Dr. Tendai Chikore',
      doctorSpecialization: 'ENT',
      branchId: context.branchId,
      departmentId: context.departmentId,
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'COMPLETED',
      reason: 'Referral recommendation',
      notes: 'Needs admission',
      createdBy: context.actorId,
      updatedBy: context.actorId,
    });
    const referral = await OpdReferralModel.create({
      visitId: visit._id,
      consultationId: id(),
      patientId: context.patientId,
      patientNumber: 'HMS-2026-000016',
      patientName: 'Anushya George',
      referringDoctorId: context.doctorId,
      referringDoctorName: 'Dr. Tendai Chikore',
      referralType: 'INTERNAL',
      specialty: 'ENT admission',
      priority: 'ROUTINE',
      reason: 'Referral recommendation',
      clinicalSummary: 'Needs admission',
      status: 'SUBMITTED',
      submittedAt: new Date(),
      createdBy: context.actorId,
      updatedBy: context.actorId,
    });

    const result = await context.service.createRequest({
      ...directPayload(context),
      source_type: 'REFERRAL',
      source_id: referral._id.toString(),
      reason: 'Referral recommendation',
    }, context.actorId, {});

    expect(result.source_type).toBe('REFERRAL');
    expect(result.source_id).toBe(referral._id.toString());
    expect(result.source_reference).toBe('ENT admission');
  });

  it('rejects a duplicate pending request for the same patient and branch', async () => {
    const context = await seedAdmissionContext();
    await context.service.createRequest(directPayload(context), context.actorId, {});

    await expect(context.service.createRequest(directPayload(context), context.actorId, {}))
      .rejects
      .toMatchObject({ statusCode: 409, code: 'DUPLICATE_ADMISSION_REQUEST' });
  });

  it('rejects a request when the patient already has an active admission', async () => {
    const context = await seedAdmissionContext();

    await InpatientAdmissionModel.create({
      admissionNumber: 'ADM-TEST-001',
      patientId: context.patientId,
      patientNumber: 'HMS-2026-000016',
      patientName: 'Anushya George',
      branchId: context.branchId,
      wardId: id(),
      bedId: id(),
      admittingDoctorId: context.doctorId,
      admittingDoctorName: 'Dr. Tendai Chikore',
      departmentId: context.departmentId,
      departmentName: 'ENT',
      admissionDate: new Date(),
      admissionType: 'INPATIENT',
      reason: 'Already admitted.',
      status: 'ADMITTED',
      sourceType: 'DIRECT',
      createdBy: context.actorId,
      updatedBy: context.actorId,
    });

    await expect(context.service.createRequest(directPayload(context), context.actorId, {}))
      .rejects
      .toMatchObject({ statusCode: 409, code: 'PATIENT_ALREADY_ADMITTED' });
  });

  it('executes fallback operation without a Mongo session when transactions are not supported', async () => {
    const transactionSession: FakeSession = {
      ended: false,
      withTransaction: async () => {
        throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
      },
      endSession: async () => {
        transactionSession.ended = true;
      },
    };
    const sessions = [transactionSession];
    const requestId = id().toString();
    const context = {
      actorId: id().toString(),
      branchId: id().toString(),
      departmentId: id().toString(),
      doctorId: id().toString(),
      patientId: id().toString(),
    };
    const assertNoSession = async (session: ClientSession | undefined) => {
      await Promise.resolve();
      expect(session).toBeUndefined();
    };
    const repository = {
      session: vi.fn(async () => sessions.shift() as unknown as ClientSession),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => undefined),
      requestReferences: vi.fn(async (_data: CreateAdmissionRequestDTO, session?: ClientSession) => {
        await assertNoSession(session);
        return {
          patient: { patientNumber: 'HMS-TEST', firstName: 'Direct', middleName: null, lastName: 'Patient' },
          doctor: { displayName: 'Dr. Direct' },
          department: { name: 'ENT' },
        };
      }),
      hasActiveAdmission: vi.fn(async (_patientId: string, session?: ClientSession) => {
        await assertNoSession(session);
        return false;
      }),
      hasActiveAdmissionRequest: vi.fn(async (_patientId: string, _branchId: string, session?: ClientSession) => {
        await assertNoSession(session);
        return false;
      }),
      createRequest: vi.fn(async (_data: CreateAdmissionRequestDTO, _refs: unknown, _actor: string, session?: ClientSession) => {
        await assertNoSession(session);
        return {
          id: requestId,
          request_number: 'AR-TEST-001',
          patient_id: context.patientId,
          patient_number: 'HMS-TEST',
          patient_name: 'Direct Patient',
          branch_id: context.branchId,
          department_id: context.departmentId,
          department_name: 'ENT',
          recommending_doctor_id: context.doctorId,
          recommending_doctor_name: 'Dr. Direct',
          source_type: 'DIRECT',
          source_id: null,
          source_reference: null,
          admission_type: 'INPATIENT',
          priority: 'ROUTINE',
          reason: 'Patient requires inpatient admission.',
          notes: null,
          status: 'PENDING_VALIDATION',
          hold_id: null,
          ward_id: null,
          bed_id: null,
          consent_document_id: null,
          deposit_invoice_id: null,
          prerequisite_snapshot: null,
          admission_id: null,
          cancellation_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
      }),
      audit: vi.fn(async (_eventType: string, _actor: string, _metadata: unknown, _details: unknown, session?: ClientSession) => {
        await assertNoSession(session);
      }),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[0];
    const patients = {
      addAdmissionTimeline: vi.fn(async (_patientId: string, _eventType: string, _title: string, _description: string, _actor: string, session?: ClientSession) => {
        await assertNoSession(session);
      }),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[2];
    const service = new InpatientAdmissionService(
      repository,
      {} as ConstructorParameters<typeof InpatientAdmissionService>[1],
      patients,
      {} as ConstructorParameters<typeof InpatientAdmissionService>[3],
      {} as ConstructorParameters<typeof InpatientAdmissionService>[4],
      {} as ConstructorParameters<typeof InpatientAdmissionService>[5],
      {} as ConstructorParameters<typeof InpatientAdmissionService>[6],
      {} as ConstructorParameters<typeof InpatientAdmissionService>[7],
      {} as ConstructorParameters<typeof InpatientAdmissionService>[8],
    );

    await expect(service.createRequest({
      patient_id: context.patientId,
      branch_id: context.branchId,
      department_id: context.departmentId,
      recommending_doctor_id: context.doctorId,
      source_type: 'DIRECT',
      source_id: null,
      admission_type: 'INPATIENT',
      priority: 'ROUTINE',
      reason: 'Patient requires inpatient admission.',
      notes: null,
    }, context.actorId, {})).resolves.toMatchObject({
      request_number: 'AR-TEST-001',
      source_type: 'DIRECT',
    });
    expect(transactionSession.ended).toBe(true);
    expect(repository.session).toHaveBeenCalledTimes(1);
  });
});
