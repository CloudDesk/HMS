import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { PatientAccessGrantModel } from './patient-access-grant.model.js';
import { PatientModel, PatientTimelineEventModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { OtpChallengeModel } from './otp-challenge.model.js';
import { RegistrationTokenModel } from './registration-token.model.js';

const phone = '+919876543210';
const normalizedPhone = '919876543210';
const otp = '4821';

const createChallenge = () =>
  OtpChallengeModel.create({
    phone: normalizedPhone,
    otpHash: createHash('sha256').update(`${normalizedPhone}:${otp}`).digest('hex'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    resendAvailableAt: new Date(Date.now() + 60 * 1000),
    attempts: 0,
    verifiedAt: null,
  });

const createRoles = async () => {
  await RoleModel.create([
    {
      code: 'PATIENT',
      name: 'Patient',
      permissionIds: [],
      status: 'active',
    },
    {
      code: 'GUARDIAN',
      name: 'Guardian',
      permissionIds: [],
      status: 'active',
    },
  ]);
};

describe('Patient Portal Atomic Signup Flow', () => {
  let replSet: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await createRoles();
  });

  it('performs atomic registration when self_profile is supplied in signup', async () => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN',
      name: 'Main Hospital',
      city: 'Mumbai',
      status: 'ACTIVE',
    });

    await createChallenge();

    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT',
        full_name: 'Aarav Patel',
        email: 'aarav.patel@example.test',
        phone,
        otp,
        self_profile: {
          first_name: 'Aarav',
          last_name: 'Patel',
          date_of_birth: '1990-05-15',
          gender: 'MALE',
          preferred_branch_id: String(branch._id),
          blood_group: 'B+',
          address: {
            line1: '123 Marine Drive',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400020',
          },
        },
      },
    });

    expect(signupResponse.statusCode).toBe(201);
    const body = signupResponse.json<{ data: { account: { id: string }; tokens: { accessToken: string }; user: { patientId?: string } } }>();
    expect(body.data.account.id).toBeTruthy();
    expect(body.data.tokens.accessToken).toBeTruthy();

    const createdUser = await UserModel.findById(body.data.account.id);
    expect(createdUser).toBeTruthy();
    expect(createdUser?.patientId).toBeTruthy();

    const createdPatient = await PatientModel.findById(createdUser?.patientId);
    expect(createdPatient).toBeTruthy();
    expect(createdPatient?.firstName).toBe('Aarav');
    expect(createdPatient?.lastName).toBe('Patel');
    expect(createdPatient?.patientNumber).toMatch(/^HMS-\d{4}-\d{6}$/);
    expect(createdPatient?.bloodGroup).toBe('B+');
    expect(String(createdPatient?.registrationBranchId)).toBe(String(branch._id));

    const grant = await PatientAccessGrantModel.findOne({
      userId: createdUser?._id,
      patientId: createdPatient?._id,
    });
    expect(grant).toBeTruthy();
    expect(grant?.relationship).toBe('SELF');
    expect(grant?.isPrimary).toBe(true);
    expect(grant?.status).toBe('VERIFIED');

    const timeline = await PatientTimelineEventModel.findOne({ patientId: createdPatient?._id });
    expect(timeline).toBeTruthy();
    expect(timeline?.eventType).toBe('REGISTRATION');

    // Verify context API returns the new patient
    const contextResponse = await app.inject({
      method: 'GET',
      url: '/api/patient-portal/context',
      headers: { authorization: `Bearer ${body.data.tokens.accessToken}` },
    });
    expect(contextResponse.statusCode).toBe(200);
    const contextBody = contextResponse.json<{ data: { patients: Array<{ id: string; full_name: string; relationship: string }> } }>();
    expect(contextBody.data.patients).toHaveLength(1);
    expect(contextBody.data.patients[0]?.id).toBe(String(createdPatient?._id));
    expect(contextBody.data.patients[0]?.relationship).toBe('SELF');
  });

  it('rolls back completely if a duplicate patient exists when self_profile is supplied', async () => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN',
      name: 'Main Hospital',
      city: 'Mumbai',
      status: 'ACTIVE',
    });

    // Create existing patient with same name and DOB
    await PatientModel.create({
      patientNumber: 'HMS-2026-000001',
      firstName: 'Aarav',
      lastName: 'Patel',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'MALE',
      phone: normalizedPhone,
      status: 'ACTIVE',
      registrationBranchId: branch._id,
    });

    await createChallenge();

    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT',
        full_name: 'Aarav Patel',
        email: 'aarav.patel@example.test',
        phone,
        otp,
        self_profile: {
          first_name: 'Aarav',
          last_name: 'Patel',
          date_of_birth: '1990-05-15',
          gender: 'MALE',
          preferred_branch_id: String(branch._id),
        },
      },
    });

    expect(signupResponse.statusCode).toBe(409);

    // Verify complete rollback: No new User, no extra Patient, no SELF grant
    const userCount = await UserModel.countDocuments({ email: 'aarav.patel@example.test' });
    expect(userCount).toBe(0);

    const patientCount = await PatientModel.countDocuments({ firstName: 'Aarav' });
    expect(patientCount).toBe(1); // Only the pre-existing one

    const grantCount = await PatientAccessGrantModel.countDocuments({});
    expect(grantCount).toBe(0);
  });

  it('rejects minor self-registration under 15 without creating user or patient', async () => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN',
      name: 'Main Hospital',
      city: 'Mumbai',
      status: 'ACTIVE',
    });

    await createChallenge();

    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT',
        full_name: 'Minor Child',
        email: 'child@example.test',
        phone,
        otp,
        self_profile: {
          first_name: 'Minor',
          last_name: 'Child',
          dateOfBirth: '2020-01-01',
          gender: 'FEMALE',
          preferred_branch_id: String(branch._id),
        },
      },
    });

    expect(signupResponse.statusCode).toBe(400);

    const userCount = await UserModel.countDocuments({ email: 'child@example.test' });
    expect(userCount).toBe(0);
    const patientCount = await PatientModel.countDocuments({ firstName: 'Minor' });
    expect(patientCount).toBe(0);
  });

  it('preserves Patient Web two-step registration when self_profile is omitted', async () => {
    await createChallenge();

    const signupResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT',
        full_name: 'Web User',
        email: 'web.user@example.test',
        phone,
        otp,
      },
    });

    expect(signupResponse.statusCode).toBe(201);
    const body = signupResponse.json<{ data: { account: { id: string }; tokens: { accessToken: string } } }>();

    const user = await UserModel.findById(body.data.account.id);
    expect(user).toBeTruthy();
    expect(user?.patientId).toBeNull(); // Historical behavior: User created, patientId null until /profile
  });
});
