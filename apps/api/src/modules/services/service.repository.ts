
import { ServiceModel, type IService } from './service.model.js';
import type { Service, ServiceListQuery, CreateServiceDTO, UpdateServiceDTO } from './service.types.js';

export class ServiceRepository {
  async list(query: ServiceListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const filter: any = { deletedAt: null };
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

    const sortColumn = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      ServiceModel.find(filter)
        .sort({ [(query.sortBy as string) === 'duration_minutes' ? 'durationMinutes' : query.sortBy === 'standard_price' ? 'standardPrice' : (query.sortBy as string) === 'department_id' ? 'departmentId' : (query.sortBy as string)]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      ServiceModel.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => ({
        ...d,
        id: d._id.toString(),
        department_id: d.departmentId.toString(),
        standard_price: d.standardPrice,
        duration_minutes: d.durationMinutes,
      })) as unknown as Service[],
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Service | undefined> {
    const service = await ServiceModel.findById(id).lean();
    return service
      ? ({
          ...service,
          id: service._id.toString(),
          department_id: service.departmentId.toString(),
          standard_price: service.standardPrice,
          duration_minutes: service.durationMinutes,
        } as unknown as Service)
      : undefined;
  }

  async getByCode(code: string): Promise<Service | undefined> {
    const service = await ServiceModel.findOne({ code: new RegExp(`^${code}$`, 'i') }).lean();
    return service
      ? ({
          ...service,
          id: service._id.toString(),
          department_id: service.departmentId.toString(),
          standard_price: service.standardPrice,
          duration_minutes: service.durationMinutes,
        } as unknown as Service)
      : undefined;
  }

  async create(data: CreateServiceDTO, createdBy: string): Promise<Service> {
    const service = await ServiceModel.create({
      code: (data as any).code,
      name: (data as any).name,
      departmentId: (data as any).department_id,
      standardPrice: (data as any).standard_price,
      durationMinutes: (data as any).duration_minutes,
      category: (data as any).category,
      description: (data as any).description,
      status: (data as any).status,
      createdBy: createdBy,
      updatedBy: createdBy,
    } as any);
    return {
      ...service.toJSON(),
      id: service._id.toString(),
      department_id: service.departmentId.toString(),
      standard_price: service.standardPrice,
      duration_minutes: service.durationMinutes,
    } as unknown as Service;
  }

  async update(id: string, data: UpdateServiceDTO, updatedBy: string): Promise<Service> {
    const updatePayload: Record<string, any> = { ...data, updatedBy };
    if (data.department_id) {
      updatePayload.departmentId = data.department_id;
      delete updatePayload.department_id;
    }
    if (data.standard_price !== undefined) {
      updatePayload.standardPrice = data.standard_price;
      delete updatePayload.standard_price;
    }
    if (data.duration_minutes !== undefined) {
      updatePayload.durationMinutes = data.duration_minutes;
      delete updatePayload.duration_minutes;
    }

    const service = await ServiceModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload as any },
      { new: true, lean: true }
    );
    if (!service) {
      throw new Error('Service not found');
    }
    return {
      ...service,
      id: service._id.toString(),
      department_id: service.departmentId.toString(),
      standard_price: service.standardPrice,
      duration_minutes: service.durationMinutes,
    } as unknown as Service;
  }

  async delete(id: string): Promise<void> {
    await ServiceModel.findByIdAndDelete(id);
  }
}
