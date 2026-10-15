import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { OpdConsultationModel, type OpdConsultationFields } from './opd-consultation.model.js';
import type { OpdConsultation, SaveOpdConsultationDTO } from './opd-consultation.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdConsultationLean = OpdConsultationFields & { _id: Types.ObjectId };

type SaveOpdConsultationRecord = SaveOpdConsultationDTO & {
  status?: OpdConsultation['status'];
  visit: OpdVisit;
  completedAt?: Date | null;
  currentVersion?: number;
  currentStatus?: OpdConsultation['status'];
};

const requiredObjectId = (value: string) => new Types.ObjectId(value);
const isDuplicateKeyError = (error: unknown) => typeof error === 'object'
  && error !== null
  && 'code' in error
  && error.code === 11000;

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
  version: consultation.version ?? 0,
  chief_complaint: consultation.chiefComplaint ?? null,
  history_present_illness: consultation.historyPresentIllness ?? null,
  past_history: consultation.pastHistory ?? null,
  family_history: consultation.familyHistory ?? null,
  allergies: consultation.allergies ?? null,
  physical_examination: consultation.physicalExamination ?? null,
  assessment: consultation.assessment ?? null,
  diagnoses: consultation.diagnoses?.map((d) => ({
    code: d.code,
    display: d.display,
    codingSystem: d.codingSystem,
    type: d.type,
    notes: d.notes ?? null,
  })) ?? [],
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
  ...(data.diagnoses !== undefined ? {
    diagnoses: data.diagnoses.map((d) => ({
      code: d.code.trim(),
      display: d.display.trim(),
      codingSystem: (d.codingSystem || 'ICD-11').trim(),
      type: d.type || 'PRIMARY',
      notes: nullableString(d.notes),
    })),
  } : {}),
  ...(data.treatment_plan !== undefined ? { treatmentPlan: nullableString(data.treatment_plan) } : {}),
  ...(data.doctor_notes !== undefined ? { doctorNotes: nullableString(data.doctor_notes) } : {}),
  ...(data.status ? { status: data.status } : {}),
  ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
  updatedBy: requiredObjectId(userId),
});


export class OpdConsultationRepository {
  async getByVisit(visitId: string, session?: ClientSession): Promise<OpdConsultation | null> {
    const query = OpdConsultationModel.findOne({
      visitId: requiredObjectId(visitId),
      deletedAt: null,
    });
    if (session) query.session(session);
    const consultation = await query.lean<OpdConsultationLean>();

    return consultation ? toConsultation(consultation) : null;
  }

  async saveForVisit(
    data: SaveOpdConsultationRecord,
    userId: string,
    session?: ClientSession,
  ): Promise<OpdConsultation> {
    const currentVersion = data.currentVersion ?? 0;
    const versionFilter = currentVersion === 0
      ? { $or: [{ version: 0 }, { version: { $exists: false } }] }
      : { version: currentVersion };
    const isCreate = data.currentStatus === undefined;
    let consultation: OpdConsultationLean | null;
    try {
      consultation = await OpdConsultationModel.findOneAndUpdate(
        {
          visitId: requiredObjectId(data.visit.id),
          deletedAt: null,
          ...(isCreate ? {} : versionFilter),
          ...(data.currentStatus ? { status: data.currentStatus } : {}),
        },
        {
          $set: buildUpdatePayload(data, userId),
          $inc: { version: 1 },
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
        { lean: true, returnDocument: 'after', upsert: isCreate, session },
      ).lean<OpdConsultationLean>();
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('The consultation changed after it was loaded', 409, 'OPD_CONSULTATION_VERSION_CONFLICT');
      }
      throw error;
    }

    if (!consultation) {
      throw new AppError('The consultation changed after it was loaded', 409, 'OPD_CONSULTATION_VERSION_CONFLICT');
    }

    return toConsultation(consultation);
  }
}
