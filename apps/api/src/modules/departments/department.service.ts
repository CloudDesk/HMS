import { AppError } from '../../shared/errors/app-error.js';
import type { DepartmentRepository } from './department.repository.js';
import type { DepartmentListQuery, CreateDepartmentDTO, UpdateDepartmentDTO } from './department.types.js';

export class DepartmentService {
  constructor(private readonly repository: DepartmentRepository) {}

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

  async create(data: CreateDepartmentDTO, userId: string) {
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Department with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    return this.repository.create(data, userId);
  }

  async update(id: string, data: UpdateDepartmentDTO, userId: string) {
    const department = await this.getById(id);

    if (data.code && data.code.toLowerCase() !== department.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Department with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    return this.repository.update(id, data, userId);
  }

  async delete(id: string) {
    const department = await this.getById(id);
    await this.repository.delete(department.id);
  }
}
