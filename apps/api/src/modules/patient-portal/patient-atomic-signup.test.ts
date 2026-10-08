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
import { PatientNumberSequenceModel } from '../patients/patient-number.model.js';

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
  let services: Awaited<ReturnType<typeof buildApp>>['services'];

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    ({ app, services } = await buildApp());
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

  describe.each(['PARENT', 'LEGAL_GUARDIAN'] as const)('%s also becomes a patient', (relationship) => {
    const setupGuardian = async () => {
      await PatientAccessGrantModel.createIndexes();
      const role = await RoleModel.findOne({ code: 'GUARDIAN' }).orFail();
      const branch = await BranchModel.create({ code: 'SELF', name: 'Main', city: 'Mumbai', status: 'ACTIVE' });
      const user = await UserModel.create({
        username: 'father', email: 'father@example.test', fullName: 'Father Patient',
        phone, passwordHash: 'test-only', roleIds: [role._id], status: 'active',
      });
      const child = await PatientModel.create({
        patientNumber: 'CHILD-1', firstName: 'Child', lastName: 'Patient',
        dateOfBirth: new Date('2020-01-01'), gender: 'UNKNOWN', phone,
        registrationBranchId: branch._id, status: 'ACTIVE',
      });
      const grant = await PatientAccessGrantModel.create({
        userId: user._id, patientId: child._id, relationship, status: 'VERIFIED',
      });
      const profile = {
        firstName: 'Father', lastName: 'Patient', dateOfBirth: '1980-01-01',
        gender: 'MALE' as const, preferredBranchId: String(branch._id),
      };
      return { user, child, grant: grant.toObject(), profile };
    };

    it.each(['new', 'existing'])('reuses the guardian user for a %s SELF record and preserves the child grant', async (mode) => {
      const { user, child, grant, profile } = await setupGuardian();
      const existing = mode === 'existing' ? await PatientModel.create({
        patientNumber: 'FATHER-1', ...profile, dateOfBirth: new Date(profile.dateOfBirth),
        phone, status: 'ACTIVE', registrationBranchId: profile.preferredBranchId,
      }) : null;

      const result = await services.patientPortal.completePatientProfile(String(user._id), profile);

      expect(result.patientId).not.toBe(String(child._id));
      if (existing) expect(result.patientId).toBe(String(existing._id));
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await PatientModel.countDocuments()).toBe(2);
      expect(String((await UserModel.findById(user._id).orFail()).patientId)).toBe(result.patientId);
      expect(await PatientAccessGrantModel.findById(grant._id).lean()).toEqual(grant);
      expect(await PatientAccessGrantModel.findOne({ userId: user._id, patientId: result.patientId }).lean())
        .toMatchObject({ relationship: 'SELF', status: 'VERIFIED' });
      expect(await PatientAccessGrantModel.countDocuments()).toBe(2);
      expect((await services.patientPortal.context(String(user._id))).patients)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ id: String(child._id), relationship }),
          expect.objectContaining({ id: result.patientId, relationship: 'SELF' }),
        ]));
    });

    it('rejects converting the existing child relationship to SELF', async () => {
      const { user, child, grant, profile } = await setupGuardian();
      await expect(services.patientPortal.completePatientProfile(String(user._id), {
        ...profile, firstName: 'Child', dateOfBirth: '2020-01-01',
      })).rejects.toMatchObject({ code: 'PATIENT_RELATIONSHIP_CONFLICT', statusCode: 409 });
      expect(await PatientAccessGrantModel.findById(grant._id).lean()).toEqual(grant);
      expect((await UserModel.findById(user._id).orFail()).patientId).toBeNull();
      expect(await UserModel.countDocuments()).toBe(1);
      expect(await PatientModel.countDocuments()).toBe(1);
      expect(await PatientAccessGrantModel.countDocuments()).toBe(1);
      expect(await PatientAccessGrantModel.countDocuments({ patientId: child._id, relationship: 'SELF' })).toBe(0);
    });
  });

  it.each(['fresh', 'stale-counter'])('performs atomic registration with %s MRN state', async (scenario) => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN',
      name: 'Main Hospital',
      city: 'Mumbai',
      status: 'ACTIVE',
    });

    await createChallenge();

    if (scenario === 'stale-counter') {
      await PatientModel.createIndexes();
      await PatientNumberSequenceModel.createIndexes();
      const year = new Date().getFullYear();
      await PatientNumberSequenceModel.create({ key: `PATIENT_MRN_${year}`, value: 25 });
      await PatientModel.create([26, 30].map((number) => ({
        patientNumber: `HMS-${year}-${String(number).padStart(6, '0')}`,
        firstName: 'Existing', lastName: 'Patient', dateOfBirth: new Date('1980-01-01'),
        gender: 'MALE', status: 'ACTIVE', registrationBranchId: branch._id,
      })));
    }

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
    if (scenario === 'stale-counter') {
      expect(createdPatient?.patientNumber).toBe(`HMS-${new Date().getFullYear()}-000031`);
      expect(await PatientModel.countDocuments({})).toBe(3);
    }
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

  it('persists a mononym without creating a dot placeholder surname', async () => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN', name: 'Main Hospital', city: 'Mumbai', status: 'ACTIVE',
    });
    await createChallenge();

    const response = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT',
        full_name: 'Jey',
        email: 'jey@example.test',
        phone,
        otp,
        self_profile: {
          first_name: null,
          last_name: 'Jey',
          date_of_birth: '1992-09-22',
          gender: 'MALE',
          preferred_branch_id: String(branch._id),
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const userId = response.json<{ data: { account: { id: string } } }>().data.account.id;
    const user = await UserModel.findById(userId).lean();
    const patient = await PatientModel.findById(user?.patientId).lean();
    expect(patient?.firstName).toBeNull();
    expect(patient?.lastName).toBe('Jey');
  });

  it('rejects punctuation-only placeholder surnames from older clients', async () => {
    const branch = await BranchModel.create({
      code: 'BR-MAIN', name: 'Main Hospital', city: 'Mumbai', status: 'ACTIVE',
    });
    await createChallenge();

    const response = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT', full_name: 'Jey', email: 'jey@example.test', phone, otp,
        self_profile: {
          first_name: 'Jey', last_name: '.', date_of_birth: '1992-09-22',
          gender: 'MALE', preferred_branch_id: String(branch._id),
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(await PatientModel.countDocuments({})).toBe(0);
  });

  it.each(['email', 'username', 'phone'] as const)('identifies an existing User %s without creating a patient or grant', async (field) => {
    const branch = await BranchModel.create({ code: 'BR-MAIN', name: 'Main Hospital', city: 'Mumbai', status: 'ACTIVE' });
    await UserModel.create({
      username: field === 'username' ? 'new@example.test' : 'existing@example.test',
      email: field === 'email' ? 'new@example.test' : 'existing@example.test',
      phone: field === 'phone' ? phone : '+919999999999',
      fullName: 'Existing User', passwordHash: 'test-only', status: 'active',
    });
    const registrationToken = 'test-registration-token-after-verification';
    await RegistrationTokenModel.create({ phone: normalizedPhone,
      tokenHash: createHash('sha256').update(registrationToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60000), consumedAt: null,
    });
    const response = await app.inject({ method: 'POST', url: '/api/patient-portal/signup', payload: {
      account_type: 'PATIENT', full_name: 'New Patient', email: 'new@example.test', phone, registration_token: registrationToken,
      self_profile: { first_name: 'New', last_name: 'Patient', date_of_birth: '1990-05-15', gender: 'MALE', preferred_branch_id: String(branch._id) },
    } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe(`DUPLICATE_${field.toUpperCase()}`);
    expect(await UserModel.countDocuments({})).toBe(1);
    expect(await PatientModel.countDocuments({})).toBe(0);
    expect(await PatientAccessGrantModel.countDocuments({})).toBe(0);
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

  it('creates a minor self account with a patient, MRN and SELF access grant', async () => {
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
          date_of_birth: '2020-01-01',
          gender: 'FEMALE',
          preferred_branch_id: String(branch._id),
        },
      },
    });

    expect(signupResponse.statusCode).toBe(201);
    const user = await UserModel.findOne({ email: 'child@example.test' }).lean();
    const patient = await PatientModel.findOne({ firstName: 'Minor' }).lean();
    expect(patient?.patientNumber).toBeTruthy();
    expect(String(user?.patientId)).toBe(String(patient?._id));
    expect(await PatientAccessGrantModel.findOne({ userId: user?._id, patientId: patient?._id }).lean())
      .toMatchObject({ relationship: 'SELF', status: 'VERIFIED', isPrimary: true });

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
    const branch = await BranchModel.create({ code: 'PROFILE', name: 'Profile Hospital', city: 'Mumbai', status: 'ACTIVE' });
    const completed = await app.inject({ method: 'POST', url: '/api/patient-portal/profile',
      headers: { authorization: `Bearer ${body.data.tokens.accessToken}` },
      payload: { first_name: 'Web', last_name: 'User', date_of_birth: '2020-01-01',
        gender: 'UNKNOWN', preferred_branch_id: String(branch._id) } });
    expect(completed.statusCode, completed.body).toBe(201);
    const linked = await UserModel.findById(body.data.account.id).lean();
    expect(linked?.patientId).toBeTruthy();
    expect(await PatientAccessGrantModel.findOne({ userId: linked?._id, patientId: linked?.patientId }).lean())
      .toMatchObject({ relationship: 'SELF', status: 'VERIFIED' });

  });
});
