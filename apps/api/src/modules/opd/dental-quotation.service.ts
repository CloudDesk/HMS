import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { RoleModel } from '../roles/role.model.js';
import { ServiceRepository } from '../services/service.repository.js';
import { SettingsRepository } from '../settings/settings.repository.js';
import { UserModel } from '../users/user.model.js';
import { SequenceService } from '../../shared/sequence/sequence.service.js';

const isObjectId = (value: string | null | undefined) =>
  Boolean(value && Types.ObjectId.isValid(value));
import { DentalEpisodeRepository } from './dental-episode.repository.js';
import { DentalStageRepository } from './dental-stage.repository.js';
import {
  type DentalQuotationItemFields,
  type DentalQuotationOptionFields,
  type DentalTreatmentQuotationFields,
} from './dental-quotation.model.js';
import { DentalQuotationRepository } from './dental-quotation.repository.js';
import {
  OpdDentalExaminationModel,
  type DentalTreatmentPlanItemFields,
} from './opd-dental-examination.model.js';
import type {
  AcceptDentalQuotationDTO,
  CreateDentalQuotationDTO,
  CreateDentalQuotationItemDTO,
  CreateDentalQuotationOptionDTO,
  DentalQuotationOption,
  DentalTreatmentQuotation,
  PostponeDentalQuotationDTO,
  RejectDentalQuotationDTO,
  UpdateDentalQuotationDraftDTO,
} from './dental-quotation.types.js';

export class DentalQuotationService {
  constructor(
    private readonly repository: DentalQuotationRepository,
    private readonly episodeRepository: DentalEpisodeRepository,
    private readonly patientRepository: PatientRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly sequenceService: SequenceService,
    private readonly stageRepository?: DentalStageRepository,
  ) {}

  async createDraftQuotation(
    episodeId: string,
    data: CreateDentalQuotationDTO,
    userId: string,
  ): Promise<DentalTreatmentQuotation> {
    this.validateId(episodeId, 'Episode id is invalid');

    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }

    await this.ensureDepartmentAccess(episode.department_id, userId);

    // Resolve currency from settings
    const settings = await this.settingsRepository.get();
    const currency = settings?.localization?.currency ?? 'KES';

    // Doctor resolution
    let doctorId = new Types.ObjectId(episode.primary_doctor_id);
    let doctorName = episode.primary_doctor_name;

    if (data.doctor_id && isObjectId(data.doctor_id)) {
      const doc = await DoctorModel.findOne({
        _id: new Types.ObjectId(data.doctor_id),
        deletedAt: null,
      }).lean();
      if (!doc) {
        throw new AppError('Specified doctor not found', 404, 'DOCTOR_NOT_FOUND');
      }
      doctorId = doc._id;
      doctorName = doc.displayName || `${doc.firstName} ${doc.lastName}`.trim();
    }

    // Process and calculate quotation options and items
    const {
      processedOptions,
      allProcessedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total,
    } = await this.processOptions(
      data.options,
      data.items,
      data.discount_amount,
      data.tax_amount,
    );

    // Generate quotation number
    const seq = await this.sequenceService.getNextSequence('DENTAL_TREATMENT_QUOTATION');
    const quotationNumber = this.sequenceService.formatStandardSequence('DTQ', seq, 5);

    const record: Omit<DentalTreatmentQuotationFields, 'createdAt' | 'updatedAt'> = {
      quotationNumber,
      patientId: new Types.ObjectId(episode.patient_id),
      patientNumber: episode.patient_number,
      patientName: episode.patient_name,
      treatmentEpisodeId: new Types.ObjectId(episode.id),
      treatmentEpisodeNumber: episode.episode_number,
      doctorId,
      doctorName,
      branchId: new Types.ObjectId(episode.branch_id),
      departmentId: new Types.ObjectId(episode.department_id),
      status: 'DRAFT',
      currency,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes: data.notes?.trim() || null,
      validUntil: data.valid_until ? new Date(data.valid_until) : null,
      items: allProcessedItems,
      options: processedOptions,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    };

    const quotation = await this.repository.create(record);

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.created',
      userId,
      {
        quotationId: quotation.id,
        quotationNumber: quotation.quotation_number,
        episodeId: quotation.treatment_episode_id,
        patientId: quotation.patient_id,
        status: quotation.status,
        total: quotation.total,
        currency: quotation.currency,
        itemsCount: quotation.items.length,
        optionsCount: quotation.options.length,
      },
    );

    return quotation;
  }

  async updateDraftQuotation(
    quotationId: string,
    data: UpdateDentalQuotationDraftDTO,
    userId: string,
  ): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');

    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    if (quotation.status !== 'DRAFT') {
      throw new AppError('Only draft quotations can be edited', 400, 'INVALID_STATE');
    }

    await this.ensureDepartmentAccess(quotation.department_id, userId);

    let doctorId = new Types.ObjectId(quotation.doctor_id);
    let doctorName = quotation.doctor_name;

    if (data.doctor_id && isObjectId(data.doctor_id) && data.doctor_id !== quotation.doctor_id) {
      const doc = await DoctorModel.findOne({
        _id: new Types.ObjectId(data.doctor_id),
        deletedAt: null,
      }).lean();
      if (!doc) {
        throw new AppError('Specified doctor not found', 404, 'DOCTOR_NOT_FOUND');
      }
      doctorId = doc._id;
      doctorName = doc.displayName || `${doc.firstName} ${doc.lastName}`.trim();
    }

    const {
      processedOptions,
      allProcessedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total,
    } = await this.processOptions(
      data.options,
      data.items,
      data.discount_amount ?? quotation.discount_amount,
      data.tax_amount ?? quotation.tax_amount,
    );

    const updateData: Partial<DentalTreatmentQuotationFields> = {
      doctorId,
      doctorName,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes: data.notes !== undefined ? (data.notes?.trim() ?? null) : quotation.notes,
      validUntil: data.valid_until !== undefined ? (data.valid_until ? new Date(data.valid_until) : null) : (quotation.valid_until ? new Date(quotation.valid_until) : null),
      items: allProcessedItems,
      options: processedOptions,
      updatedBy: new Types.ObjectId(userId),
    };

    const updated = await this.repository.update(quotationId, updateData);
    if (!updated) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.updated',
      userId,
      {
        quotationId: updated.id,
        quotationNumber: updated.quotation_number,
        episodeId: updated.treatment_episode_id,
        patientId: updated.patient_id,
        status: updated.status,
        total: updated.total,
        currency: updated.currency,
        itemsCount: updated.items.length,
        optionsCount: updated.options.length,
      },
    );

    return updated;
  }

  async sendQuotation(quotationId: string, userId: string): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');
    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    await this.ensureAccess(quotation, userId);

    if (quotation.status !== 'DRAFT' && quotation.status !== 'POSTPONED') {
      throw new AppError(`Cannot send a quotation with status ${quotation.status}`, 400, 'INVALID_STATE');
    }

    const sentAt = new Date();
    const updated = await this.repository.update(quotationId, {
      status: 'SENT',
      sentAt,
      sentBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    if (!updated) {
      throw new AppError('Failed to update quotation status', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.sent',
      userId,
      {
        quotationId: updated.id,
        quotationNumber: updated.quotation_number,
        episodeId: updated.treatment_episode_id,
        patientId: updated.patient_id,
        total: updated.total,
        currency: updated.currency,
        sentAt,
      },
    );

    await this.patientRepository.addTimelineEvent(
      updated.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Quotation Sent (${updated.quotation_number})`,
        description: `Quotation containing ${updated.options.length} treatment option(s) sent to patient for review.`,
      },
      userId,
    );

    return updated;
  }

  async acceptQuotation(
    quotationId: string,
    data: AcceptDentalQuotationDTO,
    userId: string,
  ): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');
    if (!data.selected_option_id) {
      throw new AppError('Selected option id is required', 400, 'VALIDATION_ERROR');
    }

    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    await this.ensureAccess(quotation, userId);

    // Validate state transitions
    if (quotation.status === 'ACCEPTED') {
      if (quotation.selected_option_id === data.selected_option_id) {
        return quotation;
      }
      throw new AppError('Quotation has already been accepted with a different option', 400, 'INVALID_STATE');
    }

    if (quotation.status === 'REJECTED' || quotation.status === 'EXPIRED') {
      throw new AppError(`Cannot accept a quotation with status ${quotation.status}`, 400, 'INVALID_STATE');
    }

    // Find the selected option
    const selectedOption = quotation.options.find(
      (opt) => opt.id === data.selected_option_id,
    );
    if (!selectedOption) {
      throw new AppError(
        'Selected option does not exist in this quotation',
        400,
        'INVALID_OPTION',
      );
    }

    const acceptedAt = new Date();
    const updateData: Partial<DentalTreatmentQuotationFields> = {
      status: 'ACCEPTED',
      selectedOptionId: isObjectId(data.selected_option_id) ? new Types.ObjectId(data.selected_option_id) : null,
      selectedOptionName: selectedOption.name,
      acceptedAt,
      acceptedBy: new Types.ObjectId(userId),
      decisionAt: acceptedAt,
      decisionReason: data.notes?.trim() || null,
      updatedBy: new Types.ObjectId(userId),
    };

    const updated = await this.repository.update(quotationId, updateData);
    if (!updated) {
      throw new AppError('Failed to update quotation status', 500, 'UPDATE_FAILED');
    }

    // Synchronize treatment plan with the selected option and activate stages
    await this.synchronizeTreatmentPlan(quotation.treatment_episode_id, selectedOption, userId, updated.id);

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.accepted',
      userId,
      {
        quotationId: updated.id,
        quotationNumber: updated.quotation_number,
        episodeId: updated.treatment_episode_id,
        patientId: updated.patient_id,
        selectedOptionId: selectedOption.id,
        selectedOptionName: selectedOption.name,
        total: selectedOption.total,
        currency: updated.currency,
        acceptedAt,
      },
    );

    await this.patientRepository.addTimelineEvent(
      updated.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Quotation Accepted (${updated.quotation_number})`,
        description: `Patient accepted ${selectedOption.name} for ${updated.currency} ${selectedOption.total.toFixed(2)}.`,
      },
      userId,
    );

    return updated;
  }

  async rejectQuotation(
    quotationId: string,
    data: RejectDentalQuotationDTO,
    userId: string,
  ): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');
    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    await this.ensureAccess(quotation, userId);

    if (quotation.status === 'ACCEPTED') {
      throw new AppError('Cannot reject a quotation that has already been accepted', 400, 'INVALID_STATE');
    }
    if (quotation.status === 'REJECTED') {
      return quotation;
    }
    if (quotation.status === 'EXPIRED') {
      throw new AppError('Cannot reject an expired quotation', 400, 'INVALID_STATE');
    }

    const decisionAt = new Date();
    const updated = await this.repository.update(quotationId, {
      status: 'REJECTED',
      decisionReason: data.reason?.trim() || 'Patient declined quotation',
      decisionAt,
      updatedBy: new Types.ObjectId(userId),
    });

    if (!updated) {
      throw new AppError('Failed to update quotation status', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.rejected',
      userId,
      {
        quotationId: updated.id,
        quotationNumber: updated.quotation_number,
        episodeId: updated.treatment_episode_id,
        patientId: updated.patient_id,
        reason: updated.decision_reason,
        decisionAt,
      },
    );

    await this.patientRepository.addTimelineEvent(
      updated.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Quotation Rejected (${updated.quotation_number})`,
        description: `Patient declined quotation: ${updated.decision_reason}.`,
      },
      userId,
    );

    return updated;
  }

  async postponeQuotation(
    quotationId: string,
    data: PostponeDentalQuotationDTO,
    userId: string,
  ): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');
    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }

    await this.ensureAccess(quotation, userId);

    if (quotation.status === 'ACCEPTED') {
      throw new AppError('Cannot postpone a quotation that has already been accepted', 400, 'INVALID_STATE');
    }
    if (quotation.status === 'REJECTED') {
      throw new AppError('Cannot postpone a quotation that has been rejected', 400, 'INVALID_STATE');
    }
    if (quotation.status === 'EXPIRED') {
      throw new AppError('Cannot postpone an expired quotation', 400, 'INVALID_STATE');
    }

    const decisionAt = new Date();
    const updated = await this.repository.update(quotationId, {
      status: 'POSTPONED',
      decisionReason: data.reason?.trim() || null,
      decisionAt,
      updatedBy: new Types.ObjectId(userId),
    });

    if (!updated) {
      throw new AppError('Failed to update quotation status', 500, 'UPDATE_FAILED');
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.postponed',
      userId,
      {
        quotationId: updated.id,
        quotationNumber: updated.quotation_number,
        episodeId: updated.treatment_episode_id,
        patientId: updated.patient_id,
        reason: updated.decision_reason,
        decisionAt,
      },
    );

    await this.patientRepository.addTimelineEvent(
      updated.patient_id,
      {
        event_type: 'OPD_DENTAL_EXAMINATION_COMPLETED',
        title: `Dental Treatment Quotation Postponed (${updated.quotation_number})`,
        description: updated.decision_reason
          ? `Decision postponed: ${updated.decision_reason}.`
          : 'Patient postponed decision on treatment quotation.',
      },
      userId,
    );

    return updated;
  }

  private async processItems(
    items: CreateDentalQuotationItemDTO[],
  ): Promise<DentalQuotationItemFields[]> {
    const processedItems: DentalQuotationItemFields[] = [];
    for (const item of items) {
      let unitPrice = 0;
      if (item.service_id && isObjectId(item.service_id)) {
        const service = await this.serviceRepository.getById(item.service_id);
        unitPrice = item.unit_price !== undefined ? item.unit_price : (service?.standard_price ?? 0);
      } else if (item.unit_price !== undefined) {
        unitPrice = item.unit_price;
      }

      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const discountAmount = item.discount_amount && item.discount_amount > 0 ? item.discount_amount : 0;
      const taxAmount = item.tax_amount && item.tax_amount > 0 ? item.tax_amount : 0;
      const lineTotal = Math.max(0, quantity * unitPrice - discountAmount + taxAmount);

      processedItems.push({
        treatmentPlanItemId: item.treatment_plan_item_id ?? null,
        serviceId: item.service_id && isObjectId(item.service_id) ? new Types.ObjectId(item.service_id) : null,
        procedureName: item.procedure_name.trim(),
        toothNumber: item.tooth_number ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxAmount,
        lineTotal,
        notes: item.notes?.trim() ?? null,
      });
    }
    return processedItems;
  }

  private async processOptions(
    options?: CreateDentalQuotationOptionDTO[],
    fallbackItems?: CreateDentalQuotationItemDTO[],
    topDiscount?: number,
    topTax?: number,
  ): Promise<{
    processedOptions: DentalQuotationOptionFields[];
    allProcessedItems: DentalQuotationItemFields[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
  }> {
    if (options && options.length > 0) {
      const processedOptions: DentalQuotationOptionFields[] = [];
      let seq = 1;
      for (const opt of options) {
        const optItems = await this.processItems(opt.items);
        const optSubtotal = optItems.reduce((acc, it) => acc + it.lineTotal, 0);
        const optDiscount = opt.discount_amount ?? 0;
        const optTax = opt.tax_amount ?? 0;
        const optTotal = Math.max(0, optSubtotal - optDiscount + optTax);

        processedOptions.push({
          ...(opt.id && isObjectId(opt.id) ? { _id: new Types.ObjectId(opt.id) } : { _id: new Types.ObjectId() }),
          name: opt.name.trim(),
          description: opt.description?.trim() || null,
          sequence: opt.sequence ?? seq++,
          items: optItems,
          subtotal: optSubtotal,
          discountAmount: optDiscount,
          taxAmount: optTax,
          total: optTotal,
        });
      }

      const primary = processedOptions[0];
      const primaryItems = primary ? primary.items : [];
      const subtotal = primary ? primary.subtotal : 0;
      const discountAmount = primary ? primary.discountAmount : (topDiscount ?? 0);
      const taxAmount = primary ? primary.taxAmount : (topTax ?? 0);
      const total = primary ? primary.total : Math.max(0, subtotal - discountAmount + taxAmount);

      return {
        processedOptions,
        allProcessedItems: primaryItems,
        subtotal,
        discountAmount,
        taxAmount,
        total,
      };
    }

    const items = await this.processItems(fallbackItems ?? []);
    const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
    const discountAmount = topDiscount ?? 0;
    const taxAmount = topTax ?? 0;
    const total = Math.max(0, subtotal - discountAmount + taxAmount);

    const defaultOption: DentalQuotationOptionFields = {
      _id: new Types.ObjectId(),
      name: 'Option A – Standard Plan',
      description: 'Standard quoted treatment plan',
      sequence: 1,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };

    return {
      processedOptions: [defaultOption],
      allProcessedItems: items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  }

  private async synchronizeTreatmentPlan(
    episodeId: string,
    selectedOption: DentalQuotationOption,
    userId: string,
    quotationId?: string,
  ): Promise<void> {
    const episodeObjectId = new Types.ObjectId(episodeId);
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) return;

    const examFilter = {
      $or: [
        { episodeId: episodeObjectId },
        { visitId: { $in: episode.visit_ids.map((v) => new Types.ObjectId(v)) } },
        { visitId: new Types.ObjectId(episode.originating_visit_id) },
      ],
      deletedAt: null,
    };

    const exam = await OpdDentalExaminationModel.findOne(examFilter).sort({ updatedAt: -1 });
    if (!exam) return;

    const currentPlanItems: DentalTreatmentPlanItemFields[] = exam.treatmentPlanItems ?? [];
    const synchronizedPlanItemIds: string[] = [];

    for (const optItem of selectedOption.items) {
      let matchedIndex = -1;

      // 1. Try matching by treatmentPlanItemId if specified
      if (optItem.treatment_plan_item_id) {
        matchedIndex = currentPlanItems.findIndex(
          (pi) => pi._id?.toString() === optItem.treatment_plan_item_id,
        );
      }

      // 2. Try matching by serviceId + toothNumber
      if (matchedIndex === -1 && optItem.service_id) {
        matchedIndex = currentPlanItems.findIndex(
          (pi) =>
            pi.serviceId?.toString() === optItem.service_id &&
            (pi.toothNumber ?? null) === (optItem.tooth_number ?? null),
        );
      }

      // 3. Try matching by procedureName + toothNumber
      if (matchedIndex === -1 && optItem.procedure_name) {
        matchedIndex = currentPlanItems.findIndex(
          (pi) =>
            pi.procedureName.toLowerCase().trim() === optItem.procedure_name.toLowerCase().trim() &&
            (pi.toothNumber ?? null) === (optItem.tooth_number ?? null),
        );
      }

      if (matchedIndex !== -1 && currentPlanItems[matchedIndex]) {
        const existing = currentPlanItems[matchedIndex]!;
        existing.status = 'ACCEPTED';
        existing.estimatedCost = optItem.unit_price;
        if (optItem.tooth_number !== undefined) {
          existing.toothNumber = optItem.tooth_number ?? null;
        }
        if (optItem.service_id && !existing.serviceId) {
          existing.serviceId = optItem.service_id;
        }
        if (existing._id) {
          synchronizedPlanItemIds.push(existing._id.toString());
        }
      } else {
        const newId = new Types.ObjectId();
        currentPlanItems.push({
          _id: newId,
          serviceId: optItem.service_id ?? null,
          toothNumber: optItem.tooth_number ?? null,
          procedureName: optItem.procedure_name,
          surfaces: [],
          priority: 'ROUTINE',
          estimatedCost: optItem.unit_price,
          notes: optItem.notes ?? null,
          status: 'ACCEPTED',
        });
        synchronizedPlanItemIds.push(newId.toString());
      }
    }

    exam.treatmentPlanItems = currentPlanItems;
    exam.updatedBy = new Types.ObjectId(userId);
    await exam.save();

    // Treatment Stage Activation / Linking
    const createdStageIds: string[] = [];
    if (this.stageRepository && episode.status !== 'COMPLETED' && episode.status !== 'CANCELLED') {
      for (const planItemId of synchronizedPlanItemIds) {
        const existingStages = await this.stageRepository.listByPlanItem(episodeId, planItemId);
        if (existingStages.length === 0) {
          const item = currentPlanItems.find((pi) => pi._id?.toString() === planItemId);
          if (item) {
            const createdStage = await this.stageRepository.create({
              episodeId: new Types.ObjectId(episode.id),
              planItemId,
              toothNumber: item.toothNumber ?? null,
              serviceId: item.serviceId && isObjectId(item.serviceId) ? new Types.ObjectId(item.serviceId) : null,
              stageName: item.procedureName,
              sequence: 1,
              assignedDoctorId: new Types.ObjectId(episode.primary_doctor_id),
              assignedDoctorName: episode.primary_doctor_name,
              status: 'PLANNED',
              branchId: new Types.ObjectId(episode.branch_id),
              departmentId: new Types.ObjectId(episode.department_id),
              patientId: new Types.ObjectId(episode.patient_id),
              createdBy: new Types.ObjectId(userId),
              updatedBy: new Types.ObjectId(userId),
            });
            createdStageIds.push(createdStage.id);
          }
        }
      }
    }

    await this.patientRepository.auditClinicalEvent(
      'opd.dental_quotation.treatment_activated',
      userId,
      {
        quotationId: quotationId ?? null,
        selectedOptionId: selectedOption.id,
        selectedOptionName: selectedOption.name,
        episodeId,
        patientId: episode.patient_id,
        planItemIds: synchronizedPlanItemIds,
        createdStageIds,
      },
    );
  }

  async getQuotation(quotationId: string, userId: string): Promise<DentalTreatmentQuotation> {
    this.validateId(quotationId, 'Quotation id is invalid');
    const quotation = await this.repository.getById(quotationId);
    if (!quotation) {
      throw new AppError('Dental treatment quotation not found', 404, 'NOT_FOUND');
    }
    await this.ensureAccess(quotation, userId);
    return quotation;
  }

  async listQuotationsByEpisode(
    episodeId: string,
    userId: string,
  ): Promise<DentalTreatmentQuotation[]> {
    this.validateId(episodeId, 'Episode id is invalid');
    const episode = await this.episodeRepository.getById(episodeId);
    if (!episode) {
      throw new AppError('Dental treatment episode not found', 404, 'EPISODE_NOT_FOUND');
    }
    await this.ensureDepartmentAccess(episode.department_id, userId);
    return await this.repository.listByEpisode(episodeId);
  }

  async listQuotationsByPatient(
    patientId: string,
    userId: string,
  ): Promise<DentalTreatmentQuotation[]> {
    this.validateId(patientId, 'Patient id is invalid');
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('patientId roleIds departmentIds')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    if (user.patientId && user.patientId.toString() !== patientId) {
      throw new AppError('You are not authorized to view this patient\'s quotations', 403, 'FORBIDDEN');
    }

    return await this.repository.listByPatient(patientId);
  }

  private validateId(value: string | null | undefined, message: string): void {
    if (!isObjectId(value)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private async ensureAccess(quotation: DentalTreatmentQuotation, userId: string): Promise<void> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('branchIds departmentIds roleIds patientId')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // If user is a patient user:
    if (user.patientId) {
      if (user.patientId.toString() !== quotation.patient_id) {
        throw new AppError('You are not authorized to access this patient quotation', 403, 'FORBIDDEN');
      }
      return;
    }

    // If staff user:
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
      if (!allowedDeptIds.includes(quotation.department_id)) {
        throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
      }
    }
  }

  private async ensureDepartmentAccess(departmentId: string, userId: string): Promise<void> {
    const user = await UserModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('branchIds departmentIds roleIds')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
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
      if (!allowedDeptIds.includes(departmentId)) {
        throw new AppError('Department access denied', 403, 'DEPARTMENT_ACCESS_DENIED');
      }
    }
  }
}
