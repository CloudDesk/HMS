import { Types, type SortOrder } from 'mongoose';
import { OpdVisitModel, type OpdVisitFields } from './opd-visit.model.js';
import type { CreateOpdVisitDTO, OpdVisit, OpdVisitListQuery, UpdateOpdVisitStatusDTO } from './opd-visit.types.js';

type OpdVisitLean = OpdVisitFields & { _id: Types.ObjectId };

type CreateOpdVisitRecord = Omit<CreateOpdVisitDTO, 'appointment_id' | 'patient_id' | 'doctor_id'> & {
  visitNumber: string;
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
  async list(query: OpdVisitListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };

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

  async getById(id: string): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOne({ _id: id, deletedAt: null }).lean<OpdVisitLean>();
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
    const visit = await OpdVisitModel.findOne({
      patientId: requiredObjectId(patientId),
      status: { $nin: terminalStatuses },
      deletedAt: null,
    }).lean<OpdVisitLean>();
    return visit ? toVisit(visit) : undefined;
  }

  async create(data: CreateOpdVisitRecord, userId: string): Promise<OpdVisit> {
    const created = await OpdVisitModel.create({
      visitNumber: data.visitNumber,
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
      status: 'CHECKED_IN',
      reason: nullableString(data.reason),
      notes: nullableString(data.notes),
      createdBy: requiredObjectId(userId),
      updatedBy: requiredObjectId(userId),
    });
    return toVisit(created.toObject<OpdVisitLean>());
  }

  async updateStatus(id: string, data: UpdateOpdVisitStatusDTO, userId: string): Promise<OpdVisit | undefined> {
    const visit = await OpdVisitModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
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

  async nextVisitSequence() {
    return OpdVisitModel.countDocuments();
  }
}
