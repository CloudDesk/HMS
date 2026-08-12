import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { BranchRepository } from '../branches/branch.repository.js';
import type { DepartmentRepository } from './department.repository.js';
import type { DepartmentListQuery, DepartmentRequestMetadata, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

export class DepartmentService {
  constructor(
    private readonly repository: DepartmentRepository,
    private readonly branchRepository: BranchRepository,
  ) {}

  async list(query: DepartmentListQuery) {
    return this.repository.list(query);
  }

  async getById(id: string) {
    const department = await this.repository.getById(id);
    if (!department) {
      throw new AppError('Department not found', 404, 'NOT_FOUND');
    }
    return department;
  }

  summary() {
    return this.repository.summary();
  }

  async create(data: CreateDepartmentDTO, userId: string, metadata: DepartmentRequestMetadata) {
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Department with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    await this.requireActiveBranch(data.branch_id);
    const department = await this.repository.create(data, userId);
    await this.repository.audit('department.created', userId, metadata, { departmentId: department.id, code: department.code });
    return department;
  }

  async update(id: string, data: UpdateDepartmentDTO, userId: string, metadata: DepartmentRequestMetadata) {
    const department = await this.getById(id);

    if (data.code && data.code.toLowerCase() !== department.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Department with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    if (data.branch_id) {
      await this.requireActiveBranch(data.branch_id);
    }
    const updated = await this.repository.update(id, data, userId);
    const eventType = data.status && data.status !== department.status
      ? data.status === 'ACTIVE' ? 'department.activated' : 'department.deactivated'
      : 'department.updated';
    await this.repository.audit(eventType, userId, metadata, { departmentId: id, code: updated.code });
    return updated;
  }

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId: string, metadata: DepartmentRequestMetadata) {
    return this.update(id, { status }, userId, metadata);
  }

  async delete(id: string, userId: string, metadata: DepartmentRequestMetadata) {
    const department = await this.getById(id);
    const dependencies = await this.repository.dependencies(id);
    if (dependencies.services || dependencies.users) {
      throw new AppError(
        'Department cannot be deleted while services or users are assigned',
        409,
        'DEPARTMENT_HAS_DEPENDENCIES',
        dependencies,
      );
    }
    await this.repository.softDelete(department.id, userId);
    await this.repository.audit('department.deleted', userId, metadata, { departmentId: id, code: department.code });
  }

  async export(query: DepartmentListQuery, userId: string, metadata: DepartmentRequestMetadata) {
    await this.repository.audit('department.exported', userId, metadata, { filters: query });
    const repository = this.repository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.list({ ...query, page, limit: 100 });
        for (const department of result.data) {
          yield [department.code, department.name, department.description, department.status, department.created_at];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(
      ['Department Code', 'Department Name', 'Description', 'Status', 'Created Date'],
      rows(),
    );
  }

  private async requireActiveBranch(id: string) {
    const branch = await this.branchRepository.getById(id);
    if (!branch) {
      throw new AppError('Branch not found', 400, 'INVALID_BRANCH');
    }
    if (branch.status !== 'ACTIVE') {
      throw new AppError('Inactive branch cannot be assigned', 400, 'INACTIVE_BRANCH');
    }
  }
}
