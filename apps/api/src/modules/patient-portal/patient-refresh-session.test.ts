import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { hashPassword } from '../../shared/security/hash.js';
import { RefreshTokenModel } from '../auth/refresh-token.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { OtpChallengeModel } from './otp-challenge.model.js';

const phone = '+27821234567';
const normalizedPhone = '27821234567';
const otp = '4821';

const cookieHeader = (header: string | string[] | undefined) => {
  const values = Array.isArray(header) ? header : header ? [header] : [];
  return values.find((value) => value.startsWith('hms-refresh-token=')) ?? '';
};

const requestCookie = (header: string | string[] | undefined) => cookieHeader(header).split(';')[0] ?? '';

const createChallenge = () => OtpChallengeModel.create({
  phone: normalizedPhone,
  otpHash: createHash('sha256').update(`${normalizedPhone}:${otp}`).digest('hex'),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  resendAvailableAt: new Date(Date.now() + 60 * 1000),
  attempts: 0,
  verifiedAt: null,
});

const createRole = (code: 'PATIENT' | 'GUARDIAN') => RoleModel.create({
  code,
  name: code === 'PATIENT' ? 'Patient' : 'Guardian',
  permissionIds: [],
  status: 'active',
});

describe('patient refresh session cookie contract', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  const createPatientAccount = async () => {
    const role = await createRole('PATIENT');
    await UserModel.create({
      username: 'patient@example.test',
      email: 'patient@example.test',
      fullName: 'Patient User',
      phone: normalizedPhone,
      passwordHash: await hashPassword('UnusedPassword1'),
      roleIds: [role._id],
      branchIds: [],
      departmentIds: [],
      status: 'active',
    });
    await createChallenge();
  };

  const loginPatient = async () => {
    await createPatientAccount();
    return app.inject({
      method: 'POST',
      url: '/api/patient-portal/login/otp',
      payload: { phone, otp },
    });
  };

  it('OTP login sets an HttpOnly cookie without exposing the refresh token', async () => {
    const response = await loginPatient();

    expect(response.statusCode).toBe(200);
    const setCookie = cookieHeader(response.headers['set-cookie']);
    expect(setCookie).toContain('hms-refresh-token=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie.toLowerCase()).toContain('path=/api/auth');
    expect(setCookie.toLowerCase()).toContain('max-age=');
    expect(response.body).not.toContain('refreshToken');
    expect(response.body).not.toContain('refreshExpiresIn');
  });

  it('refreshes and rotates a patient session using an empty body and cookie', async () => {
    const login = await loginPatient();
    const originalCookie = requestCookie(login.headers['set-cookie']);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: originalCookie },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ data: { tokens: { accessToken: string } } }>().data.tokens.accessToken).toBeTruthy();
    expect(response.body).not.toContain('refreshToken');
    expect(requestCookie(response.headers['set-cookie'])).not.toBe(originalCookie);

    const reuse = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: originalCookie }, payload: {} });
    expect(reuse.statusCode).toBe(401);
  });

  it('rejects missing and invalid refresh cookies', async () => {
    const missing = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: {} });
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: 'hms-refresh-token=invalid-token' },
      payload: {},
    });

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });

  it('rejects expired and revoked refresh sessions', async () => {
    const expiredLogin = await loginPatient();
    await RefreshTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1_000) } });
    const expired = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: requestCookie(expiredLogin.headers['set-cookie']) }, payload: {},
    });
    expect(expired.statusCode).toBe(401);

    await mongoose.connection.db?.dropDatabase();
    const revokedLogin = await loginPatient();
    await RefreshTokenModel.updateMany({}, { $set: { revokedAt: new Date() } }, { strict: false });
    const revoked = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: requestCookie(revokedLogin.headers['set-cookie']) }, payload: {},
    });
    expect(revoked.statusCode).toBe(401);
  });

  it('clears and revokes the refresh cookie on logout', async () => {
    const login = await loginPatient();
    const body = login.json<{ data: { tokens: { accessToken: string } } }>();
    const cookie = requestCookie(login.headers['set-cookie']);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${body.data.tokens.accessToken}`, cookie },
      payload: {},
    });

    expect(logout.statusCode).toBe(200);
    expect(cookieHeader(logout.headers['set-cookie']).toLowerCase()).toContain('max-age=0');
    const refresh = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie }, payload: {} });
    expect(refresh.statusCode).toBe(401);
  });

  it('new-patient signup establishes a refresh session without OTP reuse', async () => {
    await createRole('PATIENT');
    await createChallenge();
    const initialLogin = await app.inject({
      method: 'POST', url: '/api/patient-portal/login/otp', payload: { phone, otp },
    });
    expect(initialLogin.statusCode).toBe(409);
    expect(initialLogin.json<{ error: { code: string } }>().error.code).toBe('NEW_PATIENT_REQUIRES_REGISTRATION');
    expect((await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean())?.verifiedAt).toBeNull();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/signup',
      payload: {
        account_type: 'PATIENT', full_name: 'New Patient', email: 'new.patient@example.test', phone, otp,
      },
    });

    expect(signup.statusCode).toBe(201);
    expect(cookieHeader(signup.headers['set-cookie']).toLowerCase()).toContain('httponly');
    expect(signup.body).not.toContain('refreshToken');
    const refresh = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: requestCookie(signup.headers['set-cookie']) }, payload: {},
    });
    expect(refresh.statusCode).toBe(200);
  });

  it('existing-patient activation establishes a refresh session', async () => {
    await createRole('PATIENT');
    await PatientModel.create({
      patientNumber: 'HMS-2026-000001', firstName: 'Existing', lastName: 'Patient',
      dateOfBirth: new Date('1990-01-01'), gender: 'UNKNOWN', phone: normalizedPhone,
      status: 'ACTIVE', deletedAt: null,
    });
    await createChallenge();
    const activation = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/existing-patient/activate',
      payload: {
        patient_number: 'HMS-2026-000001', phone, date_of_birth: '1990-01-01',
        email: 'existing.patient@example.test', otp,
      },
    });

    expect(activation.statusCode).toBe(201);
    expect(cookieHeader(activation.headers['set-cookie']).toLowerCase()).toContain('httponly');
    expect(activation.body).not.toContain('refreshToken');
    const refresh = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: requestCookie(activation.headers['set-cookie']) }, payload: {},
    });
    expect(refresh.statusCode).toBe(200);
  });

  it('guardian activation establishes a safe refresh session', async () => {
    await createRole('GUARDIAN');
    await PatientModel.create({
      patientNumber: 'HMS-2026-000002', firstName: 'Minor', lastName: 'Patient',
      dateOfBirth: new Date('2018-01-01'), gender: 'UNKNOWN', phone: normalizedPhone,
      status: 'ACTIVE', deletedAt: null,
    });
    await createChallenge();
    const initialLogin = await app.inject({
      method: 'POST', url: '/api/patient-portal/login/otp', payload: { phone, otp },
    });
    expect(initialLogin.statusCode).toBe(409);
    expect(initialLogin.json<{ error: { code: string } }>().error.code).toBe('MINOR_GUARDIAN_ACCOUNT_REQUIRED');
    expect((await OtpChallengeModel.findOne({ phone: normalizedPhone }).lean())?.verifiedAt).toBeNull();

    const activation = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/guardian-activation',
      payload: {
        phone, otp, full_name: 'Parent Guardian', email: 'guardian@example.test',
        relationship: 'PARENT', legal_consent_accepted: true,
      },
    });

    expect(activation.statusCode).toBe(200);
    expect(cookieHeader(activation.headers['set-cookie']).toLowerCase()).toContain('httponly');
    expect(activation.body).not.toContain('refreshToken');
    const refresh = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      headers: { cookie: requestCookie(activation.headers['set-cookie']) }, payload: {},
    });
    expect(refresh.statusCode).toBe(200);
  });
});
