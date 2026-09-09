import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import {
  OpdDentalExaminationModel,
  type DentalHistoryFields,
  type DentalTreatmentPlanItemFields,
  type OpdDentalExaminationFields,
  type SoftTissueFields,
  type ToothFindingFields,
} from './opd-dental-examination.model.js';
import type {
  DentalHistory,
  DentalTreatmentPlanItem,
  OpdDentalExamination,
  SaveOpdDentalExaminationDTO,
  SoftTissueExamination,
  ToothFinding,
} from './opd-dental-examination.types.js';
import type { OpdVisit } from './opd-visit.types.js';

type OpdDentalExaminationLean = OpdDentalExaminationFields & {
  _id: Types.ObjectId;
};

export type SaveDentalExaminationRecord = SaveOpdDentalExaminationDTO & {
  visit: OpdVisit;
  consultationId?: string | null;
  status?: OpdDentalExamination['status'];
  completedAt?: Date | null;
};

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const optionalObjectId = (value: string | null | undefined) =>
  value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

const toDomainHistory = (history?: DentalHistoryFields | null): DentalHistory | null => {
  if (!history) return null;
  return {
    chief_complaint: history.chiefComplaint ?? null,
    pain_scale: history.painScale ?? null,
    bleeding_gums: history.bleedingGums ?? null,
    sensitivity_hot_cold_sweet: history.sensitivityHotColdSweet ?? null,
    bruxism: history.bruxism ?? null,
    habits: history.habits ?? [],
    medical_alerts: history.medicalAlerts ?? [],
  };
};

const toDomainSoftTissue = (softTissue?: SoftTissueFields | null): SoftTissueExamination | null => {
  if (!softTissue) return null;
  return {
    gingiva_condition: softTissue.gingivaCondition ?? null,
    calculus_plaque: softTissue.calculusPlaque ?? null,
    oral_mucosa: softTissue.oralMucosa ?? null,
    tongue_palate_floor: softTissue.tonguePalateFloor ?? null,
    tmj_evaluation: softTissue.tmjEvaluation ?? null,
    occlusion_class: softTissue.occlusionClass ?? null,
  };
};

const toDomainTooth = (tooth: ToothFindingFields): ToothFinding => ({
  tooth_number: tooth.toothNumber,
  dentition: tooth.dentition,
  status: tooth.status,
  surfaces: tooth.surfaces ?? [],
  conditions: tooth.conditions ?? [],
  mobility: tooth.mobility ?? null,
  pocket_depth_mm: tooth.pocketDepthMm ?? null,
  furcation_involvement: tooth.furcationInvolvement ?? null,
  notes: tooth.notes ?? null,
});

const toDomainPlanItem = (item: DentalTreatmentPlanItemFields): DentalTreatmentPlanItem => ({
  id: item._id?.toString(),
  service_id: item.serviceId ?? null,
  tooth_number: item.toothNumber ?? null,
  procedure_name: item.procedureName,
  surfaces: item.surfaces ?? [],
  priority: item.priority ?? 'ROUTINE',
  estimated_cost: item.estimatedCost ?? null,
  notes: item.notes ?? null,
  status: item.status ?? 'PROPOSED',
});

const toDentalExamination = (record: OpdDentalExaminationLean): OpdDentalExamination => ({
  id: record._id.toString(),
  visit_id: record.visitId.toString(),
  consultation_id: record.consultationId?.toString() ?? null,
  patient_id: record.patientId.toString(),
  patient_number: record.patientNumber,
  patient_name: record.patientName,
  doctor_id: record.doctorId.toString(),
  doctor_name: record.doctorName,
  branch_id: record.branchId.toString(),
  department_id: record.departmentId.toString(),
  status: record.status,
  dental_history: toDomainHistory(record.dentalHistory),
  soft_tissue: toDomainSoftTissue(record.softTissue),
  teeth: (record.teeth ?? []).map(toDomainTooth),
  treatment_plan_items: (record.treatmentPlanItems ?? []).map(toDomainPlanItem),
  completed_at: record.completedAt ?? null,
  created_by: record.createdBy?.toString() ?? null,
  updated_by: record.updatedBy?.toString() ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toPersistenceHistory = (history?: DentalHistory | null): DentalHistoryFields | null => {
  if (!history) return null;
  return {
    chiefComplaint: history.chief_complaint ?? null,
    painScale: history.pain_scale ?? null,
    bleedingGums: history.bleeding_gums ?? null,
    sensitivityHotColdSweet: history.sensitivity_hot_cold_sweet ?? null,
    bruxism: history.bruxism ?? null,
    habits: history.habits ?? [],
    medicalAlerts: history.medical_alerts ?? [],
  };
};

const toPersistenceSoftTissue = (
  softTissue?: SoftTissueExamination | null,
): SoftTissueFields | null => {
  if (!softTissue) return null;
  return {
    gingivaCondition: softTissue.gingiva_condition ?? null,
    calculusPlaque: softTissue.calculus_plaque ?? null,
    oralMucosa: softTissue.oral_mucosa ?? null,
    tonguePalateFloor: softTissue.tongue_palate_floor ?? null,
    tmjEvaluation: softTissue.tmj_evaluation ?? null,
    occlusionClass: softTissue.occlusion_class ?? null,
  };
};

const toPersistenceTooth = (tooth: ToothFinding): ToothFindingFields => ({
  toothNumber: tooth.tooth_number,
  dentition: tooth.dentition,
  status: tooth.status,
  surfaces: tooth.surfaces ?? [],
  conditions: tooth.conditions ?? [],
  mobility: tooth.mobility ?? null,
  pocketDepthMm: tooth.pocket_depth_mm ?? null,
  furcationInvolvement: tooth.furcation_involvement ?? null,
  notes: tooth.notes ?? null,
});

const toPersistencePlanItem = (item: DentalTreatmentPlanItem): DentalTreatmentPlanItemFields => ({
  ...(item.id && Types.ObjectId.isValid(item.id) ? { _id: new Types.ObjectId(item.id) } : {}),
  serviceId: item.service_id ?? null,
  toothNumber: item.tooth_number ?? null,
  procedureName: item.procedure_name.trim(),
  surfaces: item.surfaces ?? [],
  priority: item.priority ?? 'ROUTINE',
  estimatedCost: item.estimated_cost ?? null,
  notes: item.notes ?? null,
  status: item.status ?? 'PROPOSED',
});

export class OpdDentalExaminationRepository {
  async getByVisit(
    visitId: string,
    session?: ClientSession,
  ): Promise<OpdDentalExamination | null> {
    const query = OpdDentalExaminationModel.findOne({
      visitId: requiredObjectId(visitId),
      deletedAt: null,
    }).lean<OpdDentalExaminationLean>();
    if (session) query.session(session);
    const examination = await query;

    return examination ? toDentalExamination(examination) : null;
  }

  async getById(id: string): Promise<OpdDentalExamination | null> {
    const examination = await OpdDentalExaminationModel.findOne({
      _id: requiredObjectId(id),
      deletedAt: null,
    }).lean<OpdDentalExaminationLean>();

    return examination ? toDentalExamination(examination) : null;
  }

  async saveForVisit(
    data: SaveDentalExaminationRecord,
    userId: string,
    session?: ClientSession,
  ): Promise<OpdDentalExamination> {
    const setPayload: Record<string, unknown> = {
      updatedBy: requiredObjectId(userId),
    };

    if (data.dental_history !== undefined) {
      setPayload.dentalHistory = toPersistenceHistory(data.dental_history);
    }
    if (data.soft_tissue !== undefined) {
      setPayload.softTissue = toPersistenceSoftTissue(data.soft_tissue);
    }
    if (data.teeth !== undefined) {
      setPayload.teeth = data.teeth.map(toPersistenceTooth);
    }
    if (data.treatment_plan_items !== undefined) {
      setPayload.treatmentPlanItems = data.treatment_plan_items.map(toPersistencePlanItem);
    }
    if (data.consultationId !== undefined) {
      setPayload.consultationId = optionalObjectId(data.consultationId);
    }
    setPayload.status = data.status ?? 'DRAFT';
    if (data.completedAt !== undefined) {
      setPayload.completedAt = data.completedAt;
    }

    let examination: OpdDentalExaminationLean | null;
    const filter = {
      visitId: requiredObjectId(data.visit.id),
      deletedAt: null,
      status: 'DRAFT' as const,
      ...(data.expected_updated_at ? { updatedAt: new Date(data.expected_updated_at) } : {}),
    };
    try {
      examination = await OpdDentalExaminationModel.findOneAndUpdate(
        filter,
        {
          $set: setPayload,
          $setOnInsert: {
            visitId: requiredObjectId(data.visit.id),
            patientId: requiredObjectId(data.visit.patient_id),
            patientNumber: data.visit.patient_number,
            patientName: data.visit.patient_name,
            doctorId: requiredObjectId(data.visit.doctor_id),
            doctorName: data.visit.doctor_name,
            branchId: requiredObjectId(data.visit.branch_id),
            departmentId: requiredObjectId(data.visit.department_id),
            createdBy: requiredObjectId(userId),
          },
        },
        { lean: true, returnDocument: 'after', upsert: !data.expected_updated_at, session },
      ).lean<OpdDentalExaminationLean>();
    } catch (err: unknown) {
      if (session) throw err;
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        // Retry findOneAndUpdate without upsert or with existing document
        examination = await OpdDentalExaminationModel.findOneAndUpdate(
          filter,
          { $set: setPayload },
          { lean: true, returnDocument: 'after', session },
        ).lean<OpdDentalExaminationLean>();
      } else {
        throw err;
      }
    }

    if (!examination) {
      throw new AppError(
        'Dental examination changed or was completed. Reload before retrying.',
        409,
        'EXAMINATION_CONFLICT',
      );
    }

    return toDentalExamination(examination);
  }
}
