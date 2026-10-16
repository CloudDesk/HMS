import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { Appointment } from '../appointments/appointment.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import { OpdFollowUpModel, type OpdFollowUpFields } from './opd-follow-up.model.js';
import type { OpdFollowUp, OpdFollowUpComplianceQuery, SaveOpdFollowUpDTO } from './opd-follow-up.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdFollowUpLean = OpdFollowUpFields & { _id: Types.ObjectId };
type SaveFollowUpRecord = SaveOpdFollowUpDTO & {
  appointment?: Appointment | null;
  assignedDoctorName?: string | null;
  consultation: OpdConsultation;
  scheduledAt?: Date | null;
  status: OpdFollowUp['status'];
  visit: OpdVisit;
};

const objectId = (value: string) => new Types.ObjectId(value);
const nullableString = (value: string | null | undefined) => value?.trim() || null;

const toFollowUp = (record: OpdFollowUpLean): OpdFollowUp => ({
  id: record._id.toString(),
  visit_id: record.visitId.toString(),
  consultation_id: record.consultationId.toString(),
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  originating_doctor_id: record.originatingDoctorId.toString(),
  originating_doctor_name: record.originatingDoctorName,
  assigned_doctor_id: record.assignedDoctorId?.toString() ?? null,
  assigned_doctor_name: record.assignedDoctorName ?? null,
  appointment_id: record.appointmentId?.toString() ?? null,
  appointment_number: record.appointmentNumber ?? null,
  follow_up_type: record.followUpType ?? null,
  next_visit_date: record.nextVisitDate ?? null,
  start_time: record.startTime ?? null,
  duration_minutes: record.durationMinutes ?? null,
  reason: record.reason ?? null,
  reminder_type: record.reminderType,
  notes: record.notes ?? null,
  status: record.status,
  scheduled_at: record.scheduledAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

export class OpdFollowUpRepository {
  async compliance(query: OpdFollowUpComplianceQuery) {
    const page = query.page ?? 1; const limit = query.limit ?? 20; const now = new Date();
    const dateRange = query.date_from || query.date_to ? { ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
      ...(query.date_to ? { $lte: new Date(query.date_to) } : {}) } : undefined;
    const pipeline: PipelineStage[] = [
      { $match: { deletedAt: null, ...(dateRange ? { nextVisitDate: dateRange } : {}) } },
      { $lookup: { from: 'opdvisits', localField: 'visitId', foreignField: '_id', as: 'sourceVisit' } },
      { $unwind: '$sourceVisit' },
      { $match: { 'sourceVisit.branchId': objectId(query.branch_id), 'sourceVisit.deletedAt': null,
        ...(query.department_id ? { 'sourceVisit.departmentId': objectId(query.department_id) } : {}) } },
      { $lookup: { from: 'appointments', localField: 'appointmentId', foreignField: '_id', as: 'appointment' } },
      { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
      { $addFields: { compliance_status: { $switch: { branches: [
        { case: { $eq: ['$status', 'DRAFT'] }, then: 'UNSCHEDULED' },
        { case: { $eq: ['$appointment.status', 'COMPLETED'] }, then: 'COMPLETED' },
        { case: { $eq: ['$appointment.status', 'NO_SHOW'] }, then: 'MISSED' },
        { case: { $in: ['$appointment.status', ['CANCELLED', 'RESCHEDULED']] }, then: 'CANCELLED_OR_RESCHEDULED' },
        { case: { $lt: ['$nextVisitDate', now] }, then: 'OVERDUE' },
      ], default: 'UPCOMING' } } } },
      { $project: { _id: 0, follow_up_id: { $toString: '$_id' }, source_visit_id: { $toString: '$visitId' },
        patient_id: { $toString: '$patientId' }, patient_number: 1, appointment_id: { $cond: ['$appointmentId', { $toString: '$appointmentId' }, null] },
        appointment_number: 1, follow_up_type: '$followUpType', next_visit_date: '$nextVisitDate', scheduled_at: '$scheduledAt',
        appointment_status: { $ifNull: ['$appointment.status', null] }, compliance_status: 1 } },
      { $sort: { next_visit_date: -1, follow_up_id: 1 } },
    ];
    const [items, countRows] = await Promise.all([
      OpdFollowUpModel.aggregate([...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }]),
      OpdFollowUpModel.aggregate([...pipeline, { $count: 'total' }]),
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }
  async getByVisit(visitId: string): Promise<OpdFollowUp | null> {
    const record = await OpdFollowUpModel.findOne({ visitId: objectId(visitId), deletedAt: null }).lean<OpdFollowUpLean>();
    return record ? toFollowUp(record) : null;
  }

  async saveForVisit(data: SaveFollowUpRecord, userId: string): Promise<OpdFollowUp> {
    const record = await OpdFollowUpModel.findOneAndUpdate(
      { visitId: objectId(data.visit.id), deletedAt: null },
      {
        $set: {
          consultationId: objectId(data.consultation.id),
          assignedDoctorId: data.assigned_doctor_id ? objectId(data.assigned_doctor_id) : null,
          assignedDoctorName: data.assignedDoctorName ?? null,
          appointmentId: data.appointment ? objectId(data.appointment.id) : null,
          appointmentNumber: data.appointment?.appointment_number ?? null,
          followUpType: data.follow_up_type ?? null,
          nextVisitDate: data.next_visit_date ? new Date(data.next_visit_date) : null,
          startTime: nullableString(data.start_time),
          durationMinutes: data.duration_minutes ?? null,
          reason: nullableString(data.reason),
          reminderType: data.reminder_type ?? 'SMS',
          notes: nullableString(data.notes),
          status: data.status,
          scheduledAt: data.scheduledAt ?? null,
          updatedBy: objectId(userId),
        },
        $setOnInsert: {
          visitId: objectId(data.visit.id),
          patientId: objectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          originatingDoctorId: objectId(data.visit.doctor_id),
          originatingDoctorName: data.visit.doctor_name,
          createdBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after', upsert: true },
    ).lean<OpdFollowUpLean>();

    if (!record) throw new AppError('Follow-up could not be saved', 500, 'FOLLOW_UP_SAVE_FAILED');
    return toFollowUp(record);
  }
}
