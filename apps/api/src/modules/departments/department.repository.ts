
import { DepartmentModel, type IDepartment } from './department.model.js';
import type { Department, DepartmentListQuery, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

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
      filter.branchId = query.branch_id;
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
        branch_id: d.branchId.toString(),
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
    const department = await DepartmentModel.findById(id).lean();
    return department
      ? ({
          ...department,
          id: department._id.toString(),
          branch_id: department.branchId.toString(),
        } as unknown as Department)
      : undefined;
  }

  async getByCode(code: string): Promise<Department | undefined> {
    const department = await DepartmentModel.findOne({ code: new RegExp(`^${code}$`, 'i') }).lean();
    return department
      ? ({
          ...department,
          id: department._id.toString(),
          branch_id: department.branchId.toString(),
        } as unknown as Department)
      : undefined;
  }

  async create(data: CreateDepartmentDTO, createdBy: string): Promise<Department> {
    const department = await DepartmentModel.create({
      ...data,
      branchId: data.branch_id,
      status: data.status ?? 'ACTIVE',
      createdBy: createdBy,
      updatedBy: createdBy,
    } as any);
    return {
      ...department.toJSON(),
      id: department._id.toString(),
      branch_id: department.branchId.toString(),
    } as unknown as Department;
  }

  async update(id: string, data: UpdateDepartmentDTO, updatedBy: string): Promise<Department> {
    const updatePayload: Record<string, any> = { ...data, updatedBy };
    if (data.branch_id) {
      updatePayload.branchId = data.branch_id;
      delete updatePayload.branch_id;
    }

    const department = await DepartmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { new: true, lean: true }
    );
    if (!department) {
      throw new Error('Department not found');
    }
    return {
      ...department,
      id: department._id.toString(),
      branch_id: department.branchId.toString(),
    } as unknown as Department;
  }

  async delete(id: string): Promise<void> {
    await DepartmentModel.findByIdAndDelete(id);
  }
}
