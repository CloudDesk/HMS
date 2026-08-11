import { AppError } from '../../shared/errors/app-error.js';
import type { DepartmentRepository } from '../departments/department.repository.js';
import type { ServiceRepository } from './service.repository.js';
import type { ServiceListQuery, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

export class ServiceCatalogueService {
  constructor(
    private readonly repository: ServiceRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async list(query: ServiceListQuery) {
    return this.repository.list(query);
  }

  async getById(id: string) {
    const service = await this.repository.getById(id);
    if (!service) {
      throw new AppError('Service not found', 404, 'NOT_FOUND');
    }
    return service;
  }

  async create(data: CreateServiceDTO, userId: string) {
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Service with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    await this.requireDepartment(data.department_id);

    return this.repository.create(data, userId);
  }

  async update(id: string, data: UpdateServiceDTO, userId: string) {
    const service = await this.getById(id);

    if (data.code && data.code.toLowerCase() !== service.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Service with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    if (data.department_id) {
      await this.requireDepartment(data.department_id);
    }

    return this.repository.update(id, data, userId);
  }

  async delete(id: string) {
    const service = await this.getById(id);
    await this.repository.delete(service.id);
  }

  private async requireDepartment(id: string) {
    const department = await this.departmentRepository.getById(id);
    if (!department) {
      throw new AppError('Department not found', 400, 'INVALID_DEPARTMENT');
    }
  }
}
