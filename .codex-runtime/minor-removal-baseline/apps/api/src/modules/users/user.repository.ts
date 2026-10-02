import type { ClientSession } from 'mongoose';
import { UserModel } from './user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { RoleModel } from '../roles/role.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  AssignmentInput,
  RequestMetadata,
  UserAssignment,
  UserListQuery,
  UserRecord,
  UserStatus,
} from './user.types.js';

type UserDoc = {
  _id: unknown;
  employeeCode?: string | null;
  username: string;
  email?: string | null;
  fullName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  employeeType?: string | null;
  hireDate?: Date | null;
  profilePhotoUrl?: string | null;
  address?: string | null;
  status: string;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  passwordChangedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy?: unknown;
  updatedBy?: unknown;
  deletedBy?: unknown;
  roleIds?: unknown[];
  patientId?: unknown | null;
};

const mapUser = (user: UserDoc): UserRecord => ({
  id: String(user._id),
  employeeCode: user.employeeCode ?? null,
  username: user.username ?? user.email ?? user.employeeCode ?? String(user._id),
  email: user.email ?? null,
  fullName: user.fullName ?? user.username ?? user.email ?? 'User',
  phone: user.phone ?? null,
  jobTitle: user.jobTitle ?? null,
  employeeType: user.employeeType ?? null,
  hireDate: user.hireDate ? (typeof user.hireDate === 'string' ? user.hireDate : (user.hireDate as Date).toISOString()) : null,
  profilePhotoUrl: user.profilePhotoUrl ?? null,
  address: user.address ?? null,
  status: (user.status as UserStatus) ?? 'active',
  failedLoginAttempts: user.failedLoginAttempts ?? 0,
  lockedUntil: user.lockedUntil ?? null,
  passwordChangedAt: user.passwordChangedAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
  updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
  deletedAt: user.deletedAt ?? null,
  createdBy: user.createdBy ? String(user.createdBy) : null,
  updatedBy: user.updatedBy ? String(user.updatedBy) : null,
  deletedBy: user.deletedBy ? String(user.deletedBy) : null,
  roleIds: (user.roleIds ?? []).map((id: unknown) => String(id)),
  patientId: user.patientId ? String(user.patientId) : null,
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class UserRepository {
  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');

    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }));
    if (requestedBranchId) {
      const branchExists = Boolean(await BranchModel.exists({
        _id: requestedBranchId,
        status: 'ACTIVE',
        deletedAt: null,
      }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) {
        throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      }
      return [requestedBranchId];
    }
    if (isSuperAdmin) return undefined;

    const activeBranches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] },
      status: 'ACTIVE',
      deletedAt: null,
    }).select('_id').lean();
    return activeBranches.map((branch) => String(branch._id));
  }

  async isUserInBranchScope(userId: string, branchIds: string[]) {
    return Boolean(await UserModel.exists({
      _id: userId,
      branchIds: { $in: branchIds },
      deletedAt: null,
    }));
  }

  async findById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).lean();
    return user ? mapUser(user as unknown as UserDoc) : null;
  }

  async findPasswordHashById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).select('passwordHash').lean();
    return user?.passwordHash ?? null;
  }

  async findByPatientId(patientId: string) {
    const user = await UserModel.findOne({ patientId, deletedAt: null }).lean();
    return user ? mapUser(user) : null;
  }

  async findByUniqueFields(fields: {
    username?: string;
    email?: string | null;
    phone?: string | null;
    employeeCode?: string | null;
    excludeUserId?: string;
  }, session?: ClientSession) {
    const filter: Record<string, unknown> = { deletedAt: null };
    
    if (fields.excludeUserId) {
      filter._id = { $ne: fields.excludeUserId };
    }

    const orConditions: Array<Record<string, unknown>> = [];

    if (fields.username) {
      orConditions.push({ username: new RegExp(`^${escapeRegex(fields.username)}$`, 'i') });
    }
    if (fields.email) {
      orConditions.push({ email: new RegExp(`^${escapeRegex(fields.email)}$`, 'i') });
    }
    if (fields.employeeCode) {
      orConditions.push({ employeeCode: fields.employeeCode });
    }
    if (fields.phone) {
      orConditions.push({ phone: fields.phone });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    } else {
      return null;
    }

    const queryDoc = UserModel.findOne(filter);
    if (session) queryDoc.session(session);
    const user = await queryDoc.lean();
    return user ? mapUser(user as unknown as UserDoc) : null;
  }

  async list(query: UserListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = { deletedAt: null };
    if (branchIds) filter.branchIds = { $in: branchIds };
    
    if (query.status) {
      filter.status = query.status;
    }
    if (query.branchId) {
      filter.branchIds = query.branchId;
    }
    if (query.departmentId) {
      filter.departmentIds = query.departmentId;
    }
    if (query.roleId) {
      filter.roleIds = query.roleId;
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { fullName: searchRegex },
        { employeeCode: searchRegex },
        { phone: searchRegex },
      ];
    }

    let sortKey = query.sortBy ?? 'createdAt';
    if (sortKey === 'fullName') sortKey = 'fullName'; // we don't have fullName in schema exactly? wait, schema doesn't have fullName! 
    // Wait, let's fix that. Schema needs fullName if we query by it.
    
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      UserModel.find(filter)
        .sort({ [sortKey]: sortOrder, _id: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    return {
      users: data.map(u => mapUser(u as unknown as UserDoc)),
      total: count,
    };
  }

  async create(input: {
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
    status: UserStatus;
    passwordHash: string;
    actorUserId?: string;
    roleIds: string[];
    patientId?: string | null;
  }, session?: ClientSession) {
    const created = await UserModel.create([{
      employeeCode: input.employeeCode,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      jobTitle: input.jobTitle,
      employeeType: input.employeeType,
      hireDate: input.hireDate ? new Date(input.hireDate) : null,
      profilePhotoUrl: input.profilePhotoUrl,
      address: input.address,
      status: input.status,
      passwordHash: input.passwordHash,
      roleIds: input.roleIds,
      patientId: input.patientId,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    } as unknown as Partial<import('./user.model.js').IUser>], session ? { session } : {});
    const user = created[0];

    if (!user) {
      throw new Error('User account could not be created');
    }
    
    return mapUser(user.toObject() as unknown as UserDoc);
  }

  async update(
    id: string,
    input: {
      employeeCode?: string;
      username?: string;
      email?: string | null;
      fullName?: string;
      phone?: string | null;
      jobTitle?: string | null;
      employeeType?: string | null;
      hireDate?: string | null;
      profilePhotoUrl?: string | null;
      address?: string | null;
      actorUserId: string;
      roleIds?: string[];
    },
  ) {
    const updatePayload: Record<string, unknown> = { updatedBy: input.actorUserId };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key !== 'actorUserId' && key !== 'branches' && key !== 'departments') {
        updatePayload[key] = value;
      }
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { returnDocument: 'after', lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async updateStatus(id: string, status: UserStatus, actorUserId: string, lockedUntil?: Date | null) {
    const updatePayload: Record<string, unknown> = { 
      status, 
      updatedBy: actorUserId 
    };
    
    if (status === 'locked') {
      updatePayload.lockedUntil = lockedUntil;
    } else {
      updatePayload.lockedUntil = null;
      updatePayload.failedLoginAttempts = 0;
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { returnDocument: 'after', lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async updatePassword(id: string, passwordHash: string, actorUserId: string) {
    const user = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedBy: actorUserId,
        }
      },
      { returnDocument: 'after', lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async softDelete(id: string, actorUserId: string) {
    const user = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: actorUserId,
          updatedBy: actorUserId,
        }
      },
      { returnDocument: 'after', lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async replaceAssignments(
    userId: string,
    branches: AssignmentInput[],
    departments: AssignmentInput[],
    roleIds: string[],
    session?: ClientSession,
  ) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          branchIds: branches.map(b => b.id),
          departmentIds: departments.map(d => d.id),
          roleIds,
        }
      },
      session ? { session } : undefined,
    );
  }

  async getAssignments(userIds: string[]) {
    if (userIds.length === 0) {
      return {
        branchesByUserId: new Map<string, UserAssignment[]>(),
        departmentsByUserId: new Map<string, UserAssignment[]>(),
        rolesByUserId: new Map(),
      };
    }

    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('branchIds departmentIds roleIds')
      .populate('branchIds', 'name')
      .populate('departmentIds', 'name')
      .populate('roleIds', 'code name status')
      .lean();

    const branchesByUserId = new Map<string, UserAssignment[]>();
    const departmentsByUserId = new Map<string, UserAssignment[]>();
    const rolesByUserId = new Map<string, Array<{ id: string; code: string; name: string; status: 'active' | 'inactive' }>>();

    for (const user of users) {
      const userIdStr = user._id.toString();
      
      const userBranches = ((user.branchIds as unknown as Array<{ _id: unknown; name: string }>) ?? [])
        .filter((b) => Boolean(b && typeof b === 'object' && '_id' in b))
        .map((b, i) => ({
          id: String(b._id),
          name: b.name ?? null,
          isPrimary: i === 0,
        }));
      branchesByUserId.set(userIdStr, userBranches);
      
      const userDepts = ((user.departmentIds as unknown as Array<{ _id: unknown; name: string }>) ?? [])
        .filter((d) => Boolean(d && typeof d === 'object' && '_id' in d))
        .map((d, i) => ({
          id: String(d._id),
          name: d.name ?? null,
          isPrimary: i === 0,
        }));
      departmentsByUserId.set(userIdStr, userDepts);

      const userRoles = ((user.roleIds as unknown as Array<{ _id: unknown; code: string; name: string; status: 'active' | 'inactive' }>) ?? [])
        .filter((role) => Boolean(role && typeof role === 'object' && '_id' in role && role.code))
        .map((role) => ({
          id: String(role._id),
          code: role.code,
          name: role.name ?? role.code,
          status: (role.status as 'active' | 'inactive') ?? 'active',
        }));
      rolesByUserId.set(userIdStr, userRoles);
    }

    return { branchesByUserId, departmentsByUserId, rolesByUserId };
  }

  async validateReferences(
    branchIds: string[],
    departmentIds: string[],
    roleIds: string[],
    session?: ClientSession,
  ) {
    const branchQuery = BranchModel.countDocuments({ _id: { $in: branchIds }, status: 'ACTIVE', deletedAt: null });
    const departmentQuery = DepartmentModel.countDocuments({
      _id: { $in: departmentIds },
      status: 'ACTIVE',
      deletedAt: null,
    });
    const roleQuery = RoleModel.countDocuments({ _id: { $in: roleIds }, status: 'active', deletedAt: null });

    if (session) {
      const branches = await branchQuery.session(session);
      const departments = await departmentQuery.session(session);
      const roles = await roleQuery.session(session);
      return { branches, departments, roles };
    }

    const [branches, departments, roles] = await Promise.all([branchQuery, departmentQuery, roleQuery]);
    return { branches, departments, roles };
  }

  async countDepartmentsInBranches(departmentIds: string[], branchIds: string[], session?: ClientSession) {
    const query = DepartmentModel.countDocuments({
      _id: { $in: departmentIds },
      branchIds: { $in: branchIds },
      status: 'ACTIVE',
      deletedAt: null,
    });
    return session ? query.session(session) : query;
  }

  async isSuperAdmin(userId: string) {
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN', deletedAt: null }).select('_id').lean();
    if (!superAdminRole) return false;
    return Boolean(await UserModel.exists({ _id: userId, roleIds: superAdminRole._id, deletedAt: null }));
  }

  async isSuperAdminRole(roleId: string) {
    return Boolean(await RoleModel.exists({ _id: roleId, code: 'SUPER_ADMIN', deletedAt: null }));
  }

  async countActiveSuperAdmins() {
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN', status: 'active', deletedAt: null }).select('_id').lean();
    if (!superAdminRole) return 0;
    return UserModel.countDocuments({ roleIds: superAdminRole._id, status: 'active', deletedAt: null });
  }

  async summary(branchIds?: string[]) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const scope = branchIds ? { branchIds: { $in: branchIds } } : {};
    const [total, active, inactive, locked, addedThisMonth] = await Promise.all([
      UserModel.countDocuments({ deletedAt: null, ...scope }),
      UserModel.countDocuments({ deletedAt: null, status: 'active', ...scope }),
      UserModel.countDocuments({ deletedAt: null, status: 'inactive', ...scope }),
      UserModel.countDocuments({ deletedAt: null, status: 'locked', ...scope }),
      UserModel.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth }, ...scope }),
    ]);
    return { total, active, inactive, locked, addedThisMonth };
  }

  async revokeRefreshTokens(userId: string) {
    // Rely on AuthRepository for this, or duplicate logic since it's just a method here
    // In our Mongoose structure, we use the Auth model for Refresh Tokens, but we can do it here via model.
    // The instructions say use collections.
    const { RefreshTokenModel } = await import('../auth/refresh-token.model.js');
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { strict: false }
    );
  }

  async audit(
    eventType: string,
    metadata: RequestMetadata & {
      actorUserId?: string;
      subjectUserId?: string;
      metadata?: Record<string, unknown>;
    },
    session?: ClientSession,
  ) {
    const { AuditLogModel } = await import('../auth/auth.model.js');
    await AuditLogModel.create([{
      eventType,
      actorUserId: metadata.actorUserId,
      subjectUserId: metadata.subjectUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: metadata.metadata,
    }], session ? { session } : {});
  }
}
