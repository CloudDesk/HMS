import mongoose, { Types, type ClientSession } from 'mongoose';
import { BranchModel } from './branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { UserModel } from '../users/user.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import type { Branch, BranchListQuery, BranchRequestMetadata, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';
import type { IBranch } from './branch.model.js';
import type { UpdateQuery } from 'mongoose';

type BranchRecord = {
  _id: unknown;
  code: string;
  name: string;
  shortName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  status: Branch['status'];
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const toBranch = (branch: BranchRecord): Branch => ({
  id: String(branch._id),
  code: branch.code,
  name: branch.name,
  short_name: branch.shortName ?? null,
  email: branch.email ?? null,
  phone: branch.phone ?? null,
  address: branch.address ?? null,
  city: branch.city ?? null,
  state: branch.state ?? null,
  country: branch.country ?? null,
  postal_code: branch.postalCode ?? null,
  status: branch.status,
  created_by: branch.createdBy ? String(branch.createdBy) : null,
  updated_by: branch.updatedBy ? String(branch.updatedBy) : null,
  created_at: branch.createdAt,
  updated_at: branch.updatedAt,
});

const toPersistence = (data: CreateBranchDTO | UpdateBranchDTO) =>
  Object.fromEntries(
    Object.entries({
      code: data.code,
      name: data.name,
      shortName: data.short_name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      postalCode: data.postal_code,
      status: 'status' in data ? data.status : undefined,
    }).filter(([, value]) => value !== undefined),
  );

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class BranchRepository {
  async list(query: BranchListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const sortColumnByApiField = {
      code: 'code',
      created_at: 'createdAt',
      name: 'name',
      status: 'status',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumnByApiField[query.sortBy] : 'code';
    const sortOrder = query.sortOrder ? (query.sortOrder === 'asc' ? 1 : -1) : 1;

    const [data, count] = await Promise.all([
      BranchModel.find(filter)
        .sort({ [sortColumn]: sortOrder, name: 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      BranchModel.countDocuments(filter),
    ]);

    return {
      data: data.map((branch) => toBranch(branch)),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Branch | undefined> {
    const branch = await BranchModel.findOne({ _id: id, deletedAt: null }).lean();
    return branch ? toBranch(branch) : undefined;
  }

  async getByCode(code: string): Promise<Branch | undefined> {
    const branch = await BranchModel.findOne({ code: new RegExp(`^${escapeRegex(code)}$`, 'i'), deletedAt: null }).lean();
    return branch ? toBranch(branch) : undefined;
  }

  async create(data: CreateBranchDTO, createdBy: string): Promise<Branch> {
    const branch = await BranchModel.create({
      ...toPersistence(data),
      status: data.status ?? 'ACTIVE',
      createdBy: createdBy,
      updatedBy: createdBy,
    });
    return toBranch(branch.toObject());
  }

  async update(id: string, data: UpdateBranchDTO, updatedBy: string): Promise<Branch> {
    const branch = await BranchModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...toPersistence(data), updatedBy } as UpdateQuery<IBranch>['$set'] },
      { returnDocument: 'after', lean: true }
    );
    if (!branch) {
      throw new Error('Branch not found');
    }
    return toBranch(branch);
  }

  async summary() {
    const [total, active, inactive, assignedUsers, cities] = await Promise.all([
      BranchModel.countDocuments({ deletedAt: null }),
      BranchModel.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
      BranchModel.countDocuments({ deletedAt: null, status: 'INACTIVE' }),
      UserModel.countDocuments({ branchIds: { $ne: [] }, deletedAt: null }),
      BranchModel.distinct('city', { deletedAt: null, city: { $nin: [null, ''] } }).then((values) => values.length),
    ]);
    return { total, active, inactive, assignedUsers, cities };
  }

  async dependencies(id: string, session?: ClientSession) {
    const departmentQuery = DepartmentModel.countDocuments({ $or: [{ branchIds: id }, { branchId: id }], deletedAt: null });
    const userQuery = UserModel.countDocuments({ branchIds: id, deletedAt: null });
    const doctorQuery = DoctorModel.countDocuments({ branchId: id, deletedAt: null });
    if (session) { departmentQuery.session(session); userQuery.session(session); doctorQuery.session(session); }
    const [departments, users, doctors] = await Promise.all([departmentQuery, userQuery, doctorQuery]);
    return { departments, users, doctors };
  }

  async deletePreview(id: string, page = 1, limit = 25) {
    const offset = (page - 1) * limit;
    const [users, departments, doctors, totalUsers] = await Promise.all([
      UserModel.find({ branchIds: id, deletedAt: null }).select('_id fullName username jobTitle status').sort({ fullName: 1 }).skip(offset).limit(limit).lean(),
      DepartmentModel.countDocuments({ $or: [{ branchIds: id }, { branchId: id }], deletedAt: null }),
      DoctorModel.countDocuments({ branchId: id, deletedAt: null }),
      UserModel.countDocuments({ branchIds: id, deletedAt: null }),
    ]);
    return {
      users: users.map((user) => ({ id: String(user._id), name: user.fullName || user.username, job_title: user.jobTitle ?? null, status: user.status })),
      user_meta: { page, limit, total: totalUsers },
      departments,
      doctors,
    };
  }

  async session() {
    return mongoose.startSession();
  }

  async reassignUsers(fromBranchId: string, toBranchId: string, actorUserId: string, session?: ClientSession) {
    const filter = { branchIds: fromBranchId, deletedAt: null };
    const count = await UserModel.countDocuments(filter).session(session ?? null);
    const options = session ? { session } : {};
    await UserModel.updateMany(
      filter,
      { $addToSet: { branchIds: new Types.ObjectId(toBranchId) }, $set: { updatedBy: new Types.ObjectId(actorUserId) } },
      options,
    );
    await UserModel.updateMany(
      filter,
      { $pull: { branchIds: new Types.ObjectId(fromBranchId) } },
      options,
    );
    return count;
  }

  async reassignDepartments(fromBranchId: string, toBranchId: string, actorUserId: string, session?: ClientSession) {
    const filter = { $or: [{ branchIds: fromBranchId }, { branchId: fromBranchId }], deletedAt: null };
    const count = await DepartmentModel.countDocuments(filter).session(session ?? null);
    const options = session ? { session } : {};
    await DepartmentModel.updateMany(
      filter,
      { $addToSet: { branchIds: new Types.ObjectId(toBranchId) }, $set: { updatedBy: new Types.ObjectId(actorUserId) } },
      options,
    );
    await DepartmentModel.updateMany(
      filter,
      { $pull: { branchIds: new Types.ObjectId(fromBranchId) }, $unset: { branchId: 1 } },
      options,
    );
    return count;
  }

  async reassignDoctors(fromBranchId: string, toBranchId: string, actorUserId: string, session?: ClientSession) {
    const result = await DoctorModel.updateMany(
      { branchId: fromBranchId, deletedAt: null },
      { $set: { branchId: new Types.ObjectId(toBranchId), updatedBy: new Types.ObjectId(actorUserId) } },
      session ? { session } : {},
    );
    return result.modifiedCount;
  }

  async softDelete(id: string, actorUserId: string, session?: ClientSession) {
    return BranchModel.findOneAndUpdate(
      { _id: id, status: 'INACTIVE', deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true, ...(session ? { session } : {}) },
    );
  }

  async audit(eventType: string, actorUserId: string, metadata: BranchRequestMetadata, details: Record<string, unknown>, session?: ClientSession) {
    await AuditLogModel.create([{
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    }], session ? { session } : {});
  }
}
