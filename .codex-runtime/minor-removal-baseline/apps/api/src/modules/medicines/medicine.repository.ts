import { AuditLogModel } from '../auth/auth.model.js';
import { MedicineModel } from './medicine.model.js';
import type {
  CreateMedicineDTO,
  Medicine,
  MedicineListQuery,
  MedicineRequestMetadata,
  UpdateMedicineDTO,
} from './medicine.types.js';

type MedicineRecord = {
  _id: unknown;
  code: string;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unit?: string | null;
  description?: string | null;
  status: Medicine['status'];
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type MedicineFilter = {
  deletedAt: null;
  status?: Medicine['status'];
  dosageForm?: string;
  $or?: Array<{ name: RegExp } | { code: RegExp } | { genericName: RegExp }>;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toMedicine = (medicine: MedicineRecord): Medicine => ({
  id: String(medicine._id),
  code: medicine.code,
  name: medicine.name,
  generic_name: medicine.genericName ?? null,
  strength: medicine.strength ?? null,
  dosage_form: medicine.dosageForm ?? null,
  unit: medicine.unit ?? null,
  description: medicine.description ?? null,
  status: medicine.status,
  created_by: medicine.createdBy ? String(medicine.createdBy) : null,
  updated_by: medicine.updatedBy ? String(medicine.updatedBy) : null,
  created_at: medicine.createdAt,
  updated_at: medicine.updatedAt,
});

const toPersistence = (data: CreateMedicineDTO | UpdateMedicineDTO) =>
  Object.fromEntries(
    Object.entries({
      code: data.code,
      name: data.name,
      genericName: data.generic_name,
      strength: data.strength,
      dosageForm: data.dosage_form,
      unit: data.unit,
      description: data.description,
      status: 'status' in data ? data.status : undefined,
    }).filter(([, value]) => value !== undefined),
  );

export class MedicineRepository {
  async list(query: MedicineListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: MedicineFilter = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.dosage_form) filter.dosageForm = query.dosage_form;
    if (query.search) {
      const expression = new RegExp(escapeRegExp(query.search), 'i');
      filter.$or = [{ name: expression }, { code: expression }, { genericName: expression }];
    }

    const sortColumns = {
      code: 'code',
      created_at: 'createdAt',
      generic_name: 'genericName',
      name: 'name',
      status: 'status',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = sortColumns[query.sortBy ?? 'created_at'];
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, total] = await Promise.all([
      MedicineModel.find(filter)
        .sort({ [sortColumn]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MedicineModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toMedicine),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getById(id: string): Promise<Medicine | undefined> {
    const medicine = await MedicineModel.findOne({ _id: id, deletedAt: null }).lean();
    return medicine ? toMedicine(medicine) : undefined;
  }

  async getByCode(code: string): Promise<Medicine | undefined> {
    const medicine = await MedicineModel.findOne({
      code: new RegExp(`^${escapeRegExp(code)}$`, 'i'),
      deletedAt: null,
    }).lean();
    return medicine ? toMedicine(medicine) : undefined;
  }

  async create(data: CreateMedicineDTO, actorUserId: string): Promise<Medicine> {
    const medicine = await MedicineModel.create({
      ...toPersistence(data),
      status: data.status ?? 'ACTIVE',
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return toMedicine(medicine.toObject());
  }

  async update(id: string, data: UpdateMedicineDTO, actorUserId: string): Promise<Medicine> {
    const medicine = await MedicineModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...toPersistence(data), updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true, runValidators: true },
    );
    if (!medicine) throw new Error('Medicine not found');
    return toMedicine(medicine);
  }

  async summary() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [total, active, inactive, dosageForms, addedThisMonth] = await Promise.all([
      MedicineModel.countDocuments({ deletedAt: null }),
      MedicineModel.countDocuments({ deletedAt: null, status: 'ACTIVE' }),
      MedicineModel.countDocuments({ deletedAt: null, status: 'INACTIVE' }),
      MedicineModel.distinct('dosageForm', { deletedAt: null, dosageForm: { $nin: [null, ''] } })
        .then((values) => values.length),
      MedicineModel.countDocuments({ deletedAt: null, createdAt: { $gte: startOfMonth } }),
    ]);
    return { total, active, inactive, dosageForms, addedThisMonth };
  }

  async softDelete(id: string, actorUserId: string) {
    return MedicineModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actorUserId, updatedBy: actorUserId } },
      { returnDocument: 'after', lean: true },
    );
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: MedicineRequestMetadata,
    details: Record<string, unknown>,
  ) {
    await AuditLogModel.create({
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    });
  }
}
