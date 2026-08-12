import { Types, type SortOrder } from 'mongoose';
import { DoctorModel, type DoctorAvailabilityFields, type DoctorFields } from './doctor.model.js';
import type {
  CreateDoctorDTO,
  Doctor,
  DoctorAvailability,
  DoctorListQuery,
  SaveDoctorAvailabilityDTO,
  UpdateDoctorDTO,
} from './doctor.types.js';

type DoctorLean = DoctorFields & { _id: Types.ObjectId };

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value: string | null | undefined) => (value ? new Types.ObjectId(value) : null);

const toDisplayName = (firstName: string, lastName: string) => `Dr. ${firstName.trim()} ${lastName.trim()}`;

const toAvailability = (availability: DoctorAvailabilityFields): DoctorAvailability => {
  const workingBlocks = [...(availability.workingBlocks ?? [])].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  const startTime = availability.startTime ?? workingBlocks[0]?.startTime ?? '00:00';
  const endTime = availability.endTime ?? workingBlocks.at(-1)?.endTime ?? '00:00';
  const inferredBreakStart = workingBlocks.length > 1 ? workingBlocks[0]?.endTime : null;
  const inferredBreakEnd = workingBlocks.length > 1 ? workingBlocks[1]?.startTime : null;

  return {
    id: availability._id.toString(),
    day_of_week: availability.dayOfWeek,
    is_available: availability.isAvailable && startTime < endTime,
    start_time: startTime,
    end_time: endTime,
    break_start_time: availability.breakStartTime ?? inferredBreakStart ?? null,
    break_end_time: availability.breakEndTime ?? inferredBreakEnd ?? null,
    slot_duration_minutes: availability.slotDurationMinutes,
  };
};

const toDoctor = (doctor: DoctorLean): Doctor => ({
  id: doctor._id.toString(),
  doctor_number: doctor.doctorNumber,
  user_id: doctor.userId?.toString() ?? null,
  first_name: doctor.firstName,
  last_name: doctor.lastName,
  display_name: doctor.displayName,
  specialization: doctor.specialization,
  qualification: doctor.qualification ?? null,
  registration_number: doctor.registrationNumber ?? null,
  experience_years: doctor.experienceYears ?? null,
  branch_id: doctor.branchId.toString(),
  department_id: doctor.departmentId.toString(),
  consultation_room: doctor.consultationRoom ?? null,
  phone: doctor.phone ?? null,
  email: doctor.email ?? null,
  status: doctor.status,
  notes: doctor.notes ?? null,
  availability: doctor.availability.map(toAvailability),
  created_by: doctor.createdBy?.toString() ?? null,
  updated_by: doctor.updatedBy?.toString() ?? null,
  created_at: doctor.createdAt,
  updated_at: doctor.updatedAt,
});

const sortColumnMap = {
  doctor_number: 'doctorNumber',
  display_name: 'displayName',
  specialization: 'specialization',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

const buildDoctorPayload = (data: CreateDoctorDTO | UpdateDoctorDTO) => ({
  ...(data.first_name !== undefined ? { firstName: data.first_name.trim() } : {}),
  ...(data.last_name !== undefined ? { lastName: data.last_name.trim() } : {}),
  ...(data.first_name !== undefined || data.last_name !== undefined
    ? { displayName: toDisplayName(data.first_name ?? '', data.last_name ?? '') }
    : {}),
  ...(data.user_id !== undefined ? { userId: toObjectId(data.user_id) } : {}),
  ...(data.specialization !== undefined ? { specialization: data.specialization.trim() } : {}),
  ...(data.qualification !== undefined ? { qualification: nullableString(data.qualification) } : {}),
  ...(data.registration_number !== undefined ? { registrationNumber: nullableString(data.registration_number) } : {}),
  ...(data.experience_years !== undefined ? { experienceYears: data.experience_years } : {}),
  ...(data.branch_id !== undefined ? { branchId: new Types.ObjectId(data.branch_id) } : {}),
  ...(data.department_id !== undefined ? { departmentId: new Types.ObjectId(data.department_id) } : {}),
  ...(data.consultation_room !== undefined ? { consultationRoom: nullableString(data.consultation_room) } : {}),
  ...(data.phone !== undefined ? { phone: nullableString(data.phone) } : {}),
  ...(data.email !== undefined ? { email: nullableString(data.email) } : {}),
  ...(data.status !== undefined ? { status: data.status } : {}),
  ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
});

const buildAvailabilityPayload = (input: SaveDoctorAvailabilityDTO) =>
  input.availability.map((item) => ({
    dayOfWeek: item.day_of_week,
    isAvailable: item.is_available,
    startTime: item.start_time,
    endTime: item.end_time,
    breakStartTime: nullableString(item.break_start_time),
    breakEndTime: nullableString(item.break_end_time),
    slotDurationMinutes: item.slot_duration_minutes,
  }));

export class DoctorRepository {
  async list(query: DoctorListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.branch_id) {
      filter.branchId = new Types.ObjectId(query.branch_id);
    }
    if (query.department_id) {
      filter.departmentId = new Types.ObjectId(query.department_id);
    }
    if (query.specialization) {
      filter.specialization = new RegExp(escapeRegex(query.specialization), 'i');
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { doctorNumber: searchRegex },
        { displayName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { specialization: searchRegex },
        { registrationNumber: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    const sortBy = query.sortBy ? sortColumnMap[query.sortBy] : 'createdAt';
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      DoctorModel.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean<DoctorLean[]>(),
      DoctorModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toDoctor),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOne({ _id: id, deletedAt: null }).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async getByRegistrationNumber(registrationNumber: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOne({
      registrationNumber: new RegExp(`^${escapeRegex(registrationNumber)}$`, 'i'),
      deletedAt: null,
    }).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async create(doctorNumber: string, data: CreateDoctorDTO, createdBy: string): Promise<Doctor> {
    const created = await DoctorModel.create({
      doctorNumber,
      ...buildDoctorPayload(data),
      displayName: toDisplayName(data.first_name, data.last_name),
      status: data.status ?? 'ACTIVE',
      createdBy: new Types.ObjectId(createdBy),
      updatedBy: new Types.ObjectId(createdBy),
    });
    return toDoctor(created.toObject<DoctorLean>());
  }

  async update(id: string, data: UpdateDoctorDTO, updatedBy: string): Promise<Doctor | undefined> {
    const existing = await DoctorModel.findOne({ _id: id, deletedAt: null }).lean<DoctorLean>();
    if (!existing) {
      return undefined;
    }

    const firstName = data.first_name ?? existing.firstName;
    const lastName = data.last_name ?? existing.lastName;
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          ...buildDoctorPayload(data),
          displayName: toDisplayName(firstName, lastName),
          updatedBy: new Types.ObjectId(updatedBy),
        },
      },
      { new: true, lean: true },
    ).lean<DoctorLean>();

    return doctor ? toDoctor(doctor) : undefined;
  }

  async updateAvailability(id: string, data: SaveDoctorAvailabilityDTO, updatedBy: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          availability: buildAvailabilityPayload(data),
          updatedBy: new Types.ObjectId(updatedBy),
        },
      },
      { new: true, lean: true },
    ).lean<DoctorLean>();

    return doctor ? toDoctor(doctor) : undefined;
  }

  async nextDoctorSequence() {
    return DoctorModel.countDocuments();
  }
}
