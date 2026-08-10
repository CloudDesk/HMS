import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../shared/security/hash.js';
import { assertPasswordPolicy } from '../../shared/security/password-policy.js';
import { UserRepository } from './user.repository.js';
import type {
  AssignmentInput,
  RequestMetadata,
  UserListQuery,
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
};

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

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async list(query: Partial<UserListQuery>) {
    const normalizedQuery: UserListQuery = {
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status,
      branchId: normalizeOptionalText(query.branchId) ?? undefined,
      departmentId: normalizeOptionalText(query.departmentId) ?? undefined,
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

  async create(input: CreateUserInput, actorUserId: string, metadata: RequestMetadata) {
    const normalized = this.normalizeCreateInput(input);
    assertPasswordPolicy(normalized.password);
    await this.assertUniqueFields({
      username: normalized.username,
      email: normalized.email,
      employeeCode: normalized.employeeCode,
    });

    const user = await this.repository.create({
      ...normalized,
      status: normalized.status ?? 'active',
      passwordHash: await hashPassword(normalized.password),
      actorUserId,
    });
    await this.repository.replaceAssignments(user.id, normalized.branches, normalized.departments);
    await this.audit('user.created', actorUserId, user.id, metadata);

    return this.getById(user.id);
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

    const user = await this.repository.update(id, {
      ...normalized,
      actorUserId,
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (normalized.branches || normalized.departments) {
      const current = await this.getById(id);
      await this.repository.replaceAssignments(
        id,
        normalized.branches ?? current.branches.map((branch) => ({ ...branch })),
        normalized.departments ?? current.departments.map((department) => ({ ...department })),
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
    await this.requireUser(id);
    const deleted = await this.repository.softDelete(id, actorUserId);

    if (!deleted) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.repository.revokeRefreshTokens(id);
    await this.audit('user.deleted', actorUserId, id, metadata);

    return { ok: true };
  }

  private async setPassword(
    id: string,
    newPassword: string,
    actorUserId: string,
    metadata: RequestMetadata,
    eventType: string,
  ) {
    assertPasswordPolicy(newPassword);
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
      branches: assignments.branchesByUserId.get(user.id) ?? [],
      departments: assignments.departmentsByUserId.get(user.id) ?? [],
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

  private normalizeCreateInput(input: CreateUserInput): CreateUserInput {
    const normalized: CreateUserInput = {
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
    employeeCode?: string | null;
    excludeUserId?: string;
  }) {
    const duplicate = await this.repository.findByUniqueFields(input);

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
  }

  private async audit(
    eventType: string,
    actorUserId: string,
    subjectUserId: string,
    metadata: RequestMetadata,
    eventMetadata?: Record<string, unknown>,
  ) {
    await this.repository.audit(eventType, {
      ...metadata,
      actorUserId,
      subjectUserId,
      metadata: eventMetadata,
    });
  }
}
