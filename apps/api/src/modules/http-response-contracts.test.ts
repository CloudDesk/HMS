import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const authenticatedUser = {
  id: 'staff-user-id',
  username: 'staff',
  fullName: 'Staff User',
  email: 'staff@example.test',
  status: 'active' as const,
  patientId: null,
};

const unsafeAuthSession = {
  user: {
    id: 'auth-user-id',
    username: 'auth-user',
    email: 'auth@example.test',
    fullName: 'Auth User',
    status: 'active' as const,
    lastLoginAt: null,
    branches: [{ id: 'branch-id', code: 'MAIN', name: 'Main Branch', internal: 'drop-me' }],
    permissions: [{ code: 'PATIENT_VIEW', module: 'Patients', screen: 'Patient Records', action: 'View' }],
    roles: [{ id: 'role-id', code: 'PATIENT', name: 'Patient' }],
    passwordHash: 'must-never-be-serialized',
    otp: '4821',
    _id: 'mongo-object-id',
  },
  tokens: {
    accessToken: 'safe-access-token',
    refreshToken: 'must-remain-cookie-only',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    refreshExpiresIn: 86_400,
  },
  securityMetadata: 'drop-me',
};

const unsafeAdminUser = {
  id: 'managed-user-id',
  employeeCode: 'EMP-001',
  username: 'managed-user',
  email: 'managed@example.test',
  fullName: 'Managed User',
  phone: null,
  jobTitle: null,
  employeeType: null,
  hireDate: null,
  profilePhotoUrl: null,
  address: null,
  status: 'active' as const,
  lockedUntil: null,
  passwordChangedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  deletedBy: null,
  roleIds: ['role-id'],
  patientId: null,
  branches: [{ id: 'branch-id', name: 'Main Branch', isPrimary: true }],
  departments: [{ id: 'department-id', name: 'Reception', isPrimary: true }],
  roles: [{ id: 'role-id', code: 'RECEPTIONIST', name: 'Receptionist', status: 'active' as const }],
  audit: {
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    lastLoginAt: null,
    passwordChangedAt: null,
    createdBy: null,
    updatedBy: null,
  },
  passwordHash: 'must-never-be-serialized',
  failedLoginAttempts: 4,
  _id: 'mongo-object-id',
};

const unsafePatient = {
  id: 'patient-id',
  patient_number: 'HMS-2026-000001',
  first_name: 'Pat',
  middle_name: null,
  last_name: 'Ient',
  date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
  gender: 'UNKNOWN' as const,
  phone: '27821234567',
  email: 'patient@example.test',
  address: { line1: null, line2: null, city: null, state: null, country: null, postal_code: null },
  emergency_contact: { name: null, relationship: null, phone: null },
  parent_guardian: null,
  registration_branch_id: 'branch-id',
  blood_group: null,
  status: 'ACTIVE' as const,
  notes: null,
  created_by: 'staff-user-id',
  updated_by: null,
  created_at: new Date('2026-08-01T00:00:00.000Z'),
  updated_at: new Date('2026-08-02T00:00:00.000Z'),
  _id: 'mongo-object-id',
  passwordHash: 'must-never-be-serialized',
  otp: '4821',
};

describe('M-013 high-risk HTTP response contracts', () => {
  let built: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    built = await buildApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await built.app.close();
  });

  it('serializes staff authentication using the frontend-compatible safe session contract', async () => {
    vi.spyOn(built.services.auth, 'login').mockResolvedValue(unsafeAuthSession);

    const response = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'auth-user', password: 'Password1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        user: {
          id: 'auth-user-id', username: 'auth-user', email: 'auth@example.test', fullName: 'Auth User',
          status: 'active', lastLoginAt: null,
          branches: [{ id: 'branch-id', code: 'MAIN', name: 'Main Branch' }],
          permissions: [{ code: 'PATIENT_VIEW', module: 'Patients', screen: 'Patient Records', action: 'View' }],
          roles: [{ id: 'role-id', code: 'PATIENT', name: 'Patient' }],
        },
        tokens: { accessToken: 'safe-access-token', tokenType: 'Bearer', expiresIn: 900 },
      },
    });
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('otp');
    expect(response.body).not.toContain('refreshToken');
    expect(response.body).not.toContain('refreshExpiresIn');
  });

  it('never serializes OTP challenge internals from the public request endpoint', async () => {
    vi.spyOn(built.services.patientPortal, 'requestOtp').mockResolvedValue({
      success: true,
      resendAvailableAt: new Date('2026-08-28T12:00:00.000Z'),
      otp: '4821',
      otpHash: 'must-never-be-serialized',
      challengeId: 'internal-challenge-id',
    });

    const response = await built.app.inject({
      method: 'POST',
      url: '/api/patient-portal/otp/request',
      payload: { phone: '+27821234567' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { success: true, resendAvailableAt: '2026-08-28T12:00:00.000Z' },
    });
    expect(response.body).not.toContain('4821');
    expect(response.body).not.toContain('otpHash');
    expect(response.body).not.toContain('challengeId');
  });

  it('filters internal fields from administrative user list and detail responses', async () => {
    vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(authenticatedUser);
    vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
    vi.spyOn(built.services.users, 'list').mockResolvedValue({
      items: [unsafeAdminUser],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(built.services.users, 'getById').mockResolvedValue(unsafeAdminUser);

    const headers = { authorization: 'Bearer test-token' };
    const [list, detail] = await Promise.all([
      built.app.inject({ method: 'GET', url: '/api/users', headers }),
      built.app.inject({ method: 'GET', url: '/api/users/managed-user-id', headers }),
    ]);

    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    expect(list.json<{ data: { items: Array<{ username: string }> } }>().data.items[0]?.username).toBe('managed-user');
    for (const response of [list, detail]) {
      expect(response.body).not.toContain('passwordHash');
      expect(response.body).not.toContain('failedLoginAttempts');
      expect(response.body).not.toContain('mongo-object-id');
    }
  });

  it('filters internal fields from scoped administrative patient list and detail responses', async () => {
    vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue(authenticatedUser);
    vi.spyOn(built.services.permissions, 'userHasPermission').mockResolvedValue(true);
    const list = vi.spyOn(built.services.patients, 'list').mockResolvedValue({
      data: [unsafePatient],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const detail = vi.spyOn(built.services.patients, 'getById').mockResolvedValue(unsafePatient);

    const headers = { authorization: 'Bearer test-token' };
    const [listResponse, detailResponse] = await Promise.all([
      built.app.inject({ method: 'GET', url: '/api/patients', headers }),
      built.app.inject({ method: 'GET', url: '/api/patients/patient-id', headers }),
    ]);

    expect(listResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith({}, 'staff-user-id');
    expect(detail).toHaveBeenCalledWith('patient-id', 'staff-user-id');
    for (const response of [listResponse, detailResponse]) {
      expect(response.body).toContain('HMS-2026-000001');
      expect(response.body).not.toContain('passwordHash');
      expect(response.body).not.toContain('otp');
      expect(response.body).not.toContain('mongo-object-id');
    }
  });

  it('keeps patient portal context scoped while filtering nested internal fields', async () => {
    vi.spyOn(built.services.auth, 'authenticateAccessToken').mockResolvedValue({
      ...authenticatedUser,
      id: 'patient-user-id',
      patientId: 'patient-id',
    });
    const context = vi.spyOn(built.services.patientPortal, 'context').mockResolvedValue({
      account: {
        type: 'PATIENT',
        full_name: 'Portal Patient',
        email: 'patient@example.test',
        phone: '27821234567',
        guardian_profile: null,
        passwordHash: 'drop-me',
      },
      patients: [{
        id: 'patient-id',
        patient_number: 'HMS-2026-000001',
        full_name: 'Portal Patient',
        date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'UNKNOWN',
        relationship: 'SELF',
        is_primary: true,
        preferred_branch: null,
        clinicalNotes: 'drop-me',
      }],
    });

    const response = await built.app.inject({
      method: 'GET',
      url: '/api/patient-portal/context',
      headers: { authorization: 'Bearer patient-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(context).toHaveBeenCalledWith('patient-user-id');
    expect(response.body).toContain('HMS-2026-000001');
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('clinicalNotes');
  });
});
