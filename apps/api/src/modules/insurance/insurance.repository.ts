import mongoose, { Types, type ClientSession } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  InsuranceConfigurationModel,
  InsuranceContractModel,
  InsuranceApprovalRequestModel,
  InsuranceApprovalRuleModel,
  InsurancePayerModel,
  InsuranceProviderBranchModel,
  InsuranceProviderModel,
} from './insurance.model.js';
import type {
  CancelInsuranceApprovalRequestDTO,
  CreateInsuranceApprovalRequestDTO,
  CreateInsuranceApprovalRuleDTO,
  CreateInsuranceContractDTO,
  CreateInsurancePayerDTO,
  CreateInsuranceProviderBranchDTO,
  CreateInsuranceProviderDTO,
  DecideInsuranceApprovalRequestDTO,
  InsuranceApprovalRequest,
  InsuranceApprovalRequestListQuery,
  InsuranceApprovalRequestStatus,
  InsuranceApprovalRule,
  InsuranceApprovalRuleListQuery,
  InsuranceApprovalRuleStatus,
  InsuranceApprovalTransactionType,
  InsuranceConfiguration,
  InsuranceContract,
  InsuranceContractListQuery,
  InsuranceContractStatus,
  InsuranceOperatingMode,
  InsurancePage,
  InsurancePayer,
  InsurancePayerListQuery,
  InsurancePayerStatus,
  InsuranceProvider,
  InsuranceProviderBranch,
  InsuranceProviderBranchListQuery,
  InsuranceProviderBranchStatus,
  InsuranceProviderListQuery,
  InsuranceProviderStatus,
  InsuranceRequestMetadata,
  UpdateInsuranceApprovalRuleDTO,
  UpdateInsuranceContractDTO,
  UpdateInsurancePayerDTO,
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

type PayerRecord = {
  _id: unknown;
  payerCode: string;
  name: string;
  legalName?: string | null;
  payerType: InsurancePayer['payer_type'];
  registrationNumber?: string | null;
  taxId?: string | null;
  claimsContactName?: string | null;
  claimsContactPhone?: string | null;
  claimsContactEmail?: string | null;
  financeContactName?: string | null;
  financeContactPhone?: string | null;
  financeContactEmail?: string | null;
  address?: string | null;
  submissionMode: InsurancePayer['submission_mode'];
  portalUrl?: string | null;
  apiEnabled: boolean;
  ediEnabled: boolean;
  portalEnabled: boolean;
  memberNumberScope: InsurancePayer['member_number_scope'];
  status: InsurancePayerStatus;
  version: number;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalRuleRecord = {
  _id: unknown;
  branchId?: Types.ObjectId | null;
  payerId?: Types.ObjectId | null;
  schemeId?: Types.ObjectId | null;
  transactionType: InsuranceApprovalTransactionType;
  requiredPermission: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: InsuranceApprovalRuleStatus;
  version: number;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ApprovalRequestRecord = {
  _id: unknown;
  approvalRuleId: Types.ObjectId;
  branchId?: Types.ObjectId | null;
  transactionType: InsuranceApprovalTransactionType;
  resourceType: InsuranceApprovalRequest['resource_type'];
  resourceId: Types.ObjectId;
  resourceVersion: number;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  status: InsuranceApprovalRequestStatus;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  decisionReason?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type ContractRecord = {
  _id: unknown;
  contractNumber: string;
  payerId: Types.ObjectId;
  providerId: Types.ObjectId;
  branchId: Types.ObjectId;
  name: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  providerNetwork?: string | null;
  claimSubmissionDays?: number | null;
  status: InsuranceContractStatus;
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

const toPayer = (record: PayerRecord): InsurancePayer => ({
  id: String(record._id),
  payer_code: record.payerCode,
  name: record.name,
  legal_name: record.legalName ?? null,
  payer_type: record.payerType,
  registration_number: record.registrationNumber ?? null,
  tax_id: record.taxId ?? null,
  claims_contact_name: record.claimsContactName ?? null,
  claims_contact_phone: record.claimsContactPhone ?? null,
  claims_contact_email: record.claimsContactEmail ?? null,
  finance_contact_name: record.financeContactName ?? null,
  finance_contact_phone: record.financeContactPhone ?? null,
  finance_contact_email: record.financeContactEmail ?? null,
  address: record.address ?? null,
  submission_mode: record.submissionMode,
  portal_url: record.portalUrl ?? null,
  api_enabled: record.apiEnabled,
  edi_enabled: record.ediEnabled,
  portal_enabled: record.portalEnabled,
  member_number_scope: record.memberNumberScope,
  status: record.status,
  version: record.version,
  created_by: record.createdBy ? String(record.createdBy) : null,
  updated_by: record.updatedBy ? String(record.updatedBy) : null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toApprovalRule = (record: ApprovalRuleRecord): InsuranceApprovalRule => ({
  id: String(record._id),
  branch_id: record.branchId ? String(record.branchId) : null,
  payer_id: record.payerId ? String(record.payerId) : null,
  scheme_id: record.schemeId ? String(record.schemeId) : null,
  transaction_type: record.transactionType,
  required_permission: record.requiredPermission,
  effective_from: record.effectiveFrom,
  effective_to: record.effectiveTo ?? null,
  status: record.status,
  version: record.version,
  created_by: record.createdBy ? String(record.createdBy) : null,
  updated_by: record.updatedBy ? String(record.updatedBy) : null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toApprovalRequest = (record: ApprovalRequestRecord): InsuranceApprovalRequest => ({
  id: String(record._id),
  approval_rule_id: String(record.approvalRuleId),
  branch_id: record.branchId ? String(record.branchId) : null,
  transaction_type: record.transactionType,
  resource_type: record.resourceType,
  resource_id: String(record.resourceId),
  resource_version: record.resourceVersion,
  requested_by: String(record.requestedBy),
  requested_at: record.requestedAt,
  status: record.status,
  decided_by: record.decidedBy ? String(record.decidedBy) : null,
  decided_at: record.decidedAt ?? null,
  decision_reason: record.decisionReason ?? null,
  version: record.version,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toContract = (record: ContractRecord): InsuranceContract => ({
  id: String(record._id),
  contract_number: record.contractNumber,
  payer_id: String(record.payerId),
  provider_id: String(record.providerId),
  branch_id: String(record.branchId),
  name: record.name,
  effective_from: record.effectiveFrom,
  effective_to: record.effectiveTo ?? null,
  provider_network: record.providerNetwork ?? null,
  claim_submission_days: record.claimSubmissionDays ?? null,
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

const payerPersistence = (data: CreateInsurancePayerDTO | UpdateInsurancePayerDTO) =>
  Object.fromEntries(Object.entries({
    payerCode: data.payer_code?.trim().toUpperCase(),
    name: data.name?.trim(),
    legalName: nullableTrimmed(data.legal_name),
    payerType: data.payer_type,
    registrationNumber: nullableTrimmed(data.registration_number),
    taxId: nullableTrimmed(data.tax_id),
    claimsContactName: nullableTrimmed(data.claims_contact_name),
    claimsContactPhone: nullableTrimmed(data.claims_contact_phone),
    claimsContactEmail: nullableTrimmed(data.claims_contact_email)?.toLowerCase(),
    financeContactName: nullableTrimmed(data.finance_contact_name),
    financeContactPhone: nullableTrimmed(data.finance_contact_phone),
    financeContactEmail: nullableTrimmed(data.finance_contact_email)?.toLowerCase(),
    address: nullableTrimmed(data.address),
    submissionMode: data.submission_mode,
    portalUrl: nullableTrimmed(data.portal_url),
    apiEnabled: data.api_enabled,
    ediEnabled: data.edi_enabled,
    portalEnabled: data.portal_enabled,
    memberNumberScope: data.member_number_scope,
  }).filter(([, value]) => value !== undefined));

const contractPersistence = (data: CreateInsuranceContractDTO | UpdateInsuranceContractDTO) =>
  Object.fromEntries(Object.entries({
    contractNumber: data.contract_number?.trim().toUpperCase(),
    name: data.name?.trim(),
    effectiveFrom: data.effective_from ? new Date(`${data.effective_from}T00:00:00.000Z`) : undefined,
    effectiveTo: data.effective_to === undefined
      ? undefined
      : data.effective_to
        ? new Date(`${data.effective_to}T23:59:59.999Z`)
        : null,
    providerNetwork: nullableTrimmed(data.provider_network),
    claimSubmissionDays: data.claim_submission_days,
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

  async listPayers(query: InsurancePayerListQuery): Promise<InsurancePage<InsurancePayer>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.payer_type) filter.payerType = query.payer_type;
    if (query.submission_mode) filter.submissionMode = query.submission_mode;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ payerCode: search }, { name: search }, { legalName: search }];
    }
    const sortColumns = {
      payer_code: 'payerCode',
      name: 'name',
      payer_type: 'payerType',
      submission_mode: 'submissionMode',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsurancePayerModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<PayerRecord[]>(),
      InsurancePayerModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toPayer),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getPayerById(id: string, session?: ClientSession) {
    const query = InsurancePayerModel.findOne({ _id: objectId(id), deletedAt: null }).lean<PayerRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toPayer(record) : null;
  }

  async getPayerByCode(code: string, excludeId?: string, session?: ClientSession) {
    const filter: Record<string, unknown> = { payerCode: code.trim().toUpperCase(), deletedAt: null };
    if (excludeId) filter._id = { $ne: objectId(excludeId) };
    const query = InsurancePayerModel.findOne(filter).lean<PayerRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toPayer(record) : null;
  }

  async createPayer(data: CreateInsurancePayerDTO, actorUserId: string, session?: ClientSession) {
    const records = await InsurancePayerModel.create([{
      ...payerPersistence(data),
      status: 'DRAFT',
      version: 0,
      createdBy: objectId(actorUserId),
      updatedBy: objectId(actorUserId),
    }], { session, ordered: true });
    const record = records[0];
    return record ? toPayer(record.toObject<PayerRecord>()) : null;
  }

  async updatePayer(id: string, data: UpdateInsurancePayerDTO, actorUserId: string, session?: ClientSession) {
    const record = await InsurancePayerModel.findOneAndUpdate(
      { _id: objectId(id), version: data.version, deletedAt: null },
      { $set: { ...payerPersistence(data), updatedBy: objectId(actorUserId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<PayerRecord | null>();
    return record ? toPayer(record) : null;
  }

  async transitionPayer(
    id: string,
    fromStatuses: InsurancePayerStatus[],
    toStatus: InsurancePayerStatus,
    expectedVersion: number,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsurancePayerModel.findOneAndUpdate(
      { _id: objectId(id), status: { $in: fromStatuses }, version: expectedVersion, deletedAt: null },
      { $set: { status: toStatus, updatedBy: objectId(actorUserId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<PayerRecord | null>();
    return record ? toPayer(record) : null;
  }

  async listContracts(
    query: InsuranceContractListQuery,
    allowedBranchIds?: string[],
  ): Promise<InsurancePage<InsuranceContract>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (allowedBranchIds) filter.branchId = { $in: allowedBranchIds.map(objectId) };
    if (query.branch_id) filter.branchId = objectId(query.branch_id);
    if (query.payer_id) filter.payerId = objectId(query.payer_id);
    if (query.provider_id) filter.providerId = objectId(query.provider_id);
    if (query.status) filter.status = query.status;
    if (query.effective_on) {
      const start = new Date(`${query.effective_on}T00:00:00.000Z`);
      const end = new Date(`${query.effective_on}T23:59:59.999Z`);
      filter.effectiveFrom = { $lte: end };
      filter.$or = [{ effectiveTo: null }, { effectiveTo: { $gte: start } }];
    }
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$and = [{ $or: [{ contractNumber: search }, { name: search }, { providerNetwork: search }] }];
    }
    const sortColumns = {
      contract_number: 'contractNumber', name: 'name', effective_from: 'effectiveFrom', effective_to: 'effectiveTo',
      status: 'status', created_at: 'createdAt', updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsuranceContractModel.find(filter).sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean<ContractRecord[]>(),
      InsuranceContractModel.countDocuments(filter),
    ]);
    return { data: records.map(toContract), meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getContractById(id: string, allowedBranchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id), deletedAt: null };
    if (allowedBranchIds) filter.branchId = { $in: allowedBranchIds.map(objectId) };
    const query = InsuranceContractModel.findOne(filter).lean<ContractRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toContract(record) : null;
  }

  async getContractByNumber(branchId: string, payerId: string, contractNumber: string, excludeId?: string, session?: ClientSession) {
    const filter: Record<string, unknown> = {
      branchId: objectId(branchId), payerId: objectId(payerId),
      contractNumber: contractNumber.trim().toUpperCase(), deletedAt: null,
    };
    if (excludeId) filter._id = { $ne: objectId(excludeId) };
    const query = InsuranceContractModel.findOne(filter).lean<ContractRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toContract(record) : null;
  }

  async hasActiveProviderBranchOn(providerId: string, branchId: string, at: Date, session?: ClientSession) {
    const query = InsuranceProviderBranchModel.exists({
      providerId: objectId(providerId), branchId: objectId(branchId), status: 'ACTIVE', deletedAt: null,
      effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
    });
    if (session) query.session(session);
    return Boolean(await query);
  }

  async createContract(data: CreateInsuranceContractDTO, actorUserId: string, session?: ClientSession) {
    const records = await InsuranceContractModel.create([{
      ...contractPersistence(data), payerId: objectId(data.payer_id), providerId: objectId(data.provider_id),
      branchId: objectId(data.branch_id), status: 'DRAFT', version: 0,
      createdBy: objectId(actorUserId), updatedBy: objectId(actorUserId),
    }], { session, ordered: true });
    const record = records[0];
    return record ? toContract(record.toObject<ContractRecord>()) : null;
  }

  async updateContract(id: string, data: UpdateInsuranceContractDTO, actorUserId: string, session?: ClientSession) {
    const record = await InsuranceContractModel.findOneAndUpdate(
      { _id: objectId(id), status: 'DRAFT', version: data.version, deletedAt: null },
      { $set: { ...contractPersistence(data), updatedBy: objectId(actorUserId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ContractRecord | null>();
    return record ? toContract(record) : null;
  }

  async transitionContract(
    id: string, fromStatuses: InsuranceContractStatus[], toStatus: InsuranceContractStatus,
    expectedVersion: number, actorUserId: string, session?: ClientSession,
  ) {
    const record = await InsuranceContractModel.findOneAndUpdate(
      { _id: objectId(id), status: { $in: fromStatuses }, version: expectedVersion, deletedAt: null },
      { $set: { status: toStatus, updatedBy: objectId(actorUserId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ContractRecord | null>();
    return record ? toContract(record) : null;
  }

  async touchApprovalRuleSchedule(actorUserId: string, session?: ClientSession) {
    return InsuranceConfigurationModel.updateOne(
      { key: 'system' },
      {
        $setOnInsert: {
          key: 'system',
          operatingMode: 'PROVIDER',
          version: 0,
          createdBy: objectId(actorUserId),
          updatedBy: objectId(actorUserId),
        },
        $inc: { approvalRuleRevision: 1 },
      },
      { upsert: true, session, timestamps: false },
    );
  }

  async listApprovalRules(query: InsuranceApprovalRuleListQuery, allowedBranchIds?: string[]): Promise<InsurancePage<InsuranceApprovalRule>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (allowedBranchIds) filter.$or = [{ branchId: null }, { branchId: { $in: allowedBranchIds.map(objectId) } }];
    if (query.branch_id) filter.branchId = objectId(query.branch_id);
    if (query.transaction_type) filter.transactionType = query.transaction_type;
    if (query.status) filter.status = query.status;
    if (query.effective_on) {
      const start = new Date(`${query.effective_on}T00:00:00.000Z`);
      const end = new Date(`${query.effective_on}T23:59:59.999Z`);
      filter.effectiveFrom = { $lte: end };
      filter.$and = [{ $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }] }];
    }
    const sortColumns = {
      transaction_type: 'transactionType',
      effective_from: 'effectiveFrom',
      effective_to: 'effectiveTo',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsuranceApprovalRuleModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ApprovalRuleRecord[]>(),
      InsuranceApprovalRuleModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toApprovalRule),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getApprovalRuleById(id: string, allowedBranchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id) };
    if (allowedBranchIds) filter.$or = [{ branchId: null }, { branchId: { $in: allowedBranchIds.map(objectId) } }];
    const query = InsuranceApprovalRuleModel.findOne(filter).lean<ApprovalRuleRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toApprovalRule(record) : null;
  }

  async permissionCodeExists(code: string, session?: ClientSession) {
    const query = PermissionModel.exists({ code: code.trim().toUpperCase(), status: 'active', deletedAt: null });
    if (session) query.session(session);
    return Boolean(await query);
  }

  async userHasPermissionCode(userId: string, code: string, session?: ClientSession) {
    const permissionQuery = PermissionModel.findOne({
      code: code.trim().toUpperCase(),
      status: 'active',
      deletedAt: null,
    }).select('_id').lean();
    if (session) permissionQuery.session(session);
    const permission = await permissionQuery;
    if (!permission) return false;
    const userQuery = UserModel.findOne({ _id: objectId(userId), status: 'active', deletedAt: null })
      .select('roleIds')
      .lean();
    if (session) userQuery.session(session);
    const user = await userQuery;
    if (!user) return false;
    const roleQuery = RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      status: 'active',
      deletedAt: null,
      $or: [{ code: 'SUPER_ADMIN' }, { permissionIds: permission._id }],
    });
    if (session) roleQuery.session(session);
    return Boolean(await roleQuery);
  }

  async hasApprovalRuleOverlap(
    transactionType: InsuranceApprovalTransactionType,
    branchId: string | null,
    payerId: string | null,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
    session?: ClientSession,
  ) {
    const filter: Record<string, unknown> = {
      transactionType,
      branchId: branchId ? objectId(branchId) : null,
      payerId: payerId ? objectId(payerId) : null,
      status: 'ACTIVE',
      effectiveFrom: { $lte: effectiveTo ?? new Date('9999-12-31T23:59:59.999Z') },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: effectiveFrom } }],
    };
    if (excludeId) filter._id = { $ne: objectId(excludeId) };
    const query = InsuranceApprovalRuleModel.exists(filter);
    if (session) query.session(session);
    return Boolean(await query);
  }

  async createApprovalRule(data: CreateInsuranceApprovalRuleDTO, actorUserId: string, session?: ClientSession) {
    const records = await InsuranceApprovalRuleModel.create([{
      branchId: data.branch_id ? objectId(data.branch_id) : null,
      payerId: data.payer_id ? objectId(data.payer_id) : null,
      schemeId: null,
      transactionType: data.transaction_type,
      requiredPermission: data.required_permission.trim().toUpperCase(),
      effectiveFrom: new Date(`${data.effective_from}T00:00:00.000Z`),
      effectiveTo: data.effective_to ? new Date(`${data.effective_to}T23:59:59.999Z`) : null,
      status: data.status ?? 'ACTIVE',
      version: 0,
      createdBy: objectId(actorUserId),
      updatedBy: objectId(actorUserId),
    }], { session, ordered: true });
    const record = records[0];
    return record ? toApprovalRule(record.toObject<ApprovalRuleRecord>()) : null;
  }

  async updateApprovalRule(id: string, data: UpdateInsuranceApprovalRuleDTO, actorUserId: string, session?: ClientSession) {
    const updates: Record<string, unknown> = { updatedBy: objectId(actorUserId) };
    if (data.required_permission !== undefined) updates.requiredPermission = data.required_permission.trim().toUpperCase();
    if (data.effective_from !== undefined) updates.effectiveFrom = new Date(`${data.effective_from}T00:00:00.000Z`);
    if (data.effective_to !== undefined) updates.effectiveTo = data.effective_to ? new Date(`${data.effective_to}T23:59:59.999Z`) : null;
    if (data.status !== undefined) updates.status = data.status;
    const record = await InsuranceApprovalRuleModel.findOneAndUpdate(
      { _id: objectId(id), version: data.version },
      { $set: updates, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ApprovalRuleRecord | null>();
    return record ? toApprovalRule(record) : null;
  }

  async findEffectiveApprovalRule(
    transactionType: InsuranceApprovalTransactionType,
    branchId: string | null,
    payerId: string | null,
    at: Date,
    session?: ClientSession,
  ) {
    const base = {
      transactionType,
      status: 'ACTIVE' as const,
      effectiveFrom: { $lte: at },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
    };
    const candidates = [
      { branchId: branchId ? objectId(branchId) : null, payerId: payerId ? objectId(payerId) : null },
      ...(branchId && payerId ? [{ branchId: objectId(branchId), payerId: null }] : []),
      ...(branchId && payerId ? [{ branchId: null, payerId: objectId(payerId) }] : []),
      ...(branchId || payerId ? [{ branchId: null, payerId: null }] : []),
    ];
    for (const scope of candidates) {
      const ruleQuery = InsuranceApprovalRuleModel.findOne({ ...base, ...scope })
        .sort({ effectiveFrom: -1 }).lean<ApprovalRuleRecord | null>();
      if (session) ruleQuery.session(session);
      const rule = await ruleQuery;
      if (rule) return toApprovalRule(rule);
    }
    return null;
  }

  async listApprovalRequests(query: InsuranceApprovalRequestListQuery, allowedBranchIds?: string[]): Promise<InsurancePage<InsuranceApprovalRequest>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (allowedBranchIds) filter.$or = [{ branchId: null }, { branchId: { $in: allowedBranchIds.map(objectId) } }];
    if (query.transaction_type) filter.transactionType = query.transaction_type;
    if (query.resource_type) filter.resourceType = query.resource_type;
    if (query.resource_id) filter.resourceId = objectId(query.resource_id);
    if (query.status) filter.status = query.status;
    if (query.requested_by) filter.requestedBy = objectId(query.requested_by);
    const sortColumns = {
      requested_at: 'requestedAt',
      status: 'status',
      transaction_type: 'transactionType',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = query.sortBy ? sortColumns[query.sortBy] : 'requestedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      InsuranceApprovalRequestModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ApprovalRequestRecord[]>(),
      InsuranceApprovalRequestModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toApprovalRequest),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getApprovalRequestById(id: string, allowedBranchIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { _id: objectId(id) };
    if (allowedBranchIds) filter.$or = [{ branchId: null }, { branchId: { $in: allowedBranchIds.map(objectId) } }];
    const query = InsuranceApprovalRequestModel.findOne(filter).lean<ApprovalRequestRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toApprovalRequest(record) : null;
  }

  async createApprovalRequest(
    data: CreateInsuranceApprovalRequestDTO,
    rule: InsuranceApprovalRule,
    branchId: string | null,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const now = new Date();
    const records = await InsuranceApprovalRequestModel.create([{
      approvalRuleId: objectId(rule.id),
      branchId: branchId ? objectId(branchId) : null,
      transactionType: rule.transaction_type,
      resourceType: data.resource_type,
      resourceId: objectId(data.resource_id),
      resourceVersion: data.resource_version,
      requestedBy: objectId(actorUserId),
      requestedAt: now,
      status: 'PENDING',
      decidedBy: null,
      decidedAt: null,
      decisionReason: null,
      version: 0,
    }], { session, ordered: true });
    const record = records[0];
    return record ? toApprovalRequest(record.toObject<ApprovalRequestRecord>()) : null;
  }

  async decideApprovalRequest(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    data: DecideInsuranceApprovalRequestDTO,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsuranceApprovalRequestModel.findOneAndUpdate(
      { _id: objectId(id), status: 'PENDING', version: data.version },
      {
        $set: {
          status,
          decidedBy: objectId(actorUserId),
          decidedAt: new Date(),
          decisionReason: nullableTrimmed(data.decision_reason) ?? null,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ApprovalRequestRecord | null>();
    return record ? toApprovalRequest(record) : null;
  }

  async cancelApprovalRequest(
    id: string,
    data: CancelInsuranceApprovalRequestDTO,
    actorUserId: string,
    session?: ClientSession,
  ) {
    const record = await InsuranceApprovalRequestModel.findOneAndUpdate(
      { _id: objectId(id), status: 'PENDING', version: data.version, requestedBy: objectId(actorUserId) },
      {
        $set: {
          status: 'CANCELLED',
          decidedBy: objectId(actorUserId),
          decidedAt: new Date(),
          decisionReason: data.decision_reason.trim(),
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<ApprovalRequestRecord | null>();
    return record ? toApprovalRequest(record) : null;
  }

  async findApprovedRequest(
    id: string,
    ruleId: string,
    transactionType: InsuranceApprovalTransactionType,
    resourceType: InsuranceApprovalRequest['resource_type'],
    resourceId: string,
    resourceVersion: number,
    session?: ClientSession,
  ) {
    const query = InsuranceApprovalRequestModel.findOne({
      _id: objectId(id),
      approvalRuleId: objectId(ruleId),
      transactionType,
      resourceType,
      resourceId: objectId(resourceId),
      resourceVersion,
      status: 'APPROVED',
    }).lean<ApprovalRequestRecord | null>();
    if (session) query.session(session);
    const record = await query;
    return record ? toApprovalRequest(record) : null;
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
