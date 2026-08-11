import type { SortOrder } from 'mongoose';
import { BranchModel } from './branch.model.js';
import type { Branch, BranchListQuery, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

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

    const sortColumnByApiField = {
      code: 'code',
      created_at: 'createdAt',
      name: 'name',
      status: 'status',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = sortColumnByApiField[query.sortBy ?? 'created_at'];
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      BranchModel.find(filter)
        .sort({ [sortColumn]: sortOrder })
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
    const branch = await BranchModel.findById(id).lean();
    return branch ? toBranch(branch) : undefined;
  }

  async getByCode(code: string): Promise<Branch | undefined> {
    const branch = await BranchModel.findOne({ code: new RegExp(`^${code}$`, 'i') }).lean();
    return branch ? toBranch(branch) : undefined;
  }

  async create(data: CreateBranchDTO, createdBy: string): Promise<Branch> {
    const branch = await BranchModel.create({
      ...toPersistence(data),
      status: data.status ?? 'ACTIVE',
      createdBy: createdBy,
      updatedBy: createdBy,
    } as any);
    return toBranch(branch.toObject());
  }

  async update(id: string, data: UpdateBranchDTO, updatedBy: string): Promise<Branch> {
    const branch = await BranchModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...toPersistence(data), updatedBy } as any },
      { new: true, lean: true }
    );
    if (!branch) {
      throw new Error('Branch not found');
    }
    return toBranch(branch);
  }

  async delete(id: string): Promise<void> {
    await BranchModel.findByIdAndDelete(id);
  }
}
