import { env } from '../../config/env.js';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../shared/security/hash.js';
import { assertPasswordPolicy, getEffectivePasswordPolicy } from '../../shared/security/password-policy.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { ClientSession } from 'mongoose';
import type { RoleRepository } from '../roles/role.repository.js';
import type { SettingsService } from '../settings/settings.service.js';
import { UserRepository } from './user.repository.js';
import type {
  AssignmentInput,
  RequestMetadata,
  UserListQuery,
  ProvisionDoctorAccountInput,
  ProvisionPatientAccountInput,
  RegisterPortalAccountInput,
  UserRecord,
  UserResponse,
  UserStatus,
} from './user.types.js';

type CreateUserInput = {
  employeeCode: string;
  username: string;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  employeeType?: string | null;
  hireDate?: string | null;
  profilePhotoUrl?: string | null;
  address?: string | null;
  status?: UserStatus;
  password: string;
  branches: AssignmentInput[];
  departments: AssignmentInput[];
  roleIds?: string[];
};

type NormalizedCreateUserInput = Omit<CreateUserInput, 'roleIds'> & { roleIds: string[] };

type UpdateUserInput = Partial<Omit<CreateUserInput, 'password' | 'status'>> & {
  branches?: AssignmentInput[];
  departments?: AssignmentInput[];
};

type StatusInput = {
  status: UserStatus;
  lockedUntil?: string | null;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type ResetPasswordInput = {
  newPassword: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]{7,20}$/;

const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
};

const normalizeText = (value: string) => value.trim();

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const eventForStatus = (status: UserStatus) => {
  if (status === 'active') {
    return 'user.activated';
  }

  if (status === 'inactive') {
    return 'user.deactivated';
  }

  return 'user.locked';
};

const defaultRoleCode = {
  Nurse: 'CLINICIAN_NURSE',
  Receptionist: 'RECEPTIONIST',
  Doctor: 'DOCTOR',
} as const;

export class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly settings?: Pick<SettingsService, 'getRuntimeUserPreferences'>,
  ) {}

  async list(query: Partial<UserListQuery>) {
    const normalizedQuery: UserListQuery = {
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status,
      branchId: normalizeOptionalText(query.branchId) ?? undefined,
      departmentId: normalizeOptionalText(query.departmentId) ?? undefined,
      roleId: normalizeOptionalText(query.roleId) ?? undefined,
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 20))),
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    };
    const { users, total } = await this.repository.list(normalizedQuery);
    const responses = await this.attachAssignments(users);

    return {
      items: responses,
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / normalizedQuery.limit)),
      },
    };
  }

  async getById(id: string) {
    const user = await this.requireUser(id);
    return (await this.attachAssignments([user]))[0]!;
  }

  summary() {
    return this.repository.summary();
  }

  async create(input: CreateUserInput, actorUserId: string, metadata: RequestMetadata) {
    const normalized = this.normalizeCreateInput(await this.applyConfiguredDefaultRole(input));
    assertPasswordPolicy(normalized.password, await this.getPasswordPolicy());
    await this.assertUniqueFields({
      username: normalized.username,
      email: normalized.email,
      employeeCode: normalized.employeeCode,
    });
    await this.validateReferences(normalized.branches, normalized.departments, normalized.roleIds);

    const user = await this.repository.create({
      ...normalized,
      status: normalized.status ?? 'active',
      passwordHash: await hashPassword(normalized.password),
      actorUserId,
      roleIds: normalized.roleIds,
    });
    await this.repository.replaceAssignments(user.id, normalized.branches, normalized.departments, normalized.roleIds);
    await this.audit('user.created', actorUserId, user.id, metadata);

    return this.getById(user.id);
  }

  async provisionDoctorAccount(
    input: ProvisionDoctorAccountInput,
    actorUserId: string,
    metadata: RequestMetadata,
    session: ClientSession,
  ) {
    const doctorRole = await this.roleRepository.findActiveByCode('DOCTOR', session);
    if (!doctorRole) {
      throw new AppError('Active DOCTOR role is required for doctor login provisioning', 409, 'DOCTOR_ROLE_NOT_CONFIGURED');
    }

    const normalized = this.normalizeCreateInput({
      employeeCode: input.employeeCode,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      jobTitle: 'Doctor',
      employeeType: 'Clinical',
      password: input.password,
      branches: [{ id: input.branchId, isPrimary: true }],
      departments: [{ id: input.departmentId, isPrimary: true }],
      roleIds: [doctorRole.id],
      status: 'active',
    });

    if (!normalized.email) {
      throw new AppError('Login email is required', 400, 'DOCTOR_LOGIN_EMAIL_REQUIRED');
    }

    assertPasswordPolicy(normalized.password, await this.getPasswordPolicy());
    await this.assertUniqueFields(
      {
        username: normalized.username,
        email: normalized.email,
        employeeCode: normalized.employeeCode,
      },
      session,
    );
    await this.validateReferences(normalized.branches, normalized.departments, normalized.roleIds, session);

    const user = await this.repository.create(
      {
        ...normalized,
        status: 'active',
        passwordHash: await hashPassword(normalized.password),
        actorUserId,
        roleIds: normalized.roleIds,
      },
      session,
    );
    await this.repository.replaceAssignments(
      user.id,
      normalized.branches,
      normalized.departments,
      normalized.roleIds,
      session,
    );
    await this.audit('user.created', actorUserId, user.id, metadata, {
      source: 'doctor.onboarding',
      assignedRoleCode: doctorRole.code,
    }, session);

    return user;
  }

  async provisionPatientAccount(
    input: ProvisionPatientAccountInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const patientRole = await this.roleRepository.findActiveByCode('PATIENT');
    if (!patientRole) {
      throw new AppError('Active PATIENT role is required for patient portal provisioning', 409, 'PATIENT_ROLE_NOT_CONFIGURED');
    }

    const username = normalizeText(input.username);
    const email = normalizeOptionalText(input.email);
    const fullName = normalizeText(input.fullName);
    const employeeCode = normalizeText(input.patientNumber);
    const phone = normalizeOptionalText(input.phone);

    if (!email || !emailPattern.test(email)) {
      throw new AppError('A valid patient email is required', 400, 'PATIENT_LOGIN_EMAIL_REQUIRED');
    }
    if (!username || !fullName) {
      throw new AppError('Username and patient name are required', 400, 'PATIENT_ACCOUNT_DETAILS_REQUIRED');
    }
    if (await this.repository.findByPatientId(input.patientId)) {
      throw new AppError('This patient already has a portal account', 409, 'PATIENT_ACCOUNT_EXISTS');
    }

    assertPasswordPolicy(input.password, await this.getPasswordPolicy());
    await this.assertUniqueFields({ username, email, employeeCode });

    const user = await this.repository.create({
      employeeCode,
      username,
      email,
      fullName,
      phone,
      jobTitle: 'Patient',
      employeeType: 'Patient',
      status: 'active',
      passwordHash: await hashPassword(input.password),
      actorUserId,
      roleIds: [patientRole.id],
      patientId: input.patientId,
    });
    await this.repository.replaceAssignments(
      user.id,
      input.branchId ? [{ id: input.branchId, isPrimary: true }] : [],
      [],
      [patientRole.id],
    );
    await this.audit('patient.portal_account.created', actorUserId, user.id, metadata, {
      patientId: input.patientId,
    });

    return { id: user.id, username: user.username, email: user.email, status: user.status };
  }

  async registerPortalAccount(input: RegisterPortalAccountInput, metadata: RequestMetadata) {
    const role = await this.roleRepository.findActiveByCode(input.accountType);
    if (!role) {
      throw new AppError(`Active ${input.accountType} role is required for portal registration`, 409, 'PORTAL_ROLE_NOT_CONFIGURED');
    }

    const fullName = normalizeText(input.fullName);
    const email = normalizeText(input.email).toLowerCase();
    const phone = normalizePhone(input.phone);
    if (!fullName) throw new AppError('Full name is required', 400, 'FULL_NAME_REQUIRED');
    if (!emailPattern.test(email)) throw new AppError('Email format is invalid', 400, 'INVALID_EMAIL');
    if (!phonePattern.test(input.phone) || phone.length < 7) throw new AppError('Mobile number is invalid', 400, 'INVALID_PHONE');
    assertPasswordPolicy(input.password, await this.getPasswordPolicy());
    await this.assertUniqueFields({ username: email, email, phone });

    const user = await this.repository.create({
      employeeCode: `PORTAL-${randomUUID()}`,
      username: email,
      email,
      fullName,
      phone,
      jobTitle: input.accountType === 'GUARDIAN' ? 'Patient Guardian' : 'Patient',
      employeeType: input.accountType === 'GUARDIAN' ? 'Guardian' : 'Patient',
      status: 'active',
      passwordHash: await hashPassword(input.password),
      roleIds: [role.id],
    });
    await this.repository.replaceAssignments(user.id, [], [], [role.id]);
    await this.repository.audit('patient_portal.account.registered', {
      ...metadata,
      actorUserId: user.id,
      subjectUserId: user.id,
      metadata: { accountType: input.accountType },
    });
    return { id: user.id, username: user.username, email: user.email, phone: user.phone, accountType: input.accountType };
  }

  async update(id: string, input: UpdateUserInput, actorUserId: string, metadata: RequestMetadata) {
    await this.requireUser(id);
    const normalized = this.normalizeUpdateInput(input);

    if (normalized.username || normalized.email !== undefined || normalized.employeeCode) {
      await this.assertUniqueFields({
        username: normalized.username,
        email: normalized.email,
        employeeCode: normalized.employeeCode,
        excludeUserId: id,
      });
    }

    if (normalized.branches || normalized.departments || normalized.roleIds) {
      const current = await this.getById(id);
      if (normalized.roleIds && current.roles.some((role) => role.code === 'SUPER_ADMIN')) {
        const keepsSuperAdmin = await Promise.all(normalized.roleIds.map((roleId) => this.repository.isSuperAdminRole(roleId)));
        if (!keepsSuperAdmin.some(Boolean) && await this.repository.countActiveSuperAdmins() <= 1) {
          throw new AppError('The last active Super Admin role assignment cannot be removed', 409, 'LAST_SUPER_ADMIN_REQUIRED');
        }
      }
      await this.validateReferences(
        normalized.branches ?? current.branches,
        normalized.departments ?? current.departments,
        normalized.roleIds ?? current.roleIds,
      );
    }

    const user = await this.repository.update(id, {
      ...normalized,
      actorUserId,
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (normalized.branches || normalized.departments || normalized.roleIds) {
      const current = await this.getById(id);
      await this.repository.replaceAssignments(
        id,
        normalized.branches ?? current.branches.map((branch) => ({ ...branch })),
        normalized.departments ?? current.departments.map((department) => ({ ...department })),
        normalized.roleIds ?? current.roleIds,
      );
    }

    await this.audit('user.updated', actorUserId, id, metadata);
    return this.getById(id);
  }

  async updateProfile(id: string, input: UpdateUserInput, actorUserId: string, metadata: RequestMetadata) {
    return this.update(id, input, actorUserId, metadata);
  }

  async updateStatus(id: string, input: StatusInput, actorUserId: string, metadata: RequestMetadata) {
    const existingUser = await this.requireUser(id);
    if (id === actorUserId && input.status !== 'active') {
      throw new AppError('You cannot deactivate or lock your own account', 409, 'SELF_STATUS_CHANGE_FORBIDDEN');
    }
    if (input.status !== 'active' && await this.repository.isSuperAdmin(id) && await this.repository.countActiveSuperAdmins() <= 1) {
      throw new AppError('The last active Super Admin cannot be deactivated or locked', 409, 'LAST_SUPER_ADMIN_REQUIRED');
    }
    const lockedUntil =
      input.status === 'locked'
        ? input.lockedUntil
          ? new Date(input.lockedUntil)
          : new Date(Date.now() + env.auth.lockoutMinutes * 60 * 1000)
        : null;

    if (lockedUntil && Number.isNaN(lockedUntil.getTime())) {
      throw new AppError('lockedUntil must be a valid date', 400, 'INVALID_LOCKED_UNTIL');
    }

    const user = await this.repository.updateStatus(id, input.status, actorUserId, lockedUntil);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (input.status !== 'active') {
      await this.repository.revokeRefreshTokens(id);
    }

    const eventType =
      input.status === 'active' && existingUser.status === 'locked'
        ? 'user.unlocked'
        : eventForStatus(input.status);

    await this.audit(eventType, actorUserId, id, metadata, {
      status: input.status,
    });

    return this.getById(id);
  }

  async unlock(id: string, actorUserId: string, metadata: RequestMetadata) {
    return this.updateStatus(id, { status: 'active' }, actorUserId, metadata);
  }

  async changePassword(
    id: string,
    input: ChangePasswordInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    const passwordHash = await this.repository.findPasswordHashById(id);

    if (!passwordHash) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const currentPasswordMatches = await verifyPassword(input.currentPassword, passwordHash);

    if (!currentPasswordMatches) {
      throw new AppError('Current password is invalid', 400, 'INVALID_CURRENT_PASSWORD');
    }

    return this.setPassword(id, input.newPassword, actorUserId, metadata, 'user.password.changed');
  }

  async resetPassword(
    id: string,
    input: ResetPasswordInput,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    await this.requireUser(id);
    return this.setPassword(id, input.newPassword, actorUserId, metadata, 'user.password.reset');
  }

  async delete(id: string, actorUserId: string, metadata: RequestMetadata) {
    if (id === actorUserId) {
      throw new AppError('You cannot delete your own account', 409, 'SELF_DELETE_FORBIDDEN');
    }
    if (await this.repository.isSuperAdmin(id) && await this.repository.countActiveSuperAdmins() <= 1) {
      throw new AppError('The last active Super Admin cannot be deleted', 409, 'LAST_SUPER_ADMIN_REQUIRED');
    }
    await this.requireUser(id);
    const deleted = await this.repository.softDelete(id, actorUserId);

    if (!deleted) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.repository.revokeRefreshTokens(id);
    await this.audit('user.deleted', actorUserId, id, metadata);

    return { ok: true };
  }

  async export(query: Partial<UserListQuery>, actorUserId: string, metadata: RequestMetadata) {
    const normalizedQuery: UserListQuery = {
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status,
      branchId: normalizeOptionalText(query.branchId) ?? undefined,
      departmentId: normalizeOptionalText(query.departmentId) ?? undefined,
      roleId: normalizeOptionalText(query.roleId) ?? undefined,
      page: 1,
      limit: 100,
      sortBy: query.sortBy ?? 'fullName',
      sortOrder: query.sortOrder ?? 'asc',
    };
    await this.audit('user.exported', actorUserId, undefined, metadata, { filters: normalizedQuery });
    const loadPage = (page: number) => this.list({ ...normalizedQuery, page, limit: 100 });
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await loadPage(page);
        for (const user of result.items) {
          const primaryDepartment = user.departments.find((item) => item.isPrimary) ?? user.departments[0];
          const primaryBranch = user.branches.find((item) => item.isPrimary) ?? user.branches[0];
          yield [
            user.employeeCode,
            user.fullName,
            user.username,
            user.email,
            user.phone,
            user.roles.map((role) => role.name).join('; '),
            primaryDepartment?.name,
            primaryBranch?.name,
            user.status,
            user.lastLoginAt,
          ];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(
      ['Employee ID', 'Full Name', 'Username', 'Email', 'Phone', 'Role', 'Department', 'Branch', 'Status', 'Last Login'],
      rows(),
    );
  }

  private async setPassword(
    id: string,
    newPassword: string,
    actorUserId: string,
    metadata: RequestMetadata,
    eventType: string,
  ) {
    assertPasswordPolicy(newPassword, await this.getPasswordPolicy());
    const user = await this.repository.updatePassword(id, await hashPassword(newPassword), actorUserId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.repository.revokeRefreshTokens(id);
    await this.audit(eventType, actorUserId, id, metadata);

    return { ok: true };
  }

  private async requireUser(id: string) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
  }

  private async attachAssignments(users: UserRecord[]): Promise<UserResponse[]> {
    const assignments = await this.repository.getAssignments(users.map((user) => user.id));

    return users.map((user) => ({
      id: user.id,
      employeeCode: user.employeeCode,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      jobTitle: user.jobTitle,
      employeeType: user.employeeType,
      hireDate: user.hireDate,
      profilePhotoUrl: user.profilePhotoUrl,
      address: user.address,
      status: user.status,
      lockedUntil: user.lockedUntil,
      passwordChangedAt: user.passwordChangedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      createdBy: user.createdBy,
      updatedBy: user.updatedBy,
      deletedBy: user.deletedBy,
      roleIds: user.roleIds,
      patientId: user.patientId,
      branches: assignments.branchesByUserId.get(user.id) ?? [],
      departments: assignments.departmentsByUserId.get(user.id) ?? [],
      roles: assignments.rolesByUserId.get(user.id) ?? [],
      audit: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        passwordChangedAt: user.passwordChangedAt,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
      },
    }));
  }

  private normalizeCreateInput(input: CreateUserInput): NormalizedCreateUserInput {
    const normalized: NormalizedCreateUserInput = {
      employeeCode: normalizeText(input.employeeCode),
      username: normalizeText(input.username),
      email: normalizeOptionalText(input.email),
      fullName: normalizeText(input.fullName),
      phone: normalizeOptionalText(input.phone),
      jobTitle: normalizeOptionalText(input.jobTitle),
      employeeType: normalizeOptionalText(input.employeeType),
      hireDate: normalizeOptionalText(input.hireDate),
      profilePhotoUrl: normalizeOptionalText(input.profilePhotoUrl),
      address: normalizeOptionalText(input.address),
      status: input.status ?? 'active',
      password: input.password,
      branches: this.normalizeAssignments(input.branches, 'branch'),
      departments: this.normalizeAssignments(input.departments, 'department'),
      roleIds: this.normalizeRoleIds(input.roleIds),
    };

    this.validateProfile(normalized);
    return normalized;
  }

  private normalizeUpdateInput(input: UpdateUserInput): UpdateUserInput {
    const normalized: UpdateUserInput = {
      employeeCode: input.employeeCode === undefined ? undefined : normalizeText(input.employeeCode),
      username: input.username === undefined ? undefined : normalizeText(input.username),
      email: normalizeOptionalText(input.email),
      fullName: input.fullName === undefined ? undefined : normalizeText(input.fullName),
      phone: normalizeOptionalText(input.phone),
      jobTitle: normalizeOptionalText(input.jobTitle),
      employeeType: normalizeOptionalText(input.employeeType),
      hireDate: normalizeOptionalText(input.hireDate),
      profilePhotoUrl: normalizeOptionalText(input.profilePhotoUrl),
      address: normalizeOptionalText(input.address),
      branches: input.branches ? this.normalizeAssignments(input.branches, 'branch') : undefined,
      departments: input.departments
        ? this.normalizeAssignments(input.departments, 'department')
        : undefined,
      roleIds: input.roleIds ? this.normalizeRoleIds(input.roleIds) : undefined,
    };

    this.validateProfile(normalized);
    return normalized;
  }

  private normalizeAssignments(assignments: AssignmentInput[], label: string) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new AppError(`At least one ${label} assignment is required`, 400, 'ASSIGNMENT_REQUIRED');
    }

    const normalized = assignments.map((assignment) => ({
      id: normalizeText(assignment.id),
      name: normalizeOptionalText(assignment.name),
      isPrimary: Boolean(assignment.isPrimary),
    }));

    if (normalized.some((assignment) => assignment.id.length === 0)) {
      throw new AppError(`${label} assignment id is required`, 400, 'ASSIGNMENT_REQUIRED');
    }

    if (new Set(normalized.map((assignment) => assignment.id)).size !== normalized.length) {
      throw new AppError(`Duplicate ${label} assignment`, 400, 'DUPLICATE_ASSIGNMENT');
    }

    if (normalized.filter((assignment) => assignment.isPrimary).length !== 1) {
      throw new AppError(`Exactly one primary ${label} assignment is required`, 400, 'PRIMARY_ASSIGNMENT_REQUIRED');
    }

    return normalized;
  }

  private normalizeRoleIds(roleIds: string[] | undefined) {
    if (!roleIds) {
      throw new AppError('At least one role assignment is required', 400, 'ROLE_ASSIGNMENT_REQUIRED');
    }
    const normalized = roleIds.map(normalizeText).filter(Boolean);
    if (normalized.length === 0) {
      throw new AppError('At least one role assignment is required', 400, 'ROLE_ASSIGNMENT_REQUIRED');
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new AppError('Duplicate role assignment', 400, 'DUPLICATE_ROLE_ASSIGNMENT');
    }
    return normalized;
  }

  private async applyConfiguredDefaultRole(input: CreateUserInput): Promise<CreateUserInput> {
    if (input.roleIds?.some((roleId) => normalizeText(roleId))) {
      return input;
    }

    const preferences = await this.settings?.getRuntimeUserPreferences();
    if (!preferences) {
      return input;
    }

    const role = await this.roleRepository.findActiveByCode(defaultRoleCode[preferences.defaultRole]);
    return role ? { ...input, roleIds: [role.id] } : input;
  }

  private async getPasswordPolicy() {
    const preferences = await this.settings?.getRuntimeUserPreferences() ?? null;
    return getEffectivePasswordPolicy(preferences);
  }

  private async validateReferences(
    branches: AssignmentInput[],
    departments: AssignmentInput[],
    roleIds: string[],
    session?: ClientSession,
  ) {
    const branchIds = branches.map((item) => item.id);
    const departmentIds = departments.map((item) => item.id);
    const result = await this.repository.validateReferences(branchIds, departmentIds, roleIds, session);
    if (result.branches !== branchIds.length) {
      throw new AppError('One or more branch assignments are invalid or inactive', 400, 'INVALID_BRANCH_ASSIGNMENT');
    }
    if (result.departments !== departmentIds.length) {
      throw new AppError('One or more department assignments are invalid or inactive', 400, 'INVALID_DEPARTMENT_ASSIGNMENT');
    }
    if (result.roles !== roleIds.length) {
      throw new AppError('One or more role assignments are invalid or inactive', 400, 'INVALID_ROLE_ASSIGNMENT');
    }
  }

  private validateProfile(input: Partial<CreateUserInput>) {
    if (input.employeeCode !== undefined && input.employeeCode.length === 0) {
      throw new AppError('Employee code is required', 400, 'EMPLOYEE_CODE_REQUIRED');
    }

    if (input.username !== undefined && input.username.length === 0) {
      throw new AppError('Username is required', 400, 'USERNAME_REQUIRED');
    }

    if (input.fullName !== undefined && input.fullName.length === 0) {
      throw new AppError('Full name is required', 400, 'FULL_NAME_REQUIRED');
    }

    if (input.email && !emailPattern.test(input.email)) {
      throw new AppError('Email format is invalid', 400, 'INVALID_EMAIL');
    }

    if (input.phone && !phonePattern.test(input.phone)) {
      throw new AppError('Phone format is invalid', 400, 'INVALID_PHONE');
    }

    if (input.hireDate && Number.isNaN(new Date(input.hireDate).getTime())) {
      throw new AppError('Hire date is invalid', 400, 'INVALID_HIRE_DATE');
    }
  }

  private async assertUniqueFields(input: {
    username?: string;
    email?: string | null;
    phone?: string | null;
    employeeCode?: string | null;
    excludeUserId?: string;
  }, session?: ClientSession) {
    const duplicate = await this.repository.findByUniqueFields(input, session);

    if (!duplicate) {
      return;
    }

    if (input.username && duplicate.username.toLowerCase() === input.username.toLowerCase()) {
      throw new AppError('Username already exists', 409, 'DUPLICATE_USERNAME');
    }

    if (input.email && duplicate.email?.toLowerCase() === input.email.toLowerCase()) {
      throw new AppError('Email already exists', 409, 'DUPLICATE_EMAIL');
    }

    if (input.employeeCode && duplicate.employeeCode === input.employeeCode) {
      throw new AppError('Employee code already exists', 409, 'DUPLICATE_EMPLOYEE_CODE');
    }

    if (input.phone && duplicate.phone === input.phone) {
      throw new AppError('Mobile number already exists', 409, 'DUPLICATE_PHONE');
    }
  }

  private async audit(
    eventType: string,
    actorUserId: string,
    subjectUserId: string | undefined,
    metadata: RequestMetadata,
    eventMetadata?: Record<string, unknown>,
    session?: ClientSession,
  ) {
    await this.repository.audit(eventType, {
      ...metadata,
      actorUserId,
      subjectUserId,
      metadata: eventMetadata,
    }, session);
  }
}
