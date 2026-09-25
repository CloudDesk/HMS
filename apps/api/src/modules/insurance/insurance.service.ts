import type { ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { executeTransaction } from '../../shared/database/transaction.js';
import { InsuranceRepository } from './insurance.repository.js';
import type {
  CancelInsuranceApprovalRequestDTO,
  CreateInsuranceApprovalRequestDTO,
  CreateInsuranceApprovalRuleDTO,
  CreateInsuranceContractDTO,
  CreateInsurancePayerDTO,
  CreateInsuranceProviderBranchDTO,
  CreateInsuranceProviderDTO,
  DecideInsuranceApprovalRequestDTO,
  InsuranceApprovalRequestListQuery,
  InsuranceApprovalResourceType,
  InsuranceApprovalRule,
  InsuranceApprovalRuleListQuery,
  InsuranceApprovalTransactionType,
  InsuranceContractAction,
  InsuranceContractActionDTO,
  InsuranceContractListQuery,
  InsuranceOperatingMode,
  InsurancePayerListQuery,
  InsuranceProviderAction,
  InsuranceProviderBranchListQuery,
  InsuranceProviderListQuery,
  InsuranceRequestMetadata,
  InsuranceStatusActionDTO,
  UpdateInsuranceConfigurationDTO,
  UpdateInsuranceApprovalRuleDTO,
  UpdateInsuranceContractDTO,
  UpdateInsurancePayerDTO,
  UpdateInsuranceProviderBranchDTO,
  UpdateInsuranceProviderDTO,
} from './insurance.types.js';

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

const dayStart = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dayEnd = (value: string | null | undefined) => value ? new Date(`${value}T23:59:59.999Z`) : null;

export class InsuranceService {
  constructor(private readonly repository: InsuranceRepository) {}

  private async payerAdministrationMode(session?: ClientSession): Promise<InsuranceOperatingMode> {
    const configuration = await this.repository.getConfiguration(session);
    const supportedModes: readonly InsuranceOperatingMode[] = ['PROVIDER', 'PAYER', 'TPA', 'HYBRID'];
    if (!supportedModes.includes(configuration.operating_mode)) {
      throw new AppError('Current operating mode does not permit payer administration', 403, 'INSURANCE_OPERATING_MODE_DENIED');
    }
    return configuration.operating_mode;
  }

  private async getApprovalResource(resourceType: InsuranceApprovalResourceType, resourceId: string, session?: ClientSession) {
    const resource = resourceType === 'PROVIDER'
      ? await this.repository.getProviderById(resourceId, session)
      : resourceType === 'PAYER'
        ? await this.repository.getPayerById(resourceId, session)
        : await this.repository.getContractById(resourceId, undefined, session);
    if (!resource) throw new AppError('Insurance approval resource not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    return resource;
  }

  private expectedApprovalTransaction(resourceType: InsuranceApprovalResourceType): InsuranceApprovalTransactionType {
    return resourceType === 'PROVIDER'
      ? 'PROVIDER_ACTIVATION'
      : resourceType === 'PAYER'
        ? 'PAYER_ACTIVATION'
        : 'CONTRACT_ACTIVATION';
  }

  private assertApprovalRuleMatchesResource(
    rule: InsuranceApprovalRule,
    resourceType: InsuranceApprovalResourceType,
    resourceId: string,
  ) {
    if (rule.transaction_type !== this.expectedApprovalTransaction(resourceType)) {
      throw new AppError('Approval rule does not match the resource type', 409, 'INSURANCE_APPROVAL_REQUIRED');
    }
    if (resourceType === 'PAYER' && rule.payer_id && rule.payer_id !== resourceId) {
      throw new AppError('Approval rule does not match this payer', 409, 'INSURANCE_APPROVAL_REQUIRED');
    }
    if (resourceType === 'PROVIDER' && rule.payer_id) {
      throw new AppError('Payer-scoped rules cannot approve providers', 409, 'INSURANCE_APPROVAL_REQUIRED');
    }
  }

  private async enforceActivationApproval(
    resourceType: InsuranceApprovalResourceType,
    resourceId: string,
    resourceVersion: number,
    approvalRequestId: string | undefined,
    actor: string,
    session?: ClientSession,
    branchId: string | null = null,
    payerId: string | null = null,
  ) {
    await this.repository.touchApprovalRuleSchedule(actor, session);
    const transactionType = this.expectedApprovalTransaction(resourceType);
    const rule = await this.repository.findEffectiveApprovalRule(
      transactionType,
      branchId,
      payerId ?? (resourceType === 'PAYER' ? resourceId : null),
      new Date(),
      session,
    );
    if (!rule) return null;
    if (!approvalRequestId) {
      throw new AppError('An approved request is required for activation', 409, 'INSURANCE_APPROVAL_REQUIRED');
    }
    const approved = await this.repository.findApprovedRequest(
      approvalRequestId,
      rule.id,
      transactionType,
      resourceType,
      resourceId,
      resourceVersion,
      session,
    );
    if (!approved) {
      throw new AppError('Approval does not match the current resource version', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
    }
    return approved.id;
  }

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
      const approvalRequestId = action === 'activate'
        ? await this.enforceActivationApproval('PROVIDER', id, data.version, data.approval_request_id, actor, session)
        : null;
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
        approvalRequestId,
      }, session);
      return updated;
    });
  }

  listPayers(query: InsurancePayerListQuery) {
    return this.repository.listPayers(query);
  }

  async getPayer(id: string) {
    const payer = await this.repository.getPayerById(id);
    if (!payer) throw new AppError('Insurance payer not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    return payer;
  }

  async createPayer(data: CreateInsurancePayerDTO, actor: string, metadata: InsuranceRequestMetadata) {
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        const operatingMode = await this.payerAdministrationMode(session);
        if (await this.repository.getPayerByCode(data.payer_code, undefined, session)) {
          throw new AppError('Payer code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const payer = await this.repository.createPayer(data, actor, session);
        if (!payer) throw new AppError('Insurance payer could not be created', 500, 'INSURANCE_PAYER_CREATE_FAILED');
        await this.repository.audit('insurance.payer.created', actor, metadata, {
          insuranceResourceType: 'PAYER',
          insuranceResourceId: payer.id,
          resourceVersion: payer.version,
          operatingMode,
          before: null,
          after: payer,
        }, session);
        return payer;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Payer code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async updatePayer(id: string, data: UpdateInsurancePayerDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getPayer(id);
    if (before.version !== data.version) throw new AppError('Insurance payer was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        const operatingMode = await this.payerAdministrationMode(session);
        if (data.payer_code && await this.repository.getPayerByCode(data.payer_code, id, session)) {
          throw new AppError('Payer code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const updated = await this.repository.updatePayer(id, data, actor, session);
        if (!updated) throw new AppError('Insurance payer was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.payer.updated', actor, metadata, {
          insuranceResourceType: 'PAYER',
          insuranceResourceId: id,
          resourceVersion: updated.version,
          operatingMode,
          before,
          after: updated,
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Payer code already exists', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async transitionPayer(id: string, action: InsuranceProviderAction, data: InsuranceStatusActionDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getPayer(id);
    if (before.version !== data.version) throw new AppError('Insurance payer was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    const allowed = action === 'activate' ? ['DRAFT', 'INACTIVE'] as const : ['ACTIVE'] as const;
    if (!(allowed as readonly string[]).includes(before.status)) {
      throw new AppError(`Payer cannot be ${action}d from ${before.status}`, 409, 'INSURANCE_INVALID_STATUS_TRANSITION');
    }
    const target = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
    return executeTransaction(() => this.repository.startSession(), async (session) => {
      const operatingMode = await this.payerAdministrationMode(session);
      const approvalRequestId = action === 'activate'
        ? await this.enforceActivationApproval('PAYER', id, data.version, data.approval_request_id, actor, session)
        : null;
      const updated = await this.repository.transitionPayer(id, [...allowed], target, data.version, actor, session);
      if (!updated) throw new AppError('Insurance payer was changed by another user', 409, 'INSURANCE_STALE_VERSION');
      await this.repository.audit(`insurance.payer.${action}d`, actor, metadata, {
        insuranceResourceType: 'PAYER',
        insuranceResourceId: id,
        resourceVersion: updated.version,
        operatingMode,
        before,
        after: updated,
        reasonNotes: data.reason.trim(),
        approvalRequestId,
      }, session);
      return updated;
    });
  }

  async listContracts(query: InsuranceContractListQuery, actor: string) {
    const branches = await this.repository.resolveBranchScope(actor, query.branch_id);
    return this.repository.listContracts(query, branches);
  }

  async getContract(id: string, actor: string) {
    const branches = await this.repository.resolveBranchScope(actor);
    const contract = await this.repository.getContractById(id, branches);
    if (!contract) throw new AppError('Insurance contract not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    return contract;
  }

  private async validateContractReferences(
    payerId: string,
    providerId: string,
    branchId: string,
    effectiveFrom: Date,
    session?: ClientSession,
  ) {
    const [payer, provider, mapped] = await Promise.all([
      this.repository.getPayerById(payerId, session),
      this.repository.getProviderById(providerId, session),
      this.repository.hasActiveProviderBranchOn(providerId, branchId, effectiveFrom, session),
    ]);
    if (!payer || payer.status !== 'ACTIVE') {
      throw new AppError('Contract payer must be active', 409, 'INSURANCE_INACTIVE_REFERENCE');
    }
    if (!provider || provider.status !== 'ACTIVE') {
      throw new AppError('Contract provider must be active', 409, 'INSURANCE_INACTIVE_REFERENCE');
    }
    if (!mapped) {
      throw new AppError('Provider is not actively mapped to the contract branch on the effective date', 409, 'INSURANCE_INACTIVE_REFERENCE');
    }
  }

  async createContract(data: CreateInsuranceContractDTO, actor: string, metadata: InsuranceRequestMetadata) {
    await this.repository.resolveBranchScope(actor, data.branch_id);
    if (data.effective_to && data.effective_to < data.effective_from) {
      throw new AppError('Effective-to must be on or after effective-from', 400, 'INSURANCE_INVALID_EFFECTIVE_DATES');
    }
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.validateContractReferences(data.payer_id, data.provider_id, data.branch_id, dayStart(data.effective_from), session);
        if (await this.repository.getContractByNumber(data.branch_id, data.payer_id, data.contract_number, undefined, session)) {
          throw new AppError('Contract number already exists for this payer and branch', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const contract = await this.repository.createContract(data, actor, session);
        if (!contract) throw new AppError('Insurance contract could not be created', 500, 'INSURANCE_CONTRACT_CREATE_FAILED');
        await this.repository.audit('insurance.contract.created', actor, metadata, {
          insuranceResourceType: 'CONTRACT', insuranceResourceId: contract.id, resourceVersion: contract.version,
          branchId: contract.branch_id, payerId: contract.payer_id, providerId: contract.provider_id,
          before: null, after: contract,
        }, session);
        return contract;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Contract number already exists for this payer and branch', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async updateContract(id: string, data: UpdateInsuranceContractDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getContract(id, actor);
    if (before.version !== data.version) throw new AppError('Insurance contract was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    if (before.status !== 'DRAFT') throw new AppError('Only draft contracts can be edited', 409, 'INSURANCE_INVALID_STATUS_TRANSITION');
    const effectiveFrom = data.effective_from ? dayStart(data.effective_from) : before.effective_from;
    const effectiveTo = data.effective_to !== undefined ? dayEnd(data.effective_to) : before.effective_to;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new AppError('Effective-to must be on or after effective-from', 400, 'INSURANCE_INVALID_EFFECTIVE_DATES');
    }
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.validateContractReferences(before.payer_id, before.provider_id, before.branch_id, effectiveFrom, session);
        const contractNumber = data.contract_number ?? before.contract_number;
        if (await this.repository.getContractByNumber(before.branch_id, before.payer_id, contractNumber, id, session)) {
          throw new AppError('Contract number already exists for this payer and branch', 409, 'INSURANCE_DUPLICATE_CODE');
        }
        const updated = await this.repository.updateContract(id, data, actor, session);
        if (!updated) throw new AppError('Insurance contract was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.contract.updated', actor, metadata, {
          insuranceResourceType: 'CONTRACT', insuranceResourceId: id, resourceVersion: updated.version,
          branchId: updated.branch_id, before, after: updated,
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Contract number already exists for this payer and branch', 409, 'INSURANCE_DUPLICATE_CODE');
      throw error;
    }
  }

  async transitionContract(
    id: string,
    action: InsuranceContractAction,
    data: InsuranceContractActionDTO,
    actor: string,
    metadata: InsuranceRequestMetadata,
  ) {
    const before = await this.getContract(id, actor);
    if (before.version !== data.version) throw new AppError('Insurance contract was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    const transitions = {
      submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
      activate: { from: ['APPROVED', 'SUSPENDED'], to: 'ACTIVE' },
      suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
      expire: { from: ['ACTIVE', 'SUSPENDED'], to: 'EXPIRED' },
      terminate: { from: ['ACTIVE', 'SUSPENDED'], to: 'TERMINATED' },
    } as const;
    const transition = transitions[action];
    if (!(transition.from as readonly string[]).includes(before.status)) {
      throw new AppError(`Contract cannot be ${action}ed from ${before.status}`, 409, 'INSURANCE_INVALID_STATUS_TRANSITION');
    }
    if (['suspend', 'expire', 'terminate'].includes(action) && !data.reason?.trim()) {
      throw new AppError('Reason is required for this contract action', 400, 'VALIDATION_ERROR');
    }
    return executeTransaction(() => this.repository.startSession(), async (session) => {
      if (action === 'submit' || action === 'activate') {
        await this.validateContractReferences(before.payer_id, before.provider_id, before.branch_id, before.effective_from, session);
      }
      let approvalRequestId: string | null = null;
      let approvalRuleId: string | null = null;
      if (action === 'submit') {
        await this.repository.touchApprovalRuleSchedule(actor, session);
        const rule = await this.repository.findEffectiveApprovalRule(
          'CONTRACT_ACTIVATION', before.branch_id, before.payer_id, new Date(), session,
        );
        if (!rule) throw new AppError('An approval rule is required before submitting a contract', 409, 'INSURANCE_APPROVAL_REQUIRED');
        approvalRuleId = rule.id;
      } else if (action === 'activate' && before.status === 'SUSPENDED') {
        approvalRequestId = await this.enforceActivationApproval(
          'CONTRACT', id, before.version, data.approval_request_id, actor, session, before.branch_id, before.payer_id,
        );
      }
      const updated = await this.repository.transitionContract(
        id, [...transition.from], transition.to, data.version, actor, session,
      );
      if (!updated) throw new AppError('Insurance contract was changed by another user', 409, 'INSURANCE_STALE_VERSION');
      await this.repository.audit(`insurance.contract.${action}ed`, actor, metadata, {
        insuranceResourceType: 'CONTRACT', insuranceResourceId: id, resourceVersion: updated.version,
        branchId: updated.branch_id, payerId: updated.payer_id, providerId: updated.provider_id,
        before, after: updated, reasonNotes: data.reason?.trim() ?? null, approvalRuleId, approvalRequestId,
      }, session);
      return updated;
    });
  }

  async listApprovalRules(query: InsuranceApprovalRuleListQuery, actor: string) {
    const branches = await this.repository.resolveBranchScope(actor, query.branch_id);
    return this.repository.listApprovalRules(query, branches);
  }

  async getApprovalRule(id: string, actor?: string) {
    const branches = actor ? await this.repository.resolveBranchScope(actor) : undefined;
    const rule = await this.repository.getApprovalRuleById(id, branches);
    if (!rule) throw new AppError('Insurance approval rule not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    return rule;
  }

  async createApprovalRule(data: CreateInsuranceApprovalRuleDTO, actor: string, metadata: InsuranceRequestMetadata) {
    if (data.scheme_id) {
      throw new AppError('Scheme-scoped approval rules are not available in this slice', 400, 'VALIDATION_ERROR');
    }
    if (data.transaction_type !== 'CONTRACT_ACTIVATION' && data.branch_id) {
      throw new AppError('Only contract activation rules can be branch-scoped', 400, 'VALIDATION_ERROR');
    }
    if (data.transaction_type === 'PROVIDER_ACTIVATION' && data.payer_id) {
      throw new AppError('Provider activation rules cannot be payer-scoped', 400, 'VALIDATION_ERROR');
    }
    if (data.branch_id) await this.repository.resolveBranchScope(actor, data.branch_id);
    if (data.effective_to && data.effective_to < data.effective_from) {
      throw new AppError('Effective-to must be on or after effective-from', 400, 'VALIDATION_ERROR');
    }
    if (!await this.repository.permissionCodeExists(data.required_permission)) {
      throw new AppError('Required approval permission not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    }
    if (data.payer_id) await this.getPayer(data.payer_id);
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.repository.touchApprovalRuleSchedule(actor, session);
        if ((data.status ?? 'ACTIVE') === 'ACTIVE' && await this.repository.hasApprovalRuleOverlap(
          data.transaction_type,
          data.branch_id ?? null,
          data.payer_id ?? null,
          dayStart(data.effective_from),
          dayEnd(data.effective_to),
          undefined,
          session,
        )) {
          throw new AppError('Approval rule effective dates overlap an active rule', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
        }
        const rule = await this.repository.createApprovalRule(data, actor, session);
        if (!rule) throw new AppError('Approval rule could not be created', 500, 'INSURANCE_APPROVAL_RULE_CREATE_FAILED');
        await this.repository.audit('insurance.approval_rule.created', actor, metadata, {
          insuranceResourceType: 'APPROVAL_RULE',
          insuranceResourceId: rule.id,
          resourceVersion: rule.version,
          before: null,
          after: rule,
        }, session);
        return rule;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Approval rule conflicts with an active rule', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
      throw error;
    }
  }

  async updateApprovalRule(id: string, data: UpdateInsuranceApprovalRuleDTO, actor: string, metadata: InsuranceRequestMetadata) {
    const before = await this.getApprovalRule(id, actor);
    if (before.version !== data.version) throw new AppError('Approval rule was changed by another user', 409, 'INSURANCE_STALE_VERSION');
    if (data.required_permission && !await this.repository.permissionCodeExists(data.required_permission)) {
      throw new AppError('Required approval permission not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    }
    const effectiveFrom = data.effective_from ? dayStart(data.effective_from) : before.effective_from;
    const effectiveTo = data.effective_to !== undefined ? dayEnd(data.effective_to) : before.effective_to;
    if (effectiveTo && effectiveTo < effectiveFrom) throw new AppError('Effective-to must be on or after effective-from', 400, 'VALIDATION_ERROR');
    const targetStatus = data.status ?? before.status;
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.repository.touchApprovalRuleSchedule(actor, session);
        if (targetStatus === 'ACTIVE' && await this.repository.hasApprovalRuleOverlap(
          before.transaction_type,
          before.branch_id,
          before.payer_id,
          effectiveFrom,
          effectiveTo,
          id,
          session,
        )) {
          throw new AppError('Approval rule effective dates overlap an active rule', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
        }
        const updated = await this.repository.updateApprovalRule(id, data, actor, session);
        if (!updated) throw new AppError('Approval rule was changed by another user', 409, 'INSURANCE_STALE_VERSION');
        await this.repository.audit('insurance.approval_rule.updated', actor, metadata, {
          insuranceResourceType: 'APPROVAL_RULE',
          insuranceResourceId: id,
          resourceVersion: updated.version,
          before,
          after: updated,
        }, session);
        return updated;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('Approval rule conflicts with an active rule', 409, 'INSURANCE_EFFECTIVE_DATE_OVERLAP');
      throw error;
    }
  }

  async listApprovalRequests(query: InsuranceApprovalRequestListQuery, actor: string) {
    const branches = await this.repository.resolveBranchScope(actor);
    return this.repository.listApprovalRequests(query, branches);
  }

  async getApprovalRequest(id: string, actor?: string) {
    const branches = actor ? await this.repository.resolveBranchScope(actor) : undefined;
    const request = await this.repository.getApprovalRequestById(id, branches);
    if (!request) throw new AppError('Insurance approval request not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
    return request;
  }

  async createApprovalRequest(data: CreateInsuranceApprovalRequestDTO, actor: string, metadata: InsuranceRequestMetadata) {
    try {
      return await executeTransaction(() => this.repository.startSession(), async (session) => {
        await this.repository.touchApprovalRuleSchedule(actor, session);
        const rule = await this.repository.getApprovalRuleById(data.approval_rule_id, undefined, session);
        if (!rule) throw new AppError('Insurance approval rule not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
        const now = new Date();
        if (rule.status !== 'ACTIVE' || rule.effective_from > now || (rule.effective_to && rule.effective_to < now)) {
          throw new AppError('Approval rule is not currently active', 409, 'INSURANCE_APPROVAL_REQUIRED');
        }
        this.assertApprovalRuleMatchesResource(rule, data.resource_type, data.resource_id);
        const resource = await this.getApprovalResource(data.resource_type, data.resource_id, session);
        const resourceBranchId = data.resource_type === 'CONTRACT' ? resource.branch_id : null;
        const resourcePayerId = data.resource_type === 'CONTRACT'
          ? resource.payer_id
          : data.resource_type === 'PAYER' ? data.resource_id : null;
        if (resourceBranchId) await this.repository.resolveBranchScope(actor, resourceBranchId);
        if (data.resource_type === 'CONTRACT' && (
          (rule.branch_id && rule.branch_id !== resourceBranchId)
          || (rule.payer_id && rule.payer_id !== resourcePayerId)
        )) {
          throw new AppError('Approval rule does not match this contract', 409, 'INSURANCE_APPROVAL_REQUIRED');
        }
        const effectiveRule = await this.repository.findEffectiveApprovalRule(
          rule.transaction_type,
          resourceBranchId,
          resourcePayerId,
          now,
          session,
        );
        if (!effectiveRule || effectiveRule.id !== rule.id) {
          throw new AppError('The selected rule is not the applicable approval rule', 409, 'INSURANCE_APPROVAL_REQUIRED');
        }
        if (resource.version !== data.resource_version) {
          throw new AppError('Approval request uses a stale resource version', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
        }
        const eligibleStatuses = data.resource_type === 'CONTRACT'
          ? ['PENDING_APPROVAL', 'SUSPENDED']
          : ['DRAFT', 'INACTIVE'];
        if (!eligibleStatuses.includes(resource.status)) {
          throw new AppError('Resource is not eligible for activation approval', 409, 'INSURANCE_INVALID_STATUS_TRANSITION');
        }
        const request = await this.repository.createApprovalRequest(data, rule, resourceBranchId, actor, session);
        if (!request) throw new AppError('Approval request could not be created', 500, 'INSURANCE_APPROVAL_REQUEST_CREATE_FAILED');
        await this.repository.audit('insurance.approval_request.created', actor, metadata, {
          insuranceResourceType: 'APPROVAL_REQUEST',
          insuranceResourceId: request.id,
          resourceVersion: request.version,
          approvalRequestId: request.id,
          approvalRuleId: rule.id,
          targetResourceType: request.resource_type,
          targetResourceId: request.resource_id,
          targetResourceVersion: request.resource_version,
          before: null,
          after: request,
        }, session);
        return request;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError('A pending approval request already exists for this resource version', 409, 'INSURANCE_APPROVAL_REQUIRED');
      throw error;
    }
  }

  async decideApprovalRequest(
    id: string,
    action: 'approve' | 'reject',
    data: DecideInsuranceApprovalRequestDTO,
    actor: string,
    metadata: InsuranceRequestMetadata,
  ) {
    if (action === 'reject' && !data.decision_reason?.trim()) {
      throw new AppError('Decision reason is required when rejecting', 400, 'VALIDATION_ERROR');
    }
    return executeTransaction(() => this.repository.startSession(), async (session) => {
      await this.repository.touchApprovalRuleSchedule(actor, session);
      const before = await this.repository.getApprovalRequestById(id, undefined, session);
      if (!before) throw new AppError('Insurance approval request not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
      if (before.version !== data.version || before.status !== 'PENDING') {
        throw new AppError('Approval request is stale or already decided', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      }
      if (before.requested_by === actor) {
        throw new AppError('Requester cannot decide their own approval request', 409, 'INSURANCE_SELF_APPROVAL_FORBIDDEN');
      }
      const rule = await this.repository.getApprovalRuleById(before.approval_rule_id, undefined, session);
      if (!rule) throw new AppError('Insurance approval rule not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
      if (before.branch_id) await this.repository.resolveBranchScope(actor, before.branch_id);
      const now = new Date();
      const resource = await this.getApprovalResource(before.resource_type, before.resource_id, session);
      const resourceBranchId = before.resource_type === 'CONTRACT' ? resource.branch_id : null;
      const resourcePayerId = before.resource_type === 'CONTRACT'
        ? resource.payer_id
        : before.resource_type === 'PAYER' ? before.resource_id : null;
      const effectiveRule = await this.repository.findEffectiveApprovalRule(
        rule.transaction_type,
        resourceBranchId,
        resourcePayerId,
        now,
        session,
      );
      if (!effectiveRule || effectiveRule.id !== rule.id) {
        throw new AppError('Approval rule is no longer applicable', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      }
      if (!await this.repository.userHasPermissionCode(actor, rule.required_permission, session)) {
        throw new AppError('The approval rule requires an additional permission', 403, 'PERMISSION_REQUIRED');
      }
      if (resource.version !== before.resource_version) {
        throw new AppError('Approval target changed after the request', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      }
      const updated = await this.repository.decideApprovalRequest(
        id,
        action === 'approve' ? 'APPROVED' : 'REJECTED',
        data,
        actor,
        session,
      );
      if (!updated) throw new AppError('Approval request is stale or already decided', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      let approvalTarget = resource;
      if (before.resource_type === 'CONTRACT' && resource.status === 'PENDING_APPROVAL') {
        const targetStatus = action === 'approve' ? 'APPROVED' : 'DRAFT';
        const contract = await this.repository.transitionContract(
          resource.id, ['PENDING_APPROVAL'], targetStatus, resource.version, actor, session,
        );
        if (!contract) throw new AppError('Approval target changed after the request', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
        approvalTarget = contract;
      }
      await this.repository.audit(`insurance.approval_request.${action}d`, actor, metadata, {
        insuranceResourceType: 'APPROVAL_REQUEST',
        insuranceResourceId: id,
        resourceVersion: updated.version,
        approvalRequestId: id,
        approvalRuleId: rule.id,
        targetResourceType: updated.resource_type,
        targetResourceId: updated.resource_id,
        targetResourceVersion: updated.resource_version,
        before,
        after: updated,
        targetAfter: approvalTarget,
        reasonNotes: data.decision_reason?.trim() ?? null,
      }, session);
      return updated;
    });
  }

  async cancelApprovalRequest(id: string, data: CancelInsuranceApprovalRequestDTO, actor: string, metadata: InsuranceRequestMetadata) {
    return executeTransaction(() => this.repository.startSession(), async (session) => {
      const before = await this.repository.getApprovalRequestById(id, undefined, session);
      if (!before) throw new AppError('Insurance approval request not found', 404, 'INSURANCE_RESOURCE_NOT_FOUND');
      if (before.branch_id) await this.repository.resolveBranchScope(actor, before.branch_id);
      if (before.requested_by !== actor) throw new AppError('Only the requester may cancel this approval', 403, 'INSURANCE_SCOPE_DENIED');
      if (before.version !== data.version || before.status !== 'PENDING') {
        throw new AppError('Approval request is stale or already decided', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      }
      const updated = await this.repository.cancelApprovalRequest(id, data, actor, session);
      if (!updated) throw new AppError('Approval request is stale or already decided', 409, 'INSURANCE_APPROVAL_STALE_RESOURCE');
      await this.repository.audit('insurance.approval_request.cancelled', actor, metadata, {
        insuranceResourceType: 'APPROVAL_REQUEST',
        insuranceResourceId: id,
        resourceVersion: updated.version,
        approvalRequestId: id,
        before,
        after: updated,
        reasonNotes: data.decision_reason.trim(),
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
