import { AppError } from '../../shared/errors/app-error.js';
import type { BranchRepository } from './branch.repository.js';
import type { BranchListQuery, CreateBranchDTO, UpdateBranchDTO } from './branch.types.js';

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

  async create(data: CreateBranchDTO, userId: string) {
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Branch with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    return this.repository.create(data, userId);
  }

  async update(id: string, data: UpdateBranchDTO, userId: string) {
    const branch = await this.getById(id);

    if (data.code && data.code.toLowerCase() !== branch.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Branch with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    return this.repository.update(id, data, userId);
  }

  async delete(id: string) {
    const branch = await this.getById(id);
    await this.repository.delete(branch.id);
  }
}
