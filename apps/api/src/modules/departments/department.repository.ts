
import { DepartmentModel } from './department.model.js';
import { ServiceModel } from '../services/service.model.js';
import { UserModel } from '../users/user.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import type { Department, DepartmentListQuery, DepartmentRequestMetadata, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

export class DepartmentRepository {
  async list(query: DepartmentListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: any = { deletedAt: null };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.branch_id) {
      filter.branchIds = query.branch_id;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const sortColumn = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      DepartmentModel.find(filter)
        .sort({ [sortColumn === 'created_at' ? 'createdAt' : sortColumn]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      DepartmentModel.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => ({
        ...d,
        id: d._id.toString(),
        branch_ids: (d.branchIds || (d.branchId ? [d.branchId] : [])).map((id: any) => id.toString()),
      })) as unknown as Department[],
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Department | undefined> {
    const department = await DepartmentModel.findOne({ _id: id, deletedAt: null }).lean();
    return department
      ? ({
          ...department,
          id: department._id.toString(),
          branch_ids: (department.branchIds || (department.branchId ? [department.branchId] : [])).map((id: any) => id.toString()),
        } as unknown as Department)
      : undefined;
  }

  async getByCode(code: string): Promise<Department | undefined> {
    const department = await DepartmentModel.findOne({ code: new RegExp(`^${code}$`, 'i'), deletedAt: null }).lean();
    return department
      ? ({
          ...department,
          id: department._id.toString(),
          branch_ids: (department.branchIds || (department.branchId ? [department.branchId] : [])).map((id: any) => id.toString()),
        } as unknown as Department)
      : undefined;
  }

  async create(data: CreateDepartmentDTO, createdBy: string): Promise<Department> {
    const department = await DepartmentModel.create({
      ...data,
      branchIds: data.branch_ids,
      status: data.status ?? 'ACTIVE',
      createdBy: createdBy,
      updatedBy: createdBy,
    } as any);
    return {
      ...department.toJSON(),
      id: department._id.toString(),
      branch_ids: (department.branchIds || (department.branchId ? [department.branchId] : [])).map((id: any) => id.toString()),
    } as unknown as Department;
  }

  async update(id: string, data: UpdateDepartmentDTO, updatedBy: string): Promise<Department> {
    const updatePayload: Record<string, any> = { ...data, updatedBy };
    if (data.branch_ids) {
      updatePayload.branchIds = data.branch_ids;
      delete updatePayload.branch_ids;
    }

    const department = await DepartmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { returnDocument: 'after', lean: true }
    );
    if (!department) {
      throw new Error('Department not found');
    }
    return {
      ...department,
      id: department._id.toString(),
      branch_ids: (department.branchIds || (department.branchId ? [department.branchId] : [])).map((id: any) => id.toString()),
    } as unknown as Department;
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
    await AuditLogModel.create({
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    });
  }
}
