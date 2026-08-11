import type { SortOrder } from 'mongoose';
import { BranchModel, type IBranch } from './branch.model.js';
import type { Branch, BranchListQuery, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

export class BranchRepository {
  async list(query: BranchListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: any = { deletedAt: null };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const sortColumn = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      BranchModel.find(filter)
        .sort({ [sortColumn === 'created_at' ? 'createdAt' : sortColumn]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      BranchModel.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => ({ ...d, id: d._id.toString() })) as unknown as Branch[],
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Branch | undefined> {
    const branch = await BranchModel.findById(id).lean();
    return branch ? ({ ...branch, id: branch._id.toString() } as unknown as Branch) : undefined;
  }

  async getByCode(code: string): Promise<Branch | undefined> {
    const branch = await BranchModel.findOne({ code: new RegExp(`^${code}$`, 'i') }).lean();
    return branch ? ({ ...branch, id: branch._id.toString() } as unknown as Branch) : undefined;
  }

  async create(data: CreateBranchDTO, createdBy: string): Promise<Branch> {
    const branch = await BranchModel.create({
      ...data,
      status: data.status ?? 'ACTIVE',
      createdBy: createdBy,
      updatedBy: createdBy,
    } as any);
    return { ...branch.toJSON(), id: branch._id.toString() } as unknown as Branch;
  }

  async update(id: string, data: UpdateBranchDTO, updatedBy: string): Promise<Branch> {
    const branch = await BranchModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...data, updatedBy } as any },
      { new: true, lean: true }
    );
    if (!branch) {
      throw new Error('Branch not found');
    }
    return { ...branch, id: branch._id.toString() } as unknown as Branch;
  }

  async delete(id: string): Promise<void> {
    await BranchModel.findByIdAndDelete(id);
  }
}
