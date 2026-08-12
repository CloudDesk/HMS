import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { Appointment } from '../appointments/appointment.types.js';
import type { OpdConsultation } from './opd-consultation.types.js';
import { OpdReferralModel, type OpdReferralFields } from './opd-referral.model.js';
import type { OpdReferral, SaveOpdReferralDTO } from './opd-referral.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdReferralLean = OpdReferralFields & { _id: Types.ObjectId };
type SaveReferralRecord = SaveOpdReferralDTO & {
  appointment?: Appointment | null;
  consultation: OpdConsultation;
  referredDoctorName?: string | null;
  status: OpdReferral['status'];
  submittedAt?: Date | null;
  visit: OpdVisit;
};

const objectId = (value: string) => new Types.ObjectId(value);
const nullableString = (value: string | null | undefined) => value?.trim() || null;

const toReferral = (record: OpdReferralLean): OpdReferral => ({
  id: record._id.toString(),
  visit_id: record.visitId.toString(),
  consultation_id: record.consultationId.toString(),
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  referring_doctor_id: record.referringDoctorId.toString(),
  referring_doctor_name: record.referringDoctorName,
  referral_type: record.referralType ?? null,
  specialty: record.specialty ?? null,
  priority: record.priority,
  facility: record.facility ?? null,
  referred_doctor_id: record.referredDoctorId?.toString() ?? null,
  referred_doctor_name: record.referredDoctorName ?? null,
  reason: record.reason ?? null,
  clinical_summary: record.clinicalSummary ?? null,
  appointment_id: record.appointmentId?.toString() ?? null,
  appointment_number: record.appointmentNumber ?? null,
  appointment_date: record.appointmentDate ?? null,
  appointment_start_time: record.appointmentStartTime ?? null,
  appointment_duration_minutes: record.appointmentDurationMinutes ?? null,
  status: record.status,
  submitted_at: record.submittedAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

export class OpdReferralRepository {
  async getByVisit(visitId: string): Promise<OpdReferral | null> {
    const record = await OpdReferralModel.findOne({ visitId: objectId(visitId), deletedAt: null }).lean<OpdReferralLean>();
    return record ? toReferral(record) : null;
  }

  async saveForVisit(data: SaveReferralRecord, userId: string): Promise<OpdReferral> {
    const record = await OpdReferralModel.findOneAndUpdate(
      { visitId: objectId(data.visit.id), deletedAt: null },
      {
        $set: {
          consultationId: objectId(data.consultation.id),
          referralType: data.referral_type ?? null,
          specialty: nullableString(data.specialty),
          priority: data.priority ?? 'ROUTINE',
          facility: nullableString(data.facility),
          referredDoctorId: data.referred_doctor_id ? objectId(data.referred_doctor_id) : null,
          referredDoctorName: data.referredDoctorName ?? nullableString(data.referred_doctor_name),
          reason: nullableString(data.reason),
          clinicalSummary: nullableString(data.clinical_summary),
          appointmentId: data.appointment ? objectId(data.appointment.id) : null,
          appointmentNumber: data.appointment?.appointment_number ?? null,
          appointmentDate: data.appointment_date ? new Date(data.appointment_date) : null,
          appointmentStartTime: nullableString(data.appointment_start_time),
          appointmentDurationMinutes: data.appointment_duration_minutes ?? null,
          status: data.status,
          submittedAt: data.submittedAt ?? null,
          updatedBy: objectId(userId),
        },
        $setOnInsert: {
          visitId: objectId(data.visit.id),
          patientId: objectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          referringDoctorId: objectId(data.visit.doctor_id),
          referringDoctorName: data.visit.doctor_name,
          createdBy: objectId(userId),
        },
      },
      { lean: true, returnDocument: 'after', upsert: true },
    ).lean<OpdReferralLean>();

    if (!record) throw new AppError('Referral could not be saved', 500, 'REFERRAL_SAVE_FAILED');
    return toReferral(record);
  }
}
