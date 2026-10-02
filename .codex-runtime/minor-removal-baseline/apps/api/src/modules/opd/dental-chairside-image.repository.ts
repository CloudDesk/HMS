import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import {
  DentalChairsideImageModel,
} from './dental-chairside-image.model.js';
import type {
  ChairsideImageListQuery,
  DentalChairsideImage,
  DentalChairsideImageFields,
} from './dental-chairside-image.types.js';

export class DentalChairsideImageRepository {
  private toDTO(doc: DentalChairsideImageFields): DentalChairsideImage {
    return {
      id: doc._id.toString(),
      patient_id: doc.patientId.toString(),
      patient_number: doc.patientNumber,
      patient_name: doc.patientName,
      visit_id: doc.visitId.toString(),
      visit_number: doc.visitNumber,
      episode_id: doc.episodeId ? doc.episodeId.toString() : null,
      episode_number: doc.episodeNumber ?? null,
      examination_id: doc.examinationId ? doc.examinationId.toString() : null,
      tooth_number: doc.toothNumber ?? null,
      imaging_source: 'CHAIRSIDE',
      file_name: doc.fileName,
      mime_type: doc.mimeType,
      file_size_bytes: doc.fileSizeBytes,
      storage_key: doc.storageKey,
      file_url: `/api/opd/dental-chairside-images/${doc._id.toString()}/download`,
      notes: doc.notes ?? null,
      doctor_id: doc.doctorId.toString(),
      doctor_name: doc.doctorName,
      branch_id: doc.branchId.toString(),
      department_id: doc.departmentId.toString(),
      created_by: doc.createdBy.toString(),
      created_at: doc.createdAt.toISOString(),
      updated_at: doc.updatedAt.toISOString(),
    };
  }

  async create(
    data: Omit<DentalChairsideImageFields, '_id' | 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<DentalChairsideImage> {
    const [doc] = await DentalChairsideImageModel.create([data], { session });
    if (!doc) {
      throw new AppError('Failed to create chairside image record', 500, 'CREATE_FAILED');
    }
    return this.toDTO(doc as unknown as DentalChairsideImageFields);
  }

  async getById(id: string, session?: ClientSession): Promise<DentalChairsideImage | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await DentalChairsideImageModel.findOne({
      _id: new Types.ObjectId(id),
      deletedAt: null,
    })
      .session(session ?? null)
      .lean();

    return doc ? this.toDTO(doc as DentalChairsideImageFields) : null;
  }

  async listByVisit(
    visitId: string,
    query?: ChairsideImageListQuery,
    session?: ClientSession,
  ): Promise<DentalChairsideImage[]> {
    if (!Types.ObjectId.isValid(visitId)) return [];

    const filter: Record<string, unknown> = {
      visitId: new Types.ObjectId(visitId),
      deletedAt: null,
    };

    if (query?.tooth_number !== undefined) {
      filter.toothNumber = query.tooth_number;
    }
    if (query?.episode_id && Types.ObjectId.isValid(query.episode_id)) {
      filter.episodeId = new Types.ObjectId(query.episode_id);
    }

    const docs = await DentalChairsideImageModel.find(filter)
      .sort({ createdAt: -1 })
      .session(session ?? null)
      .lean();

    return docs.map((d) => this.toDTO(d as DentalChairsideImageFields));
  }

  async listByEpisode(
    episodeId: string,
    session?: ClientSession,
  ): Promise<DentalChairsideImage[]> {
    if (!Types.ObjectId.isValid(episodeId)) return [];

    const docs = await DentalChairsideImageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .session(session ?? null)
      .lean();

    return docs.map((d) => this.toDTO(d as DentalChairsideImageFields));
  }

  async listByPatient(
    patientId: string,
    session?: ClientSession,
  ): Promise<DentalChairsideImage[]> {
    if (!Types.ObjectId.isValid(patientId)) return [];

    const docs = await DentalChairsideImageModel.find({
      patientId: new Types.ObjectId(patientId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .session(session ?? null)
      .lean();

    return docs.map((d) => this.toDTO(d as DentalChairsideImageFields));
  }

  async softDelete(id: string, userId: string, session?: ClientSession): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;

    const result = await DentalChairsideImageModel.updateOne(
      { _id: new Types.ObjectId(id), deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
        },
      },
      { session },
    );

    return result.modifiedCount > 0;
  }
}
