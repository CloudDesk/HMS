import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { DentalEpisodeRepository } from './dental-episode.repository.js';
import type {
  CreateDentalEpisodeDTO,
  DentalEpisodeStatus,
  DentalTreatmentEpisode,
  HistoricalToothFinding,
} from './dental-episode.types.js';
import { isDentalClinicalContext } from './opd-dental-examination.service.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));

export class DentalEpisodeService {
  constructor(
    private readonly repository: DentalEpisodeRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly patientRepository: PatientRepository,
    private readonly sequenceService: SequenceService,
  ) {}

  async createEpisode(
    data: CreateDentalEpisodeDTO,
    userId: string,
  ): Promise<DentalTreatmentEpisode> {
    this.validateId(data.patient_id, 'Patient id is invalid');
    this.validateId(data.originating_visit_id, 'Originating visit id is invalid');

    const visit = await this.getVisit(data.originating_visit_id, userId);
    if (visit.patient_id !== data.patient_id) {
      throw new AppError('Visit does not belong to specified patient', 400, 'VALIDATION_ERROR');
    }

    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    const activeEpisode = await this.repository.getActiveEpisodeForPatient(data.patient_id);
    if (activeEpisode) {
      throw new AppError(
        `Patient already has an active Dental Treatment Episode (${activeEpisode.episode_number})`,
        409,
        'ACTIVE_EPISODE_EXISTS',
      );
    }

    const seq = await this.sequenceService.getNextSequence('DENTAL_TREATMENT_EPISODE');
    const episodeNumber = this.sequenceService.formatStandardSequence('DTE', seq, 5);

    const episode = await this.repository.create({
      episodeNumber,
      patientId: new Types.ObjectId(visit.patient_id),
      patientNumber: visit.patient_number,
      patientName: visit.patient_name,
      originatingVisitId: new Types.ObjectId(visit.id),
      originatingVisitNumber: visit.visit_number,
      primaryDoctorId: new Types.ObjectId(visit.doctor_id),
      primaryDoctorName: visit.doctor_name,
      branchId: new Types.ObjectId(visit.branch_id),
      departmentId: new Types.ObjectId(visit.department_id),
      primaryToothNumber: data.primary_tooth_number ?? null,
      diagnosisCode: data.diagnosis_code?.trim() || null,
      diagnosisName: data.diagnosis_name?.trim() || null,
      treatmentPlanSummary: data.treatment_plan_summary?.trim() || null,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visit.id)],
      notes: data.notes?.trim() || null,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_episode.created',
      userId,
      {
        episodeId: episode.id,
        episodeNumber: episode.episode_number,
        patientId: episode.patient_id,
        originatingVisitId: episode.originating_visit_id,
        status: episode.status,
      },
    );

    await this.patientRepository.addTimelineEvent(
      episode.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Episode Created (${episode.episode_number})`,
        description: `Episode initiated by Dr. ${episode.primary_doctor_name} for Visit ${visit.visit_number}${
          episode.primary_tooth_number ? ` on Tooth #${episode.primary_tooth_number}` : ''
        }.`,
      },
      userId,
    );

    return episode;
  }

  async getById(id: string): Promise<DentalTreatmentEpisode> {
    this.validateId(id, 'Episode id is invalid');
    const episode = await this.repository.getById(id);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'NOT_FOUND');
    }

    return episode;
  }

  async listByPatient(
    patientId: string,
    status?: DentalEpisodeStatus,
  ): Promise<DentalTreatmentEpisode[]> {
    this.validateId(patientId, 'Patient id is invalid');
    return this.repository.listByPatient(patientId, status);
  }

  async getActiveEpisodeForPatient(
    patientId: string,
  ): Promise<DentalTreatmentEpisode | null> {
    this.validateId(patientId, 'Patient id is invalid');
    return this.repository.getActiveEpisodeForPatient(patientId);
  }

  async linkVisitToEpisode(
    episodeId: string,
    visitId: string,
    userId: string,
  ): Promise<DentalTreatmentEpisode> {
    this.validateId(episodeId, 'Episode id is invalid');
    this.validateId(visitId, 'Visit id is invalid');

    const episode = await this.repository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'NOT_FOUND');
    }

    if (episode.status === 'COMPLETED' || episode.status === 'CANCELLED') {
      throw new AppError(
        'Cannot link visits to a closed or cancelled dental episode',
        400,
        'EPISODE_CLOSED',
      );
    }

    const visit = await this.getVisit(visitId, userId);
    if (visit.patient_id !== episode.patient_id) {
      throw new AppError(
        'Visit patient does not match episode patient',
        400,
        'PATIENT_MISMATCH',
      );
    }

    await this.ensureDentalContext(visit);

    const updated = await this.repository.addVisitToEpisode(episodeId, visitId, userId);
    if (!updated) {
      throw new AppError('Failed to link visit to episode', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_episode.visit_linked',
      userId,
      {
        episodeId,
        visitId,
        visitNumber: visit.visit_number,
      },
    );

    return updated;
  }

  async updateStatus(
    episodeId: string,
    status: DentalEpisodeStatus,
    userId: string,
    notes?: string | null,
  ): Promise<DentalTreatmentEpisode> {
    this.validateId(episodeId, 'Episode id is invalid');

    const episode = await this.repository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'NOT_FOUND');
    }

    const validTransitions: Record<DentalEpisodeStatus, DentalEpisodeStatus[]> = {
      ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
      ON_HOLD: ['ACTIVE', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (episode.status !== status && !validTransitions[episode.status].includes(status)) {
      throw new AppError(
        `Cannot transition dental episode from ${episode.status} to ${status}`,
        400,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const updated = await this.repository.updateStatus(
      episodeId,
      status,
      userId,
      notes,
    );

    if (!updated) {
      throw new AppError('Failed to update dental episode', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_episode.status_updated',
      userId,
      {
        episodeId,
        previousStatus: episode.status,
        newStatus: status,
        notes,
      },
    );

    return updated;
  }

  async getHistoricalToothFindings(
    patientId: string,
    excludeVisitId?: string,
  ): Promise<HistoricalToothFinding[]> {
    this.validateId(patientId, 'Patient id is invalid');
    if (excludeVisitId) {
      this.validateId(excludeVisitId, 'Exclude visit id is invalid');
    }

    return this.repository.getHistoricalToothFindings(patientId, excludeVisitId);
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
