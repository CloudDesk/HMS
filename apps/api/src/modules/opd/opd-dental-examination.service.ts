import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { BillingRepository } from '../billing/billing.repository.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import { ServiceRepository } from '../services/service.repository.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import type { OpdConsultationRepository } from './opd-consultation.repository.js';
import type { OpdDentalExaminationRepository } from './opd-dental-examination.repository.js';
import type {
  OpdDentalExamination,
  SaveOpdDentalExaminationDTO,
} from './opd-dental-examination.types.js';
import type { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';
import { isValidFdiTooth } from './opd-dental-examination.schemas.js';

const terminalVisitStatuses: OpdVisit['status'][] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const DENTAL_KEYWORDS_REGEX =
  /dental|dentist|dentistry|orthodont|endodont|periodont|pedodont|prosthodont|oral/i;

export const isDentalClinicalContext = (
  doctorSpecialization: string,
  department?: { code: string; name: string },
) =>
  DENTAL_KEYWORDS_REGEX.test(doctorSpecialization) ||
  Boolean(
    department &&
      (DENTAL_KEYWORDS_REGEX.test(department.name) ||
        DENTAL_KEYWORDS_REGEX.test(department.code) ||
        department.code.toUpperCase().includes('DENT')),
  );

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));

export class OpdDentalExaminationService {
  constructor(
    private readonly repository: OpdDentalExaminationRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly consultationRepository: OpdConsultationRepository,
    private readonly patientRepository: PatientRepository,
    private readonly serviceRepository = new ServiceRepository(),
    private readonly billingRepository = new BillingRepository(),
  ) {}

  async getByVisit(visitId: string, userId: string): Promise<OpdDentalExamination | null> {
    const visit = await this.getVisit(visitId, userId);
    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    return this.repository.getByVisit(visitId);
  }

  async validateAssessment(visit: OpdVisit, assessment: string | null | undefined, userId: string) {
    try {
      await this.ensureDentalContext(visit);
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_DENTAL_VISIT') return;
      throw error;
    }
    await this.ensureDepartmentAccess(visit, userId);
    if (assessment === undefined) return;
    for (const tag of (assessment ?? '').matchAll(/\[Tooth #([^\]]*)\]/gi)) {
      if (!/^\d{2}$/.test(tag[1] ?? '') || !isValidFdiTooth(Number(tag[1]))) {
        throw new AppError(
          'Diagnosis contains an invalid FDI tooth number',
          400,
          'VALIDATION_ERROR',
        );
      }
    }
    const examination = await this.repository.getByVisit(visit.id);
    if (examination?.status === 'COMPLETED') {
      const consultation = await this.consultationRepository.getByVisit(visit.id);
      if ((assessment?.trim() ?? '') !== (consultation?.assessment?.trim() ?? '')) {
        throw new AppError(
          'Diagnoses for a completed dental examination cannot be modified',
          400,
          'EXAMINATION_COMPLETED',
        );
      }
    }
  }

  async saveDraft(
    visitId: string,
    data: SaveOpdDentalExaminationDTO,
    userId: string,
  ): Promise<OpdDentalExamination> {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);
    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    const existing = await this.repository.getByVisit(visitId);
    if (existing?.status === 'COMPLETED') {
      throw new AppError(
        'A completed dental examination cannot be modified',
        400,
        'EXAMINATION_COMPLETED',
      );
    }

    await this.validateTreatmentItemOwnership(data, existing);
    await this.validateTreatmentServices(data, visit);
    return this.writeClinicalState(async (session) => {
      const consultation = await this.getOrCreateConsultation(visit, userId, session);

      const examination = await this.repository.saveForVisit(
        {
          ...data,
          visit,
          consultationId: consultation?.id,
          status: 'DRAFT',
        },
        userId,
        session,
      );

      if (visit.status === 'READY_FOR_CONSULTATION') {
        await this.visitRepository.updateStatus(
          visit.id,
          {
            notes: 'Dental consultation examination in progress.',
            status: 'IN_CONSULTATION',
          },
          userId,
          undefined,
          session,
        );
      }

      await this.patientRepository.auditClinicalEvent(
        'opd.dental_examination.saved',
        userId,
        {
          examinationId: examination.id,
          patientId: visit.patient_id,
          visitId: visit.id,
          visitNumber: visit.visit_number,
          branchId: visit.branch_id,
          departmentId: visit.department_id,
          doctorId: visit.doctor_id,
          status: 'DRAFT',
        },
        session,
      );

      return examination;
    });
  }

  async complete(
    visitId: string,
    data: SaveOpdDentalExaminationDTO,
    userId: string,
  ): Promise<OpdDentalExamination> {
    const visit = await this.getVisit(visitId, userId);
    this.ensureOpenVisit(visit);
    this.ensureConsultationReady(visit);
    await this.ensureDentalContext(visit);
    await this.ensureDepartmentAccess(visit, userId);

    const existing = await this.repository.getByVisit(visitId);
    if (existing?.status === 'COMPLETED') {
      throw new AppError(
        'A completed dental examination cannot be modified',
        400,
        'EXAMINATION_COMPLETED',
      );
    }

    const effectiveExaminationData: SaveOpdDentalExaminationDTO = {
      dental_history:
        data.dental_history !== undefined ? data.dental_history : existing?.dental_history,
      soft_tissue: data.soft_tissue !== undefined ? data.soft_tissue : existing?.soft_tissue,
      teeth: data.teeth ?? existing?.teeth ?? [],
      treatment_plan_items: data.treatment_plan_items ?? existing?.treatment_plan_items ?? [],
    };

    this.validateClinicalCompleteness(effectiveExaminationData);
    await this.validateTreatmentItemOwnership(effectiveExaminationData, existing);
    await this.validateTreatmentServices(effectiveExaminationData, visit);

    return this.writeClinicalState(async (session) => {
      const consultation = await this.getOrCreateConsultation(visit, userId, session);

      const examination = await this.repository.saveForVisit(
        {
          ...effectiveExaminationData,
          expected_updated_at: data.expected_updated_at ?? existing?.updated_at.toISOString(),
          visit,
          consultationId: consultation?.id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        userId,
        session,
      );

      if (visit.status === 'READY_FOR_CONSULTATION') {
        await this.visitRepository.updateStatus(
          visit.id,
          {
            notes: 'Dental consultation completed.',
            status: 'IN_CONSULTATION',
          },
          userId,
          undefined,
          session,
        );
      }

      await this.patientRepository.addTimelineEvent(
        visit.patient_id,
        {
          event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
          title: 'Dental examination completed',
          description: `${visit.visit_number}: Dental examination completed by ${visit.doctor_name}.`,
        },
        userId,
        session,
      );

      await this.patientRepository.auditClinicalEvent(
        'opd.dental_examination.completed',
        userId,
        {
          examinationId: examination.id,
          patientId: visit.patient_id,
          visitId: visit.id,
          visitNumber: visit.visit_number,
          branchId: visit.branch_id,
          departmentId: visit.department_id,
          doctorId: visit.doctor_id,
          status: 'COMPLETED',
        },
        session,
      );

      return examination;
    });
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

  private async writeClinicalState(
    work: (session: ClientSession) => Promise<OpdDentalExamination>,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await mongoose.connection.transaction(work);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) {
          throw error;
        }
        if (attempt === 2)
          throw new AppError(
            'Dental examination changed. Reload before retrying.',
            409,
            'EXAMINATION_CONFLICT',
          );
      }
    }
    throw new AppError(
      'Dental examination changed. Reload before retrying.',
      409,
      'EXAMINATION_CONFLICT',
    );
  }

  private async validateTreatmentServices(data: SaveOpdDentalExaminationDTO, visit: OpdVisit) {
    const serviceIds = new Set(
      (data.treatment_plan_items ?? []).flatMap((item) =>
        item.service_id ? [item.service_id] : [],
      ),
    );
    for (const serviceId of serviceIds) {
      this.validateId(serviceId, 'Service id is invalid');
      const service = await this.serviceRepository.getById(serviceId);
      if (
        !service ||
        service.status !== 'ACTIVE' ||
        service.service_type !== 'PROCEDURE' ||
        service.department_id !== visit.department_id
      ) {
        throw new AppError(
          'The selected procedure is unavailable or does not belong to this visit department. Review the treatment plan.',
          400,
          'INVALID_DENTAL_SERVICE',
        );
      }
    }
  }

  private async validateTreatmentItemOwnership(
    data: SaveOpdDentalExaminationDTO,
    existing: OpdDentalExamination | null,
  ) {
    if (data.treatment_plan_items === undefined) return;

    const existingItemsById = new Map(
      (existing?.treatment_plan_items ?? []).flatMap((item) =>
        item.id ? [[item.id, item] as const] : [],
      ),
    );
    for (const item of data.treatment_plan_items) {
      if (item.id && !existingItemsById.has(item.id)) {
        throw new AppError(
          'Dental treatment item does not belong to this examination',
          409,
          'DENTAL_TREATMENT_ITEM_CONTEXT_MISMATCH',
        );
      }
    }

    const existingIds = [...existingItemsById.keys()];
    const billedItems = await this.billingRepository.listDentalTreatmentBillingStates(existingIds);
    if (billedItems.length === 0) return;

    const submittedItemsById = new Map(
      data.treatment_plan_items.flatMap((item) => (item.id ? [[item.id, item] as const] : [])),
    );
    for (const billingState of billedItems) {
      const existingItem = existingItemsById.get(billingState.treatment_item_id);
      const submittedItem = submittedItemsById.get(billingState.treatment_item_id);
      if (
        !existingItem ||
        !submittedItem ||
        submittedItem.service_id !== existingItem.service_id ||
        submittedItem.tooth_number !== existingItem.tooth_number
      ) {
        throw new AppError(
          'An invoiced Dental treatment item cannot be removed or reassigned',
          409,
          'BILLED_DENTAL_TREATMENT_IMMUTABLE',
        );
      }
    }
  }

  private ensureOpenVisit(visit: OpdVisit) {
    if (terminalVisitStatuses.includes(visit.status)) {
      throw new AppError(
        'Dental examination cannot be updated for a closed OPD visit',
        400,
        'VISIT_CLOSED',
      );
    }
  }

  private ensureConsultationReady(visit: OpdVisit) {
    if (
      !['READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'CHECKED_IN', 'WAITING_FOR_VITALS'].includes(
        visit.status,
      )
    ) {
      throw new AppError(
        'Visit is not in an active consultation state',
        400,
        'VISIT_NOT_READY_FOR_CONSULTATION',
      );
    }
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

  private validateClinicalCompleteness(data: SaveOpdDentalExaminationDTO) {
    const hasHistory =
      data.dental_history &&
      (Boolean(data.dental_history.chief_complaint?.trim()) ||
        typeof data.dental_history.pain_scale === 'number' ||
        Boolean(data.dental_history.bleeding_gums) ||
        Boolean(data.dental_history.sensitivity_hot_cold_sweet) ||
        Boolean(data.dental_history.bruxism) ||
        (data.dental_history.habits && data.dental_history.habits.length > 0) ||
        (data.dental_history.medical_alerts && data.dental_history.medical_alerts.length > 0));

    const hasSoftTissue =
      data.soft_tissue &&
      (Boolean(data.soft_tissue.gingiva_condition?.trim()) ||
        Boolean(data.soft_tissue.calculus_plaque?.trim()) ||
        Boolean(data.soft_tissue.oral_mucosa?.trim()) ||
        Boolean(data.soft_tissue.tongue_palate_floor?.trim()) ||
        Boolean(data.soft_tissue.tmj_evaluation?.trim()) ||
        Boolean(data.soft_tissue.occlusion_class?.trim()));

    const hasTeeth = Array.isArray(data.teeth) && data.teeth.length > 0;
    const hasTreatmentPlan =
      Array.isArray(data.treatment_plan_items) && data.treatment_plan_items.length > 0;

    if (!hasHistory && !hasSoftTissue && !hasTeeth && !hasTreatmentPlan) {
      throw new AppError(
        'At least one clinical dental finding, soft tissue evaluation, tooth assessment, or treatment plan item is required to complete the examination',
        400,
        'DENTAL_FINDINGS_REQUIRED',
      );
    }
  }

  private async getOrCreateConsultation(visit: OpdVisit, userId: string, session?: ClientSession) {
    let consultation = await this.consultationRepository.getByVisit(visit.id, session);
    if (!consultation) {
      consultation = await this.consultationRepository.saveForVisit(
        {
          status: 'DRAFT',
          visit,
        },
        userId,
        session,
      );
    }
    return consultation;
  }

  private validateId(id: string | null | undefined, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
