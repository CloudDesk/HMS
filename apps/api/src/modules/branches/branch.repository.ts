import { Types, type UpdateQuery } from 'mongoose';
import { BranchModel, type IBranch, type BranchIdentifierFields } from './branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { UserModel } from '../users/user.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  Branch,
  BranchListQuery,
  BranchRequestMetadata,
  CreateBranchDTO,
  UpdateBranchDTO,
  BranchIdentifier,
  AddBranchIdentifierDTO,
  UpdateBranchIdentifierDTO,
  BranchIdentifierStatus,
} from './branch.types.js';

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

const toBranchIdentifier = (field: BranchIdentifierFields): BranchIdentifier => ({
  id: field._id.toString(),
  identifier_type: field.identifierType,
  value: field.value,
  issuing_authority: field.issuingAuthority,
  status: field.status as BranchIdentifierStatus,
  effective_from: field.effectiveFrom ? field.effectiveFrom.toISOString().slice(0, 10) : null,
  effective_to: field.effectiveTo ? field.effectiveTo.toISOString().slice(0, 10) : null,
  verified_at: field.verifiedAt ? field.verifiedAt.toISOString() : null,
  verified_by: field.verifiedBy ? field.verifiedBy.toString() : null,
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

  async dependencies(id: string) {
    const [departments, users] = await Promise.all([
      DepartmentModel.countDocuments({ branchId: id, deletedAt: null }),
      UserModel.countDocuments({ branchIds: id, deletedAt: null }),
    ]);
    return { departments, users };
  }

  async softDelete(id: string, actorUserId: string) {
    return BranchModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true },
    );
  }

  async getIdentifiers(branchId: string): Promise<BranchIdentifier[]> {
    if (!Types.ObjectId.isValid(branchId)) throw new AppError('Invalid branch ID', 400, 'VALIDATION_ERROR');
    const branch = await BranchModel.findOne({ _id: branchId, deletedAt: null }).select('identifiers').lean();
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');
    return (branch.identifiers ?? []).map(toBranchIdentifier);
  }

  async addIdentifier(
    branchId: string,
    data: AddBranchIdentifierDTO,
    userId: string,
    metadata?: BranchRequestMetadata,
  ): Promise<BranchIdentifier> {
    if (!Types.ObjectId.isValid(branchId)) throw new AppError('Invalid branch ID', 400, 'VALIDATION_ERROR');
    const branchOid = new Types.ObjectId(branchId);

    const trimmedValue = (data.value ?? '').trim();
    const trimmedAuthority = (data.issuing_authority ?? '').trim();
    const trimmedType = (data.identifier_type ?? '').trim();

    if (!trimmedValue || !trimmedAuthority || !trimmedType) {
      throw new AppError('Identifier type, value, and issuing authority are required', 400, 'VALIDATION_ERROR');
    }

    const status = data.status ?? 'ACTIVE';

    if (status === 'ACTIVE') {
      // 1. Conflict check across other branches: cannot have same active (value, issuingAuthority)
      const existsOther = await BranchModel.exists({
        _id: { $ne: branchOid },
        deletedAt: null,
        identifiers: {
          $elemMatch: {
            value: trimmedValue,
            issuingAuthority: trimmedAuthority,
            status: 'ACTIVE',
          },
        },
      });
      if (existsOther) {
        throw new AppError('Identifier already registered to another branch/facility', 409, 'IDENTIFIER_CONFLICT');
      }

      // 2. Conflict check within same branch: only 1 active identifier per (identifierType, issuingAuthority)
      const existsSame = await BranchModel.exists({
        _id: branchOid,
        deletedAt: null,
        identifiers: {
          $elemMatch: {
            identifierType: trimmedType,
            issuingAuthority: trimmedAuthority,
            status: 'ACTIVE',
          },
        },
      });
      if (existsSame) {
        throw new AppError('Branch already has an active identifier for this type and authority', 409, 'ACTIVE_IDENTIFIER_CONFLICT');
      }
    }

    const newIdentifierId = new Types.ObjectId();
    const identifierRecord: BranchIdentifierFields = {
      _id: newIdentifierId,
      identifierType: trimmedType,
      value: trimmedValue,
      issuingAuthority: trimmedAuthority,
      status,
      effectiveFrom: data.effective_from ? new Date(data.effective_from) : null,
      effectiveTo: data.effective_to ? new Date(data.effective_to) : null,
      verifiedAt: null,
      verifiedBy: null,
    };

    const updated = await BranchModel.findOneAndUpdate(
      { _id: branchOid, deletedAt: null },
      {
        $push: { identifiers: identifierRecord },
        $set: { updatedBy: new Types.ObjectId(userId) },
      },
      { returnDocument: 'after', lean: true },
    );

    if (!updated) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    // Audit log - NEVER store raw identifier value!
    await this.audit('branch.identifier.added', userId, metadata ?? {}, {
      branchId,
      identifierId: newIdentifierId.toString(),
      identifierType: trimmedType,
      issuingAuthority: trimmedAuthority,
      status,
    });

    return toBranchIdentifier(identifierRecord);
  }

  async updateIdentifierStatus(
    branchId: string,
    identifierId: string,
    data: UpdateBranchIdentifierDTO,
    userId: string,
    metadata?: BranchRequestMetadata,
  ): Promise<BranchIdentifier> {
    if (!Types.ObjectId.isValid(branchId) || !Types.ObjectId.isValid(identifierId)) {
      throw new AppError('Invalid branch or identifier ID', 400, 'VALIDATION_ERROR');
    }

    const branchOid = new Types.ObjectId(branchId);
    const identifierOid = new Types.ObjectId(identifierId);

    const branch = await BranchModel.findOne({ _id: branchOid, deletedAt: null }).lean();
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const current = (branch.identifiers ?? []).find(id => id._id.toString() === identifierId);
    if (!current) throw new AppError('Branch identifier not found', 404, 'NOT_FOUND');

    if (data.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      const existsOther = await BranchModel.exists({
        _id: { $ne: branchOid },
        deletedAt: null,
        identifiers: {
          $elemMatch: {
            value: current.value,
            issuingAuthority: current.issuingAuthority,
            status: 'ACTIVE',
          },
        },
      });
      if (existsOther) {
        throw new AppError('Identifier already registered to another branch/facility', 409, 'IDENTIFIER_CONFLICT');
      }

      const existsSame = await BranchModel.exists({
        _id: branchOid,
        deletedAt: null,
        identifiers: {
          $elemMatch: {
            _id: { $ne: identifierOid },
            identifierType: current.identifierType,
            issuingAuthority: current.issuingAuthority,
            status: 'ACTIVE',
          },
        },
      });
      if (existsSame) {
        throw new AppError('Branch already has an active identifier for this type and authority', 409, 'ACTIVE_IDENTIFIER_CONFLICT');
      }
    }

    const updateFields: Record<string, unknown> = {
      'identifiers.$.status': data.status,
      updatedBy: new Types.ObjectId(userId),
    };
    if (data.effective_to !== undefined) {
      updateFields['identifiers.$.effectiveTo'] = data.effective_to ? new Date(data.effective_to) : null;
    }

    const updated = await BranchModel.findOneAndUpdate(
      { _id: branchOid, 'identifiers._id': identifierOid, deletedAt: null },
      { $set: updateFields },
      { returnDocument: 'after', lean: true },
    );

    if (!updated) throw new AppError('Branch identifier update failed', 404, 'NOT_FOUND');

    // Audit log - NEVER store raw identifier value!
    await this.audit('branch.identifier.updated', userId, metadata ?? {}, {
      branchId,
      identifierId,
      status: data.status,
      previousStatus: current.status,
    });

    const updatedField = (updated.identifiers ?? []).find(id => id._id.toString() === identifierId);
    return toBranchIdentifier(updatedField ?? current);
  }

  async audit(eventType: string, actorUserId: string, metadata: BranchRequestMetadata, details: Record<string, unknown>) {
    await AuditLogModel.create({
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    });
  }
}
