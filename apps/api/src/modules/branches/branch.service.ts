import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { BranchRepository } from './branch.repository.js';
import type { BranchListQuery, BranchRequestMetadata, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]{7,20}$/;

export class BranchService {
  constructor(private readonly repository: BranchRepository) {}

  async list(query: BranchListQuery) {
    return this.repository.list(query);
  }

  async getById(id: string) {
    const branch = await this.repository.getById(id);
    if (!branch) {
      throw new AppError('Branch not found', 404, 'NOT_FOUND');
    }
    return branch;
  }

  summary() {
    return this.repository.summary();
  }

  async create(data: CreateBranchDTO, userId: string, metadata: BranchRequestMetadata) {
    this.validate(data);
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Branch with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    const branch = await this.repository.create(data, userId);
    await this.repository.audit('branch.created', userId, metadata, { branchId: branch.id, code: branch.code });
    return branch;
  }

  async update(id: string, data: UpdateBranchDTO, userId: string, metadata: BranchRequestMetadata) {
    const branch = await this.getById(id);
    this.validate(data);

    if (data.code && data.code.toLowerCase() !== branch.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Branch with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    const updated = await this.repository.update(id, data, userId);
    const eventType = data.status && data.status !== branch.status
      ? data.status === 'ACTIVE' ? 'branch.activated' : 'branch.deactivated'
      : 'branch.updated';
    await this.repository.audit(eventType, userId, metadata, { branchId: id, code: updated.code });
    return updated;
  }

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId: string, metadata: BranchRequestMetadata) {
    return this.update(id, { status }, userId, metadata);
  }

  async delete(id: string, userId: string, metadata: BranchRequestMetadata) {
    const branch = await this.getById(id);
    const dependencies = await this.repository.dependencies(id);
    if (dependencies.departments || dependencies.users) {
      throw new AppError(
        'Branch cannot be deleted while departments or users are assigned',
        409,
        'BRANCH_HAS_DEPENDENCIES',
        dependencies,
      );
    }
    await this.repository.softDelete(branch.id, userId);
    await this.repository.audit('branch.deleted', userId, metadata, { branchId: id, code: branch.code });
  }

  async export(query: BranchListQuery, userId: string, metadata: BranchRequestMetadata) {
    await this.repository.audit('branch.exported', userId, metadata, { filters: query });
    const repository = this.repository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.list({ ...query, page, limit: 100 });
        for (const branch of result.data) {
          yield [branch.code, branch.name, branch.city, branch.phone, branch.status, branch.created_at];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(['Branch Code', 'Branch Name', 'City', 'Phone', 'Status', 'Created Date'], rows());
  }

  private validate(data: UpdateBranchDTO) {
    if (data.email && !emailPattern.test(data.email)) {
      throw new AppError('Branch email is invalid', 400, 'INVALID_BRANCH_EMAIL');
    }
    if (data.phone && !phonePattern.test(data.phone)) {
      throw new AppError('Branch phone is invalid', 400, 'INVALID_BRANCH_PHONE');
    }
  }
}
