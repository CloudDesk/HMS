import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../../shared/security/hash.js';
import {
  InsuranceConfigurationModel,
  InsuranceApprovalRequestModel,
  InsuranceApprovalRuleModel,
  InsurancePayerModel,
  InsuranceProviderBranchModel,
  InsuranceProviderModel,
} from './insurance.model.js';
import { InsuranceRepository } from './insurance.repository.js';
import { InsuranceService } from './insurance.service.js';

const errorCode = (error: unknown) => error instanceof AppError ? error.code : undefined;

describe('Insurance Phase 1A configuration and provider foundation', () => {
  let replSet: MongoMemoryReplSet;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let repository: InsuranceRepository;
  let service: InsuranceService;
  let actorId: string;
  let assignedBranchId: string;
  let inaccessibleBranchId: string;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    ({ app } = await buildApp());
    repository = new InsuranceRepository();
    service = new InsuranceService(repository);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      InsuranceConfigurationModel.deleteMany({}),
      InsuranceApprovalRequestModel.deleteMany({}),
      InsuranceApprovalRuleModel.deleteMany({}),
      InsurancePayerModel.deleteMany({}),
      InsuranceProviderBranchModel.deleteMany({}),
      InsuranceProviderModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
      PermissionModel.deleteMany({}),
      UserModel.deleteMany({}),
      RoleModel.deleteMany({}),
      BranchModel.deleteMany({}),
    ]);

    const [assignedBranch, inaccessibleBranch] = await BranchModel.create([
      { code: 'BR-A', name: 'Assigned Branch', status: 'ACTIVE' },
      { code: 'BR-B', name: 'Other Branch', status: 'ACTIVE' },
    ]);
    assignedBranchId = assignedBranch._id.toString();
    inaccessibleBranchId = inaccessibleBranch._id.toString();
    const role = await RoleModel.create({ code: 'INSURANCE_USER', name: 'Insurance User', permissionIds: [], status: 'active' });
    const actor = await UserModel.create({
      username: 'insurance.user',
      email: 'insurance.user@example.test',
      fullName: 'Insurance User',
      passwordHash: await hashPassword('Testpassword1'),
      roleIds: [role._id],
      branchIds: [assignedBranch._id],
      departmentIds: [],
      status: 'active',
    });
    actorId = actor._id.toString();
  });

  const createApprover = async (suffix = 'one') => {
    let permission = await PermissionModel.findOne({ code: 'INSURANCE_APPROVALS_DECIDE' });
    if (!permission) {
      permission = await PermissionModel.create({
        code: 'INSURANCE_APPROVALS_DECIDE',
        name: 'Insurance Approvals Decide',
        module: 'Insurance',
        screen: 'Approvals',
        action: 'Decide',
        type: 'system',
        status: 'active',
      });
    }
    const role = await RoleModel.create({
      code: `INSURANCE_APPROVER_${suffix.toUpperCase()}`,
      name: `Insurance Approver ${suffix}`,
      permissionIds: [permission._id],
      status: 'active',
    });
    const user = await UserModel.create({
      username: `insurance.approver.${suffix}`,
      email: `insurance.approver.${suffix}@example.test`,
      fullName: `Insurance Approver ${suffix}`,
      passwordHash: await hashPassword('Testpassword1'),
      roleIds: [role._id],
      branchIds: [assignedBranchId],
      departmentIds: [],
      status: 'active',
    });
    return user._id.toString();
  };

  it('persists singleton configuration changes with optimistic concurrency and audit history', async () => {
    const initial = await service.getConfiguration();
    expect(initial).toMatchObject({ id: null, operating_mode: 'PROVIDER', version: 0 });

    const updated = await service.updateConfiguration(
      { operating_mode: 'HYBRID', version: 0, reason: 'Approved operating model' },
      actorId,
      { ipAddress: '127.0.0.1' },
    );
    expect(updated).toMatchObject({ operating_mode: 'HYBRID', version: 1 });

    await expect(service.updateConfiguration(
      { operating_mode: 'PAYER', version: 0, reason: 'Stale client' },
      actorId,
      {},
    )).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_STALE_VERSION');

    expect(await AuditLogModel.countDocuments({ eventType: 'insurance.configuration.updated' })).toBe(1);
  });

  it('enforces unique provider codes and explicit lifecycle transitions', async () => {
    const provider = await service.createProvider({
      provider_code: 'PRV-001',
      legal_name: 'Provider One',
      provider_type: 'HOSPITAL',
    }, actorId, {});
    expect(provider.status).toBe('DRAFT');

    await expect(service.createProvider({
      provider_code: 'prv-001',
      legal_name: 'Duplicate Provider',
      provider_type: 'CLINIC',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_DUPLICATE_CODE');

    const active = await service.transitionProvider(provider.id, 'activate', {
      version: provider.version,
      reason: 'Due diligence complete',
    }, actorId, {});
    expect(active).toMatchObject({ status: 'ACTIVE', version: 1 });

    await expect(service.transitionProvider(provider.id, 'activate', {
      version: active.version,
      reason: 'Invalid repeat activation',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_INVALID_STATUS_TRANSITION');
  });

  it('creates and updates payer identity across approved operating modes with audit context', async () => {
    const payer = await service.createPayer({
      payer_code: 'pay-001',
      name: 'Health Assurance',
      payer_type: 'INSURER',
      submission_mode: 'PORTAL',
      portal_url: 'https://payer.example.test',
      portal_enabled: true,
      member_number_scope: 'PAYER_POLICY',
    }, actorId, { correlationId: 'payer-create-1' });
    expect(payer).toMatchObject({
      payer_code: 'PAY-001',
      status: 'DRAFT',
      version: 0,
      submission_mode: 'PORTAL',
      member_number_scope: 'PAYER_POLICY',
    });

    await service.updateConfiguration({
      operating_mode: 'TPA',
      version: 0,
      reason: 'TPA deployment configuration',
    }, actorId, {});
    const updated = await service.updatePayer(payer.id, {
      name: 'Health Assurance TPA',
      version: payer.version,
    }, actorId, { correlationId: 'payer-update-1' });
    expect(updated).toMatchObject({ name: 'Health Assurance TPA', version: 1 });

    const audit = await AuditLogModel.findOne({ eventType: 'insurance.payer.updated' }).lean();
    expect(audit?.metadataJson).toMatchObject({
      correlationId: 'payer-update-1',
      insuranceResourceType: 'PAYER',
      insuranceResourceId: payer.id,
      resourceVersion: 1,
      operatingMode: 'TPA',
    });
  });

  it('enforces normalized payer-code uniqueness, stale writes, and explicit lifecycle transitions', async () => {
    const payer = await service.createPayer({
      payer_code: 'PAY-002',
      name: 'Government Health Fund',
      payer_type: 'GOVERNMENT',
    }, actorId, {});

    await expect(service.createPayer({
      payer_code: 'pay-002',
      name: 'Duplicate Fund',
      payer_type: 'GOVERNMENT',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_DUPLICATE_CODE');

    const active = await service.transitionPayer(payer.id, 'activate', {
      version: payer.version,
      reason: 'Payer verification complete',
    }, actorId, {});
    expect(active).toMatchObject({ status: 'ACTIVE', version: 1 });

    await expect(service.updatePayer(payer.id, {
      name: 'Stale Update',
      version: 0,
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_STALE_VERSION');

    await expect(service.transitionPayer(payer.id, 'activate', {
      version: active.version,
      reason: 'Invalid repeat activation',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_INVALID_STATUS_TRANSITION');

    const inactive = await service.transitionPayer(payer.id, 'deactivate', {
      version: active.version,
      reason: 'Contract relationship ended',
    }, actorId, {});
    expect(inactive).toMatchObject({ status: 'INACTIVE', version: 2 });
  });

  it('allows exactly one concurrent create for the same normalized payer code', async () => {
    const results = await Promise.allSettled([
      service.createPayer({ payer_code: 'PAY-RACE', name: 'Race A', payer_type: 'INSURER' }, actorId, {}),
      service.createPayer({ payer_code: 'pay-race', name: 'Race B', payer_type: 'INSURER' }, actorId, {}),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(errorCode(rejected.reason)).toBe('INSURANCE_DUPLICATE_CODE');
    expect(await InsurancePayerModel.countDocuments({ payerCode: 'PAY-RACE' })).toBe(1);
  });

  it('paginates, filters, searches, and sorts payer lists', async () => {
    const first = await service.createPayer({
      payer_code: 'PAY-LIST-A',
      name: 'Alpha Insurance',
      payer_type: 'INSURER',
      submission_mode: 'API',
    }, actorId, {});
    await service.createPayer({
      payer_code: 'PAY-LIST-B',
      name: 'Beta Employer Plan',
      payer_type: 'EMPLOYER',
      submission_mode: 'MANUAL',
    }, actorId, {});
    await service.transitionPayer(first.id, 'activate', { version: 0, reason: 'Approved' }, actorId, {});

    const active = await service.listPayers({
      search: 'alpha',
      payer_type: 'INSURER',
      submission_mode: 'API',
      status: 'ACTIVE',
      page: 1,
      limit: 1,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(active.meta).toMatchObject({ total: 1, page: 1, limit: 1, totalPages: 1 });
    expect(active.data.map((payer) => payer.payer_code)).toEqual(['PAY-LIST-A']);
  });

  it('rolls back payer persistence when its audit write fails', async () => {
    const auditFailure = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.createPayer({
      payer_code: 'PAY-ROLLBACK',
      name: 'Rollback Payer',
      payer_type: 'EMPLOYER',
    }, actorId, {})).rejects.toThrow('audit unavailable');
    auditFailure.mockRestore();

    expect(await InsurancePayerModel.countDocuments({ payerCode: 'PAY-ROLLBACK' })).toBe(0);
  });

  it('enforces Payer and Approval view permissions on their list routes', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'insurance.user', password: 'Testpassword1' },
    });
    const accessToken = login.json<{ data: { tokens: { accessToken: string } } }>().data.tokens.accessToken;
    const headers = { authorization: `Bearer ${accessToken}` };

    const denied = await app.inject({ method: 'GET', url: '/api/insurance/payers', headers });
    expect(denied.statusCode).toBe(403);
    expect(denied.json<{ error: { code: string } }>().error.code).toBe('PERMISSION_REQUIRED');

    const permission = await PermissionModel.create({
      code: 'INSURANCE_PAYERS_VIEW',
      name: 'Insurance Payers View',
      module: 'Insurance',
      screen: 'Payers',
      action: 'View',
      type: 'system',
      status: 'active',
    });
    await RoleModel.updateOne({ code: 'INSURANCE_USER' }, { $set: { permissionIds: [permission._id] } });

    const allowed = await app.inject({ method: 'GET', url: '/api/insurance/payers', headers });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json<{ data: { data: unknown[] } }>().data.data).toEqual([]);

    const approvalsDenied = await app.inject({ method: 'GET', url: '/api/insurance/approval-rules', headers });
    expect(approvalsDenied.statusCode).toBe(403);
    const approvalView = await PermissionModel.create({
      code: 'INSURANCE_APPROVALS_VIEW',
      name: 'Insurance Approvals View',
      module: 'Insurance',
      screen: 'Approvals',
      action: 'View',
      type: 'system',
      status: 'active',
    });
    await RoleModel.updateOne(
      { code: 'INSURANCE_USER' },
      { $set: { permissionIds: [permission._id, approvalView._id] } },
    );
    const approvalsAllowed = await app.inject({ method: 'GET', url: '/api/insurance/approval-rules', headers });
    expect(approvalsAllowed.statusCode).toBe(200);
  });

  it('requires an approved request and prevents self-approval before Provider activation', async () => {
    const approverId = await createApprover();
    const provider = await service.createProvider({
      provider_code: 'PRV-APPROVAL',
      legal_name: 'Approval Controlled Provider',
      provider_type: 'HOSPITAL',
    }, actorId, {});
    const rule = await service.createApprovalRule({
      transaction_type: 'PROVIDER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      effective_to: '2027-12-31',
      status: 'ACTIVE',
    }, actorId, {});

    await expect(service.transitionProvider(provider.id, 'activate', {
      version: provider.version,
      reason: 'Attempt without approval',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_APPROVAL_REQUIRED');

    const request = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PROVIDER',
      resource_id: provider.id,
      resource_version: provider.version,
    }, actorId, {});
    await expect(service.decideApprovalRequest(request.id, 'approve', {
      version: request.version,
      decision_reason: 'Self decision',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_SELF_APPROVAL_FORBIDDEN');

    const approved = await service.decideApprovalRequest(request.id, 'approve', {
      version: request.version,
      decision_reason: 'Credential review complete',
    }, approverId, {});
    expect(approved.status).toBe('APPROVED');

    const active = await service.transitionProvider(provider.id, 'activate', {
      version: provider.version,
      reason: 'Approved activation',
      approval_request_id: approved.id,
    }, actorId, {});
    expect(active.status).toBe('ACTIVE');
    const activationAudit = await AuditLogModel.findOne({ eventType: 'insurance.provider.activated' }).lean();
    expect(activationAudit?.metadataJson?.approvalRequestId).toBe(approved.id);
  });

  it('rejects stale approval decisions when the target resource changed', async () => {
    const approverId = await createApprover();
    const payer = await service.createPayer({
      payer_code: 'PAY-STALE-APPROVAL',
      name: 'Stale Approval Payer',
      payer_type: 'INSURER',
    }, actorId, {});
    const rule = await service.createApprovalRule({
      payer_id: payer.id,
      transaction_type: 'PAYER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});
    const request = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PAYER',
      resource_id: payer.id,
      resource_version: payer.version,
    }, actorId, {});
    await service.updatePayer(payer.id, { name: 'Changed Payer', version: payer.version }, actorId, {});

    await expect(service.decideApprovalRequest(request.id, 'approve', {
      version: request.version,
      decision_reason: 'Outdated review',
    }, approverId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_APPROVAL_STALE_RESOURCE');
    expect((await service.getApprovalRequest(request.id)).status).toBe('PENDING');
  });

  it('serializes overlapping active rules and concurrent approval decisions', async () => {
    const firstApprover = await createApprover('one');
    const secondApprover = await createApprover('two');
    const rules = await Promise.allSettled([
      service.createApprovalRule({
        transaction_type: 'PROVIDER_ACTIVATION',
        required_permission: 'INSURANCE_APPROVALS_DECIDE',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        status: 'ACTIVE',
      }, actorId, {}),
      service.createApprovalRule({
        transaction_type: 'PROVIDER_ACTIVATION',
        required_permission: 'INSURANCE_APPROVALS_DECIDE',
        effective_from: '2026-06-01',
        effective_to: '2027-05-31',
        status: 'ACTIVE',
      }, actorId, {}),
    ]);
    expect(rules.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejectedRule = rules.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(errorCode(rejectedRule.reason)).toBe('INSURANCE_EFFECTIVE_DATE_OVERLAP');
    const rule = (rules.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof service.createApprovalRule>>>).value;

    const provider = await service.createProvider({
      provider_code: 'PRV-CONCURRENT-APPROVAL',
      legal_name: 'Concurrent Approval Provider',
      provider_type: 'CLINIC',
    }, actorId, {});
    const request = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PROVIDER',
      resource_id: provider.id,
      resource_version: provider.version,
    }, actorId, {});
    const decisions = await Promise.allSettled([
      service.decideApprovalRequest(request.id, 'approve', { version: 0, decision_reason: 'Approved one' }, firstApprover, {}),
      service.decideApprovalRequest(request.id, 'approve', { version: 0, decision_reason: 'Approved two' }, secondApprover, {}),
    ]);
    expect(decisions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejectedDecision = decisions.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(errorCode(rejectedDecision.reason)).toBe('INSURANCE_APPROVAL_STALE_RESOURCE');
    expect((await service.getApprovalRequest(request.id)).status).toBe('APPROVED');
  });

  it('rolls back an approval decision when audit persistence fails', async () => {
    const approverId = await createApprover();
    const provider = await service.createProvider({
      provider_code: 'PRV-APPROVAL-ROLLBACK',
      legal_name: 'Approval Rollback Provider',
      provider_type: 'LABORATORY',
    }, actorId, {});
    const rule = await service.createApprovalRule({
      transaction_type: 'PROVIDER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});
    const request = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PROVIDER',
      resource_id: provider.id,
      resource_version: provider.version,
    }, actorId, {});
    const auditFailure = vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('approval audit unavailable'));
    await expect(service.decideApprovalRequest(request.id, 'approve', {
      version: request.version,
      decision_reason: 'Should roll back',
    }, approverId, {})).rejects.toThrow('approval audit unavailable');
    auditFailure.mockRestore();

    expect(await InsuranceApprovalRequestModel.countDocuments({ _id: request.id, status: 'PENDING', version: 0 })).toBe(1);
  });

  it('enforces rule permission, requester-only cancellation, and rejection reason', async () => {
    const approverId = await createApprover();
    const unprivilegedRole = await RoleModel.create({
      code: 'INSURANCE_UNPRIVILEGED',
      name: 'Insurance Unprivileged',
      permissionIds: [],
      status: 'active',
    });
    const unprivileged = await UserModel.create({
      username: 'insurance.unprivileged',
      email: 'insurance.unprivileged@example.test',
      fullName: 'Insurance Unprivileged',
      passwordHash: await hashPassword('Testpassword1'),
      roleIds: [unprivilegedRole._id],
      branchIds: [assignedBranchId],
      departmentIds: [],
      status: 'active',
    });
    const rule = await service.createApprovalRule({
      transaction_type: 'PROVIDER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});
    const firstProvider = await service.createProvider({
      provider_code: 'PRV-CANCEL-APPROVAL',
      legal_name: 'Cancel Approval Provider',
      provider_type: 'DENTAL',
    }, actorId, {});
    const firstRequest = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PROVIDER',
      resource_id: firstProvider.id,
      resource_version: 0,
    }, actorId, {});

    await expect(service.decideApprovalRequest(firstRequest.id, 'approve', {
      version: 0,
      decision_reason: 'No authority',
    }, unprivileged._id.toString(), {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'PERMISSION_REQUIRED');
    await expect(service.cancelApprovalRequest(firstRequest.id, {
      version: 0,
      decision_reason: 'Not requester',
    }, approverId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_SCOPE_DENIED');
    const cancelled = await service.cancelApprovalRequest(firstRequest.id, {
      version: 0,
      decision_reason: 'Request no longer required',
    }, actorId, {});
    expect(cancelled.status).toBe('CANCELLED');

    const secondProvider = await service.createProvider({
      provider_code: 'PRV-REJECT-APPROVAL',
      legal_name: 'Reject Approval Provider',
      provider_type: 'OPTICAL',
    }, actorId, {});
    const secondRequest = await service.createApprovalRequest({
      approval_rule_id: rule.id,
      resource_type: 'PROVIDER',
      resource_id: secondProvider.id,
      resource_version: 0,
    }, actorId, {});
    await expect(service.decideApprovalRequest(secondRequest.id, 'reject', {
      version: 0,
    }, approverId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'VALIDATION_ERROR');
    const rejected = await service.decideApprovalRequest(secondRequest.id, 'reject', {
      version: 0,
      decision_reason: 'Credential evidence incomplete',
    }, approverId, {});
    expect(rejected).toMatchObject({ status: 'REJECTED', decision_reason: 'Credential evidence incomplete' });
  });

  it('prevents bypassing a payer-specific rule with a global rule', async () => {
    await createApprover();
    const payer = await service.createPayer({
      payer_code: 'PAY-SPECIFIC-RULE',
      name: 'Specific Rule Payer',
      payer_type: 'TPA',
    }, actorId, {});
    const globalRule = await service.createApprovalRule({
      transaction_type: 'PAYER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});
    const specificRule = await service.createApprovalRule({
      payer_id: payer.id,
      transaction_type: 'PAYER_ACTIVATION',
      required_permission: 'INSURANCE_APPROVALS_DECIDE',
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});

    await expect(service.createApprovalRequest({
      approval_rule_id: globalRule.id,
      resource_type: 'PAYER',
      resource_id: payer.id,
      resource_version: 0,
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_APPROVAL_REQUIRED');
    const request = await service.createApprovalRequest({
      approval_rule_id: specificRule.id,
      resource_type: 'PAYER',
      resource_id: payer.id,
      resource_version: 0,
    }, actorId, {});
    expect(request.approval_rule_id).toBe(specificRule.id);
  });

  it('enforces actor branch scope for provider-to-branch mappings', async () => {
    const provider = await service.createProvider({
      provider_code: 'PRV-002',
      legal_name: 'Scoped Provider',
      provider_type: 'HOSPITAL',
    }, actorId, {});
    const active = await service.transitionProvider(provider.id, 'activate', { version: 0, reason: 'Approved' }, actorId, {});

    await expect(service.createProviderBranch(active.id, {
      branch_id: inaccessibleBranchId,
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_SCOPE_DENIED');

    const mapping = await service.createProviderBranch(active.id, {
      branch_id: assignedBranchId,
      effective_from: '2026-01-01',
      status: 'ACTIVE',
    }, actorId, {});
    expect(mapping.branch_id).toBe(assignedBranchId);
  });

  it('rejects overlapping effective periods and stale mapping updates', async () => {
    const provider = await service.createProvider({
      provider_code: 'PRV-003',
      legal_name: 'Date Controlled Provider',
      provider_type: 'LABORATORY',
    }, actorId, {});
    const active = await service.transitionProvider(provider.id, 'activate', { version: 0, reason: 'Approved' }, actorId, {});
    const mapping = await service.createProviderBranch(active.id, {
      branch_id: assignedBranchId,
      effective_from: '2026-01-01',
      effective_to: '2026-06-30',
      status: 'ACTIVE',
    }, actorId, {});

    await expect(service.createProviderBranch(active.id, {
      branch_id: assignedBranchId,
      effective_from: '2026-06-01',
      effective_to: '2026-12-31',
      status: 'ACTIVE',
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_EFFECTIVE_DATE_OVERLAP');

    const inactiveHistory = await service.createProviderBranch(active.id, {
      branch_id: assignedBranchId,
      effective_from: '2026-06-01',
      effective_to: '2026-12-31',
      status: 'INACTIVE',
    }, actorId, {});
    expect(inactiveHistory.status).toBe('INACTIVE');

    const updated = await service.updateProviderBranch(mapping.id, {
      effective_to: '2026-05-31',
      version: mapping.version,
    }, actorId, {});
    expect(updated.version).toBe(1);

    await expect(service.updateProviderBranch(mapping.id, {
      status: 'INACTIVE',
      version: 0,
    }, actorId, {})).rejects.toSatisfy((error: unknown) => errorCode(error) === 'INSURANCE_STALE_VERSION');
  });

  it('serializes concurrent overlapping mapping creation so exactly one succeeds', async () => {
    const provider = await service.createProvider({
      provider_code: 'PRV-004',
      legal_name: 'Concurrent Provider',
      provider_type: 'CLINIC',
    }, actorId, {});
    const active = await service.transitionProvider(provider.id, 'activate', { version: 0, reason: 'Approved' }, actorId, {});

    const results = await Promise.allSettled([
      service.createProviderBranch(active.id, {
        branch_id: assignedBranchId,
        effective_from: '2026-01-01',
        effective_to: '2026-09-30',
        status: 'ACTIVE',
      }, actorId, {}),
      service.createProviderBranch(active.id, {
        branch_id: assignedBranchId,
        effective_from: '2026-06-01',
        effective_to: '2026-12-31',
        status: 'ACTIVE',
      }, actorId, {}),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(errorCode(rejected.reason)).toBe('INSURANCE_EFFECTIVE_DATE_OVERLAP');
    expect(await InsuranceProviderBranchModel.countDocuments({ providerId: active.id })).toBe(1);
  });
});
