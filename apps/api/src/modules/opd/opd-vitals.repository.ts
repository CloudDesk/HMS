import { Types, type SortOrder } from 'mongoose';
import { OpdVitalsModel, type OpdVitalsFields } from './opd-vitals.model.js';
import type { CreateOpdVitalsDTO, OpdVitals, OpdVitalsListQuery } from './opd-vitals.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdVitalsLean = OpdVitalsFields & { _id: Types.ObjectId };

type CreateOpdVitalsRecord = CreateOpdVitalsDTO & {
  visit: OpdVisit;
  bmi: number;
};

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const nullableNumber = (value: number | null | undefined) => (value === undefined ? null : value);

const toVitals = (vitals: OpdVitalsLean): OpdVitals => ({
  id: vitals._id.toString(),
  visit_id: vitals.visitId.toString(),
  patient_id: vitals.patientId.toString(),
  patient_number: vitals.patientNumber,
  patient_name: vitals.patientName,
  recorded_at: vitals.recordedAt,
  blood_pressure_systolic: vitals.bloodPressureSystolic ?? null,
  blood_pressure_diastolic: vitals.bloodPressureDiastolic ?? null,
  blood_pressure:
    vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
      ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`
      : 'N/A',
  weight_kg: vitals.weightKg ?? null,
  height_cm: vitals.heightCm ?? null,
  bmi: vitals.bmi,
  temperature_c: vitals.temperatureC ?? null,
  pulse_bpm: vitals.pulseBpm ?? null,
  respiratory_rate_per_min: vitals.respiratoryRatePerMin ?? null,
  oxygen_saturation_percent: vitals.oxygenSaturationPercent ?? null,
  notes: vitals.notes ?? null,
  created_by: vitals.createdBy?.toString() ?? null,
  updated_by: vitals.updatedBy?.toString() ?? null,
  created_at: vitals.createdAt,
  updated_at: vitals.updatedAt,
});

const sortColumnMap = {
  recorded_at: 'recordedAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

export class OpdVitalsRepository {
  async listByVisit(visitId: string, query: OpdVitalsListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const sortBy = query.sortBy ? sortColumnMap[query.sortBy] : 'recordedAt';
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const filter = { visitId: requiredObjectId(visitId), deletedAt: null };

    const [data, count] = await Promise.all([
      OpdVitalsModel.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean<OpdVitalsLean[]>(),
      OpdVitalsModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toVitals),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getLatestByVisit(visitId: string): Promise<OpdVitals | null> {
    const vitals = await OpdVitalsModel.findOne({
      visitId: requiredObjectId(visitId),
      deletedAt: null,
    })
      .sort({ recordedAt: -1 })
      .lean<OpdVitalsLean>();

    return vitals ? toVitals(vitals) : null;
  }

  async create(data: CreateOpdVitalsRecord, userId: string): Promise<OpdVitals> {
    const created = await OpdVitalsModel.create({
      visitId: requiredObjectId(data.visit.id),
      patientId: requiredObjectId(data.visit.patient_id),
      patientNumber: data.visit.patient_number,
      patientName: data.visit.patient_name,
      recordedAt: new Date(),
      bloodPressureSystolic: data.blood_pressure_systolic,
      bloodPressureDiastolic: data.blood_pressure_diastolic,
      weightKg: data.weight_kg,
      heightCm: data.height_cm,
      bmi: data.bmi,
      temperatureC: nullableNumber(data.temperature_c),
      pulseBpm: nullableNumber(data.pulse_bpm),
      respiratoryRatePerMin: nullableNumber(data.respiratory_rate_per_min),
      oxygenSaturationPercent: nullableNumber(data.oxygen_saturation_percent),
      notes: nullableString(data.notes),
      createdBy: requiredObjectId(userId),
      updatedBy: requiredObjectId(userId),
    });

    return toVitals(created.toObject<OpdVitalsLean>());
  }
}
