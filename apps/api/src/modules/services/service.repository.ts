
import { ServiceModel } from './service.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import type { Service, ServiceListQuery, ServiceRequestMetadata, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

type ServiceRecord = {
  _id: unknown;
  code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  departmentId: unknown;
  standardPrice: number;
  durationMinutes: number;
  status: Service['status'];
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type ServiceFilter = {
  deletedAt: null;
  status?: Service['status'];
  departmentId?: string;
  $or?: Array<{ name: RegExp } | { code: RegExp }>;
};

const toService = (service: ServiceRecord): Service => ({
  id: String(service._id),
  code: service.code,
  name: service.name,
  category: service.category ?? null,
  description: service.description ?? null,
  department_id: String(service.departmentId),
  standard_price: service.standardPrice,
  duration_minutes: service.durationMinutes,
  status: service.status,
  created_by: service.createdBy ? String(service.createdBy) : null,
  updated_by: service.updatedBy ? String(service.updatedBy) : null,
  created_at: service.createdAt,
  updated_at: service.updatedAt,
});

const toPersistence = (data: CreateServiceDTO | UpdateServiceDTO) =>
  Object.fromEntries(
    Object.entries({
      code: data.code,
      name: data.name,
      category: data.category,
      description: data.description,
      departmentId: data.department_id,
      standardPrice: data.standard_price,
      durationMinutes: data.duration_minutes,
      status: 'status' in data ? data.status : undefined,
    }).filter(([, value]) => value !== undefined),
  );

export class ServiceRepository {
  async list(query: ServiceListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: ServiceFilter = { deletedAt: null };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.department_id) {
      filter.departmentId = query.department_id;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const sortColumnByApiField = {
      code: 'code',
      created_at: 'createdAt',
      name: 'name',
      standard_price: 'standardPrice',
      status: 'status',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = sortColumnByApiField[query.sortBy ?? 'created_at'];
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      ServiceModel.find(filter)
        .sort({ [sortColumn]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      ServiceModel.countDocuments(filter),
    ]);

    return {
      data: data.map((service) => toService(service)),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Service | undefined> {
    const service = await ServiceModel.findOne({ _id: id, deletedAt: null }).lean();
    return service ? toService(service) : undefined;
  }

  async getByCode(code: string): Promise<Service | undefined> {
    const service = await ServiceModel.findOne({ code: new RegExp(`^${code}$`, 'i'), deletedAt: null }).lean();
    return service ? toService(service) : undefined;
  }

  async create(data: CreateServiceDTO, createdBy: string): Promise<Service> {
    const service = await ServiceModel.create({
      ...toPersistence(data),
      status: data.status ?? 'ACTIVE',
      createdBy,
      updatedBy: createdBy,
    });
    return toService(service.toObject());
  }

  async update(id: string, data: UpdateServiceDTO, updatedBy: string): Promise<Service> {
    const service = await ServiceModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...toPersistence(data), updatedBy } },
      { returnDocument: 'after', lean: true }
    );
    if (!service) {
      throw new Error('Service not found');
    }
    return toService(service);
  }

  async summary() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [total, active, inactive, addedThisMonth, departmentsCovered] = await Promise.all([
      ServiceModel.countDocuments({ deletedAt: null }),
      ServiceModel.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
      ServiceModel.countDocuments({ deletedAt: null, status: 'INACTIVE' }),
      ServiceModel.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth } }),
      ServiceModel.distinct('departmentId', { deletedAt: null }).then((ids) => ids.length),
    ]);
    return { total, active, inactive, addedThisMonth, departmentsCovered };
  }

  async softDelete(id: string, actorUserId: string) {
    return ServiceModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true },
    );
  }

  async audit(eventType: string, actorUserId: string, metadata: ServiceRequestMetadata, details: Record<string, unknown>) {
    await AuditLogModel.create({
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    });
  }
}
