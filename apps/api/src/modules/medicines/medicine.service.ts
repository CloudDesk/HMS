import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { MedicineRepository } from './medicine.repository.js';
import type { PharmacyInventoryRepository } from '../pharmacy-inventory/pharmacy-inventory.repository.js';
import type {
  CreateMedicineDTO,
  MedicineListQuery,
  MedicineRequestMetadata,
  UpdateMedicineDTO,
} from './medicine.types.js';

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeCreate = (data: CreateMedicineDTO): CreateMedicineDTO => ({
  ...data,
  code: data.code.trim().toUpperCase(),
  name: data.name.trim(),
  generic_name: normalizeOptionalText(data.generic_name),
  strength: normalizeOptionalText(data.strength),
  dosage_form: normalizeOptionalText(data.dosage_form),
  unit: normalizeOptionalText(data.unit),
  description: normalizeOptionalText(data.description),
});

const normalizeUpdate = (data: UpdateMedicineDTO): UpdateMedicineDTO => ({
  ...data,
  ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}),
  ...(data.name !== undefined ? { name: data.name.trim() } : {}),
  ...(data.generic_name !== undefined ? { generic_name: normalizeOptionalText(data.generic_name) } : {}),
  ...(data.strength !== undefined ? { strength: normalizeOptionalText(data.strength) } : {}),
  ...(data.dosage_form !== undefined ? { dosage_form: normalizeOptionalText(data.dosage_form) } : {}),
  ...(data.unit !== undefined ? { unit: normalizeOptionalText(data.unit) } : {}),
  ...(data.description !== undefined ? { description: normalizeOptionalText(data.description) } : {}),
});

export class MedicineService {
  constructor(
    private readonly repository: MedicineRepository,
    private readonly pharmacyInventoryRepository: PharmacyInventoryRepository,
  ) {}

  list(query: MedicineListQuery) {
    return this.repository.list(query);
  }

  async getById(id: string) {
    const medicine = await this.repository.getById(id);
    if (!medicine) throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    return medicine;
  }

  summary() {
    return this.repository.summary();
  }

  async create(data: CreateMedicineDTO, actorUserId: string, metadata: MedicineRequestMetadata) {
    const normalized = normalizeCreate(data);
    if (await this.repository.getByCode(normalized.code)) {
      throw new AppError(`Medicine with code ${normalized.code} already exists`, 409, 'MEDICINE_CODE_EXISTS');
    }
    const medicine = await this.repository.create(normalized, actorUserId);
    await this.repository.audit('medicine.created', actorUserId, metadata, {
      medicineId: medicine.id,
      code: medicine.code,
    });
    return medicine;
  }

  async update(id: string, data: UpdateMedicineDTO, actorUserId: string, metadata: MedicineRequestMetadata) {
    const current = await this.getById(id);
    const normalized = normalizeUpdate(data);
    if (normalized.status === 'INACTIVE' && current.status !== 'INACTIVE') {
      if (await this.pharmacyInventoryRepository.hasPositiveStock(id)) {
        throw new AppError(
          'Medicine cannot be deactivated while pharmacy stock remains on hand',
          409,
          'MEDICINE_HAS_STOCK',
        );
      }
    }
    if (normalized.code && normalized.code.toLowerCase() !== current.code.toLowerCase()) {
      if (await this.repository.getByCode(normalized.code)) {
        throw new AppError(`Medicine with code ${normalized.code} already exists`, 409, 'MEDICINE_CODE_EXISTS');
      }
    }
    const medicine = await this.repository.update(id, normalized, actorUserId);
    const eventType = normalized.status && normalized.status !== current.status
      ? normalized.status === 'ACTIVE' ? 'medicine.activated' : 'medicine.deactivated'
      : 'medicine.updated';
    await this.repository.audit(eventType, actorUserId, metadata, {
      medicineId: medicine.id,
      code: medicine.code,
      previousStatus: current.status,
      status: medicine.status,
    });
    return medicine;
  }

  updateStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    actorUserId: string,
    metadata: MedicineRequestMetadata,
  ) {
    return this.update(id, { status }, actorUserId, metadata);
  }

  async delete(id: string, actorUserId: string, metadata: MedicineRequestMetadata) {
    const medicine = await this.getById(id);
    if (await this.pharmacyInventoryRepository.hasInventoryReferences(id)) {
      throw new AppError(
        'Medicine cannot be deleted after pharmacy inventory activity exists',
        409,
        'MEDICINE_HAS_INVENTORY_HISTORY',
      );
    }
    await this.repository.softDelete(id, actorUserId);
    await this.repository.audit('medicine.deleted', actorUserId, metadata, {
      medicineId: id,
      code: medicine.code,
    });
  }

  async export(query: MedicineListQuery, actorUserId: string, metadata: MedicineRequestMetadata) {
    await this.repository.audit('medicine.exported', actorUserId, metadata, { filters: query });
    const repository = this.repository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.list({ ...query, page, limit: 100 });
        for (const medicine of result.data) {
          yield [
            medicine.code,
            medicine.name,
            medicine.generic_name,
            medicine.strength,
            medicine.dosage_form,
            medicine.unit,
            medicine.status,
            medicine.created_at,
          ];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(
      ['Medicine Code', 'Medicine Name', 'Generic Name', 'Strength', 'Dosage Form', 'Unit', 'Status', 'Created Date'],
      rows(),
    );
  }
}
