import { AppError } from '../../shared/errors/app-error.js';
import { executeTransaction } from '../../shared/database/transaction.js';
import { InsuranceRepository } from './insurance.repository.js';
import type {
  CreateInsuranceProviderBranchDTO,
  CreateInsuranceProviderDTO,
  InsuranceProviderAction,
  InsuranceProviderBranchListQuery,
  InsuranceProviderListQuery,
  InsuranceRequestMetadata,
  InsuranceStatusActionDTO,
  UpdateInsuranceConfigurationDTO,
  UpdateInsuranceProviderBranchDTO,
  UpdateInsuranceProviderDTO,
} from './insurance.types.js';

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

const dayStart = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dayEnd = (value: string | null | undefined) => value ? new Date(`${value}T23:59:59.999Z`) : null;

export class InsuranceService {
  constructor(private readonly repository: InsuranceRepository) {}

  getConfiguration() {
    return this.repository.getConfiguration();
  }

  async updateConfiguration(data: UpdateInsuranceConfigurationDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.repository.getConfiguration();
    if (before.version !== data.version) {
      throw new AppError('Insurance configuration was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    }
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        const updated = await this.repository.updateConfiguration(data.operating_mode, data.version, actor, session);
        if (!updated) throw new AppError('Insurance configuration was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.configuration.updated', actor, metadata, {
          insuranceResourceType: 'CONFIGURATION',
          resourceId: updated.id,
          insuranceResourceId: updated.id,
          resourceVersion: updated.version,
          before: { operating_mode: before.operating_mode, version: before.version },
          after: { operating_mode: updated.operating_mode, version: updated.version },
          reasonNotes: data.reason.trim(),
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Insurance configuration was changed by another user', 409, 'INSURANCE_STALE_VERSION');
      throw error;
    }
  }

  listProviders(query: InsuranceProviderListQuery) {
    return this.repository.listProviders(query);
  }

  async getProvider(id: string) {
    const provider = await this.repository.getProviderById(id);
    if (!provider) throw new AppError('Insurance provider not found', 404, 'INSURANCE_PROVIDER_NOT_FOUND');
    return provider;
  }

  async createProvider(data: CreateInsuranceProviderDTO, actor: string, metadata: InsuranceRequestMetadata) {
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        if (await this.repository.getProviderByCode(data.provider_code, undefined, session)) {
          throw new AppError('Provider code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const provider = await this.repository.createProvider(data, actor, session);
        if (!provider) throw new AppError('Insurance provider could not be created', 500, 'INSURANCE_PROVIDER_CREATE_FAILED');
        await this.repository.audit('insurance.provider.created', actor, metadata, {
          insuranceResourceType: 'PROVIDER',
          insuranceResourceId: provider.id,
          resourceVersion: provider.version,
          providerId: provider.id,
          providerCode: provider.provider_code,
          status: provider.status,
          before: null,
          after: provider,
        }, session);
        return provider;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Provider code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async updateProvider(id: string, data: UpdateInsuranceProviderDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getProvider(id);
    if (before.version !== data.version) throw new AppError('Insurance provider was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        if (data.provider_code && await this.repository.getProviderByCode(data.provider_code, id, session)) {
          throw new AppError('Provider code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const updated = await this.repository.updateProvider(id, data, actor, session);
        if (!updated) throw new AppError('Insurance provider was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.provider.updated', actor, metadata, {
          insuranceResourceType: 'PROVIDER',
          insuranceResourceId: id,
          resourceVersion: updated.version,
          providerId: id,
          before,
          after: updated,
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Provider code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async transitionProvider(id: string, action: InsuranceProviderAction, data: InsuranceStatusActionDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getProvider(id);
    if (before.version !== data.version) throw new AppError('Insurance provider was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    const allowed = action === 'activate' ? ['DRAFT', 'INACTIVE'] as const : ['ACTIVE'] as const;
    if (!(allowed as readonly string[]).includes(before.status)) {
      throw new AppError(`Provider cannot be ${action}d from ${before.status}`, 409, 'INSURANCE_INVALID_STATUS_TRANSITION');
    }
    const target = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
    return executeTransaction(() => this.repository.startSession(), async (session) => {
      const updated = await this.repository.transitionProvider(id, [...allowed], target, data.version, actor, session);
      if (!updated) throw new AppError('Insurance provider was changed by another user', 409, 'INSURANCE_STALE_VERSION');
      await this.repository.audit(`insurance.provider.${action}d`, actor, metadata, {
        insuranceResourceType: 'PROVIDER',
        insuranceResourceId: id,
        resourceVersion: updated.version,
        providerId: id,
        beforeStatus: before.status,
        afterStatus: updated.status,
        beforeVersion: before.version,
        afterVersion: updated.version,
        before,
        after: updated,
        reasonNotes: data.reason.trim(),
      }, session);
      return updated;
    });
  }

  async listProviderBranches(providerId: string, query: InsuranceProviderBranchListQuery, actor: string) {
    await this.getProvider(providerId);
    const branchIds = await this.repository.resolveBranchScope(actor, query.branch_id);
    return this.repository.listProviderBranches(providerId, query, branchIds);
  }

  async createProviderBranch(providerId: string, data: CreateInsuranceProviderBranchDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const provider = await this.getProvider(providerId);
    await this.repository.resolveBranchScope(actor, data.branch_id);
    if (data.effective_to && data.effective_to < data.effective_from) {
      throw new AppError('Effective-to must be on or after effective-from', 400, 'INSURANCE_INVALID_EFFECTIVE_DATES');
    }
    if ((data.status ?? 'ACTIVE') === 'ACTIVE' && provider.status !== 'ACTIVE') {
      throw new AppError('Only an active provider can be mapped as active', 409, 'INSURANCE_INACTIVE_REFERENCE');
    }
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.repository.touchProviderBranchSchedule(providerId, session);
        if ((data.status ?? 'ACTIVE') === 'ACTIVE' && await this.repository.hasProviderBranchOverlap(providerId, data.branch_id, dayStart(data.effective_from), dayEnd(data.effective_to), undefined, session)) {
          throw new AppError('Provider branch effective dates overlap an existing mapping', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
        }
        const mapping = await this.repository.createProviderBranch(providerId, data, actor, session);
        if (!mapping) throw new AppError('Provider branch mapping could not be created', 500, 'INSURANCE_PROVIDER_BRANCH_CREATE_FAILED');
        await this.repository.audit('insurance.provider_branch.created', actor, metadata, {
          insuranceResourceType: 'PROVIDER_BRANCH',
          insuranceResourceId: mapping.id,
          resourceVersion: mapping.version,
          providerBranchId: mapping.id,
          providerId,
          branchId: mapping.branch_id,
          effectiveFrom: mapping.effective_from,
          effectiveTo: mapping.effective_to,
          status: mapping.status,
          before: null,
          after: mapping,
        }, session);
        return mapping;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Provider branch effective dates conflict with an existing mapping', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
      throw error;
    }
  }

  async updateProviderBranch(id: string, data: UpdateInsuranceProviderBranchDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const allowedBranchIds = await this.repository.resolveBranchScope(actor);
    const before = await this.repository.getProviderBranchById(id, allowedBranchIds);
    if (!before) throw new AppError('Provider branch mapping not found', 404, 'INSURANCE_PROVIDER_BRANCH_NOT_FOUND');
    await this.repository.resolveBranchScope(actor, before.branch_id);
    if (before.version !== data.version) throw new AppError('Provider branch mapping was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    const effectiveFrom = data.effective_from ? dayStart(data.effective_from) : before.effective_from;
    const effectiveTo = data.effective_to !== undefined ? dayEnd(data.effective_to) : before.effective_to;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new AppError('Effective-to must be on or after effective-from', 400, 'INSURANCE_INVALID_EFFECTIVE_DATES');
    }
    const targetStatus = data.status ?? before.status;
    if (targetStatus === 'ACTIVE') {
      const provider = await this.getProvider(before.provider_id);
      if (provider.status !== 'ACTIVE') throw new AppError('Only an active provider can have an active mapping', 409, 'INSURANCE_INACTIVE_REFERENCE');
    }
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.repository.touchProviderBranchSchedule(before.provider_id, session);
        if (targetStatus === 'ACTIVE' && await this.repository.hasProviderBranchOverlap(before.provider_id, before.branch_id, effectiveFrom, effectiveTo, id, session)) {
          throw new AppError('Provider branch effective dates overlap an existing mapping', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
        }
        const updated = await this.repository.updateProviderBranch(id, data, actor, session);
        if (!updated) throw new AppError('Provider branch mapping was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.provider_branch.updated', actor, metadata, {
          insuranceResourceType: 'PROVIDER_BRANCH',
          insuranceResourceId: id,
          resourceVersion: updated.version,
          providerBranchId: id,
          providerId: before.provider_id,
          branchId: before.branch_id,
          before,
          after: updated,
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Provider branch effective dates conflict with an existing mapping', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
      throw error;
    }
  }
}
