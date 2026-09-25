import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { InsuranceRepository } from './insurance.repository.js';
import { InsuranceService } from './insurance.service.js';

const errorCode = (error: unknown) => error instanceof AppError ? error.code : undefined;

describe('Insurance Phase 1A configuration and provider foundation', () => {
  let replSet: MongoMemoryReplSet;
  let service: InsuranceService;
  let actorId: string;
  let assignedBranchId: string;
  let inaccessibleBranchId: string;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    service = new InsuranceService(new InsuranceRepository());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      InsuranceConfigurationModel.deleteMany({}),
      InsuranceProviderBranchModel.deleteMany({}),
      InsuranceProviderModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
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
      passwordHash: 'not-used-in-test',
      roleIds: [role._id],
      branchIds: [assignedBranch._id],
      departmentIds: [],
      status: 'active',
    });
    actorId = actor._id.toString();
  });

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
