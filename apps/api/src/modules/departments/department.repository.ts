import { Types, type SortOrder } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { ServiceModel } from '../services/service.model.js';
import { UserModel } from '../users/user.model.js';
import { DepartmentModel } from './department.model.js';
import type {
  CreateDepartmentDTO,
  Department,
  DepartmentListQuery,
  DepartmentRequestMetadata,
  UpdateDepartmentDTO,
} from './department.types.js';

type DepartmentRecord = {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string | null;
  branchIds?: Types.ObjectId[];
  branchId?: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  isClinical: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const escapedRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const branchIds = (record: DepartmentRecord) => record.branchIds ?? (record.branchId ? [record.branchId] : []);
const toDepartment = (record: DepartmentRecord): Department => ({
  id: record._id.toString(),
  code: record.code,
  name: record.name,
  description: record.description ?? null,
  branch_ids: branchIds(record).map((id) => id.toString()),
  status: record.status,
  isClinical: record.isClinical,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

export class DepartmentRepository {
  async list(query: DepartmentListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.branch_id) filter.branchIds = new Types.ObjectId(query.branch_id);
    if (query.search) {
      const search = escapedRegex(query.search);
      filter.$or = [{ name: search }, { code: search }, { description: search }];
    }

    const sortFields: Record<NonNullable<DepartmentListQuery['sortBy']>, string> = {
      name: 'name',
      code: 'code',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    };
    const sortField = sortFields[query.sortBy ?? 'created_at'];
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      DepartmentModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<DepartmentRecord[]>(),
      DepartmentModel.countDocuments(filter),
    ]);

    return {
      data: records.map(toDepartment),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getById(id: string): Promise<Department | undefined> {
    const record = await DepartmentModel.findOne({ _id: id, deletedAt: null }).lean<DepartmentRecord>();
    return record ? toDepartment(record) : undefined;
  }

  async getByCode(code: string): Promise<Department | undefined> {
    const record = await DepartmentModel.findOne({ code: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), deletedAt: null }).lean<DepartmentRecord>();
    return record ? toDepartment(record) : undefined;
  }

  async create(data: CreateDepartmentDTO, createdBy: string): Promise<Department> {
    const department = await DepartmentModel.create({
      code: data.code,
      name: data.name,
      branchIds: data.branch_ids.map((id) => new Types.ObjectId(id)),
      description: data.description ?? undefined,
      status: data.status ?? 'ACTIVE',
      isClinical: data.isClinical ?? false,
      createdBy: new Types.ObjectId(createdBy),
      updatedBy: new Types.ObjectId(createdBy),
    });
    return toDepartment({
      _id: department._id,
      code: department.code,
      name: department.name,
      description: department.description,
      branchIds: department.branchIds,
      status: department.status,
      isClinical: department.isClinical,
      createdBy: department.createdBy,
      updatedBy: department.updatedBy,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    });
  }

  async update(id: string, data: UpdateDepartmentDTO, updatedBy: string): Promise<Department> {
    const updatePayload: Record<string, unknown> = { updatedBy };
    if (data.code !== undefined) updatePayload.code = data.code;
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.branch_ids !== undefined) updatePayload.branchIds = data.branch_ids;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.isClinical !== undefined) updatePayload.isClinical = data.isClinical;

    const record = await DepartmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { returnDocument: 'after', lean: true, runValidators: true },
    ).lean<DepartmentRecord>();
    if (!record) throw new Error('Department not found');
    return toDepartment(record);
  }

  async summary() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [total, active, inactive, addedThisMonth, branchesCovered] = await Promise.all([
      DepartmentModel.countDocuments({ deletedAt: null }),
      DepartmentModel.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
      DepartmentModel.countDocuments({ deletedAt: null, status: 'INACTIVE' }),
      DepartmentModel.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth } }),
      DepartmentModel.distinct('branchIds', { deletedAt: null }).then((ids) => ids.length),
    ]);
    return { total, active, inactive, addedThisMonth, branchesCovered };
  }

  async dependencies(id: string) {
    const [services, users] = await Promise.all([
      ServiceModel.countDocuments({ departmentId: id, deletedAt: null }),
      UserModel.countDocuments({ departmentIds: id, deletedAt: null }),
    ]);
    return { services, users };
  }

  async softDelete(id: string, actorUserId: string) {
    return DepartmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true },
    );
  }

  async audit(eventType: string, actorUserId: string, metadata: DepartmentRequestMetadata, details: Record<string, unknown>) {
    await AuditLogModel.create({ eventType, actorUserId, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details });
  }
}
