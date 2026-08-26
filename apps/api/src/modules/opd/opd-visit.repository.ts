import mongoose, { Types, type ClientSession, type SortOrder } from 'mongoose';
import { OpdVisitModel, type OpdVisitFields } from './opd-visit.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { CreateOpdVisitDTO, OpdVisit, OpdVisitListQuery, UpdateOpdVisitStatusDTO } from './opd-visit.types.js';

type OpdVisitLean = OpdVisitFields & { _id: Types.ObjectId };

type CreateOpdVisitRecord = Omit<CreateOpdVisitDTO, 'appointment_id' | 'patient_id' | 'doctor_id'> & {
  visitNumber: string;
  queueTokenNumber: number;
  initialStatus?: OpdVisit['status'];
  appointmentId?: string | null;
  patientId: string;
  patientNumber: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  branchId: string;
  departmentId: string;
  visitDate: Date;
  checkInTime: Date;
};

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const optionalObjectId = (value: string | null | undefined) => (value ? new Types.ObjectId(value) : undefined);

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const toVisit = (visit: OpdVisitLean): OpdVisit => ({
  id: visit._id.toString(),
  visit_number: visit.visitNumber,
  queue_token_number: visit.queueTokenNumber ?? null,
  appointment_id: visit.appointmentId?.toString() ?? null,
  patient_id: visit.patientId.toString(),
  patient_number: visit.patientNumber,
  patient_name: visit.patientName,
  doctor_id: visit.doctorId.toString(),
  doctor_name: visit.doctorName,
  doctor_specialization: visit.doctorSpecialization,
  branch_id: visit.branchId.toString(),
  department_id: visit.departmentId.toString(),
  visit_date: visit.visitDate,
  check_in_time: visit.checkInTime,
  visit_type: visit.visitType,
  priority: visit.priority,
  status: visit.status,
  reason: visit.reason ?? null,
  notes: visit.notes ?? null,
  created_by: visit.createdBy?.toString() ?? null,
  updated_by: visit.updatedBy?.toString() ?? null,
  created_at: visit.createdAt,
  updated_at: visit.updatedAt,
});

const sortColumnMap = {
  visit_number: 'visitNumber',
  visit_date: 'visitDate',
  check_in_time: 'checkInTime',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

const terminalStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export class OpdVisitRepository {
  session() {
    return mongoose.startSession();
  }

  async getAdmissionSource(id: string, session: ClientSession) {
    return OpdVisitModel.findOne({ _id: requiredObjectId(id), deletedAt: null }).session(session).lean<OpdVisitLean>();
  }

  async markAdmissionConverted(id: string, admissionId: string, userId: string, session: ClientSession) {
    return OpdVisitModel.findOneAndUpdate(
      { _id: requiredObjectId(id), inpatientAdmissionId: null, deletedAt: null },
      { $set: { inpatientAdmissionId: requiredObjectId(admissionId), admissionConvertedAt: new Date(), updatedBy: requiredObjectId(userId) } },
      { new: true, session }
    ).lean<OpdVisitLean>();
  }

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

  async reconcileStaleVisits(): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const staleStatuses: OpdVisit['status'][] = [
      'CHECKED_IN',
      'WAITING_FOR_VITALS',
      'READY_FOR_CONSULTATION',
      'SKIPPED',
    ];

    const result = await OpdVisitModel.updateMany(
      {
        visitDate: { $lt: todayStart },
        status: { $in: staleStatuses },
        deletedAt: null,
      },
      {
        $set: {
          status: 'NO_SHOW',
          notes: 'Automatically marked as NO_SHOW during end-of-day reconciliation.',
          updatedAt: new Date(),
        },
      },
    );

    return result.modifiedCount;
  }

  async list(query: OpdVisitListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (branchIds) filter.branchId = { $in: branchIds.map(requiredObjectId) };

    if (query.status) filter.status = query.status;
    if (query.doctor_id) filter.doctorId = requiredObjectId(query.doctor_id);
    if (query.patient_id) filter.patientId = requiredObjectId(query.patient_id);
    if (query.branch_id) filter.branchId = requiredObjectId(query.branch_id);
    if (query.department_id) filter.departmentId = requiredObjectId(query.department_id);
    if (query.date_from || query.date_to) {
      filter.visitDate = {
        ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
        ...(query.date_to ? { $lte: new Date(query.date_to) } : {}),
      };
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { visitNumber: searchRegex },
        { patientNumber: searchRegex },
        { patientName: searchRegex },
        { doctorName: searchRegex },
        { doctorSpecialization: searchRegex },
      ];
    }

    const sortBy = query.sortBy ? sortColumnMap[query.sortBy] : 'checkInTime';
    const sortOrder: SortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [data, count] = await Promise.all([
      OpdVisitModel.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean<OpdVisitLean[]>(),
      OpdVisitModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toVisit),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string, branchIds?: string[]): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOne({
      _id: id,
      deletedAt: null,
      ...(branchIds ? { branchId: { $in: branchIds.map(requiredObjectId) } } : {}),
    }).lean<OpdVisitLean>();
    return visit ? toVisit(visit) : undefined;
  }

  async findByAppointmentId(appointmentId: string): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOne({
      appointmentId: requiredObjectId(appointmentId),
      deletedAt: null,
    }).lean<OpdVisitLean>();
    return visit ? toVisit(visit) : undefined;
  }

  async findActiveByPatient(patientId: string): Promise<OpdVisit | undefined> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const visit = await OpdVisitModel.findOne({
      patientId: requiredObjectId(patientId),
      visitDate: { $gte: todayStart },
      status: { $nin: terminalStatuses },
      deletedAt: null,
    }).lean<OpdVisitLean>();
    return visit ? toVisit(visit) : undefined;
  }

  async create(data: CreateOpdVisitRecord, userId: string, session?: ClientSession): Promise<OpdVisit> {
    const records = await OpdVisitModel.create([{
      visitNumber: data.visitNumber,
      queueTokenNumber: data.queueTokenNumber,
      ...(data.appointmentId ? { appointmentId: requiredObjectId(data.appointmentId) } : {}),
      patientId: requiredObjectId(data.patientId),
      patientNumber: data.patientNumber,
      patientName: data.patientName,
      doctorId: requiredObjectId(data.doctorId),
      doctorName: data.doctorName,
      doctorSpecialization: data.doctorSpecialization,
      branchId: requiredObjectId(data.branchId),
      departmentId: requiredObjectId(data.departmentId),
      visitDate: data.visitDate,
      checkInTime: data.checkInTime,
      visitType: data.visit_type ?? 'WALK_IN',
      priority: data.priority ?? 'ROUTINE',
      status: data.initialStatus ?? 'CHECKED_IN',
      reason: nullableString(data.reason),
      notes: nullableString(data.notes),
      createdBy: requiredObjectId(userId),
      updatedBy: requiredObjectId(userId),
    }], session ? { session } : undefined);
    const created = records[0];
    if (!created) throw new AppError('OPD visit could not be created', 500, 'OPD_VISIT_CREATE_FAILED');
    return toVisit(created.toObject<OpdVisitLean>());
  }

  async updateStatus(id: string, data: UpdateOpdVisitStatusDTO, userId: string, branchIds?: string[]): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOneAndUpdate(
      { _id: id, deletedAt: null, ...(branchIds ? { branchId: { $in: branchIds.map(requiredObjectId) } } : {}) },
      {
        $set: {
          status: data.status,
          ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
          updatedBy: optionalObjectId(userId),
        },
      },
      { new: true, lean: true },
    ).lean<OpdVisitLean>();

    return visit ? toVisit(visit) : undefined;
  }

  async markSkippedBySystem(id: string) {
    const visit = await OpdVisitModel.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
        status: { $in: ['CHECKED_IN', 'WAITING_FOR_VITALS', 'READY_FOR_CONSULTATION'] },
      },
      { $set: { status: 'SKIPPED' } },
      { new: true, lean: true },
    ).lean<OpdVisitLean>();
    if (!visit) return undefined;
    const result = toVisit(visit);
    await AuditLogModel.create({
      eventType: 'opd.visit.status.reconciled',
      metadataJson: {
        appointmentId: result.appointment_id,
        patientId: result.patient_id,
        source: 'system_overdue_reconciliation',
        toStatus: result.status,
        visitId: result.id,
        visitNumber: result.visit_number,
      },
    });
    return result;
  }

  async auditStatusTransition(visit: OpdVisit, previousStatus: OpdVisit['status'], actorUserId: string) {
    await AuditLogModel.create({
  async startNextReadyVisit(current: OpdVisit, userId: string, session: ClientSession): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOneAndUpdate(
      {
        branchId: requiredObjectId(current.branch_id),
        doctorId: requiredObjectId(current.doctor_id),
        visitDate: current.visit_date,
        status: 'READY_FOR_CONSULTATION',
        deletedAt: null,
      },
      { $set: { status: 'IN_CONSULTATION', updatedBy: requiredObjectId(userId) } },
      {
        new: true,
        session,
        sort: { queueTokenNumber: 1, checkInTime: 1, _id: 1 },
      },
    ).lean<OpdVisitLean>();
    return visit ? toVisit(visit) : undefined;
  }

  async claimNextPatientCall(currentVisitId: string, nextVisitId: string, userId: string, session: ClientSession) {
    return OpdVisitModel.findOneAndUpdate(
      {
        _id: requiredObjectId(currentVisitId),
        status: 'COMPLETED',
        nextPatientCalledAt: null,
        deletedAt: null,
      },
      {
        $set: {
          nextPatientCalledAt: new Date(),
          nextPatientVisitId: requiredObjectId(nextVisitId),
          updatedBy: requiredObjectId(userId),
        },
      },
      { new: true, session },
    ).lean<OpdVisitLean>();
  }

  async auditStatusTransition(visit: OpdVisit, previousStatus: OpdVisit['status'], actorUserId: string, session?: ClientSession) {
    await AuditLogModel.create([{
      actorUserId,
      eventType: 'opd.visit.status.updated',
      metadataJson: {
        fromStatus: previousStatus,
        patientId: visit.patient_id,
        toStatus: visit.status,
        visitId: visit.id,
        visitNumber: visit.visit_number,
      },
    }], session ? { session } : undefined);
  }

  async auditCreated(visit: OpdVisit, actorUserId: string, session?: ClientSession) {
    await AuditLogModel.create([{
      actorUserId,
      eventType: 'opd.visit.created',
      metadataJson: {
        appointmentId: visit.appointment_id,
        branchId: visit.branch_id,
        doctorId: visit.doctor_id,
        patientId: visit.patient_id,
        visitId: visit.id,
        visitNumber: visit.visit_number,
      },
    }], session ? { session } : undefined);
  }

  async nextVisitSequence(session?: ClientSession) {
    const query = OpdVisitModel.countDocuments();
    return session ? query.session(session) : query;
  }
}
