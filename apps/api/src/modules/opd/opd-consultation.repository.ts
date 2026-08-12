import { Types } from 'mongoose';
import { OpdConsultationModel, type OpdConsultationFields } from './opd-consultation.model.js';
import type { OpdConsultation, SaveOpdConsultationDTO } from './opd-consultation.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdConsultationLean = OpdConsultationFields & { _id: Types.ObjectId };

type SaveOpdConsultationRecord = SaveOpdConsultationDTO & {
  status?: OpdConsultation['status'];
  visit: OpdVisit;
  completedAt?: Date | null;
};

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toConsultation = (consultation: OpdConsultationLean): OpdConsultation => ({
  id: consultation._id.toString(),
  visit_id: consultation.visitId.toString(),
  patient_id: consultation.patientId.toString(),
  patient_number: consultation.patientNumber,
  patient_name: consultation.patientName,
  doctor_id: consultation.doctorId.toString(),
  doctor_name: consultation.doctorName,
  status: consultation.status,
  chief_complaint: consultation.chiefComplaint ?? null,
  history_present_illness: consultation.historyPresentIllness ?? null,
  past_history: consultation.pastHistory ?? null,
  family_history: consultation.familyHistory ?? null,
  allergies: consultation.allergies ?? null,
  physical_examination: consultation.physicalExamination ?? null,
  assessment: consultation.assessment ?? null,
  treatment_plan: consultation.treatmentPlan ?? null,
  doctor_notes: consultation.doctorNotes ?? null,
  completed_at: consultation.completedAt ?? null,
  created_by: consultation.createdBy?.toString() ?? null,
  updated_by: consultation.updatedBy?.toString() ?? null,
  created_at: consultation.createdAt,
  updated_at: consultation.updatedAt,
});

const buildUpdatePayload = (data: SaveOpdConsultationRecord, userId: string) => ({
  ...(data.chief_complaint !== undefined ? { chiefComplaint: nullableString(data.chief_complaint) } : {}),
  ...(data.history_present_illness !== undefined ? { historyPresentIllness: nullableString(data.history_present_illness) } : {}),
  ...(data.past_history !== undefined ? { pastHistory: nullableString(data.past_history) } : {}),
  ...(data.family_history !== undefined ? { familyHistory: nullableString(data.family_history) } : {}),
  ...(data.allergies !== undefined ? { allergies: nullableString(data.allergies) } : {}),
  ...(data.physical_examination !== undefined ? { physicalExamination: nullableString(data.physical_examination) } : {}),
  ...(data.assessment !== undefined ? { assessment: nullableString(data.assessment) } : {}),
  ...(data.treatment_plan !== undefined ? { treatmentPlan: nullableString(data.treatment_plan) } : {}),
  ...(data.doctor_notes !== undefined ? { doctorNotes: nullableString(data.doctor_notes) } : {}),
  ...(data.status ? { status: data.status } : {}),
  ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
  updatedBy: requiredObjectId(userId),
});

export class OpdConsultationRepository {
  async getByVisit(visitId: string): Promise<OpdConsultation | null> {
    const consultation = await OpdConsultationModel.findOne({
      visitId: requiredObjectId(visitId),
      deletedAt: null,
    }).lean<OpdConsultationLean>();

    return consultation ? toConsultation(consultation) : null;
  }

  async saveForVisit(data: SaveOpdConsultationRecord, userId: string): Promise<OpdConsultation> {
    const consultation = await OpdConsultationModel.findOneAndUpdate(
      { visitId: requiredObjectId(data.visit.id), deletedAt: null },
      {
        $set: buildUpdatePayload(data, userId),
        $setOnInsert: {
          visitId: requiredObjectId(data.visit.id),
          patientId: requiredObjectId(data.visit.patient_id),
          patientNumber: data.visit.patient_number,
          patientName: data.visit.patient_name,
          doctorId: requiredObjectId(data.visit.doctor_id),
          doctorName: data.visit.doctor_name,
          createdBy: requiredObjectId(userId),
        },
      },
      { lean: true, new: true, upsert: true },
    ).lean<OpdConsultationLean>();

    if (!consultation) {
      throw new Error('Consultation upsert failed');
    }

    return toConsultation(consultation);
  }
}
