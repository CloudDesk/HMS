import { Types, type ClientSession } from 'mongoose';
import { DentalTreatmentEpisodeModel, type DentalTreatmentEpisodeFields } from './dental-episode.model.js';
import type {
  DentalEpisodeStatus,
  DentalTreatmentEpisode,
  HistoricalToothFinding,
} from './dental-episode.types.js';
import { OpdDentalExaminationModel } from './opd-dental-examination.model.js';
import { OpdVisitModel } from './opd-visit.model.js';

type DentalTreatmentEpisodeLean = DentalTreatmentEpisodeFields & { _id: Types.ObjectId };

const requiredObjectId = (value: string) => new Types.ObjectId(value);

const toDomainEpisode = (
  doc: DentalTreatmentEpisodeLean,
  visitsMap?: Map<string, { visitNumber: string; doctorName: string; visitDate: Date; status: string }>,
): DentalTreatmentEpisode => ({
  id: doc._id.toString(),
  episode_number: doc.episodeNumber,
  patient_id: doc.patientId.toString(),
  patient_number: doc.patientNumber,
  patient_name: doc.patientName,
  originating_visit_id: doc.originatingVisitId.toString(),
  originating_visit_number: doc.originatingVisitNumber,
  primary_doctor_id: doc.primaryDoctorId.toString(),
  primary_doctor_name: doc.primaryDoctorName,
  branch_id: doc.branchId.toString(),
  department_id: doc.departmentId.toString(),
  primary_tooth_number: doc.primaryToothNumber ?? null,
  diagnosis_code: doc.diagnosisCode ?? null,
  diagnosis_name: doc.diagnosisName ?? null,
  treatment_plan_summary: doc.treatmentPlanSummary ?? null,
  status: doc.status,
  visit_ids: (doc.visitIds ?? []).map((id) => id.toString()),
  visits: visitsMap
    ? (doc.visitIds ?? []).map((id) => {
        const v = visitsMap.get(id.toString());
        return {
          visit_id: id.toString(),
          visit_number: v?.visitNumber ?? '',
          doctor_id: doc.primaryDoctorId.toString(),
          doctor_name: v?.doctorName ?? '',
          visit_date: v?.visitDate ?? new Date(),
          status: v?.status ?? '',
        };
      })
    : undefined,
  notes: doc.notes ?? null,
  created_by: doc.createdBy?.toString() ?? null,
  updated_by: doc.updatedBy?.toString() ?? null,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

export class DentalEpisodeRepository {
  async create(
    record: Omit<DentalTreatmentEpisodeFields, 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<DentalTreatmentEpisode> {
    const doc = new DentalTreatmentEpisodeModel(record);
    if (session) {
      await doc.save({ session });
    } else {
      await doc.save();
    }
    return toDomainEpisode(doc.toObject());
  }

  async getById(id: string, session?: ClientSession): Promise<DentalTreatmentEpisode | null> {
    const query = DentalTreatmentEpisodeModel.findOne({
      _id: requiredObjectId(id),
      deletedAt: null,
    }).lean<DentalTreatmentEpisodeLean>();
    if (session) query.session(session);
    const doc = await query;
    if (!doc) return null;

    const visits = await OpdVisitModel.find({
      _id: { $in: doc.visitIds },
      deletedAt: null,
    })
      .select('visitNumber doctorName visitDate status')
      .lean();

    const visitsMap = new Map(
      visits.map((v) => [v._id.toString(), {
        visitNumber: v.visitNumber,
        doctorName: v.doctorName,
        visitDate: v.visitDate,
        status: v.status,
      }]),
    );

    return toDomainEpisode(doc, visitsMap);
  }

  async listByPatient(
    patientId: string,
    status?: DentalEpisodeStatus,
    session?: ClientSession,
  ): Promise<DentalTreatmentEpisode[]> {
    const filter: Record<string, unknown> = {
      patientId: requiredObjectId(patientId),
      deletedAt: null,
    };
    if (status) {
      filter.status = status;
    }

    const query = DentalTreatmentEpisodeModel.find(filter)
      .sort({ createdAt: -1 })
      .lean<DentalTreatmentEpisodeLean[]>();
    if (session) query.session(session);
    const docs = await query;

    const allVisitIds = Array.from(new Set(docs.flatMap((d) => (d.visitIds ?? []).map((id) => id.toString()))));
    const visits = await OpdVisitModel.find({
      _id: { $in: allVisitIds.map((id) => new Types.ObjectId(id)) },
      deletedAt: null,
    })
      .select('visitNumber doctorName visitDate status')
      .lean();

    const visitsMap = new Map(
      visits.map((v) => [v._id.toString(), {
        visitNumber: v.visitNumber,
        doctorName: v.doctorName,
        visitDate: v.visitDate,
        status: v.status,
      }]),
    );

    return docs.map((doc) => toDomainEpisode(doc, visitsMap));
  }

  async getActiveEpisodeForPatient(
    patientId: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentEpisode | null> {
    const query = DentalTreatmentEpisodeModel.findOne({
      patientId: requiredObjectId(patientId),
      status: 'ACTIVE',
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean<DentalTreatmentEpisodeLean>();
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainEpisode(doc) : null;
  }

  async addVisitToEpisode(
    episodeId: string,
    visitId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<DentalTreatmentEpisode | null> {
    const query = DentalTreatmentEpisodeModel.findOneAndUpdate(
      {
        _id: requiredObjectId(episodeId),
        deletedAt: null,
      },
      {
        $addToSet: { visitIds: requiredObjectId(visitId) },
        $set: { updatedBy: requiredObjectId(userId) },
      },
      { new: true, lean: true },
    );
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainEpisode(doc as DentalTreatmentEpisodeLean) : null;
  }

  async updateStatus(
    episodeId: string,
    status: DentalEpisodeStatus,
    userId: string,
    notes?: string | null,
    session?: ClientSession,
  ): Promise<DentalTreatmentEpisode | null> {
    const updatePayload: Record<string, unknown> = {
      status,
      updatedBy: requiredObjectId(userId),
    };
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const query = DentalTreatmentEpisodeModel.findOneAndUpdate(
      {
        _id: requiredObjectId(episodeId),
        deletedAt: null,
      },
      { $set: updatePayload },
      { new: true, lean: true },
    );
    if (session) query.session(session);
    const doc = await query;
    return doc ? toDomainEpisode(doc as DentalTreatmentEpisodeLean) : null;
  }

  async getHistoricalToothFindings(
    patientId: string,
    excludeVisitId?: string,
  ): Promise<HistoricalToothFinding[]> {
    const filter: Record<string, unknown> = {
      patientId: requiredObjectId(patientId),
      deletedAt: null,
    };
    if (excludeVisitId) {
      filter.visitId = { $ne: requiredObjectId(excludeVisitId) };
    }

    // Retrieve prior examinations sorted by newest first
    const exams = await OpdDentalExaminationModel.find(filter)
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();

    if (exams.length === 0) return [];

    const examVisitIds = exams.map((e) => e.visitId);
    const visits = await OpdVisitModel.find({
      _id: { $in: examVisitIds },
      deletedAt: null,
    })
      .select('visitNumber')
      .lean();
    const visitNumberMap = new Map(visits.map((v) => [v._id.toString(), v.visitNumber]));

    const latestToothFindings = new Map<number, HistoricalToothFinding>();

    for (const exam of exams) {
      const visitNum = visitNumberMap.get(exam.visitId.toString()) ?? '';
      for (const tooth of exam.teeth ?? []) {
        if (!latestToothFindings.has(tooth.toothNumber)) {
          latestToothFindings.set(tooth.toothNumber, {
            tooth_number: tooth.toothNumber,
            dentition: tooth.dentition,
            status: tooth.status,
            surfaces: tooth.surfaces ?? [],
            conditions: tooth.conditions ?? [],
            mobility: tooth.mobility ?? null,
            pocket_depth_mm: tooth.pocketDepthMm ?? null,
            furcation_involvement: tooth.furcationInvolvement ?? null,
            notes: tooth.notes ?? null,
            visit_id: exam.visitId.toString(),
            visit_number: visitNum,
            doctor_id: exam.doctorId.toString(),
            doctor_name: exam.doctorName,
            recorded_at: exam.completedAt ?? exam.createdAt,
          });
        }
      }
    }

    return Array.from(latestToothFindings.values()).sort(
      (a, b) => a.tooth_number - b.tooth_number,
    );
  }
}
