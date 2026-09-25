import mongoose, { Types, type ClientSession } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  InsuranceConfigurationModel,
  InsuranceProviderBranchModel,
  InsuranceProviderModel,
} from './insurance.model.js';
import type {
  CreateInsuranceProviderBranchDTO,
  CreateInsuranceProviderDTO,
  InsuranceConfiguration,
  InsuranceOperatingMode,
  InsurancePage,
  InsuranceProvider,
  InsuranceProviderBranch,
  InsuranceProviderBranchListQuery,
  InsuranceProviderBranchStatus,
  InsuranceProviderListQuery,
  InsuranceProviderStatus,
  InsuranceRequestMetadata,
  UpdateInsuranceProviderBranchDTO,
  UpdateInsuranceProviderDTO,
} from './insurance.types.js';

type ConfigurationRecord = {
  _id: unknown;
  operatingMode: InsuranceOperatingMode;
  version: number;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ProviderRecord = {
  _id: unknown;
  providerCode: string;
  legalName: string;
  tradingName?: string | null;
  providerType: InsuranceProvider['provider_type'];
  registrationNumber?: string | null;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: InsuranceProviderStatus;
  version: number;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ProviderBranchRecord = {
  _id: unknown;
  providerId: Types.ObjectId;
  branchId: Types.ObjectId;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: InsuranceProviderBranchStatus;
  version: number;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type BranchSummary = { _id: Types.ObjectId; code: string; name: string };

const objectId = (value: string) => new Types.ObjectId(value);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toConfiguration = (record: ConfigurationRecord | null): InsuranceConfiguration => ({
  id: record ? String(record._id) : null,
  operating_mode: record?.operatingMode ?? 'PROVIDER',
  version: record?.version ?? 0,
  created_by: record?.createdBy ? String(record.createdBy) : null,
  updated_by: record?.updatedBy ? String(record.updatedBy) : null,
  created_at: record?.createdAt ?? null,
  updated_at: record?.updatedAt ?? null,
});

const toProvider = (record: ProviderRecord): InsuranceProvider => ({
  id: String(record._id),
  provider_code: record.providerCode,
  legal_name: record.legalName,
  trading_name: record.tradingName ?? null,
  provider_type: record.providerType,
  registration_number: record.registrationNumber ?? null,
  tax_id: record.taxId ?? null,
  contact_name: record.contactName ?? null,
  phone: record.phone ?? null,
  email: record.email ?? null,
  address: record.address ?? null,
  status: record.status,
  version: record.version,
  created_by: record.createdBy ? String(record.createdBy) : null,
  updated_by: record.updatedBy ? String(record.updatedBy) : null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toProviderBranch = (
  record: ProviderBranchRecord,
  branch?: BranchSummary,
): InsuranceProviderBranch => ({
  id: String(record._id),
  provider_id: String(record.providerId),
  branch_id: String(record.branchId),
  branch_code: branch?.code ?? null,
  branch_name: branch?.name ?? null,
  effective_from: record.effectiveFrom,
  effective_to: record.effectiveTo ?? null,
  status: record.status,
  version: record.version,
  created_by: record.createdBy ? String(record.createdBy) : null,
  updated_by: record.updatedBy ? String(record.updatedBy) : null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const nullableTrimmed = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const providerPersistence = (data: CreateInsuranceProviderDTO | UpdateInsuranceProviderDTO) =>
  Object.fromEntries(Object.entries({
    providerCode: data.provider_code?.trim().toUpperCase(),
    legalName: data.legal_name?.trim(),
    tradingName: nullableTrimmed(data.trading_name),
    providerType: data.provider_type,
    registrationNumber: nullableTrimmed(data.registration_number),
    taxId: nullableTrimmed(data.tax_id),
    contactName: nullableTrimmed(data.contact_name),
    phone: nullableTrimmed(data.phone),
    email: nullableTrimmed(data.email)?.toLowerCase(),
    address: nullableTrimmed(data.address),
  }).filter(([, value]) => value !== undefined));

export class InsuranceRepository {
  async getConfiguration(session?: ClientSession) {
    const query = InsuranceConfigurationModel.findOne({ key: 'system' }).lean<ConfigurationRecord | null>();
    if (session) query.session(session);
    return toConfiguration(await query);
  }

  async updateConfiguration(
    operatingMode: InsuranceOperatingMode,
    expectedVersion: number,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsuranceConfigurationModel.findOneAndUpdate(
      { key: 'system', version: expectedVersion },
      {
        $set: { operatingMode, updatedBy: objectId(actorUserId) },
        $setOnInsert: { key: 'system', createdBy: objectId(actorUserId) },
        $inc: { version: 1 },
      },
      { upsert: true, returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ConfigurationRecord | null>();
    return record ? toConfiguration(record) : null;
  }

  async listProviders(query: InsuranceProviderListQuery): Promise<InsurancePage<InsuranceProvider>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.provider_type) filter.providerType = query.provider_type;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ providerCode: search }, { legalName: search }, { tradingName: search }];
    }
    const sortColumns = {
      provider_code: 'providerCode',
      legal_name: 'legalName',
      provider_type: 'providerType',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsuranceProviderModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ProviderRecord[]>(),
      InsuranceProviderModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toProvider),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getProviderById(id: string, session?: ClientSession) {
    const query = InsuranceProviderModel.findOne({ _id: objectId(id), deletedAt: null }).lean<ProviderRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toProvider(record) : null;
  }

  async getProviderByCode(code: string, excludeId?: string, session?: ClientSession) {
    const filter: Record<string, unknown> = { providerCode: code.trim().toUpperCase(), deletedAt: null };
    if (excludeId) filter._id = { $ne: objectId(excludeId) };
    const query = InsuranceProviderModel.findOne(filter).lean<ProviderRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toProvider(record) : null;
  }

  async createProvider(data: CreateInsuranceProviderDTO, actorUserId: string, session?: ClientSession) {
    const records = await InsuranceProviderModel.create([{
      ...providerPersistence(data),
      status: 'DRAFT',
      version: 0,
      createdBy: objectId(actorUserId),
      updatedBy: objectId(actorUserId),
    }], { session, ordered: true });
    const record = records[0];
    if (!record) return null;
    return toProvider(record.toObject<ProviderRecord>());
  }

  async updateProvider(
    id: string,
    data: UpdateInsuranceProviderDTO,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsuranceProviderModel.findOneAndUpdate(
      { _id: objectId(id), version: data.version, deletedAt: null },
      {
        $set: { ...providerPersistence(data), updatedBy: objectId(actorUserId) },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ProviderRecord | null>();
    return record ? toProvider(record) : null;
  }

  async transitionProvider(
    id: string,
    fromStatuses: InsuranceProviderStatus[],
    toStatus: InsuranceProviderStatus,
    expectedVersion: number,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsuranceProviderModel.findOneAndUpdate(
      { _id: objectId(id), status: { $in: fromStatuses }, version: expectedVersion, deletedAt: null },
      { $set: { status: toStatus, updatedBy: objectId(actorUserId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ProviderRecord | null>();
    return record ? toProvider(record) : null;
  }

  async touchProviderBranchSchedule(providerId: string, session?: ClientSession) {
    return InsuranceProviderModel.updateOne(
      { _id: objectId(providerId), deletedAt: null },
      { $inc: { branchMappingRevision: 1 } },
      { session },
    );
  }

  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: objectId(userId), status: 'active', deletedAt: null })
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
        _id: objectId(requestedBranchId),
        status: 'ACTIVE',
        deletedAt: null,
      }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) {
        throw new AppError('Branch access denied', 403, 'INSURANCE_SCOPE_DENIED');
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

  async listProviderBranches(
    providerId: string,
    query: InsuranceProviderBranchListQuery,
    allowedBranchIds?: string[],
  ): Promise<InsurancePage<InsuranceProviderBranch>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { providerId: objectId(providerId), deletedAt: null };
    if (allowedBranchIds) filter.branchId = { $in: allowedBranchIds.map(objectId) };
    if (query.branch_id) filter.branchId = objectId(query.branch_id);
    if (query.status) filter.status = query.status;
    if (query.effective_on) {
      const start = new Date(`${query.effective_on}T00:00:00.000Z`);
      const end = new Date(`${query.effective_on}T23:59:59.999Z`);
      filter.effectiveFrom = { $lte: end };
      filter.$or = [{ effectiveTo: null }, { effectiveTo: { $gte: start } }];
    }
    const sortColumns = {
      effective_from: 'effectiveFrom',
      effective_to: 'effectiveTo',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'effectiveFrom';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsuranceProviderBranchModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ProviderBranchRecord[]>(),
      InsuranceProviderBranchModel.countDocuments(filter),
    ]);
    const branches = await BranchModel.find({
      _id: { $in: records.map((record) => record.branchId) },
      deletedAt: null,
    }).select('code name').lean<BranchSummary[]>();
    const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));
    return {
      data: records.map((record) => toProviderBranch(record, branchById.get(String(record.branchId)))),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getProviderBranchById(id: string, allowedBranchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id), deletedAt: null };
    if (allowedBranchIds) filter.branchId = { $in: allowedBranchIds.map(objectId) };
    const query = InsuranceProviderBranchModel.findOne(filter).lean<ProviderBranchRecord | null>();
    if (session) query.session(session);
    const record = await query;
    if (!record) return null;
    const branchQuery = BranchModel.findOne({ _id: record.branchId, deletedAt: null }).select('code name').lean<BranchSummary | null>();
    if (session) branchQuery.session(session);
    return toProviderBranch(record, (await branchQuery) ?? undefined);
  }

  async hasProviderBranchOverlap(
    providerId: string,
    branchId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
    session?: ClientSession,
  ) {
    const filter: Record<string, unknown> = {
      providerId: objectId(providerId),
      branchId: objectId(branchId),
      status: 'ACTIVE',
      deletedAt: null,
      effectiveFrom: { $lte: effectiveTo ?? new Date('9999-12-31T23:59:59.999Z') },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: effectiveFrom } }],
    };
    if (excludeId) filter._id = { $ne: objectId(excludeId) };
    const query = InsuranceProviderBranchModel.exists(filter);
    if (session) query.session(session);
    return Boolean(await query);
  }

  async createProviderBranch(
    providerId: string,
    data: CreateInsuranceProviderBranchDTO,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const records = await InsuranceProviderBranchModel.create([{
      providerId: objectId(providerId),
      branchId: objectId(data.branch_id),
      effectiveFrom: new Date(`${data.effective_from}T00:00:00.000Z`),
      effectiveTo: data.effective_to ? new Date(`${data.effective_to}T23:59:59.999Z`) : null,
      status: data.status ?? 'ACTIVE',
      version: 0,
      createdBy: objectId(actorUserId),
      updatedBy: objectId(actorUserId),
    }], { session, ordered: true });
    const record = records[0];
    if (!record) return null;
    const branch = await BranchModel.findById(data.branch_id).select('code name').session(session ?? null).lean<BranchSummary | null>();
    return toProviderBranch(record.toObject<ProviderBranchRecord>(), branch ?? undefined);
  }

  async updateProviderBranch(
    id: string,
    data: UpdateInsuranceProviderBranchDTO,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const updates: Record<string, unknown> = { updatedBy: objectId(actorUserId) };
    if (data.effective_from !== undefined) updates.effectiveFrom = new Date(`${data.effective_from}T00:00:00.000Z`);
    if (data.effective_to !== undefined) {
      updates.effectiveTo = data.effective_to ? new Date(`${data.effective_to}T23:59:59.999Z`) : null;
    }
    if (data.status !== undefined) updates.status = data.status;
    const record = await InsuranceProviderBranchModel.findOneAndUpdate(
      { _id: objectId(id), version: data.version, deletedAt: null },
      { $set: updates, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ProviderBranchRecord | null>();
    if (!record) return null;
    const branch = await BranchModel.findById(record.branchId).select('code name').session(session ?? null).lean<BranchSummary | null>();
    return toProviderBranch(record, branch ?? undefined);
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: InsuranceRequestMetadata,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    const entry = {
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: { correlationId: metadata.correlationId ?? null, ...details },
    };
    if (session) {
      const records = await AuditLogModel.create([entry], { session, ordered: true });
      return records[0];
    }
    return AuditLogModel.create(entry);
  }

  startSession() {
    return mongoose.startSession();
  }
}
