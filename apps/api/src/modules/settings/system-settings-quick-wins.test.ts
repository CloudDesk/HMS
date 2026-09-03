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
import { SettingsLogoStorage } from './settings.logo-storage.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';
import { UserRepository } from '../users/user.repository.js';
import { UserService } from '../users/user.service.js';
import type { UserRecord } from '../users/user.types.js';

const metadata = { ipAddress: '192.0.2.10', userAgent: 'settings-test' };

const preferences = (overrides: Partial<{
  passwordMinLength: number;
  maxFailedLoginAttempts: number;
  requireStrongPasswords: boolean;
}> = {}) => ({
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

const createUserHarness = () => {
  const users = new UserRepository();
  const roles = new RoleRepository();
  let createdRoleIds: string[] = [];

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
  const service = new UserService(users, roles, permissions, settings);
  vi.spyOn(service as unknown as { validateReferences: () => Promise<void> }, 'validateReferences').mockResolvedValue(undefined);

  return {
    service,
    getCreatedRoleIds: () => createdRoleIds,
  };
};

const createInput = (roleIds?: string[]) => ({
  employeeCode: 'EMP-1',
  username: 'new-user',
  email: 'new-user@example.test',
  fullName: 'New User',
  password: 'StrongPass1!',
  branches: [{ id: '650000000000000000000001', isPrimary: true }],
  departments: [{ id: '650000000000000000000002', isPrimary: true }],
  roleIds,
});

describe('System Settings quick-win runtime behavior', () => {
  it('requires explicit role selection during user creation', async () => {
    const harness = createUserHarness();
    await expect(harness.service.create(createInput(), 'actor-1', metadata)).rejects.toMatchObject({
      code: 'ROLE_ASSIGNMENT_REQUIRED',
    });

    await harness.service.create(createInput(['650000000000000000000003']), 'actor-1', metadata);
    expect(harness.getCreatedRoleIds()).toEqual(['650000000000000000000003']);
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

  it('clears stored logoBlobName and logoContentType when deleting hospital logo', async () => {
    const repository = new SettingsRepository();
    const logoStorage = new SettingsLogoStorage();
    const currentSettings = {
      hospital: {
        hospitalName: 'HMS Enterprise',
        phone: '1234567890',
        email: 'info@hms.test',
        address: '123 Main St',
        logoBlobName: 'logo-blob-123' as string | null,
        logoContentType: 'image/png' as string | null,
      },
    };

    vi.spyOn(repository, 'get').mockImplementation(async () => currentSettings as never);
    vi.spyOn(repository, 'updateSection').mockImplementation(async (_section, data) => {
      currentSettings.hospital = { ...currentSettings.hospital, ...data };
      return currentSettings as never;
    });
    vi.spyOn(repository, 'audit').mockResolvedValue(undefined as never);
    const deleteSpy = vi.spyOn(logoStorage, 'delete').mockResolvedValue(undefined as never);

    const service = new SettingsService(repository, logoStorage);
    const updated = await service.deleteHospitalLogo('user-1', metadata);

    expect(updated.logoBlobName).toBeNull();
    expect(updated.logoContentType).toBeNull();
    expect(updated.hospitalName).toBe('HMS Enterprise');
    expect(deleteSpy).toHaveBeenCalledWith('logo-blob-123');
  });
});
