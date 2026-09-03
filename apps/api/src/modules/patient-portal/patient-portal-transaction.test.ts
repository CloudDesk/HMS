import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PatientAccessGrantModel } from './patient-access-grant.model.js';
import { PatientPortalRepository } from './patient-portal.repository.js';
import { PatientModel, PatientTimelineEventModel } from '../patients/patient.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';

describe('Patient Portal Transaction Atomicity (H-002)', () => {
  let replSet: MongoMemoryReplSet;
  let repository: PatientPortalRepository;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    repository = new PatientPortalRepository();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await PatientModel.deleteMany({});
    await PatientAccessGrantModel.deleteMany({});
    await PatientTimelineEventModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    await UserModel.deleteMany({});
    await BranchModel.deleteMany({});
  });

  it('creates patient, access grant, timeline event, and audit log atomically inside a transaction', async () => {
    const branch = await BranchModel.create({
      code: 'BR001',
      name: 'Main Hospital',
      city: 'Nairobi',
    });

    const user = await UserModel.create({
      username: 'testpatient',
      email: 'patient@example.com',
      fullName: 'John Doe',
      phone: '+254712345678',
      passwordHash: 'dummy',
      roleIds: [],
    });

    const session = await repository.session();
    let patientId: string | null = null;
    await session.withTransaction(async () => {
      patientId = await repository.createPortalPatient(
        {
          userId: String(user._id),
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'MALE',
          email: 'patient@example.com',
          phone: '+254712345678',
          relationship: 'SELF',
          preferredBranchId: String(branch._id),
        },
        session,
      );
    });
    await session.endSession();

    expect(patientId).toBeTruthy();

    const createdPatient = await PatientModel.findById(patientId);
    expect(createdPatient).toBeTruthy();
    expect(createdPatient?.firstName).toBe('John');

    const accessGrant = await PatientAccessGrantModel.findOne({ userId: user._id, patientId });
    expect(accessGrant).toBeTruthy();
    expect(accessGrant?.relationship).toBe('SELF');

    const timelineEvent = await PatientTimelineEventModel.findOne({ patientId });
    expect(timelineEvent).toBeTruthy();
    expect(timelineEvent?.eventType).toBe('REGISTRATION');

    const auditLog = await AuditLogModel.findOne({ eventType: 'patient_portal.patient.created' });
    expect(auditLog).toBeTruthy();

    const updatedUser = await UserModel.findById(user._id);
    expect(String(updatedUser?.patientId)).toBe(String(patientId));
  });

  it('rolls back all records if the transaction fails halfway through', async () => {
    const branch = await BranchModel.create({
      code: 'BR002',
      name: 'Secondary Hospital',
      city: 'Mombasa',
    });

    const user = await UserModel.create({
      username: 'rollbackpatient',
      email: 'rollback@example.com',
      fullName: 'Rollback User',
      phone: '+254722222222',
      passwordHash: 'dummy',
      roleIds: [],
    });

    const session = await repository.session();
    let caughtError: unknown = null;

    try {
      await session.withTransaction(async () => {
        await repository.createPortalPatient(
          {
            userId: String(user._id),
            firstName: 'Rollback',
            lastName: 'User',
            dateOfBirth: '1995-05-05',
            gender: 'FEMALE',
            email: 'rollback@example.com',
            phone: '+254722222222',
            relationship: 'SELF',
            preferredBranchId: String(branch._id),
          },
          session,
        );

        // Force a failure inside the transaction session
        throw new Error('Simulated transaction abortion');
      });
    } catch (err) {
      caughtError = err;
    } finally {
      await session.endSession();
    }

    expect(caughtError).toBeTruthy();

    // Verify complete rollback: no patient, grant, timeline, or user update persisted
    const patientCount = await PatientModel.countDocuments({ firstName: 'Rollback' });
    expect(patientCount).toBe(0);

    const grantCount = await PatientAccessGrantModel.countDocuments({ userId: user._id });
    expect(grantCount).toBe(0);

    const timelineCount = await PatientTimelineEventModel.countDocuments({});
    expect(timelineCount).toBe(0);

    const auditCount = await AuditLogModel.countDocuments({ eventType: 'patient_portal.patient.created' });
    expect(auditCount).toBe(0);

    const checkUser = await UserModel.findById(user._id);
    expect(checkUser?.patientId).toBeFalsy();
  });
});
