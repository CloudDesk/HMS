import mongoose, { Types, type ClientSession, type SortOrder } from 'mongoose';
import { AppointmentModel, type AppointmentFields } from './appointment.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type {
  Appointment,
  AppointmentListQuery,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  UpdateAppointmentStatusDTO,
} from './appointment.types.js';

type AppointmentLean = AppointmentFields & { _id: Types.ObjectId };

type AppointmentCreateRecord = Omit<CreateAppointmentDTO, 'appointment_date' | 'priority'> & {
  appointmentNumber: string;
  patientNumber: string;
  patientName: string;
  doctorName: string;
  doctorSpecialization: string;
  branchId: string;
  departmentId: string;
  appointmentDate: Date;
  endTime: string;
  priority: NonNullable<CreateAppointmentDTO['priority']>;
};

type AppointmentUpdateRecord = Omit<UpdateAppointmentDTO, 'appointment_date'> & {
  patientNumber?: string;
  patientName?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  branchId?: string;
  departmentId?: string;
  appointmentDate?: Date;
  endTime?: string;
};

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value: string) => new Types.ObjectId(value);

const activeSlotKey = (doctorId: string, appointmentDate: Date, startTime: string) =>
  `${doctorId}:${appointmentDate.toISOString().slice(0, 10)}:${startTime}`;

const toAppointment = (appointment: AppointmentLean): Appointment => ({
  id: appointment._id.toString(),
  appointment_number: appointment.appointmentNumber,
  patient_id: appointment.patientId.toString(),
  patient_number: appointment.patientNumber,
  patient_name: appointment.patientName,
  doctor_id: appointment.doctorId.toString(),
  doctor_name: appointment.doctorName,
  doctor_specialization: appointment.doctorSpecialization,
  branch_id: appointment.branchId.toString(),
  department_id: appointment.departmentId.toString(),
  appointment_date: appointment.appointmentDate,
  start_time: appointment.startTime,
  end_time: appointment.endTime,
  duration_minutes: appointment.durationMinutes,
  visit_type: appointment.visitType,
  priority: appointment.priority,
  status: appointment.status,
  reason: appointment.reason ?? null,
  notes: appointment.notes ?? null,
  rescheduled_from_id: appointment.rescheduledFromId?.toString() ?? null,
  rescheduled_to_id: appointment.rescheduledToId?.toString() ?? null,
  rescheduled_at: appointment.rescheduledAt ?? null,
  created_by: appointment.createdBy?.toString() ?? null,
  updated_by: appointment.updatedBy?.toString() ?? null,
  created_at: appointment.createdAt,
  updated_at: appointment.updatedAt,
});

const sortColumnMap = {
  appointment_number: 'appointmentNumber',
  appointment_date: 'appointmentDate',
  start_time: 'startTime',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

const buildCreatePayload = (data: AppointmentCreateRecord, userId: string) => ({
  appointmentNumber: data.appointmentNumber,
  patientId: toObjectId(data.patient_id),
  patientNumber: data.patientNumber,
  patientName: data.patientName,
  doctorId: toObjectId(data.doctor_id),
  doctorName: data.doctorName,
  doctorSpecialization: data.doctorSpecialization,
  branchId: toObjectId(data.branchId),
  departmentId: toObjectId(data.departmentId),
  appointmentDate: data.appointmentDate,
  startTime: data.start_time,
  endTime: data.endTime,
  durationMinutes: data.duration_minutes,
  visitType: data.visit_type,
  priority: data.priority,
  status: 'SCHEDULED' as const,
  reason: nullableString(data.reason),
  notes: nullableString(data.notes),
  activeSlotKey: activeSlotKey(data.doctor_id, data.appointmentDate, data.start_time),
  createdBy: toObjectId(userId),
  updatedBy: toObjectId(userId),
});

const buildUpdatePayload = (data: AppointmentUpdateRecord, userId: string) => ({
  ...(data.doctor_id !== undefined ? { doctorId: toObjectId(data.doctor_id) } : {}),
  ...(data.doctorName !== undefined ? { doctorName: data.doctorName } : {}),
  ...(data.doctorSpecialization !== undefined ? { doctorSpecialization: data.doctorSpecialization } : {}),
  ...(data.branchId !== undefined ? { branchId: toObjectId(data.branchId) } : {}),
  ...(data.departmentId !== undefined ? { departmentId: toObjectId(data.departmentId) } : {}),
  ...(data.appointmentDate !== undefined ? { appointmentDate: data.appointmentDate } : {}),
  ...(data.start_time !== undefined ? { startTime: data.start_time } : {}),
  ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
  ...(data.duration_minutes !== undefined ? { durationMinutes: data.duration_minutes } : {}),
  ...(data.visit_type !== undefined ? { visitType: data.visit_type } : {}),
  ...(data.priority !== undefined ? { priority: data.priority } : {}),
  ...(data.reason !== undefined ? { reason: nullableString(data.reason) } : {}),
  ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
  ...(data.doctor_id && data.appointmentDate && data.start_time
    ? { activeSlotKey: activeSlotKey(data.doctor_id, data.appointmentDate, data.start_time) }
    : {}),
  updatedBy: toObjectId(userId),
});

export class AppointmentRepository {
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

  async list(query: AppointmentListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(toObjectId) };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.doctor_id) {
      filter.doctorId = toObjectId(query.doctor_id);
    }
    if (query.patient_id) {
      filter.patientId = toObjectId(query.patient_id);
    }
    if (query.branch_id) {
      filter.branchId = toObjectId(query.branch_id);
    }
    if (query.department_id) {
      filter.departmentId = toObjectId(query.department_id);
    }
    if (query.date_from || query.date_to) {
      filter.appointmentDate = {
        ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
        ...(query.date_to ? { $lte: new Date(query.date_to) } : {}),
      };
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { appointmentNumber: searchRegex },
        { patientNumber: searchRegex },
        { patientName: searchRegex },
        { doctorName: searchRegex },
        { doctorSpecialization: searchRegex },
      ];
    }

    const sortBy = query.sortBy ? sortColumnMap[query.sortBy] : 'appointmentDate';
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      AppointmentModel.find(filter)
        .sort({ [sortBy]: sortOrder, startTime: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean<AppointmentLean[]>(),
      AppointmentModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toAppointment),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string, branchIds?: string[]): Promise<Appointment | undefined> {
    const appointment = await AppointmentModel.findOne({
      _id: id, deletedAt: null,
      ...(branchIds ? { branchId: { $in: branchIds.map(toObjectId) } } : {}),
    }).lean<AppointmentLean>();
    return appointment ? toAppointment(appointment) : undefined;
  }

  async create(data: AppointmentCreateRecord, userId: string, session?: ClientSession): Promise<Appointment> {
    const created = session
      ? (await AppointmentModel.create([buildCreatePayload(data, userId)], { session }))[0]!
      : await AppointmentModel.create(buildCreatePayload(data, userId));
    return toAppointment(created.toObject<AppointmentLean>());
  }

  async update(id: string, data: AppointmentUpdateRecord, userId: string, branchIds?: string[]): Promise<Appointment | undefined> {
    const appointment = await AppointmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null, ...(branchIds ? { branchId: { $in: branchIds.map(toObjectId) } } : {}) },
      { $set: buildUpdatePayload(data, userId) },
      { new: true, lean: true },
    ).lean<AppointmentLean>();

    return appointment ? toAppointment(appointment) : undefined;
  }

  async updateStatus(
    id: string,
    data: UpdateAppointmentStatusDTO,
    userId: string,
    branchIds?: string[],
  ): Promise<Appointment | undefined> {
    const appointment = await AppointmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null, ...(branchIds ? { branchId: { $in: branchIds.map(toObjectId) } } : {}) },
      {
        $set: {
          status: data.status,
          ...(['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED'].includes(data.status)
            ? { activeSlotKey: null }
            : {}),
          ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
          updatedBy: toObjectId(userId),
        },
      },
      { new: true, lean: true },
    ).lean<AppointmentLean>();

    return appointment ? toAppointment(appointment) : undefined;
  }

  async findDoctorConflict(
    doctorId: string,
    appointmentDate: Date,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
  ) {
    const filter: Record<string, unknown> = {
      doctorId: toObjectId(doctorId),
      appointmentDate,
      deletedAt: null,
      status: { $nin: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeAppointmentId) {
      filter._id = { $ne: toObjectId(excludeAppointmentId) };
    }

    const appointment = await AppointmentModel.findOne(filter).lean<AppointmentLean>();
    return appointment ? toAppointment(appointment) : undefined;
  }

async listActiveWindows(doctorId: string, appointmentDate: Date) {
  const appointments = await AppointmentModel.find({
    doctorId: toObjectId(doctorId),
    appointmentDate,
    status: { $in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
    deletedAt: null,
  })
    .select('startTime endTime')
    .sort({ startTime: 1 })
    .lean<Array<{ startTime: string; endTime: string }>>();

  return appointments.map((appointment) => ({
    start_time: appointment.startTime,
    end_time: appointment.endTime,
  }));
}

async findPatientConflict(
  patientId: string,
  appointmentDate: Date,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string,
) {
  const filter: Record<string, unknown> = {
    patientId: toObjectId(patientId),
    appointmentDate,
    deletedAt: null,
    status: { $nin: ['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeAppointmentId) {
    filter._id = { $ne: toObjectId(excludeAppointmentId) };
  }

  const appointment = await AppointmentModel.findOne(filter).lean<AppointmentLean>();
  return appointment ? toAppointment(appointment) : undefined;
}

async auditStatusTransition(
  appointment: Appointment,
  previousStatus: Appointment['status'],
  actorUserId: string,
) {
  await AuditLogModel.create({
    actorUserId,
    eventType: 'appointment.status.updated',
    metadataJson: {
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointment_number,
      fromStatus: previousStatus,
      patientId: appointment.patient_id,
      toStatus: appointment.status,
    },
  });
}

async auditCreated(appointment: Appointment, actorUserId: string) {
  await AuditLogModel.create({
    actorUserId,
    eventType: 'appointment.created',
    metadataJson: {
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointment_number,
      branchId: appointment.branch_id,
      doctorId: appointment.doctor_id,
      patientId: appointment.patient_id,
    },
  });
}

  async listPastOpen(patientId?: string) {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const appointments = await AppointmentModel.find({
      ...(patientId ? { patientId: toObjectId(patientId) } : {}),
      $or: [
        { appointmentDate: { $lt: startOfToday } },
        { appointmentDate: startOfToday, endTime: { $lte: currentTimeStr } },
      ],
      status: { $in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
      deletedAt: null,
    }).lean<AppointmentLean[]>();
    return appointments.map(toAppointment);
  }

  async updateStatusBySystem(id: string, status: Appointment['status']) {
    const appointment = await AppointmentModel.findOneAndUpdate(
      { _id: id, deletedAt: null, status: { $in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] } },
      { $set: { status, activeSlotKey: null } },
      { new: true, lean: true },
    ).lean<AppointmentLean>();
    return appointment ? toAppointment(appointment) : undefined;
  }

  async auditSystemStatusTransition(appointment: Appointment, previousStatus: Appointment['status']) {
    await AuditLogModel.create({
      eventType: 'appointment.status.reconciled',
      metadataJson: {
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
        fromStatus: previousStatus,
        patientId: appointment.patient_id,
        source: 'system_overdue_reconciliation',
        toStatus: appointment.status,
      },
    });
  }

  async rescheduleAtomically(
    original: Appointment,
    replacement: AppointmentCreateRecord,
    userId: string,
  ) {
    const session = await mongoose.startSession();
    let created: Appointment | undefined;
    try {
      await session.withTransaction(async () => {
        const current = await AppointmentModel.findOne({
          _id: toObjectId(original.id),
          status: original.status,
          deletedAt: null,
        }).session(session).lean<AppointmentLean>();
        if (!current) {
          throw new AppError('Appointment changed while rescheduling. Refresh and try again.', 409, 'APPOINTMENT_CHANGED');
        }

        created = await this.create(replacement, userId, session);
        const changedAt = new Date();
        const updated = await AppointmentModel.findOneAndUpdate(
          { _id: current._id, status: original.status, deletedAt: null },
          {
            $set: {
              status: 'RESCHEDULED',
              activeSlotKey: null,
              rescheduledToId: toObjectId(created.id),
              rescheduledAt: changedAt,
              updatedBy: toObjectId(userId),
            },
          },
          { new: true, session },
        ).lean<AppointmentLean>();
        if (!updated) {
          throw new AppError('Appointment changed while rescheduling. Refresh and try again.', 409, 'APPOINTMENT_CHANGED');
        }
        await AppointmentModel.updateOne(
          { _id: toObjectId(created.id) },
          { $set: { rescheduledFromId: current._id, rescheduledAt: changedAt } },
          { session },
        );
        await AuditLogModel.create([{
          actorUserId: userId,
          eventType: 'appointment.rescheduled',
          metadataJson: {
            appointmentId: original.id,
            appointmentNumber: original.appointment_number,
            from: {
              doctorId: original.doctor_id,
              appointmentDate: original.appointment_date,
              startTime: original.start_time,
              endTime: original.end_time,
            },
            patientId: original.patient_id,
            replacementAppointmentId: created.id,
            replacementAppointmentNumber: created.appointment_number,
            to: {
              doctorId: created.doctor_id,
              appointmentDate: created.appointment_date,
              startTime: created.start_time,
              endTime: created.end_time,
            },
          },
        }], { session });
      });
    } catch (error) {
      const databaseError = error as { code?: unknown; keyPattern?: Record<string, unknown> };
      if (databaseError.code === 11000 && databaseError.keyPattern?.activeSlotKey) {
        throw new AppError('This slot is no longer available. Select another time.', 409, 'APPOINTMENT_SLOT_CONFLICT');
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!created) throw new AppError('Appointment could not be rescheduled', 500, 'RESCHEDULE_FAILED');
    return created;
  }

  async nextAppointmentSequence() {
    return AppointmentModel.countDocuments();
  }
}
