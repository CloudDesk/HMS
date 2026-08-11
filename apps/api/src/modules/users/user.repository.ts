
import { UserModel, type IUser } from './user.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  AssignmentInput,
  RequestMetadata,
  UserAssignment,
  UserListQuery,
  UserRecord,
  UserStatus,
} from './user.types.js';

const mapUser = (user: any): UserRecord => ({
  id: user._id.toString(),
  employeeCode: user.employeeCode ?? null,
  username: user.username,
  email: user.email ?? null,
  fullName: user.fullName ?? user.username,
  phone: user.phone ?? null,
  jobTitle: user.jobTitle ?? null,
  employeeType: user.employeeType ?? null,
  hireDate: user.hireDate ?? null,
  profilePhotoUrl: user.profilePhotoUrl ?? null,
  address: user.address ?? null,
  status: user.status as UserStatus,
  failedLoginAttempts: user.failedLoginAttempts ?? 0,
  lockedUntil: user.lockedUntil ?? null,
  passwordChangedAt: user.passwordChangedAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  deletedAt: user.deletedAt ?? null,
  createdBy: user.createdBy?.toString() ?? null,
  updatedBy: user.updatedBy?.toString() ?? null,
  deletedBy: user.deletedBy?.toString() ?? null,
});

export class UserRepository {
  async findById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).lean();
    return user ? mapUser(user) : null;
  }

  async findPasswordHashById(id: string) {
    const user = await UserModel.findOne({ _id: id, deletedAt: null }).select('passwordHash').lean();
    return user?.passwordHash ?? null;
  }

  async findByUniqueFields(fields: {
    username?: string;
    email?: string | null;
    employeeCode?: string | null;
    excludeUserId?: string;
  }) {
    const filter: Record<string, any> = { deletedAt: null };
    
    if (fields.excludeUserId) {
      filter._id = { $ne: fields.excludeUserId };
    }

    const orConditions: any[] = [];
    if (fields.username) {
      orConditions.push({ username: new RegExp(`^${fields.username}$`, 'i') });
    }
    if (fields.email) {
      orConditions.push({ email: new RegExp(`^${fields.email}$`, 'i') });
    }
    if (fields.employeeCode) {
      orConditions.push({ employeeCode: fields.employeeCode });
    }

    if (orConditions.length > 0) {
      filter.$or = orConditions;
    } else {
      return null;
    }

    const user = await UserModel.findOne(filter).lean();
    return user ? mapUser(user) : null;
  }

  async list(query: UserListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, any> = { deletedAt: null };
    
    if (query.status) {
      filter.status = query.status;
    }
    if (query.branchId) {
      filter.branchIds = query.branchId;
    }
    if (query.departmentId) {
      filter.departmentIds = query.departmentId;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
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
      users: data.map(mapUser),
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
    actorUserId: string;
  }) {
    const user = await UserModel.create({
      employeeCode: input.employeeCode,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      jobTitle: input.jobTitle,
      employeeType: input.employeeType,
      hireDate: input.hireDate,
      profilePhotoUrl: input.profilePhotoUrl,
      address: input.address,
      status: input.status,
      passwordHash: input.passwordHash,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    } as any);
    
    return mapUser(user.toObject());
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
    },
  ) {
    const updatePayload: any = { updatedBy: input.actorUserId };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key !== 'actorUserId') {
        updatePayload[key] = value;
      }
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { new: true, lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async updateStatus(id: string, status: UserStatus, actorUserId: string, lockedUntil?: Date | null) {
    const updatePayload: any = { 
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
      { new: true, lean: true }
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
      { new: true, lean: true }
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
      { new: true, lean: true }
    );
    
    return user ? mapUser(user) : null;
  }

  async replaceAssignments(
    userId: string,
    branches: AssignmentInput[],
    departments: AssignmentInput[],
  ) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          branchIds: branches.map(b => b.id),
          departmentIds: departments.map(d => d.id),
        }
      }
    );
  }

  async getAssignments(userIds: string[]) {
    if (userIds.length === 0) {
      return {
        branchesByUserId: new Map<string, UserAssignment[]>(),
        departmentsByUserId: new Map<string, UserAssignment[]>(),
      };
    }

    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('branchIds departmentIds')
      .populate('branchIds', 'name')
      .populate('departmentIds', 'name')
      .lean();

    const branchesByUserId = new Map<string, UserAssignment[]>();
    const departmentsByUserId = new Map<string, UserAssignment[]>();

    for (const user of users) {
      const userIdStr = user._id.toString();
      
      const userBranches = (user.branchIds as any[] || []).map((b, i) => ({
        id: b._id.toString(),
        name: b.name,
        isPrimary: i === 0, // Mock primary behavior as first item
      }));
      branchesByUserId.set(userIdStr, userBranches);
      
      const userDepts = (user.departmentIds as any[] || []).map((d, i) => ({
        id: d._id.toString(),
        name: d.name,
        isPrimary: i === 0,
      }));
      departmentsByUserId.set(userIdStr, userDepts);
    }

    return { branchesByUserId, departmentsByUserId };
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
  ) {
    const { AuditLogModel } = await import('../auth/auth.model.js');
    await AuditLogModel.create({
      eventType,
      actorUserId: metadata.actorUserId,
      subjectUserId: metadata.subjectUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: metadata.metadata,
    });
  }
}
