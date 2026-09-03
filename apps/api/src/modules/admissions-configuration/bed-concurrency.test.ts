import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AdmissionPolicyModel,
  BedAssignmentHistoryModel,
  BedHoldModel,
  BedModel,
  WardModel,
} from './admissions-configuration.model.js';
import { InpatientAdmissionModel } from '../inpatient-admissions/inpatient-admission.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { AdmissionsConfigurationRepository } from './admissions-configuration.repository.js';
import { AdmissionsConfigurationService } from './admissions-configuration.service.js';
import { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AppError } from '../../shared/errors/app-error.js';

describe('High-Risk Workflow: Concurrent Bed Selection & Atomicity (M-010)', () => {
  let replSet: MongoMemoryReplSet;
  let repository: AdmissionsConfigurationRepository;
  let service: AdmissionsConfigurationService;
  let branchId: mongoose.Types.ObjectId;
  let wardId: mongoose.Types.ObjectId;
  let actorId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    const sequenceService = new SequenceService();
    repository = new AdmissionsConfigurationRepository(sequenceService);
    service = new AdmissionsConfigurationService(repository);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await BedModel.deleteMany({});
    await WardModel.deleteMany({});
    await BedHoldModel.deleteMany({});
    await BedAssignmentHistoryModel.deleteMany({});
    await AdmissionPolicyModel.deleteMany({});
    await InpatientAdmissionModel.deleteMany({});
    await PatientModel.deleteMany({});

    branchId = new mongoose.Types.ObjectId();
    wardId = new mongoose.Types.ObjectId();
    actorId = new mongoose.Types.ObjectId();

    await WardModel.create({
      _id: wardId,
      branchId,
      name: 'General Medical Ward',
      wardType: 'GENERAL',
      floor: '1st Floor',
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    });

    await AdmissionPolicyModel.create({
      branchId,
      bedHoldDurationMinutes: 120,
      admissionConsentRequired: false,
      admissionAdvanceDepositRequired: false,
      admissionMinimumDepositAmount: 0,
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    });
  });

  it('prevents double-booking: concurrent direct allotment of the same bed succeeds for exactly one patient', async () => {
    const bed = await BedModel.create({
      branchId,
      wardId,
      bedNumber: 'BED-C1',
      bedCategory: 'STANDARD',
      status: 'AVAILABLE',
      currentHoldId: null,
      currentAdmissionId: null,
      createdBy: actorId,
      updatedBy: actorId,
      version: 0,
    });

    const admission1Id = new mongoose.Types.ObjectId();
    const patient1Id = new mongoose.Types.ObjectId();
    const admission1 = await InpatientAdmissionModel.create({
      _id: admission1Id,
      admissionNumber: 'ADM-001',
      branchId,
      wardId,
      bedId: new mongoose.Types.ObjectId(),
      patientId: patient1Id,
      patientNumber: 'PAT-001',
      patientName: 'Patient One',
      admittingDoctorId: new mongoose.Types.ObjectId(),
      admittingDoctorName: 'Dr. Sarah Connor',
      departmentId: new mongoose.Types.ObjectId(),
      departmentName: 'General Medicine',
      admissionDate: new Date(),
      admissionType: 'INPATIENT',
      reason: 'Acute respiratory infection requiring IV therapy',
      status: 'DRAFT',
      createdBy: actorId,
      updatedBy: actorId,
    });

    const admission2Id = new mongoose.Types.ObjectId();
    const patient2Id = new mongoose.Types.ObjectId();
    const admission2 = await InpatientAdmissionModel.create({
      _id: admission2Id,
      admissionNumber: 'ADM-002',
      branchId,
      wardId,
      bedId: new mongoose.Types.ObjectId(),
      patientId: patient2Id,
      patientNumber: 'PAT-002',
      patientName: 'Patient Two',
      admittingDoctorId: new mongoose.Types.ObjectId(),
      admittingDoctorName: 'Dr. John Smith',
      departmentId: new mongoose.Types.ObjectId(),
      departmentName: 'General Medicine',
      admissionDate: new Date(),
      admissionType: 'INPATIENT',
      reason: 'Severe hypertension requiring telemetry',
      status: 'DRAFT',
      createdBy: actorId,
      updatedBy: actorId,
    });

    // Execute concurrent allotment attempts in separate sessions/transactions
    const executeAllotment = async (admissionRecord: typeof admission1) => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await service.allotAdmission(
            admissionRecord,
            bed._id.toString(),
            branchId.toString(),
            null,
            actorId.toString(),
            { ipAddress: '127.0.0.1' },
            session,
          );
        });
        return;
      } finally {
        await session.endSession();
      }
    };

    const results = await Promise.allSettled([
      executeAllotment(admission1),
      executeAllotment(admission2),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and exactly one must fail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('BED_NOT_AVAILABLE');

    // Verify bed document state in DB
    const finalBed = await BedModel.findById(bed._id).lean();
    expect(finalBed?.status).toBe('OCCUPIED');
    expect(finalBed?.currentHoldId).toBeNull();
    expect(
      [admission1Id.toString(), admission2Id.toString()].includes(
        finalBed?.currentAdmissionId?.toString() || '',
      ),
    ).toBe(true);

    // Verify exactly one ALLOTTED history record was created
    const history = await BedAssignmentHistoryModel.find({ bedId: bed._id }).lean();
    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('ALLOTTED');
  });

  it('prevents concurrent hold race: only one active hold can reserve an available bed', async () => {
    const bed = await BedModel.create({
      branchId,
      wardId,
      bedNumber: 'BED-C2',
      bedCategory: 'STANDARD',
      status: 'AVAILABLE',
      currentHoldId: null,
      currentAdmissionId: null,
      createdBy: actorId,
      updatedBy: actorId,
      version: 0,
    });

    const p1 = await PatientModel.create({
      patientNumber: 'PAT-H1',
      firstName: 'Alice',
      lastName: 'Wong',
      gender: 'FEMALE',
      dateOfBirth: new Date('1985-05-12'),
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    });

    const p2 = await PatientModel.create({
      patientNumber: 'PAT-H2',
      firstName: 'Bob',
      lastName: 'Miller',
      gender: 'MALE',
      dateOfBirth: new Date('1978-09-20'),
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    });

    repository.hasBranchAccess = async () => true;

    const executeHold = async (patientId: string, idempotencyKey: string) => {
      return service.createHold(
        bed._id.toString(),
        {
          branch_id: branchId.toString(),
          bed_id: bed._id.toString(),
          patient_id: patientId,
          reason: 'Pre-op reservation',
          idempotency_key: idempotencyKey,
        },
        actorId.toString(),
        { ipAddress: '127.0.0.1' },
      );
    };

    const results = await Promise.allSettled([
      executeHold(p1._id.toString(), 'idemp-hold-1'),
      executeHold(p2._id.toString(), 'idemp-hold-2'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('BED_NOT_AVAILABLE');

    // The winning hold is active and attached to the bed
    const activeHolds = await BedHoldModel.find({ bedId: bed._id, status: 'ACTIVE' }).lean();
    expect(activeHolds).toHaveLength(1);

    const updatedBed = await BedModel.findById(bed._id).lean();
    expect(updatedBed?.status).toBe('RESERVED');
    expect(updatedBed?.currentHoldId?.toString()).toBe(activeHolds[0]._id.toString());
  });

  it('transaction rollback: downstream failure rolls back bed allotment and preserves available state', async () => {
    const bed = await BedModel.create({
      branchId,
      wardId,
      bedNumber: 'BED-C3',
      bedCategory: 'STANDARD',
      status: 'AVAILABLE',
      currentHoldId: null,
      currentAdmissionId: null,
      createdBy: actorId,
      updatedBy: actorId,
      version: 0,
    });

    const admissionId = new mongoose.Types.ObjectId();
    const patientId = new mongoose.Types.ObjectId();
    const admission = await InpatientAdmissionModel.create({
      _id: admissionId,
      admissionNumber: 'ADM-003',
      branchId,
      wardId,
      bedId: bed._id,
      patientId,
      patientNumber: 'PAT-003',
      patientName: 'Rollback Patient',
      admittingDoctorId: new mongoose.Types.ObjectId(),
      admittingDoctorName: 'Dr. John Smith',
      departmentId: new mongoose.Types.ObjectId(),
      departmentName: 'General Medicine',
      admissionDate: new Date(),
      admissionType: 'INPATIENT',
      reason: 'Acute symptoms for observation',
      status: 'ADMITTED',
      createdBy: actorId,
      updatedBy: actorId,
    });

    const session = await mongoose.startSession();
    try {
      await expect(
        session.withTransaction(async () => {
          // 1. Allot bed
          await service.allotAdmission(
            admission,
            bed._id.toString(),
            branchId.toString(),
            null,
            actorId.toString(),
            { ipAddress: '127.0.0.1' },
            session,
          );

          // 2. Simulate downstream unhandled error or validation failure
          throw new AppError('Downstream verification failed', 400, 'DOWNSTREAM_ERROR');
        }),
      ).rejects.toThrow('Downstream verification failed');
    } finally {
      await session.endSession();
    }

    // Verify bed rolled back to AVAILABLE
    const bedAfterRollback = await BedModel.findById(bed._id).lean();
    expect(bedAfterRollback?.status).toBe('AVAILABLE');
    expect(bedAfterRollback?.currentAdmissionId).toBeNull();
    expect(bedAfterRollback?.currentHoldId).toBeNull();

    // Verify no orphaned assignment history exists
    const history = await BedAssignmentHistoryModel.find({ bedId: bed._id }).lean();
    expect(history).toHaveLength(0);
  });
});
