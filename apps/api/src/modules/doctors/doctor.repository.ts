import { Types, type ClientSession, type SortOrder } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { DoctorModel, type DoctorAvailabilityFields, type DoctorFields } from './doctor.model.js';
import {
  DoctorAvailabilityExceptionModel,
  DoctorLeaveModel,
  DoctorSequenceModel,
  type DoctorAvailabilityExceptionFields,
  type DoctorLeaveFields,
} from './doctor-scheduling.model.js';
import type {
  CreateDoctorDTO,
  CreateDoctorLeaveDTO,
  Doctor,
  DoctorAvailability,
  DoctorAvailabilityException,
  DoctorAvailabilityExceptionListQuery,
  DoctorLeave,
  DoctorLeaveListQuery,
  DoctorListQuery,
  DoctorRequestMetadata,
  DoctorStatus,
  DoctorUserOption,
  SaveDoctorAvailabilityDTO,
  SaveDoctorAvailabilityExceptionDTO,
  UpdateDoctorDTO,
} from './doctor.types.js';

type DoctorLean = DoctorFields & { _id: Types.ObjectId };
type DoctorLeaveLean = DoctorLeaveFields & { _id: Types.ObjectId };
type DoctorExceptionLean = DoctorAvailabilityExceptionFields & { _id: Types.ObjectId };

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toObjectId = (value: string | null | undefined) => (value ? new Types.ObjectId(value) : null);
const requiredObjectId = (value: string) => new Types.ObjectId(value);
const toDisplayName = (firstName: string, lastName: string) => `Dr. ${firstName.trim()} ${lastName.trim()}`;

const legacyWorkingBlocks = (availability: DoctorAvailabilityFields) => {
  if (!availability.startTime || !availability.endTime) return [];

  const legacyDuration = (availability as any).slotDurationMinutes ?? 30;

  if (!availability.breakStartTime || !availability.breakEndTime) {
    return [
      {
        id: `${availability._id.toString()}-legacy`,
        start_time: availability.startTime,
        end_time: availability.endTime,
        slot_duration_minutes: legacyDuration,
      },
    ];
  }

  return [
    ...(availability.startTime < availability.breakStartTime
      ? [
          {
            id: `${availability._id.toString()}-legacy-1`,
            start_time: availability.startTime,
            end_time: availability.breakStartTime,
            slot_duration_minutes: legacyDuration,
          },
        ]
      : []),
    ...(availability.breakEndTime < availability.endTime
      ? [
          {
            id: `${availability._id.toString()}-legacy-2`,
            start_time: availability.breakEndTime,
            end_time: availability.endTime,
            slot_duration_minutes: legacyDuration,
          },
        ]
      : []),
  ];
};

const toAvailability = (availability: DoctorAvailabilityFields): DoctorAvailability => ({
  id: availability._id.toString(),
  day_of_week: availability.dayOfWeek,
  is_available: availability.isAvailable,
  working_blocks: availability.workingBlocks?.length
    ? availability.workingBlocks.map((block) => ({
        id: block._id.toString(),
        start_time: block.startTime,
        end_time: block.endTime,
        slot_duration_minutes: block.slotDurationMinutes,
      }))
    : legacyWorkingBlocks(availability),
});

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

const toLeave = (leave: DoctorLeaveLean): DoctorLeave => ({
  id: leave._id.toString(),
  doctor_id: leave.doctorId.toString(),
  start_date: leave.startDate,
  end_date: leave.endDate,
  reason: leave.reason,
  status: leave.status,
  created_by: leave.createdBy?.toString() ?? null,
  cancelled_by: leave.cancelledBy?.toString() ?? null,
  cancelled_at: leave.cancelledAt ?? null,
  created_at: leave.createdAt,
  updated_at: leave.updatedAt,
});

const toException = (exception: DoctorExceptionLean): DoctorAvailabilityException => ({
  id: exception._id.toString(),
  doctor_id: exception.doctorId.toString(),
  date: exception.date,
  is_available: exception.isAvailable,
  working_blocks: exception.workingBlocks.map((block) => ({
    id: block._id.toString(),
    start_time: block.startTime,
    end_time: block.endTime,
    slot_duration_minutes: block.slotDurationMinutes,
  })),
  reason: exception.reason,
  created_by: exception.createdBy?.toString() ?? null,
  updated_by: exception.updatedBy?.toString() ?? null,
  created_at: exception.createdAt,
  updated_at: exception.updatedAt,
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
  ...(data.specialization !== undefined ? { specialization: data.specialization.trim() } : {}),
  ...(data.qualification !== undefined ? { qualification: nullableString(data.qualification) } : {}),
  ...(data.registration_number !== undefined ? { registrationNumber: nullableString(data.registration_number) } : {}),
  ...(data.experience_years !== undefined ? { experienceYears: data.experience_years } : {}),
  ...(data.branch_id !== undefined ? { branchId: requiredObjectId(data.branch_id) } : {}),
  ...(data.department_id !== undefined ? { departmentId: requiredObjectId(data.department_id) } : {}),
  ...(data.consultation_room !== undefined ? { consultationRoom: nullableString(data.consultation_room) } : {}),
  ...(data.phone !== undefined ? { phone: nullableString(data.phone) } : {}),
  ...(data.email !== undefined ? { email: nullableString(data.email) } : {}),
  ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
});

const buildWorkingBlocks = (blocks: Array<{ start_time: string; end_time: string; slot_duration_minutes: number }>) =>
  blocks.map((block) => ({ startTime: block.start_time, endTime: block.end_time, slotDurationMinutes: block.slot_duration_minutes }));

const buildAvailabilityPayload = (input: SaveDoctorAvailabilityDTO) =>
  input.availability.map((item) => ({
    dayOfWeek: item.day_of_week,
    isAvailable: item.is_available,
    workingBlocks: buildWorkingBlocks(item.working_blocks),
  }));

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 11000;

export class DoctorRepository {
  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds').lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');
    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null,
    }));
    if (requestedBranchId) {
      const branchExists = Boolean(await BranchModel.exists({ _id: requestedBranchId, status: 'ACTIVE', deletedAt: null }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      return [requestedBranchId];
    }
    if (isSuperAdmin) return undefined;
    const activeBranches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] }, status: 'ACTIVE', deletedAt: null,
    }).select('_id').lean();
    return activeBranches.map((branch) => String(branch._id));
  }

  async list(query: DoctorListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(requiredObjectId) };

    if (query.status) filter.status = query.status;
    if (query.branch_id) filter.branchId = requiredObjectId(query.branch_id);
    if (query.department_id) filter.departmentId = requiredObjectId(query.department_id);
    if (query.specialization) filter.specialization = new RegExp(escapeRegex(query.specialization), 'i');
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
      DoctorModel.find(filter).sort({ [sortBy]: sortOrder }).skip(offset).limit(limit).lean<DoctorLean[]>(),
      DoctorModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toDoctor),
      meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 },
    };
  }

  async getById(id: string, branchIds?: string[]): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOne({
      _id: id, deletedAt: null,
      ...(branchIds ? { branchId: { $in: branchIds.map(requiredObjectId) } } : {}),
    }).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async getByUserId(userId: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOne({ userId: requiredObjectId(userId), deletedAt: null }).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async getByRegistrationNumber(registrationNumber: string, session?: ClientSession): Promise<Doctor | undefined> {
    const query = DoctorModel.findOne({
      registrationNumber: new RegExp(`^${escapeRegex(registrationNumber)}$`, 'i'),
      deletedAt: null,
    });
    if (session) query.session(session);
    const doctor = await query.lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async ensureDoctorNumberSequence() {
    const year = new Date().getFullYear();
    const sequenceId = `doctor:${year}`;
    const existingSequence = await DoctorSequenceModel.exists({ _id: sequenceId });
    if (existingSequence) return;

    const latest = await DoctorModel.findOne({ doctorNumber: new RegExp(`^DR-${year}-\\d{5}$`) })
      .sort({ doctorNumber: -1 })
      .select('doctorNumber')
      .lean<{ doctorNumber: string }>();
    const latestValue = latest ? Number(latest.doctorNumber.slice(-5)) : 0;
    try {
      await DoctorSequenceModel.updateOne(
        { _id: sequenceId },
        { $setOnInsert: { value: latestValue } },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  async nextDoctorNumber(session: ClientSession) {
    const year = new Date().getFullYear();
    const sequenceId = `doctor:${year}`;
    const sequence = await DoctorSequenceModel.findOneAndUpdate(
      { _id: sequenceId },
      { $inc: { value: 1 } },
      { new: true, session },
    ).lean();
    if (!sequence) throw new Error('Doctor number sequence could not be allocated');
    return `DR-${year}-${String(sequence.value).padStart(5, '0')}`;
  }

  async create(
    doctorNumber: string,
    data: CreateDoctorDTO,
    createdBy: string,
    linkedUserId: string | null,
    session: ClientSession,
  ): Promise<Doctor> {
    const [created] = await DoctorModel.create([{
      doctorNumber,
      ...buildDoctorPayload(data),
      userId: toObjectId(linkedUserId),
      displayName: toDisplayName(data.first_name, data.last_name),
      status: data.status ?? 'ACTIVE',
      availability: buildAvailabilityPayload(data),
      createdBy: requiredObjectId(createdBy),
      updatedBy: requiredObjectId(createdBy),
    }], { session });
    if (!created) throw new Error('Doctor record could not be created');
    return toDoctor(created.toObject<DoctorLean>());
  }

  async update(id: string, data: UpdateDoctorDTO, updatedBy: string): Promise<Doctor | undefined> {
    const existing = await DoctorModel.findOne({ _id: id, deletedAt: null }).lean<DoctorLean>();
    if (!existing) return undefined;
    const firstName = data.first_name ?? existing.firstName;
    const lastName = data.last_name ?? existing.lastName;
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          ...buildDoctorPayload(data),
          displayName: toDisplayName(firstName, lastName),
          updatedBy: requiredObjectId(updatedBy),
        },
      },
      { new: true, lean: true },
    ).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async updateStatus(id: string, status: DoctorStatus, updatedBy: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { status, updatedBy: requiredObjectId(updatedBy) } },
      { new: true, lean: true },
    ).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async mapUser(id: string, userId: string | null, updatedBy: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { userId: toObjectId(userId), updatedBy: requiredObjectId(updatedBy) } },
      { new: true, lean: true },
    ).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async listUserOptions(): Promise<DoctorUserOption[]> {
    const [users, mappings] = await Promise.all([
      UserModel.find({ status: 'active', deletedAt: null })
        .select('_id fullName username email')
        .sort({ fullName: 1 })
        .limit(500)
        .lean<Array<{ _id: Types.ObjectId; fullName?: string; username: string; email?: string | null }>>(),
      DoctorModel.find({ userId: { $type: 'objectId' }, deletedAt: null })
        .select('_id userId')
        .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>>(),
    ]);
    const mappedByUser = new Map(mappings.map((mapping) => [mapping.userId.toString(), mapping._id.toString()]));
    return users.map((user) => ({
      id: user._id.toString(),
      full_name: user.fullName ?? user.username,
      username: user.username,
      email: user.email ?? null,
      mapped_doctor_id: mappedByUser.get(user._id.toString()) ?? null,
    }));
  }

  async updateAvailability(id: string, data: SaveDoctorAvailabilityDTO, updatedBy: string): Promise<Doctor | undefined> {
    const doctor = await DoctorModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { availability: buildAvailabilityPayload(data), updatedBy: requiredObjectId(updatedBy) } },
      { new: true, lean: true },
    ).lean<DoctorLean>();
    return doctor ? toDoctor(doctor) : undefined;
  }

  async listLeaves(doctorId: string, query: DoctorLeaveListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { doctorId: requiredObjectId(doctorId) };
    if (query.status) filter.status = query.status;
    if (query.date_from || query.date_to) {
      filter.$and = [
        ...(query.date_from ? [{ endDate: { $gte: new Date(query.date_from) } }] : []),
        ...(query.date_to ? [{ startDate: { $lte: new Date(query.date_to) } }] : []),
      ];
    }
    const [items, total] = await Promise.all([
      DoctorLeaveModel.find(filter)
        .sort({ startDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<DoctorLeaveLean[]>(),
      DoctorLeaveModel.countDocuments(filter),
    ]);
    return { data: items.map(toLeave), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findOverlappingLeave(doctorId: string, startDate: Date, endDate: Date) {
    const leave = await DoctorLeaveModel.findOne({
      doctorId: requiredObjectId(doctorId),
      status: 'ACTIVE',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).lean<DoctorLeaveLean>();
    return leave ? toLeave(leave) : undefined;
  }

  async createLeave(doctorId: string, data: CreateDoctorLeaveDTO, userId: string) {
    const leave = await DoctorLeaveModel.create({
      doctorId: requiredObjectId(doctorId),
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      reason: data.reason.trim(),
      status: 'ACTIVE',
      createdBy: requiredObjectId(userId),
    });
    return toLeave(leave.toObject<DoctorLeaveLean>());
  }

  async cancelLeave(doctorId: string, leaveId: string, userId: string) {
    const leave = await DoctorLeaveModel.findOneAndUpdate(
      { _id: leaveId, doctorId: requiredObjectId(doctorId), status: 'ACTIVE' },
      { $set: { status: 'CANCELLED', cancelledBy: requiredObjectId(userId), cancelledAt: new Date() } },
      { new: true, lean: true },
    ).lean<DoctorLeaveLean>();
    return leave ? toLeave(leave) : undefined;
  }

  async hasActiveLeave(doctorId: string, date: Date) {
    return Boolean(
      await DoctorLeaveModel.exists({
        doctorId: requiredObjectId(doctorId),
        status: 'ACTIVE',
        startDate: { $lte: date },
        endDate: { $gte: date },
      }),
    );
  }

  async listExceptions(doctorId: string, query: DoctorAvailabilityExceptionListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { doctorId: requiredObjectId(doctorId) };
    if (query.date_from || query.date_to) {
      filter.date = {
        ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
        ...(query.date_to ? { $lte: new Date(query.date_to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      DoctorAvailabilityExceptionModel.find(filter)
        .sort({ date: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<DoctorExceptionLean[]>(),
      DoctorAvailabilityExceptionModel.countDocuments(filter),
    ]);
    return { data: items.map(toException), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getExceptionByDate(doctorId: string, date: Date) {
    const exception = await DoctorAvailabilityExceptionModel.findOne({
      doctorId: requiredObjectId(doctorId),
      date,
    }).lean<DoctorExceptionLean>();
    return exception ? toException(exception) : undefined;
  }

  async saveException(doctorId: string, data: SaveDoctorAvailabilityExceptionDTO, userId: string) {
    const exception = await DoctorAvailabilityExceptionModel.findOneAndUpdate(
      { doctorId: requiredObjectId(doctorId), date: new Date(data.date) },
      {
        $set: {
          isAvailable: data.is_available,
          workingBlocks: buildWorkingBlocks(data.working_blocks),
          reason: data.reason.trim(),
          updatedBy: requiredObjectId(userId),
        },
        $setOnInsert: { createdBy: requiredObjectId(userId) },
      },
      { new: true, upsert: true, lean: true },
    ).lean<DoctorExceptionLean>();
    if (!exception) throw new Error('Doctor availability exception upsert failed');
    return toException(exception);
  }

  async deleteException(doctorId: string, exceptionId: string) {
    return DoctorAvailabilityExceptionModel.findOneAndDelete({
      _id: exceptionId,
      doctorId: requiredObjectId(doctorId),
    });
  }

  async audit(
    eventType: string,
    actorUserId: string,
    metadata: DoctorRequestMetadata,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    await AuditLogModel.create([{
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    }], session ? { session } : {});
  }
}
