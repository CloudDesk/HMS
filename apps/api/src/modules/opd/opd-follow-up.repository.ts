import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { Appointment } from '../appointments/appointment.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import { OpdFollowUpModel, type OpdFollowUpFields } from './opd-follow-up.model.js';
import type { OpdFollowUp, SaveOpdFollowUpDTO } from './opd-follow-up.types.js';
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
