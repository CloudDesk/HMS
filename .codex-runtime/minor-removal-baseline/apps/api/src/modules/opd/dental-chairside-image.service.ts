import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { DentalChairsideImageRepository } from './dental-chairside-image.repository.js';
import type {
  ChairsideImageListQuery,
  CreateChairsideImageDTO,
  DentalChairsideImage,
} from './dental-chairside-image.types.js';
import { DentalEpisodeRepository } from './dental-episode.repository.js';
import { OpdDentalExaminationRepository } from './opd-dental-examination.repository.js';
import { isDentalClinicalContext } from './opd-dental-examination.service.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
];

export class DentalChairsideImageService {
  constructor(
    private readonly repository: DentalChairsideImageRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly patientRepository: PatientRepository,
    private readonly storageService: PatientDocumentStorageService,
    private readonly episodeRepository = new DentalEpisodeRepository(),
    private readonly examinationRepository = new OpdDentalExaminationRepository(),
  ) {}

  async uploadChairsideImage(
    visitId: string,
    data: CreateChairsideImageDTO,
    userId: string,
  ): Promise<DentalChairsideImage> {
    this.validateId(visitId, 'Visit id is invalid');

    const visit = await this.getVisit(visitId, userId);
    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    if (!data.data || data.data.length === 0) {
      throw new AppError('Image file data is required', 400, 'VALIDATION_ERROR');
    }

    if (data.mime_type && !ALLOWED_MIME_TYPES.includes(data.mime_type.toLowerCase())) {
      throw new AppError(
        `Unsupported image format: ${data.mime_type}. Supported formats: JPEG, PNG, WEBP, GIF, BMP`,
        400,
        'INVALID_IMAGE_FORMAT',
      );
    }

    let episodeId: Types.ObjectId | null = null;
    let episodeNumber: string | null = null;

    if (data.episode_id && Types.ObjectId.isValid(data.episode_id)) {
      const episode = await this.episodeRepository.getById(data.episode_id);
      if (episode && episode.patient_id === visit.patient_id) {
        episodeId = new Types.ObjectId(episode.id);
        episodeNumber = episode.episode_number;
      }
    } else {
      const activeEpisode = await this.episodeRepository.getActiveEpisodeForPatient(visit.patient_id);
      if (activeEpisode) {
        episodeId = new Types.ObjectId(activeEpisode.id);
        episodeNumber = activeEpisode.episode_number;
      }
    }

    const exam = await this.examinationRepository.getByVisit(visit.id);
    const examinationId = exam ? new Types.ObjectId(exam.id) : null;

    const { storageKey } = await this.storageService.uploadPatientDocument({
      patientId: visit.patient_id,
      fileName: data.file_name,
      mimeType: data.mime_type,
      data: data.data,
    });

    const chairsideImage = await this.repository.create({
      patientId: new Types.ObjectId(visit.patient_id),
      patientNumber: visit.patient_number,
      patientName: visit.patient_name,
      visitId: new Types.ObjectId(visit.id),
      visitNumber: visit.visit_number,
      episodeId,
      episodeNumber,
      examinationId,
      toothNumber: data.tooth_number ?? null,
      imagingSource: 'CHAIRSIDE',
      fileName: data.file_name,
      mimeType: data.mime_type,
      fileSizeBytes: data.file_size_bytes || data.data.length,
      storageKey,
      notes: data.notes?.trim() || null,
      doctorId: new Types.ObjectId(visit.doctor_id),
      doctorName: visit.doctor_name,
      branchId: new Types.ObjectId(visit.branch_id),
      departmentId: new Types.ObjectId(visit.department_id),
      createdBy: new Types.ObjectId(userId),
    });

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_chairside_imaging.created',
      userId,
      {
        chairsideImageId: chairsideImage.id,
        patientId: visit.patient_id,
        visitId: visit.id,
        visitNumber: visit.visit_number,
        episodeId: episodeId?.toString() ?? null,
        toothNumber: data.tooth_number ?? null,
        fileName: data.file_name,
        mimeType: data.mime_type,
        fileSizeBytes: data.file_size_bytes || data.data.length,
      },
    );

    await this.patientRepository.addTimelineEvent(
      visit.patient_id,
      {
        event_type: 'DOCUMENT_ADDED',
        title: `Chairside Dental Image Saved (${data.file_name})`,
        description: `Chairside image captured by Dr. ${visit.doctor_name} for Visit ${visit.visit_number}${
          data.tooth_number ? ` on Tooth #${data.tooth_number}` : ''
        }.`,
      },
      userId,
    );

    return chairsideImage;
  }

  async listByVisit(
    visitId: string,
    query: ChairsideImageListQuery,
    userId: string,
  ): Promise<DentalChairsideImage[]> {
    this.validateId(visitId, 'Visit id is invalid');
    const visit = await this.getVisit(visitId, userId);
    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    return this.repository.listByVisit(visitId, query);
  }

  async listByEpisode(episodeId: string): Promise<DentalChairsideImage[]> {
    this.validateId(episodeId, 'Episode id is invalid');
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'NOT_FOUND');
    }

    return this.repository.listByEpisode(episodeId);
  }

  async downloadImage(
    id: string,
    userId: string,
  ): Promise<{ image: DentalChairsideImage; data: Buffer; contentType: string }> {
    this.validateId(id, 'Image id is invalid');
    const image = await this.repository.getById(id);
    if (!image) {
      throw new AppError('Chairside image not found', 404, 'NOT_FOUND');
    }

    const visit = await this.getVisit(image.visit_id, userId);
    await this.ensureDepartmentAccess(visit, userId);

    const download = await this.storageService.download(image.storage_key);

    return {
      image,
      data: download.data,
      contentType: image.mime_type || download.contentType || 'image/jpeg',
    };
  }

  async deleteImage(id: string, userId: string): Promise<boolean> {
    this.validateId(id, 'Image id is invalid');
    const image = await this.repository.getById(id);
    if (!image) {
      throw new AppError('Chairside image not found', 404, 'NOT_FOUND');
    }

    const visit = await this.getVisit(image.visit_id, userId);
    await this.ensureDepartmentAccess(visit, userId);

    const deleted = await this.repository.softDelete(id, userId);

    if (deleted) {
      await this.patientRepository.auditClinicalEvent(
        'opd.dental_chairside_imaging.deleted',
        userId,
        {
          chairsideImageId: id,
          patientId: image.patient_id,
          visitId: image.visit_id,
          fileName: image.file_name,
        },
      );
    }

    return deleted;
  }

  private async getVisit(visitId: string, userId: string): Promise<OpdVisit> {
    this.validateId(visitId, 'OPD visit id is invalid');
    const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope);

    if (!visit) {
      throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    }

    return visit;
  }

  private async ensureDepartmentAccess(visit: OpdVisit, userId: string) {
    const user = await UserModel.findOne({
      _id: userId,
      status: 'active',
      deletedAt: null,
    })
      .select('departmentIds roleIds')
      .lean();

    if (!user) {
      throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');
    }

    const isSuperAdmin = Boolean(
      await RoleModel.exists({
        _id: { $in: user.roleIds ?? [] },
        code: 'SUPER_ADMIN',
        status: 'active',
        deletedAt: null,
      }),
    );
    if (isSuperAdmin) return;

    if (user.departmentIds && user.departmentIds.length > 0) {
      const allowedDeptIds = user.departmentIds.map((id) => id.toString());
      if (!allowedDeptIds.includes(visit.department_id)) {
        throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
      }
    }

    const doctor = await DoctorModel.findOne({
      userId: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('departmentId branchId')
      .lean();

    if (doctor) {
      if (doctor.branchId && doctor.branchId.toString() !== visit.branch_id) {
        throw new AppError('Doctor branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      }
      if (doctor.departmentId && doctor.departmentId.toString() !== visit.department_id) {
        throw new AppError('Doctor department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
      }
    }
  }

  private async ensureDentalContext(visit: OpdVisit) {
    if (isDentalClinicalContext(visit.doctor_specialization)) {
      return;
    }

    if (visit.department_id && Types.ObjectId.isValid(visit.department_id)) {
      const department = await DepartmentModel.findOne({
        _id: new Types.ObjectId(visit.department_id),
        deletedAt: null,
      })
        .select('code name')
        .lean();

      if (department && isDentalClinicalContext(visit.doctor_specialization, department)) {
        return;
      }
    }

    throw new AppError(
      'OPD visit is not associated with Dental department or specialization',
      400,
      'NOT_DENTAL_VISIT',
    );
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
