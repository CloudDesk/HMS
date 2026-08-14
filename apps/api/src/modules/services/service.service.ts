import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { DepartmentRepository } from '../departments/department.repository.js';
import type { ServiceRepository } from './service.repository.js';
import type { ServiceListQuery, ServiceRequestMetadata, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

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

  summary() {
    return this.repository.summary();
  }

  async create(data: CreateServiceDTO, userId: string, metadata: ServiceRequestMetadata) {
    const existing = await this.repository.getByCode(data.code);
    if (existing) {
      throw new AppError(`Service with code ${data.code} already exists`, 409, 'CONFLICT');
    }

    await this.requireActiveDepartment(data.department_id);

    const service = await this.repository.create(data, userId);
    await this.repository.audit('service.created', userId, metadata, {
      serviceId: service.id,
      code: service.code,
      serviceType: service.service_type,
    });
    return service;
  }

  async update(id: string, data: UpdateServiceDTO, userId: string, metadata: ServiceRequestMetadata) {
    const service = await this.getById(id);

    if (data.code && data.code.toLowerCase() !== service.code.toLowerCase()) {
      const existing = await this.repository.getByCode(data.code);
      if (existing) {
        throw new AppError(`Service with code ${data.code} already exists`, 409, 'CONFLICT');
      }
    }

    if (data.department_id) {
      await this.requireActiveDepartment(data.department_id);
    }

    const updated = await this.repository.update(id, data, userId);
    const typeChanged = Boolean(data.service_type && data.service_type !== service.service_type);
    const eventType = typeChanged
      ? 'service.type_changed'
      : data.status && data.status !== service.status
        ? data.status === 'ACTIVE' ? 'service.activated' : 'service.deactivated'
        : 'service.updated';
    await this.repository.audit(eventType, userId, metadata, {
      serviceId: id,
      code: updated.code,
      serviceType: updated.service_type,
      ...(typeChanged
        ? { previousServiceType: service.service_type, newServiceType: updated.service_type }
        : {}),
    });
    return updated;
  }

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId: string, metadata: ServiceRequestMetadata) {
    return this.update(id, { status }, userId, metadata);
  }

  async delete(id: string, userId: string, metadata: ServiceRequestMetadata) {
    const service = await this.getById(id);
    await this.repository.softDelete(service.id, userId);
    await this.repository.audit('service.deleted', userId, metadata, {
      serviceId: id,
      code: service.code,
      serviceType: service.service_type,
    });
  }

  async export(query: ServiceListQuery, userId: string, metadata: ServiceRequestMetadata) {
    await this.repository.audit('service.exported', userId, metadata, { filters: query });
    const repository = this.repository;
    const departmentRepository = this.departmentRepository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.list({ ...query, page, limit: 100 });
        for (const service of result.data) {
          const department = await departmentRepository.getById(service.department_id);
          yield [
            service.code,
            service.name,
            service.service_type,
            department?.name ?? '—',
            service.standard_price.toFixed(2),
            service.status,
            service.created_at,
          ];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(
      ['Service Code', 'Service Name', 'Service Type', 'Department', 'Price', 'Status', 'Created Date'],
      rows(),
    );
  }

  private async requireActiveDepartment(id: string) {
    const department = await this.departmentRepository.getById(id);
    if (!department) {
      throw new AppError('Department not found', 400, 'INVALID_DEPARTMENT');
    }
    if (department.status !== 'ACTIVE') {
      throw new AppError('Inactive department cannot be assigned', 400, 'INACTIVE_DEPARTMENT');
    }
  }
}
