import { AppError } from '../../shared/errors/app-error.js';
import { executeTransaction } from '../../shared/database/transaction.js';
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

  async delete(id: string, userId: string, metadata: BranchRequestMetadata, reassignToBranchId?: string) {
    const branch = await this.getById(id);
    if (branch.status !== 'INACTIVE') {
      throw new AppError('Deactivate the branch before deleting it', 409, 'BRANCH_MUST_BE_INACTIVE');
    }
    return executeTransaction(() => this.repository.session(), async (session) => {
      const dependencies = await this.repository.dependencies(id, session);
      if ((dependencies.departments || dependencies.users || dependencies.doctors) && !reassignToBranchId) {
        throw new AppError(
          'Select an active branch to reassign the users and departments before deleting this branch',
          409,
          'BRANCH_REASSIGNMENT_REQUIRED',
          dependencies,
        );
      }
      if (reassignToBranchId) {
        if (reassignToBranchId === id) {
          throw new AppError('Choose a different branch for reassignment', 400, 'INVALID_REASSIGNMENT_BRANCH');
        }
        const target = await this.repository.getById(reassignToBranchId);
        if (!target || target.status !== 'ACTIVE') {
          throw new AppError('Reassignment branch must be active', 400, 'INVALID_REASSIGNMENT_BRANCH');
        }
      }
      const usersReassigned = reassignToBranchId
        ? await this.repository.reassignUsers(id, reassignToBranchId, userId, session)
        : 0;
      const departmentsReassigned = reassignToBranchId
        ? await this.repository.reassignDepartments(id, reassignToBranchId, userId, session)
        : 0;
      const doctorsReassigned = reassignToBranchId
        ? await this.repository.reassignDoctors(id, reassignToBranchId, userId, session)
        : 0;
      const deleted = await this.repository.softDelete(id, userId, session);
      if (!deleted) throw new AppError('Branch was already deleted or changed; refresh and retry', 409, 'STALE_BRANCH_DELETE');
      await this.repository.audit('branch.deleted', userId, metadata, {
        branchId: id,
        code: branch.code,
        reassignedToBranchId: reassignToBranchId ?? null,
        usersReassigned,
        departmentsReassigned,
        doctorsReassigned,
      }, session);
      return { success: true as const, users_reassigned: usersReassigned, departments_reassigned: departmentsReassigned };
    });
  }

  async deletePreview(id: string, page?: number, limit?: number) {
    await this.getById(id);
    return this.repository.deletePreview(id, page, limit);
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
