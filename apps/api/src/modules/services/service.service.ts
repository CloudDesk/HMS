import { AppError } from '../../shared/errors/app-error.js';
import type { ServiceRepository } from './service.repository.js';
import type { ServiceListQuery, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

export class ServiceCatalogueService {
  constructor(private readonly repository: ServiceRepository) {}

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

    return this.repository.update(id, data, userId);
  }

  async delete(id: string) {
    const service = await this.getById(id);
    await this.repository.delete(service.id);
  }
}
