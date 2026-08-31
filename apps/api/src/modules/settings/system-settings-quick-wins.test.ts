import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hms-settings-test';
});

import { hashPassword } from '../../shared/security/hash.js';
import { assertPasswordPolicy, getEffectivePasswordPolicy } from '../../shared/security/password-policy.js';
import { AuthRateLimitRepository } from '../auth/auth-rate-limit.repository.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUserRecord } from '../auth/auth.types.js';
import { PatientOtpRepository } from '../patient-portal/patient-otp.repository.js';
import { PatientOtpService } from '../patient-portal/patient-otp.service.js';
import { RoleRepository } from '../roles/role.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { UserService } from '../users/user.service.js';
import type { UserRecord } from '../users/user.types.js';

const metadata = { ipAddress: '192.0.2.10', userAgent: 'settings-test' };

const preferences = (overrides: Partial<{
  defaultRole: 'Nurse' | 'Receptionist' | 'Doctor';
  passwordMinLength: number;
  maxFailedLoginAttempts: number;
  requireStrongPasswords: boolean;
}> = {}) => ({
  defaultRole: 'Nurse' as const,
  passwordMinLength: 10,
  passwordExpiryDays: 90,
  maxFailedLoginAttempts: 3,
  requireStrongPasswords: true,
  forcePasswordChangeOnFirstLogin: true,
  allowUserSelfRegistration: false,
  ...overrides,
});

const userRecord = (roleIds: string[]): UserRecord => ({
  id: 'user-1',
  employeeCode: 'EMP-1',
  username: 'new-user',
  email: 'new-user@example.test',
  fullName: 'New User',
  phone: null,
  jobTitle: null,
  employeeType: null,
  hireDate: null,
  profilePhotoUrl: null,
  address: null,
  status: 'active',
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2030-01-01T00:00:00.000Z'),
  updatedAt: new Date('2030-01-01T00:00:00.000Z'),
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  deletedBy: null,
  roleIds,
  patientId: null,
});

const createUserHarness = (input: { defaultRoleExists?: boolean } = {}) => {
  const users = new UserRepository();
  const roles = new RoleRepository();
  const nurseRole = { id: 'role-nurse', code: 'CLINICIAN_NURSE', name: 'Clinician / Nurse', status: 'active' as const };
  let createdRoleIds: string[] = [];

  vi.spyOn(roles, 'findActiveByCode').mockResolvedValue(input.defaultRoleExists === false ? null : nurseRole);
  vi.spyOn(users, 'findByUniqueFields').mockResolvedValue(null);
  vi.spyOn(users, 'validateReferences').mockImplementation(async (branches, departments, roleIds) => ({
    branches: branches.length,
    departments: departments.length,
    roles: roleIds.length,
  }));
  vi.spyOn(users, 'create').mockImplementation(async (data) => {
    createdRoleIds = data.roleIds;
    return userRecord(data.roleIds);
  });
  vi.spyOn(users, 'replaceAssignments').mockResolvedValue(undefined);
  vi.spyOn(users, 'audit').mockResolvedValue(undefined);
  vi.spyOn(users, 'findById').mockImplementation(async () => userRecord(createdRoleIds));
  vi.spyOn(users, 'getAssignments').mockResolvedValue({
    branchesByUserId: new Map(),
    departmentsByUserId: new Map(),
    rolesByUserId: new Map(),
  });

  const settings = { getRuntimeUserPreferences: async () => preferences() };
  const permissions = {
    assertCanAssignRoles: async () => undefined,
    assertCanManageRoles: async () => undefined,
    assertCanManageUser: async () => undefined,
  };
  return {
    service: new UserService(users, roles, permissions, settings),
    getCreatedRoleIds: () => createdRoleIds,
  };
};

const createInput = (roleIds?: string[]) => ({
  employeeCode: 'EMP-1',
  username: 'new-user',
  email: 'new-user@example.test',
  fullName: 'New User',
  password: 'StrongPass1!',
  branches: [{ id: 'branch-1', isPrimary: true }],
  departments: [{ id: 'department-1', isPrimary: true }],
  roleIds,
});

describe('System Settings quick-win runtime behavior', () => {
  it('uses the configured active role only when user creation omits an explicit role', async () => {
    const defaultHarness = createUserHarness();
    await defaultHarness.service.create(createInput(), 'actor-1', metadata);
    expect(defaultHarness.getCreatedRoleIds()).toEqual(['role-nurse']);

    const explicitHarness = createUserHarness();
    await explicitHarness.service.create(createInput(['role-doctor']), 'actor-1', metadata);
    expect(explicitHarness.getCreatedRoleIds()).toEqual(['role-doctor']);
  });

  it('preserves role-required behavior when the configured default role is unavailable', async () => {
    const harness = createUserHarness({ defaultRoleExists: false });
    await expect(harness.service.create(createInput(), 'actor-1', metadata)).rejects.toMatchObject({
      code: 'ROLE_ASSIGNMENT_REQUIRED',
    });
  });

  it('enforces configured minimum length independently from strong complexity', () => {
    const relaxed = getEffectivePasswordPolicy(preferences({ requireStrongPasswords: false }));
    expect(() => assertPasswordPolicy('123456789', relaxed)).toThrowError(
      expect.objectContaining({ code: 'PASSWORD_POLICY_FAILED' }),
    );
    expect(() => assertPasswordPolicy('abcdefghij', relaxed)).not.toThrow();

    const strong = getEffectivePasswordPolicy(preferences({ requireStrongPasswords: true }));
    expect(() => assertPasswordPolicy('abcdefghij', strong)).toThrowError(
      expect.objectContaining({ code: 'PASSWORD_POLICY_FAILED' }),
    );
    expect(() => assertPasswordPolicy('StrongPass1!', strong)).not.toThrow();
  });

  it('passes the configured failed-login limit into the existing lockout repository flow', async () => {
    const repository = new AuthRepository();
    const rateLimits = new AuthRateLimitRepository();
    const passwordHash = await hashPassword('CorrectPass1!');
    let failedLoginAttempts = 0;
    const limits: number[] = [];
    const authUser = (): AuthUserRecord => ({
      id: 'user-1',
      employeeCode: 'EMP-1',
      username: 'locked-user',
      email: 'locked@example.test',
      fullName: 'Locked User',
      patientId: null,
      passwordHash,
      status: failedLoginAttempts >= 3 ? 'locked' : 'active',
      failedLoginAttempts,
      lockedUntil: failedLoginAttempts >= 3 ? new Date(Date.now() + 60_000) : null,
      passwordChangedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(rateLimits, 'consume').mockResolvedValue(true);
    vi.spyOn(repository, 'findUserByIdentifier').mockImplementation(async () => authUser());
    vi.spyOn(repository, 'incrementFailedLogin').mockImplementation(async (_id, limit) => {
      limits.push(limit);
      failedLoginAttempts += 1;
      return authUser();
    });
    vi.spyOn(repository, 'audit').mockResolvedValue(undefined);

    const settings = { getRuntimeUserPreferences: async () => preferences({ maxFailedLoginAttempts: 3 }) };
    const patientOtp = new PatientOtpService(
      new PatientOtpRepository(),
      { sendSms: async () => {} },
      { demoEnabled: false, demoOtp: '' },
      rateLimits,
    );
    const auth = new AuthService(
      repository,
      patientOtp,
      rateLimits,
      { ipLimit: 10, identityLimit: 10 },
      settings,
    );

    await expect(auth.login({ identifier: 'locked-user', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'locked-user', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(auth.login({ identifier: 'locked-user', password: 'wrong' }, metadata)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(limits).toEqual([3, 3, 3]);
    expect(authUser().status).toBe('locked');
  });

  it('keeps successful-login failed-attempt clearing unchanged', async () => {
    const repository = new AuthRepository();
    const rateLimits = new AuthRateLimitRepository();
    const passwordHash = await hashPassword('CorrectPass1!');
    const authUser: AuthUserRecord = {
      id: 'user-2',
      employeeCode: 'EMP-2',
      username: 'successful-user',
      email: 'successful@example.test',
      fullName: 'Successful User',
      patientId: null,
      passwordHash,
      status: 'active',
      failedLoginAttempts: 2,
      lockedUntil: null,
      passwordChangedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(rateLimits, 'consume').mockResolvedValue(true);
    vi.spyOn(repository, 'findUserByIdentifier').mockResolvedValue(authUser);
    const clearFailedLogin = vi.spyOn(repository, 'clearFailedLogin').mockResolvedValue(undefined);
    vi.spyOn(repository, 'findUserById').mockResolvedValue({ ...authUser, failedLoginAttempts: 0 });
    vi.spyOn(repository, 'createRefreshToken').mockResolvedValue('refresh-1');
    vi.spyOn(repository, 'getUserAccessContext').mockResolvedValue({ branches: [], permissions: [], roles: [] });
    vi.spyOn(repository, 'audit').mockResolvedValue(undefined);

    const patientOtp = new PatientOtpService(
      new PatientOtpRepository(),
      { sendSms: async () => {} },
      { demoEnabled: false, demoOtp: '' },
      rateLimits,
    );
    const settings = { getRuntimeUserPreferences: async () => preferences({ maxFailedLoginAttempts: 3 }) };
    const auth = new AuthService(repository, patientOtp, rateLimits, {}, settings);

    await expect(auth.login({ identifier: 'successful-user', password: 'CorrectPass1!' }, metadata)).resolves.toMatchObject({
      user: { username: 'successful-user' },
    });
    expect(clearFailedLogin).toHaveBeenCalledWith('user-2');
  });
});
