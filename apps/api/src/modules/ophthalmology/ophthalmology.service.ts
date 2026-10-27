import { comparisonUnitsSchema, resultComparisonProblem } from './ophthalmology-result-comparison.js';
import { subSpecialityValuesSchema } from './ophthalmology-sub-speciality.contract.js';
import { clinicalCorrectionSchema } from './ophthalmology-clinical-correction.js';
import type { OphthalmologyAssignmentLookupQuery, OphthalmologyStation } from './ophthalmology.types.js';
import { createHash } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';
import { executeRequiredTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import type { OpdConsultationRepository } from '../opd/opd-consultation.repository.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { OpdVisit, OpdVisitType } from '../opd/opd-visit.types.js';
import type { NotificationService } from '../notifications/notification.service.js';
import type { OphthalmologyRepository } from './ophthalmology.repository.js';
import { assertOphthalmologyLaterality } from './ophthalmology-laterality.js';
import { profileSupportsForm, validateCoreTestPayload } from './ophthalmology-core-test-contract.js';
import type {
  CreateOphthalmologyConfigurationDTO,
  CreateOphthalmologyContextDTO,
  CreateOphthalmologyStationDTO,
  CreateOphthalmologyWorkflowProfileDTO,
  AcknowledgeOphthalmologyAlertDTO,
  ClearOphthalmologyEmergencyAlertDTO,
  EscalateOphthalmologyEmergencyDTO,
  OphthalmologyPatientJourneyStatus,
  CompleteOphthalmologyIntakeDTO,
  OphthalmologyConfigurationListQuery,
  OphthalmologyContext,
  OphthalmologyConfiguration,
  OphthalmologyIntake,
  OphthalmologyRequestMetadata,
  OphthalmologyStationListQuery,
  OphthalmologyVisitSubtype,
  OphthalmologyWorkflowProfileListQuery,
  OphthalmologyWorkflowStatus,
  OphthalmologyTestTask,
  OphthalmologyTestTaskListQuery,
  OphthalmologyClinicalReview,
  OphthalmologyTreatmentPlanActionType,
  OphthalmologyTreatmentPlanStatus,
  OphthalmologyOpticalPrescription,
  CreateOphthalmologyTestTaskDTO,
  AssignOphthalmologyTestTaskDTO,
  ReassignOphthalmologyTestTaskDTO,
  TaskStateActionDTO,
  ReasonedTaskStateActionDTO,
  StartOphthalmologyTestTaskDTO,
  RepeatOphthalmologyTestTaskDTO,
  RouteOphthalmologyTestTaskDTO,
  RouteOphthalmologyEmergencyDTO,
  SaveOphthalmologyIntakeDraftDTO,
  UpdateOphthalmologyConfigurationDTO,
  UpdateOphthalmologyContextDTO,
  UpdateOphthalmologyStationDTO,
  UpdateOphthalmologyWorkflowProfileDTO,
  VersionActionDTO,
  SaveOphthalmologyTestResultDraftDTO,
  CompleteOphthalmologyTestResultDTO,
  AmendOphthalmologyTestResultDTO,
  OphthalmologyTestResultVersion,
  OphthalmologyTestResultStatus,
  SaveOphthalmologyClinicalReviewDraftDTO,
  SaveOphthalmologyOpticalPrescriptionDraftDTO,
  ApproveOphthalmologyOpticalPrescriptionDTO,
  OphthalmologyResultReviewDTO,
  OphthalmologyCompletionRequirementCode,
  OphthalmologyCompletionReadiness,
  DeferOphthalmologyResultDTO,
  OverrideOphthalmologyCompletionDTO,
  CompleteOphthalmologyConsultationDTO,
  ReopenOphthalmologyConsultationDTO,
  AmendOphthalmologyConsultationDTO,
} from './ophthalmology.types.js';

type TreatmentPlanValidationInput = {
  diagnosis_code: string;
  diagnosis_laterality: 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE';
  action_type: OphthalmologyTreatmentPlanActionType | null;
  status: OphthalmologyTreatmentPlanStatus;
  medication_prescription_id?: string | null;
  optical_prescription_id?: string | null;
  clinical_order_ids?: string[];
  procedure_recommendation_id?: string | null;
  referral_id?: string | null;
  follow_up_id?: string | null;
};
type ClinicalReviewValidationInput = { treatment_plans: TreatmentPlanValidationInput[] };

const sharedVisitType: Record<OphthalmologyVisitSubtype, OpdVisitType> = {
  NEW_CONSULTATION: 'NEW_CONSULTATION', FOLLOW_UP: 'FOLLOW_UP', EMERGENCY: 'EMERGENCY',
  POST_OPERATIVE: 'REVIEW', SCREENING: 'REVIEW', PROCEDURE_REVIEW: 'REVIEW',
};
const duplicateKey = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
const textValue = (value?: string | null) => value?.trim() || null;
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
};

import type { BillingService } from '../billing/billing.service.js';
import type { InpatientAdmissionService } from '../inpatient-admissions/inpatient-admission.service.js';

export class OphthalmologyService {
  constructor(
    private readonly repository: OphthalmologyRepository,
    private readonly visitRepository: OpdVisitRepository,
    private readonly notificationService: NotificationService,
    private readonly consultationRepository?: OpdConsultationRepository,
    private readonly appointmentRepository?: AppointmentRepository,
    private readonly patientRepository?: PatientRepository,
    private readonly billingService?: BillingService,
    private readonly inpatientAdmissions?: InpatientAdmissionService,
  ) {}

  async getClinicalWorkspace(visitId: string, userId: string) {
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    const departments = await this.repository.resolveDepartmentScope(userId);
    if (departments !== null && !departments.includes(visit.department_id)) throw new AppError('Clinical department access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    return { visit: { id: visit.id, visit_number: visit.visit_number, patient_id: visit.patient_id, patient_number: visit.patient_number,
      patient_name: visit.patient_name, doctor_name: visit.doctor_name, branch_id: visit.branch_id, department_id: visit.department_id,
      visit_type: visit.visit_type, priority: visit.priority, status: visit.status }, context: await this.repository.getContextByVisit(visitId) };
  }

  async getClinicalConfiguration(visitId: string, userId: string) {
    const workspace = await this.getClinicalWorkspace(visitId, userId);
    if (!workspace.context) throw new AppError('Activate the encounter context first', 409, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    const configuration = await this.repository.getConfiguration(workspace.context.configuration_version_id);
    if (!configuration || configuration.branch_id !== workspace.visit.branch_id || configuration.type !== 'COMPLETION_PROFILE') {
      throw new AppError('Bound clinical configuration is unavailable', 409, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    return configuration;
  }

  async getContext(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId);
    return this.repository.getContextByVisit(visitId);
  }

  async createContext(visitId: string, data: CreateOphthalmologyContextDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    this.validateSubtypeMapping(visit, data.visit_subtype);
    assertOphthalmologyLaterality('CONTEXT', data.affected_eye);
    await this.validateBindings(visit.branch_id, data.visit_subtype, data.configuration_version_id, data.workflow_profile_version_id);
    const current = await this.repository.getContextByVisit(visitId);
    if (current) {
      if (this.sameContext(current, data)) return current;
      throw new AppError('A different Ophthalmology context already exists for this visit', 409, 'OPHTHALMOLOGY_CONTEXT_CONFLICT');
    }
    try {
      return await executeRequiredTransaction(this.repository, async (session) => {
        const raced = await this.repository.getContextByVisit(visitId, session);
        if (raced) {
          if (this.sameContext(raced, data)) return raced;
          throw new AppError('A different Ophthalmology context already exists for this visit', 409, 'OPHTHALMOLOGY_CONTEXT_CONFLICT');
        }
        await this.validateBindings(visit.branch_id, data.visit_subtype, data.configuration_version_id, data.workflow_profile_version_id, session);
        const context = await this.repository.createContext(visit, data, this.initialWorkflowStatus(visit), userId, session);
        await this.repository.audit('ophthalmology.context.created', userId, {
          contextId: context.id, visitId, branchId: visit.branch_id, departmentId: visit.department_id,
          visitSubtype: context.visit_subtype, affectedEye: context.affected_eye, resultingVersion: context.version,
        }, metadata, session);
        return context;
      });
    } catch (error: unknown) {
      if (!duplicateKey(error)) throw error;
      const raced = await this.repository.getContextByVisit(visitId);
      if (raced && this.sameContext(raced, data)) return raced;
      throw new AppError('A different Ophthalmology context already exists for this visit', 409, 'OPHTHALMOLOGY_CONTEXT_CONFLICT');
    }
  }

  async updateContext(visitId: string, data: UpdateOphthalmologyContextDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    const current = await this.repository.getContextByVisit(visitId);
    if (!current) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    await this.assertConsultationWritable(visitId);
    if (current.version !== data.expected_version) throw this.versionConflict('context');
    const subtype = data.visit_subtype ?? current.visit_subtype;
    assertOphthalmologyLaterality('CONTEXT', data.affected_eye ?? current.affected_eye);
    this.validateSubtypeMapping(visit, subtype);
    const workflowId = data.workflow_profile_version_id ?? current.workflow_profile_version_id;
    await this.validateBindings(visit.branch_id, subtype, current.configuration_version_id, workflowId);
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactional = await this.repository.getContextByVisit(visitId, session);
      if (!transactional || transactional.version !== data.expected_version) throw this.versionConflict('context');
      const transactionalSubtype = data.visit_subtype ?? transactional.visit_subtype;
      const transactionalWorkflowId = data.workflow_profile_version_id ?? transactional.workflow_profile_version_id;
      await this.validateBindings(visit.branch_id, transactionalSubtype, transactional.configuration_version_id, transactionalWorkflowId, session);
      const updated = await this.repository.updateContext(transactional.id, transactional.version, data, userId, session);
      if (!updated) throw this.versionConflict('context');
      await this.repository.audit('ophthalmology.context.updated', userId, {
        contextId: updated.id, visitId, branchId: visit.branch_id, previousVersion: transactional.version,
        resultingVersion: updated.version, previousSubtype: transactional.visit_subtype, resultingSubtype: updated.visit_subtype,
      }, metadata, session);
      return updated;
    });
  }

  async getIntake(visitId: string, userId: string) {
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    const context = await this.repository.getContextByVisit(visit.id);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    const [intake, alerts, sharedHistory] = await Promise.all([
      this.repository.getIntakeByContext(context.id), this.repository.getAlertsByContext(context.id), this.repository.getSharedHistory(visit.id),
    ]);
    return { intake, alerts, shared_history: sharedHistory };
  }

  async saveIntakeDraft(visitId: string, data: SaveOphthalmologyIntakeDraftDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    const context = await this.repository.getContextByVisit(visit.id);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    this.validateIntakeStructure(data);
    await this.validateIntakeConfigurationBindings(context, data.complaint_configuration_version_id, data.emergency_configuration_version_id, false);
    await this.validatePreviousReports(context.patient_id, data.previous_report_document_ids ?? []);
    try {
      return await executeRequiredTransaction(this.repository, async (session) => {
        const current = await this.repository.getIntakeByContext(context.id, session);
        if (!current) {
          if (data.expected_version !== null) throw this.versionConflict('intake');
          await this.validateIntakeConfigurationBindings(context, data.complaint_configuration_version_id, data.emergency_configuration_version_id, false, session);
          await this.validatePreviousReports(context.patient_id, data.previous_report_document_ids ?? [], session);
          const created = await this.repository.createIntake(context, data, userId, session);
          await this.repository.audit('ophthalmology.intake.draft.created', userId, { intakeId: created.id, contextId: context.id,
            visitId, branchId: context.branch_id, resultingVersion: created.version }, metadata, session);
          return created;
        }
        if (current.status !== 'DRAFT') throw new AppError('Completed Ophthalmology intake is read-only', 409, 'OPHTHALMOLOGY_FINALIZED');
        if (data.expected_version === null || current.version !== data.expected_version) throw this.versionConflict('intake');
        await this.validateIntakeConfigurationBindings(context, data.complaint_configuration_version_id, data.emergency_configuration_version_id, false, session);
        await this.validatePreviousReports(context.patient_id, data.previous_report_document_ids ?? [], session);
        const updated = await this.repository.updateIntakeDraft(current.id, current.version, data, userId, session);
        if (!updated) throw this.versionConflict('intake');
        await this.repository.audit('ophthalmology.intake.draft.updated', userId, { intakeId: updated.id, contextId: context.id,
          visitId, branchId: context.branch_id, previousVersion: current.version, resultingVersion: updated.version }, metadata, session);
        return updated;
      });
    } catch (error: unknown) {
      if (duplicateKey(error)) throw this.versionConflict('intake');
      throw error;
    }
  }

  async completeIntake(visitId: string, data: CompleteOphthalmologyIntakeDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'DRAFT') throw new AppError('Intake completion requires expected status DRAFT', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    const visit = await this.getOphthalmologyVisit(visitId, userId);
    const context = await this.repository.getContextByVisit(visit.id);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactionalContext = await this.repository.getContextByVisit(visit.id, session);
      const intake = await this.repository.getIntakeByContext(context.id, session);
      if (!transactionalContext || transactionalContext.version !== data.expected_context_version) throw this.versionConflict('context');
      if (!intake) throw new AppError('Ophthalmology intake not found', 404, 'OPHTHALMOLOGY_INTAKE_NOT_FOUND');
      if (intake.status !== 'DRAFT') throw new AppError('Only a draft intake can be completed', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
      if (intake.version !== data.expected_version) throw this.versionConflict('intake');
      const configurations = await this.validateIntakeConfigurationBindings(transactionalContext,
        intake.complaint_configuration_version_id, intake.emergency_configuration_version_id, true, session);
      await this.validatePreviousReports(transactionalContext.patient_id, intake.previous_report_document_ids, session);
      this.validateIntakeCompletion(intake, configurations.complaint, configurations.emergency);

      const recipients = intake.emergency_criterion_codes.length > 0
        ? await this.repository.eligibleOphthalmologistUserIds(transactionalContext.branch_id, transactionalContext.department_id, session)
        : [];
      if (intake.emergency_criterion_codes.length > 0 && recipients.length === 0) {
        throw new AppError('No authorized Ophthalmology clinician is available for emergency routing', 409, 'OPHTHALMOLOGY_ROUTING_REQUIRED');
      }
      if (['CHECKED_IN', 'PRELIMINARY_EXAMINATION'].includes(transactionalContext.workflow_status)) {
        const moved = await this.repository.setContextWorkflowForIntake(transactionalContext.id, transactionalContext.version, userId, session);
        if (!moved) throw this.versionConflict('context');
      } else if (!['AWAITING_DOCTOR', 'UNDER_CONSULTATION'].includes(transactionalContext.workflow_status)) {
        throw new AppError('The Ophthalmology workflow state does not allow intake completion', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
      }
      const completed = await this.repository.completeIntake(intake.id, intake.version, userId, session);
      if (!completed) throw this.versionConflict('intake');
      let alert = null;
      if (completed.emergency_criterion_codes.length > 0) {
        const reason = this.emergencyReason(completed.emergency_criterion_codes, configurations.emergency);
        alert = await this.repository.createEmergencyAlert(transactionalContext, completed, reason, userId, session);
        for (const recipientUserId of recipients) {
          await this.notificationService.createNotification({ recipient_user_id: recipientUserId,
            recipient_branch_id: transactionalContext.branch_id, title: 'Emergency Ophthalmology review required',
            message: `An Ophthalmology emergency screening requires review for visit ${transactionalContext.visit_id}.`,
            type: 'GENERAL', related_entity_id: alert.id }, session, userId);
        }
        const routed = await this.repository.addAlertNotifiedUsers(alert.id, alert.version, recipients, session);
        if (!routed) throw this.versionConflict('alert');
        alert = routed;
        await this.repository.audit('ophthalmology.emergency_alert.created', userId, { alertId: alert.id, intakeId: completed.id,
          contextId: transactionalContext.id, visitId, branchId: transactionalContext.branch_id, criterionCodes: alert.criterion_codes,
          notifiedUserIds: alert.notified_user_ids, sourceVersion: alert.source_version, resultingVersion: alert.version }, metadata, session);
      }
      await this.repository.audit('ophthalmology.intake.completed', userId, { intakeId: completed.id, contextId: transactionalContext.id,
        visitId, branchId: transactionalContext.branch_id, previousVersion: intake.version, resultingVersion: completed.version,
        complaintConfigurationVersionId: completed.complaint_configuration_version_id,
        emergencyConfigurationVersionId: completed.emergency_configuration_version_id, emergencyAlertId: alert?.id ?? null }, metadata, session);
      return { intake: completed, alert };
    });
  }

  async routeEmergency(visitId: string, alertId: string, data: RouteOphthalmologyEmergencyDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    this.validateObjectId(alertId, 'Alert id is invalid');
    if (data.expected_status !== 'ACTIVE') throw new AppError('Emergency routing requires expected status ACTIVE', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    const current = await this.repository.getAlert(alertId);
    if (!current) throw new AppError('Ophthalmology alert not found', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    if (current.visit_id !== visitId) throw new AppError('Ophthalmology alert not found for this visit', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    await this.getOphthalmologyVisit(visitId, userId);
    await this.assertConsultationWritable(visitId);
    if (current.version !== data.expected_version) throw this.versionConflict('alert');
    return executeRequiredTransaction(this.repository, async (session) => {
      const alert = await this.repository.getAlert(alertId, session);
      if (!alert || alert.status !== 'ACTIVE' || alert.version !== data.expected_version) throw this.versionConflict('alert');
      const eligible = await this.repository.eligibleOphthalmologistUserIds(alert.branch_id, alert.department_id, session);
      if (eligible.length === 0) throw new AppError('No authorized Ophthalmology clinician is available for emergency routing', 409, 'OPHTHALMOLOGY_ROUTING_REQUIRED');
      const missing = eligible.filter((id) => !alert.notified_user_ids.includes(id));
      for (const recipientUserId of missing) {
        await this.notificationService.createNotification({ recipient_user_id: recipientUserId, recipient_branch_id: alert.branch_id,
          title: 'Emergency Ophthalmology review required', message: `An Ophthalmology emergency screening requires review for visit ${alert.visit_id}.`,
          type: 'GENERAL', related_entity_id: alert.id }, session, userId);
      }
      const routed = await this.repository.addAlertNotifiedUsers(alert.id, alert.version, missing, session);
      if (!routed) throw this.versionConflict('alert');
      if (missing.length > 0) await this.repository.audit('ophthalmology.emergency_alert.routed', userId, { alertId: alert.id,
        branchId: alert.branch_id, newlyNotifiedUserIds: missing, previousVersion: alert.version, resultingVersion: routed.version }, metadata, session);
      return routed;
    });
  }

  async acknowledgeAlert(visitId: string, alertId: string, data: AcknowledgeOphthalmologyAlertDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    this.validateObjectId(alertId, 'Alert id is invalid');
    if (data.expected_status !== 'ACTIVE') throw new AppError('Alert acknowledgement requires expected status ACTIVE', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    const current = await this.repository.getAlert(alertId);
    if (!current) throw new AppError('Ophthalmology alert not found', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    if (current.visit_id !== visitId) throw new AppError('Ophthalmology alert not found for this visit', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    await this.getOphthalmologyVisit(visitId, userId);
    if (current.version !== data.expected_version) throw this.versionConflict('alert');
    return executeRequiredTransaction(this.repository, async (session) => {
      const alert = await this.repository.getAlert(alertId, session);
      if (!alert || alert.status !== 'ACTIVE' || alert.version !== data.expected_version) throw this.versionConflict('alert');
      const eligible = await this.repository.eligibleOphthalmologistUserIds(alert.branch_id, alert.department_id, session);
      if (!eligible.includes(userId)) throw new AppError('Only an eligible Ophthalmology clinician may acknowledge this alert', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
      const acknowledged = await this.repository.acknowledgeAlert(alert.id, alert.version, userId, data.note?.trim() || null, session);
      if (!acknowledged) throw this.versionConflict('alert');
      await this.repository.audit('ophthalmology.emergency_alert.acknowledged', userId, { alertId: alert.id, contextId: alert.context_id,
        visitId: alert.visit_id, branchId: alert.branch_id, acknowledgedSourceVersion: alert.source_version,
        previousStatus: alert.status, resultingStatus: acknowledged.status, previousVersion: alert.version,
        resultingVersion: acknowledged.version, noteProvided: Boolean(data.note?.trim()) }, metadata, session);
      return acknowledged;
    });
  }

  async clearAlert(
    visitId: string,
    alertId: string,
    data: ClearOphthalmologyEmergencyAlertDTO,
    userId: string,
    metadata: OphthalmologyRequestMetadata = {},
  ) {
    this.validateObjectId(alertId, 'Alert id is invalid');
    const current = await this.repository.getAlert(alertId);
    if (!current) throw new AppError('Ophthalmology alert not found', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    if (current.visit_id !== visitId) throw new AppError('Ophthalmology alert not found for this visit', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
    if (current.status === 'CLEARED') {
      throw new AppError('Ophthalmology alert is already cleared', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    }
    await this.getOphthalmologyVisit(visitId, userId);

    const disposition = data.disposition;
    if (!['RESUME_ROUTINE_OPD', 'ADMIT_TO_INPATIENT', 'TRANSFER_EXTERNAL'].includes(disposition)) {
      throw new AppError('Invalid emergency clearance disposition', 400, 'VALIDATION_ERROR');
    }
    const rationale = (data.clearance_rationale ?? data.clearanceRationale)?.trim();
    if (!rationale) {
      throw new AppError('Clearance rationale is required', 400, 'VALIDATION_ERROR');
    }
    const resumptionPermitted = data.resumption_permitted ?? data.resumptionPermitted;
    if (typeof resumptionPermitted !== 'boolean') {
      throw new AppError('resumption_permitted is required', 400, 'VALIDATION_ERROR');
    }
    if (resumptionPermitted && disposition !== 'RESUME_ROUTINE_OPD') {
      throw new AppError('Routine resumption requires the routine OPD disposition', 400, 'VALIDATION_ERROR');
    }

    return executeRequiredTransaction(this.repository, async (session) => {
      const alert = await this.repository.getAlert(alertId, session);
      if (!alert) throw new AppError('Ophthalmology alert not found', 404, 'OPHTHALMOLOGY_ALERT_NOT_FOUND');
      const eligible = await this.repository.eligibleOphthalmologistUserIds(alert.branch_id, alert.department_id, session);
      if (!eligible.includes(userId)) {
        throw new AppError('Only an eligible Ophthalmology clinician may clear this alert', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
      }
      if (alert.status === 'CLEARED') {
        throw new AppError('Ophthalmology alert is already cleared', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
      }
      if (typeof data.expected_version === 'number' && alert.version !== data.expected_version) {
        throw this.versionConflict('alert');
      }

      let admissionRequestId: string | null = null;
      if (disposition === 'ADMIT_TO_INPATIENT') {
        if (!this.inpatientAdmissions) throw new AppError('Admission integration is unavailable', 503, 'OPHTHALMOLOGY_ADMISSION_DEPENDENCY_UNAVAILABLE');
        const visit = await this.getOphthalmologyVisit(visitId, userId);
        const request = await this.inpatientAdmissions.createRequest({
          patient_id: alert.patient_id,
          branch_id: alert.branch_id,
          department_id: alert.department_id,
          recommending_doctor_id: visit.doctor_id,
          source_type: 'OPD_VISIT',
          source_id: visitId,
          admission_type: 'INPATIENT',
          priority: 'EMERGENCY',
          reason: rationale,
        }, userId, metadata, session);
        admissionRequestId = request.id;
      }

      const cleared = await this.repository.clearEmergencyAlert(
        alert.id,
        data.expected_version ?? alert.version,
        userId,
        {
          disposition,
          clearanceRationale: rationale,
          resumptionPermitted,
          admissionRequestId,
        },
        session,
      );
      if (!cleared) throw this.versionConflict('alert');

      await this.repository.audit(
        'ophthalmology.emergency_alert.cleared',
        userId,
        {
          alertId: alert.id,
          contextId: alert.context_id,
          visitId: alert.visit_id,
          branchId: alert.branch_id,
          previousStatus: alert.status,
          resultingStatus: cleared.status,
          admissionRequestId,
          disposition,
          clearanceRationale: rationale,
          resumptionPermitted,
          previousVersion: alert.version,
          resultingVersion: cleared.version,
        },
        metadata,
        session,
      );

      return cleared;
    });
  }

  private validateComparisonUnits(type: string, values?: Record<string, unknown>) {
    if (type === 'FORM_PROFILE' && values?.comparison_units !== undefined && !comparisonUnitsSchema.safeParse(values.comparison_units).success) {
      throw new AppError('Comparison units require safe measurement paths and explicit unit codes', 400, 'VALIDATION_ERROR');
    }
  }

  async listConfigurations(query: OphthalmologyConfigurationListQuery, userId: string) {
    await this.requireBranchAccess(userId, query.branch_id); return this.repository.listConfigurations(query);
  }
  async createConfiguration(data: CreateOphthalmologyConfigurationDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    await this.requireBranchAccess(userId, data.branch_id); this.validateObjectId(data.branch_id, 'Branch id is invalid');
    if (data.type === 'SUB_SPECIALITY' && data.values?.options !== undefined && !subSpecialityValuesSchema.safeParse(data.values).success) throw new AppError('Sub-speciality options require unique codes, labels and active flags', 400, 'VALIDATION_ERROR');
    this.validateComparisonUnits(data.type, data.values);
    const code = data.code.trim().toUpperCase();
    const revision = await this.repository.nextConfigurationRevision(data.branch_id, data.type, code);
    try {
      const result = await this.repository.createConfiguration({ ...data, code }, revision, userId);
      await this.repository.audit('ophthalmology.configuration.created', userId, { configurationId: result.id,
        branchId: result.branch_id, type: result.type, code: result.code, revision: result.revision, resultingVersion: result.version }, metadata);
      return result;
    } catch (error: unknown) {
      if (duplicateKey(error)) throw new AppError('Configuration revision already exists', 409, 'OPHTHALMOLOGY_CONFIGURATION_CONFLICT');
      throw error;
    }
  }
  async updateConfiguration(id: string, data: UpdateOphthalmologyConfigurationDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const current = await this.getScopedConfiguration(id, userId);
    if (current.status !== 'DRAFT') throw new AppError('Only draft configurations can be edited', 409, 'OPHTHALMOLOGY_FINALIZED');
    if (current.version !== data.expected_version) throw this.versionConflict('configuration');
    if (current.type === 'SUB_SPECIALITY' && data.values !== undefined && !subSpecialityValuesSchema.safeParse(data.values).success) throw new AppError('Sub-speciality options require unique codes, labels and active flags', 400, 'VALIDATION_ERROR');
    this.validateComparisonUnits(current.type, data.values);
    const updated = await this.repository.updateConfiguration(id, data, userId);
    if (!updated) throw this.versionConflict('configuration');
    await this.repository.audit('ophthalmology.configuration.updated', userId, { configurationId: id, branchId: current.branch_id,
      previousVersion: current.version, resultingVersion: updated.version }, metadata); return updated;
  }
  async activateConfiguration(id: string, data: VersionActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'DRAFT') throw new AppError('Configuration activation requires expected status DRAFT', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    const current = await this.getScopedConfiguration(id, userId);
    if (current.version !== data.expected_version) throw this.versionConflict('configuration');
    if (current.status === 'ACTIVE') return current;
    if (current.status !== 'DRAFT') throw new AppError('Only a draft configuration can be activated', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactional = await this.repository.getConfiguration(id, session);
      if (!transactional || transactional.version !== data.expected_version || transactional.status !== 'DRAFT') throw this.versionConflict('configuration');
      if (transactional.type === 'SUB_SPECIALITY') { const parsed = subSpecialityValuesSchema.safeParse(transactional.values); if (!parsed.success || !parsed.data.options.some((row) => row.active)) throw new AppError('Configure at least one active sub-speciality before activation', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED'); }
      this.validateComparisonUnits(transactional.type, transactional.values);
      await this.repository.deactivateOtherConfigurations(transactional, userId, session);
      const activated = await this.repository.setConfigurationStatus(id, transactional.version, 'DRAFT', 'ACTIVE', userId, null, session);
      if (!activated) throw this.versionConflict('configuration');
      await this.repository.audit('ophthalmology.configuration.activated', userId, { configurationId: id,
        branchId: activated.branch_id, previousStatus: transactional.status, resultingStatus: activated.status,
        previousVersion: transactional.version, resultingVersion: activated.version }, metadata, session); return activated;
    });
  }
  async deactivateConfiguration(id: string, data: VersionActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'ACTIVE') throw new AppError('Configuration deactivation requires expected status ACTIVE', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    if (!data.reason?.trim()) throw new AppError('A deactivation reason is required', 400, 'OPHTHALMOLOGY_REASON_REQUIRED');
    const current = await this.getScopedConfiguration(id, userId);
    if (current.version !== data.expected_version) throw this.versionConflict('configuration');
    if (current.status !== 'ACTIVE') throw new AppError('Only an active configuration can be deactivated', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const deactivated = await this.repository.setConfigurationStatus(id, current.version, 'ACTIVE', 'INACTIVE', userId, data.reason!.trim(), session);
      if (!deactivated) throw this.versionConflict('configuration');
      await this.repository.audit('ophthalmology.configuration.deactivated', userId, { configurationId: id,
        branchId: current.branch_id, reason: data.reason!.trim(), previousVersion: current.version, resultingVersion: deactivated.version }, metadata, session);
      return deactivated;
    });
  }

  async listStations(query: OphthalmologyStationListQuery, userId: string) { await this.requireBranchAccess(userId, query.branch_id); return this.repository.listStations(query); }
  async getStation(id: string, userId: string) {
    this.validateObjectId(id, 'Station id is invalid'); const station = await this.repository.getStation(id);
    if (!station) throw new AppError('Ophthalmology station not found', 404, 'OPHTHALMOLOGY_STATION_NOT_FOUND');
    await this.requireBranchAccess(userId, station.branch_id); return station;
  }
  async createStation(data: CreateOphthalmologyStationDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    await this.requireBranchAccess(userId, data.branch_id); await this.requireOphthalmologyDepartment(data.department_id, data.branch_id);
    await this.validateStationMembers(data.member_user_ids ?? [], data.branch_id, data.department_id); this.validateStationLists(data);
    try {
      const station = await this.repository.createStation(data, userId); await this.repository.audit('ophthalmology.station.created', userId,
        { stationId: station.id, branchId: station.branch_id, departmentId: station.department_id, resultingVersion: station.version }, metadata); return station;
    } catch (error: unknown) { if (duplicateKey(error)) throw new AppError('Station code already exists in this branch', 409, 'OPHTHALMOLOGY_STATION_CONFLICT'); throw error; }
  }
  async updateStation(id: string, data: UpdateOphthalmologyStationDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    this.validateObjectId(id, 'Station id is invalid'); const current = await this.repository.getStation(id);
    if (!current) throw new AppError('Ophthalmology station not found', 404, 'OPHTHALMOLOGY_STATION_NOT_FOUND');
    await this.requireBranchAccess(userId, current.branch_id); if (current.version !== data.expected_version) throw this.versionConflict('station');
    await this.validateStationMembers(data.member_user_ids ?? current.member_user_ids, current.branch_id, current.department_id); this.validateStationLists(data);
    const updated = await this.repository.updateStation(id, data, userId); if (!updated) throw this.versionConflict('station');
    await this.repository.audit('ophthalmology.station.updated', userId, { stationId: id, branchId: current.branch_id,
      previousStatus: current.status, resultingStatus: updated.status, previousVersion: current.version, resultingVersion: updated.version }, metadata); return updated;
  }
  async deactivateStation(id: string, data: VersionActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'ACTIVE') throw new AppError('Station deactivation requires expected status ACTIVE', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    if (!data.reason?.trim()) throw new AppError('A deactivation reason is required', 400, 'OPHTHALMOLOGY_REASON_REQUIRED');
    this.validateObjectId(id, 'Station id is invalid');
    const current = await this.repository.getStation(id);
    if (!current) throw new AppError('Ophthalmology station not found', 404, 'OPHTHALMOLOGY_STATION_NOT_FOUND');
    await this.requireBranchAccess(userId, current.branch_id);
    if (current.version !== data.expected_version) throw this.versionConflict('station');
    if (current.status !== 'ACTIVE') throw new AppError('Only an active station can be deactivated', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactional = await this.repository.getStation(id, session);
      if (!transactional || transactional.version !== data.expected_version || transactional.status !== 'ACTIVE') throw this.versionConflict('station');
      const deactivated = await this.repository.setStationStatus(id, transactional.version, 'ACTIVE', userId, session);
      if (!deactivated) throw this.versionConflict('station');
      await this.repository.audit('ophthalmology.station.deactivated', userId, {
        stationId: id, branchId: deactivated.branch_id, reason: data.reason!.trim(), previousVersion: transactional.version,
        resultingVersion: deactivated.version,
      }, metadata, session);
      return deactivated;
    });
  }

  async listWorkflowProfiles(query: OphthalmologyWorkflowProfileListQuery, userId: string) { await this.requireBranchAccess(userId, query.branch_id); return this.repository.listWorkflowProfiles(query); }
  async getWorkflowProfile(id: string, userId: string) { return this.getScopedWorkflow(id, userId); }
  async createWorkflowProfile(data: CreateOphthalmologyWorkflowProfileDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    await this.requireBranchAccess(userId, data.branch_id); this.validateWorkflowStages(data.stages);
    const revision = await this.repository.nextWorkflowRevision(data.branch_id, data.visit_subtype);
    try { const result = await this.repository.createWorkflowProfile(data, revision, userId);
      await this.repository.audit('ophthalmology.workflow_profile.created', userId, { workflowProfileId: result.id,
        branchId: result.branch_id, visitSubtype: result.visit_subtype, revision, resultingVersion: result.version }, metadata); return result;
    } catch (error: unknown) { if (duplicateKey(error)) throw new AppError('Workflow profile revision already exists', 409, 'OPHTHALMOLOGY_WORKFLOW_CONFLICT'); throw error; }
  }
  async updateWorkflowProfile(id: string, data: UpdateOphthalmologyWorkflowProfileDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const current = await this.getScopedWorkflow(id, userId); if (current.status !== 'DRAFT') throw new AppError('Only draft workflow profiles can be edited', 409, 'OPHTHALMOLOGY_FINALIZED');
    if (current.version !== data.expected_version) throw this.versionConflict('workflow profile'); if (data.stages) this.validateWorkflowStages(data.stages);
    const updated = await this.repository.updateWorkflowProfile(id, data, userId); if (!updated) throw this.versionConflict('workflow profile');
    await this.repository.audit('ophthalmology.workflow_profile.updated', userId, { workflowProfileId: id, branchId: current.branch_id,
      previousVersion: current.version, resultingVersion: updated.version }, metadata); return updated;
  }
  async activateWorkflowProfile(id: string, data: VersionActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'DRAFT') throw new AppError('Workflow profile activation requires expected status DRAFT', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    const current = await this.getScopedWorkflow(id, userId); if (current.version !== data.expected_version) throw this.versionConflict('workflow profile');
    if (current.status === 'ACTIVE') return current; if (current.status !== 'DRAFT') throw new AppError('Only a draft workflow profile can be activated', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactional = await this.repository.getWorkflowProfile(id, session);
      if (!transactional || transactional.version !== data.expected_version || transactional.status !== 'DRAFT') throw this.versionConflict('workflow profile');
      await this.repository.deactivateOtherWorkflows(transactional, userId, session);
      const activated = await this.repository.setWorkflowStatus(id, transactional.version, 'DRAFT', 'ACTIVE', userId, null, session);
      if (!activated) throw this.versionConflict('workflow profile');
      await this.repository.audit('ophthalmology.workflow_profile.activated', userId, { workflowProfileId: id,
        branchId: activated.branch_id, visitSubtype: activated.visit_subtype, previousVersion: transactional.version,
        resultingVersion: activated.version }, metadata, session); return activated;
    });
  }
  async deactivateWorkflowProfile(id: string, data: VersionActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'ACTIVE') throw new AppError('Workflow profile deactivation requires expected status ACTIVE', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    if (!data.reason?.trim()) throw new AppError('A deactivation reason is required', 400, 'OPHTHALMOLOGY_REASON_REQUIRED');
    const current = await this.getScopedWorkflow(id, userId); if (current.version !== data.expected_version) throw this.versionConflict('workflow profile');
    if (current.status !== 'ACTIVE') throw new AppError('Only an active workflow profile can be deactivated', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const deactivated = await this.repository.setWorkflowStatus(id, current.version, 'ACTIVE', 'INACTIVE', userId, data.reason!.trim(), session);
      if (!deactivated) throw this.versionConflict('workflow profile');
      await this.repository.audit('ophthalmology.workflow_profile.deactivated', userId, { workflowProfileId: id,
        branchId: current.branch_id, reason: data.reason!.trim(), previousVersion: current.version, resultingVersion: deactivated.version }, metadata, session);
      return deactivated;
    });
  }

  async createTestTask(visitId: string, data: CreateOphthalmologyTestTaskDTO, idempotencyKey: string, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    this.validateObjectId(data.test_catalogue_version_id, 'Test catalogue version id is invalid');
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    await this.assertConsultationWritable(visitId);
    if (context.version !== data.expected_context_version) throw this.versionConflict('context');
    const normalized = { ...data, test_code: data.test_code.trim().toUpperCase(), workflow_stage_code: textValue(data.workflow_stage_code)?.toUpperCase(),
      special_instructions: textValue(data.special_instructions), source_order_id: data.source_order_id ?? null, source_order_item_id: data.source_order_item_id ?? null };
    const fingerprint = this.fingerprint(normalized); const existing = await this.repository.getTestTaskByIdempotency(context.id, idempotencyKey);
    if (existing) { if (existing.fingerprint !== fingerprint) throw this.idempotencyConflict(); return existing.task; }
    try {
      return await executeRequiredTransaction(this.repository, async (session) => {
        const transactional = await this.repository.getContext(context.id, session);
        if (!transactional || transactional.version !== data.expected_context_version) throw this.versionConflict('context');
        const raced = await this.repository.getTestTaskByIdempotency(context.id, idempotencyKey, session);
        if (raced) { if (raced.fingerprint !== fingerprint) throw this.idempotencyConflict(); return raced.task; }
        if (data.priority !== 'EMERGENCY') await this.requireEmergencyClearance(context.id, session);
        const catalogue = await this.repository.getConfiguration(data.test_catalogue_version_id, session);
        if (!catalogue || catalogue.branch_id !== transactional.branch_id || catalogue.type !== 'TEST_CATALOGUE' || catalogue.status !== 'ACTIVE') {
          throw new AppError('An active branch test catalogue version is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
        }
        const test = this.configuredTests(catalogue).find((entry) => entry.code === normalized.test_code);
        if (!test) throw new AppError('Test code is not in the active test catalogue', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
        if (normalized.workflow_stage_code) {
          const workflow = await this.repository.getWorkflowProfile(transactional.workflow_profile_version_id, session);
          const stage = workflow?.stages.find((entry) => entry.code === normalized.workflow_stage_code);
          if (!workflow || workflow.branch_id !== transactional.branch_id || !stage || !stage.test_codes.includes(normalized.test_code)) {
            throw new AppError('The test is not configured for the supplied workflow stage', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
          }
        }
        let orderType: 'LABORATORY' | 'IMAGING' | null = null;
        if (data.source_type === 'WORKFLOW') {
          if (data.source_order_id || data.source_order_item_id) throw new AppError('Workflow tasks cannot reference a clinical order', 400, 'VALIDATION_ERROR');
        } else {
          if (!data.source_order_id || !data.source_order_item_id) throw new AppError('Clinical-order tasks require order and item ids', 400, 'VALIDATION_ERROR');
          this.validateObjectId(data.source_order_id, 'Clinical order id is invalid'); this.validateObjectId(data.source_order_item_id, 'Clinical order item id is invalid');
          const item = await this.repository.getClinicalOrderItem(data.source_order_id, data.source_order_item_id, transactional, session);
          if (!item) throw new AppError('Submitted clinical order item does not match this visit', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
          orderType = item.order_type;
        }
        const created = await this.repository.createTestTask(transactional, normalized, test.name, orderType, idempotencyKey, fingerprint, userId, session);
        await this.repository.audit('ophthalmology.test_task.created', userId, { taskId: created.id, contextId: context.id,
          visitId: context.visit_id, branchId: context.branch_id, testCode: created.test_code, sourceType: created.source_type,
          idempotencyKey, resultingStatus: created.status, resultingVersion: created.version }, metadata, session); return created;
      });
    } catch (error: unknown) {
      if (!duplicateKey(error)) throw error; const raced = await this.repository.getTestTaskByIdempotency(context.id, idempotencyKey);
      if (raced?.fingerprint === fingerprint) return raced.task; throw this.idempotencyConflict();
    }
  }
  async listTestTasks(query: OphthalmologyTestTaskListQuery, userId: string) {
    if (query.branch_id) await this.requireBranchAccess(userId, query.branch_id);
    for (const value of [query.station_id, query.assigned_user_id, query.visit_id, query.patient_id].filter(Boolean) as string[]) this.validateObjectId(value, 'Test task filter id is invalid');
    return this.repository.listTestTasks(query, userId);
  }
  async getTestTask(id: string, userId: string) {
    const task = await this.requireTestTask(id); if (!await this.repository.canViewTestTask(task, userId)) throw new AppError('Test task access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    return task;
  }
  async getTaskWorkspace(id: string, userId: string) {
    const task = await this.getTestTask(id, userId); return this.getClinicalWorkspace(task.visit_id, userId);
  }
  async listTaskClinicalConfigurations(id: string, query: { type: 'FORM_PROFILE' | 'OPTICAL_PRODUCT' | 'DRUG_OPTION'; page?: number; limit?: number }, userId: string) {
    const task = await this.assignmentLookupTask(id, {}, userId);
    return this.repository.listTaskClinicalConfigurations(task, query);
  }
  private async assignmentLookupTask(id: string, query: OphthalmologyAssignmentLookupQuery, userId: string) {
    const source = await this.getTestTask(id, userId);
    const departments = await this.repository.resolveDepartmentScope(userId);
    if (departments !== null && !departments.includes(source.department_id)) throw new AppError('Task department access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    if (!query.target_task_id || query.target_task_id === source.id) return source;
    this.validateObjectId(query.target_task_id, 'Target task id is invalid');
    const target = await this.getTestTask(query.target_task_id, userId);
    if (target.context_id !== source.context_id || target.patient_id !== source.patient_id || target.visit_id !== source.visit_id || target.branch_id !== source.branch_id || target.department_id !== source.department_id || target.status !== 'ORDERED') throw new AppError('Target must be an ordered task in the same encounter', 409, 'OPHTHALMOLOGY_ROUTING_REQUIRED');
    return target;
  }
  private queueStationProjection(station: OphthalmologyStation, actorEligible: boolean) {
    return { id: station.id, branch_id: station.branch_id, department_id: station.department_id, code: station.code, name: station.name, status: station.status, supported_test_types: station.supported_test_types, devices: station.devices, version: station.version, actor_eligible: actorEligible };
  }
  async listAssignmentStations(id: string, query: OphthalmologyAssignmentLookupQuery, userId: string) {
    const task = await this.assignmentLookupTask(id, query, userId); const result = await this.repository.listTaskStations(task, query);
    return { ...result, data: result.data.map((station) => this.queueStationProjection(station, false)) };
  }
  async getAssignmentStation(id: string, stationId: string, query: OphthalmologyAssignmentLookupQuery, userId: string) {
    this.validateObjectId(stationId, 'Station id is invalid'); const task = await this.assignmentLookupTask(id, query, userId);
    const station = await this.repository.getStation(stationId);
    if (!station || station.status !== 'ACTIVE' || station.branch_id !== task.branch_id || station.department_id !== task.department_id || !station.supported_test_types.includes(task.test_code)) throw new AppError('Compatible active station not found', 404, 'NOT_FOUND');
    return this.queueStationProjection(station, await this.repository.eligibleTestAssignee(userId, station.id, task.branch_id, task.department_id));
  }
  async listAssignmentMembers(id: string, query: OphthalmologyAssignmentLookupQuery, userId: string) {
    if (!query.station_id) throw new AppError('Select a station', 400, 'VALIDATION_ERROR');
    await this.getAssignmentStation(id, query.station_id, query, userId);
    const task = await this.assignmentLookupTask(id, query, userId); const station = await this.repository.getStation(query.station_id);
    if (!station || station.status !== 'ACTIVE') throw new AppError('Active station not found', 404, 'NOT_FOUND');
    return this.repository.listTaskAssignees(task, station, query);
  }
  async priorResultComparisons(id: string, query: { expected_result_version: number; page?: number; limit?: number }, userId: string) {
    const task = await this.getTestTask(id, userId); const result = await this.repository.getTestResult(id);
    if (!result || result.version !== query.expected_result_version) throw this.versionConflict('test result');
    if (!['VISUAL_FIELD', 'OCT'].includes(result.current.form_type)) throw new AppError('This form does not support progression comparisons', 400, 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE');
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('Invalid comparison page', 400, 'VALIDATION_ERROR');
    const found = await this.repository.priorResultVersions(task, result, page, limit);
    return { task_id: task.id, result_id: result.id, expected_result_version: result.version, ...found, data: found.data.map((prior) => {
      const problem = resultComparisonProblem(result.current, prior, result.current.form_profile_snapshot, prior.profile);
      return { result_id: prior.result_id, clinical_version: prior.clinical_version, performed_at: prior.performed_at,
        form_type: prior.form_type, eye: typeof prior.payload.eye === 'string' ? prior.payload.eye : null,
        eligible: problem === null, reason: problem };
    }) };
  }

  async getTestResult(id: string, userId: string) {
    await this.getTestTask(id, userId); const result = await this.repository.getTestResult(id);
    if (!result) throw new AppError('Ophthalmology test result not found', 404, 'OPHTHALMOLOGY_TEST_RESULT_NOT_FOUND'); return result;
  }
  async saveTestResultDraft(id: string, data: SaveOphthalmologyTestResultDraftDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); this.assertExpected(task, {
      expected_status: data.expected_task_status, expected_version: data.expected_task_version,
    });
    await this.assertConsultationWritable(task.visit_id);
    if (!['IN_PROGRESS', 'DRAFT'].includes(task.status)) throw this.statusConflict('Result draft requires IN_PROGRESS or DRAFT status');
    await this.validateResultWrite(task, data, userId, 'DRAFT');
    const existing = await this.repository.getTestResult(id);
    if ((!existing && data.expected_result_version !== null) || (existing && existing.version !== data.expected_result_version)) {
      throw this.versionConflict('test result');
    }
    if (existing?.status === 'COMPLETED') throw new AppError('Completed result requires a controlled amendment', 409, 'OPHTHALMOLOGY_FINALIZED');
    if ((task.status === 'IN_PROGRESS') !== !existing) throw new AppError('Task and result draft state are inconsistent', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
    return executeRequiredTransaction(this.repository, async (session) => {
      const currentTask = await this.repository.getTestTask(id, session); if (!currentTask) throw new AppError('Ophthalmology test task not found', 404, 'OPHTHALMOLOGY_TEST_TASK_NOT_FOUND');
      this.assertExpected(currentTask, { expected_status: data.expected_task_status, expected_version: data.expected_task_version });
      const profile = await this.validateResultWrite(currentTask, data, userId, 'DRAFT', session);
      const currentResult = await this.repository.getTestResult(id, session);
      if ((!currentResult && data.expected_result_version !== null) || (currentResult && currentResult.version !== data.expected_result_version)) throw this.versionConflict('test result');
      const result = currentResult
        ? await this.repository.updateTestResultDraft(currentTask, currentResult.version, data, profile, userId, session)
        : await this.repository.createTestResultDraft(currentTask, data, profile, userId, session);
      if (!result) throw this.versionConflict('test result');
      const updatedTask = await this.repository.transitionTestTask(id, currentTask.status, currentTask.version, 'DRAFT', 'DRAFT_SAVED', userId,
        null, {}, session); if (!updatedTask) throw this.versionConflict('test task');
      await this.repository.audit('ophthalmology.test_result.draft_saved', userId, { taskId: id, resultId: result.id,
        contextId: task.context_id, branchId: task.branch_id, formType: data.form_type, clinicalVersion: result.current_clinical_version,
        previousTaskStatus: task.status, resultingTaskStatus: updatedTask.status, previousResultVersion: data.expected_result_version,
        resultingResultVersion: result.version }, metadata, session); return result;
    });
  }
  async completeTestResult(id: string, data: CompleteOphthalmologyTestResultDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); this.assertExpected(task, {
      expected_status: data.expected_task_status, expected_version: data.expected_task_version,
    });
    await this.assertConsultationWritable(task.visit_id);
    if (task.status !== 'DRAFT') throw this.statusConflict('Completion requires a saved DRAFT result');
    const result = await this.repository.getTestResult(id); if (!result || result.status !== 'DRAFT' || result.version !== data.expected_result_version) throw this.versionConflict('test result');
    await this.validateResultWrite(task, this.resultVersionAsWrite(result.current, data), userId, 'COMPLETED');
    return executeRequiredTransaction(this.repository, async (session) => {
      const currentTask = await this.repository.getTestTask(id, session); const currentResult = await this.repository.getTestResult(id, session);
      if (!currentTask) throw new AppError('Ophthalmology test task not found', 404, 'OPHTHALMOLOGY_TEST_TASK_NOT_FOUND');
      this.assertExpected(currentTask, { expected_status: data.expected_task_status, expected_version: data.expected_task_version });
      if (!currentResult || currentResult.status !== 'DRAFT' || currentResult.version !== data.expected_result_version) throw this.versionConflict('test result');
      await this.validateResultWrite(currentTask, this.resultVersionAsWrite(currentResult.current, data), userId, 'COMPLETED', session);
      const completed = await this.repository.completeTestResult(id, currentResult.version, currentResult.current.payload, userId, session); if (!completed) throw this.versionConflict('test result');
      const updatedTask = await this.repository.transitionTestTask(id, currentTask.status, currentTask.version, 'COMPLETED', 'COMPLETED', userId,
        null, { completedAt: new Date(), doctorReviewRequired: this.resultRequiresDoctorReview(currentResult.current.form_type,
          currentResult.current.payload, currentResult.current.reliability) }, session); if (!updatedTask) throw this.versionConflict('test task');
      await this.repository.audit('ophthalmology.test_result.completed', userId, { taskId: id, resultId: completed.id,
        contextId: task.context_id, branchId: task.branch_id, formType: completed.current.form_type,
        clinicalVersion: completed.current_clinical_version, previousTaskStatus: task.status, resultingTaskStatus: updatedTask.status,
        previousResultVersion: result.version, resultingResultVersion: completed.version }, metadata, session); return completed;
    });
  }
  async amendTestResult(id: string, data: AmendOphthalmologyTestResultDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); this.assertExpected(task, {
      expected_status: data.expected_task_status, expected_version: data.expected_task_version,
    });
    await this.assertConsultationWritable(task.visit_id);
    if (task.status !== 'COMPLETED') throw this.statusConflict('Only an unreviewed completed result can be amended');
    const reason = this.requiredReason(data.reason); const result = await this.repository.getTestResult(id);
    if (!result || result.status !== 'COMPLETED' || result.version !== data.expected_result_version) throw this.versionConflict('test result');
    await this.validateResultWrite(task, data, userId, 'COMPLETED', undefined, false);
    return executeRequiredTransaction(this.repository, async (session) => {
      const currentTask = await this.repository.getTestTask(id, session); const currentResult = await this.repository.getTestResult(id, session);
      if (!currentTask || !currentResult) throw new AppError('Ophthalmology test result not found', 404, 'OPHTHALMOLOGY_TEST_RESULT_NOT_FOUND');
      this.assertExpected(currentTask, { expected_status: data.expected_task_status, expected_version: data.expected_task_version });
      if (currentResult.version !== data.expected_result_version || currentResult.status !== 'COMPLETED') throw this.versionConflict('test result');
      const profile = await this.validateResultWrite(currentTask, data, userId, 'COMPLETED', session, false);
      const amended = await this.repository.amendTestResult(currentTask, currentResult.version, data, reason, profile, userId, session);
      if (!amended) throw this.versionConflict('test result');
      const updatedTask = await this.repository.transitionTestTask(id, currentTask.status, currentTask.version, 'COMPLETED', 'AMENDED', userId,
        reason, {}, session); if (!updatedTask) throw this.versionConflict('test task');
      await this.repository.audit('ophthalmology.test_result.amended', userId, { taskId: id, resultId: amended.id,
        contextId: task.context_id, branchId: task.branch_id, formType: amended.current.form_type, reason,
        supersededClinicalVersion: result.current_clinical_version, resultingClinicalVersion: amended.current_clinical_version,
        previousResultVersion: result.version, resultingResultVersion: amended.version }, metadata, session); return amended;
    });
  }
  async assignTestTask(id: string, data: AssignOphthalmologyTestTaskDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); return this.assignTask(task, data.expected_status, data.expected_version,
      data.station_id, data.assigned_user_id ?? null, userId, null, false, metadata);
  }
  async reassignTestTask(id: string, data: ReassignOphthalmologyTestTaskDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); return this.assignTask(task, data.expected_status, data.expected_version,
      data.station_id, data.assigned_user_id ?? null, userId, this.requiredReason(data.reason), true, metadata);
  }
  async callTestTask(id: string, data: TaskStateActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'PATIENT_WAITING') throw this.statusConflict('Calling requires PATIENT_WAITING status');
    const task = await this.requireScopedTask(id, userId); await this.requireTaskStationMember(task, userId, 'call this patient');
    return this.transitionTask(task, data, 'PATIENT_CALLED', 'CALLED', userId, null, { calledAt: new Date() }, metadata,
      (session) => this.requireTaskStationMember(task, userId, 'call this patient', session));
  }
  async patientUnavailable(id: string, data: ReasonedTaskStateActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'PATIENT_CALLED') throw this.statusConflict('Patient unavailable requires PATIENT_CALLED status');
    const task = await this.requireScopedTask(id, userId); await this.requireTaskStationMember(task, userId, 'mark the patient unavailable');
    return this.transitionTask(task, data, 'PATIENT_WAITING', 'PATIENT_UNAVAILABLE', userId,
      this.requiredReason(data.reason), { calledAt: null, waitingSince: new Date() }, metadata,
      (session) => this.requireTaskStationMember(task, userId, 'mark the patient unavailable', session));
  }
  async startTestTask(id: string, data: StartOphthalmologyTestTaskDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'PATIENT_CALLED') throw this.statusConflict('Starting requires PATIENT_CALLED status');
    const task = await this.requireScopedTask(id, userId); const code = textValue(data.device_code)?.toUpperCase() ?? null;
    await this.validateStartEligibility(task, userId, code);
    return this.transitionTask(task, data, 'IN_PROGRESS', 'STARTED', userId, null, { startedAt: new Date(), deviceCode: code ?? null }, metadata,
      (session) => this.validateStartEligibility(task, userId, code, session));
  }
  async unableTestTask(id: string, data: ReasonedTaskStateActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (!['IN_PROGRESS', 'DRAFT'].includes(data.expected_status)) throw this.statusConflict('Unable requires IN_PROGRESS or DRAFT status');
    const task = await this.requireScopedTask(id, userId); return this.transitionTask(task, data, 'UNABLE_TO_PERFORM', 'UNABLE_TO_PERFORM', userId,
      this.requiredReason(data.reason), { unableAt: new Date(), doctorReviewRequired: true }, metadata);
  }
  async cancelTestTask(id: string, data: ReasonedTaskStateActionDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    if (!['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED', 'DRAFT'].includes(data.expected_status)) throw this.statusConflict('Task cannot be cancelled from its current state');
    const task = await this.requireScopedTask(id, userId); return this.transitionTask(task, data, 'CANCELLED', 'CANCELLED', userId,
      this.requiredReason(data.reason), { cancelledAt: new Date() }, metadata);
  }
  async repeatTestTask(id: string, data: RepeatOphthalmologyTestTaskDTO, idempotencyKey: string, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId);
    await this.assertConsultationWritable(task.visit_id);
    const reason = this.requiredReason(data.reason);
    const fingerprint = this.fingerprint({ original_id: id, ...data, reason, assigned_user_id: data.assigned_user_id ?? null });
    const existing = await this.repository.getRepeatTask(id); if (existing) {
      const record = await this.repository.getTestTaskByIdempotency(task.context_id, idempotencyKey);
      if (record?.task.id === existing.id && record.fingerprint === fingerprint) return existing; throw new AppError('A repeat task already exists', 409, 'OPHTHALMOLOGY_REPEAT_CONFLICT');
    }
    this.assertExpected(task, data);
    if (!['COMPLETED', 'SUBMITTED_FOR_REVIEW'].includes(task.status)) throw this.statusConflict('Only completed or submitted tasks can be repeated');
    await this.validateTaskStation(task, data.station_id, data.assigned_user_id ?? null);
    try { return await executeRequiredTransaction(this.repository, async (session) => {
      const original = await this.repository.getTestTask(id, session); if (!original) throw new AppError('Ophthalmology test task not found', 404, 'OPHTHALMOLOGY_TEST_TASK_NOT_FOUND');
      this.assertExpected(original, data); if (!['COMPLETED', 'SUBMITTED_FOR_REVIEW'].includes(original.status)) throw this.statusConflict('Only completed or submitted tasks can be repeated');
      if (await this.repository.getRepeatTask(id, session)) throw new AppError('A repeat task already exists', 409, 'OPHTHALMOLOGY_REPEAT_CONFLICT');
      await this.validateTaskStation(original, data.station_id, data.assigned_user_id ?? null, session);
      const repeat = await this.repository.createRepeatTask(original, data.station_id, data.assigned_user_id ?? null, reason, idempotencyKey, fingerprint, userId, session);
      const linked = await this.repository.linkRepeatTask(original, repeat.id, reason, userId, session); if (!linked) throw this.versionConflict('test task');
      await this.repository.audit('ophthalmology.test_task.repeat_requested', userId, { taskId: id, repeatTaskId: repeat.id,
        contextId: task.context_id, branchId: task.branch_id, idempotencyKey, reason, previousStatus: original.status,
        resultingStatus: linked.status }, metadata, session); return repeat;
    }); } catch (error: unknown) {
      if (!duplicateKey(error)) throw error; const raced = await this.repository.getTestTaskByIdempotency(task.context_id, idempotencyKey);
      if (raced?.fingerprint === fingerprint) return raced.task; throw new AppError('A repeat task already exists', 409, 'OPHTHALMOLOGY_REPEAT_CONFLICT');
    }
  }
  async routeTestTask(id: string, data: RouteOphthalmologyTestTaskDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(id, userId); this.assertExpected(task, data);
    await this.assertConsultationWritable(task.visit_id);
    if (data.target === 'OPHTHALMOLOGIST') {
      if (!['COMPLETED', 'REVIEWED', 'UNABLE_TO_PERFORM'].includes(task.status)) throw this.statusConflict('Task cannot be routed to doctor from its current state');
      return executeRequiredTransaction(this.repository, async (session) => {
        const updated = await this.repository.routeTestTask(id, data.expected_status, data.expected_version, data.target, null, null,
          textValue(data.reason), userId, session); if (!updated) throw this.versionConflict('test task');
        await this.repository.audit('ophthalmology.test_task.routed', userId, { taskId: id, contextId: task.context_id, branchId: task.branch_id,
          target: data.target, status: updated.status, reason: textValue(data.reason) }, metadata, session); return updated;
      });
    }
    if (!['COMPLETED', 'REVIEWED'].includes(task.status) || !data.next_task_id || !data.station_id) {
      throw new AppError('Next-station routing requires a completed/reviewed source, next task, and station', 400, 'OPHTHALMOLOGY_ROUTE_INVALID');
    }
    this.validateObjectId(data.next_task_id, 'Next task id is invalid'); const target = await this.requireScopedTask(data.next_task_id, userId);
    if (target.context_id !== task.context_id || target.status !== 'ORDERED') throw new AppError('Next task must be an ordered task in the same context', 409, 'OPHTHALMOLOGY_ROUTE_INVALID');
    await this.validateTaskStation(target, data.station_id, data.assigned_user_id ?? null);
    return executeRequiredTransaction(this.repository, async (session) => {
      await this.validateTaskStation(target, data.station_id!, data.assigned_user_id ?? null, session);
      const routed = await this.repository.routeTestTask(id, data.expected_status, data.expected_version, data.target, target.id, data.station_id!,
        textValue(data.reason), userId, session); if (!routed) throw this.versionConflict('test task');
      const assigned = await this.repository.assignTestTask(target.id, 'ORDERED', target.version, data.station_id!, data.assigned_user_id ?? null,
        userId, textValue(data.reason), false, session); if (!assigned) throw this.versionConflict('next test task');
      await this.repository.audit('ophthalmology.test_task.routed', userId, { taskId: id, nextTaskId: target.id, contextId: task.context_id,
        branchId: task.branch_id, target: data.target, targetStationId: data.station_id, resultingTargetStatus: assigned.status }, metadata, session);
      return routed;
    });
  }

  private resultVersionAsWrite(version: OphthalmologyTestResultVersion, expected: CompleteOphthalmologyTestResultDTO): SaveOphthalmologyTestResultDraftDTO {
    return { expected_task_status: expected.expected_task_status, expected_task_version: expected.expected_task_version,
      expected_result_version: expected.expected_result_version, form_type: version.form_type, form_schema_version: version.form_schema_version,
      form_profile_version_id: version.form_profile_version_id, performed_at: version.performed_at.toISOString(), source_type: version.source_type,
      reliability: version.reliability, reliability_reason: version.reliability_reason, comments: version.comments,
      document_ids: version.document_ids, payload: version.payload };
  }
  private collectDocumentIds(value: unknown, key = ''): string[] {
    if (Array.isArray(value)) return value.flatMap((entry) => this.collectDocumentIds(entry, key));
    if (!value || typeof value !== 'object') return (key.endsWith('_document_id') && typeof value === 'string') ? [value] : [];
    const ids: string[] = [];
    for (const [nestedKey, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nestedKey.endsWith('_document_id') && typeof nested === 'string') ids.push(nested);
      else if (nestedKey.endsWith('_document_ids') && Array.isArray(nested)) ids.push(...nested.filter((item): item is string => typeof item === 'string'));
      else ids.push(...this.collectDocumentIds(nested, nestedKey));
    }
    return ids;
  }
  private async validateResultWrite(task: OphthalmologyTestTask, data: SaveOphthalmologyTestResultDraftDTO | AmendOphthalmologyTestResultDTO,
    userId: string, status: OphthalmologyTestResultStatus, session?: ClientSession, requireAssigned = true) {
    if (!task.station_id) throw new AppError('A station assignment is required for result entry', 409, 'OPHTHALMOLOGY_ASSIGNMENT_DENIED');
    if (requireAssigned) await this.validateStartEligibility(task, userId, task.device_code, session);
    else await this.requireTaskStationMember(task, userId, 'amend this result', session);
    if (data.source_type === 'DEVICE_IMPORT') throw new AppError('No approved device adapter is configured', 501, 'OPHTHALMOLOGY_ADAPTER_NOT_CONFIGURED');
    if (status === 'DRAFT' && data.source_type !== 'MANUAL') throw new AppError('Initial result entry must use MANUAL source', 400, 'OPHTHALMOLOGY_RESULT_SOURCE_INVALID');
    if (data.reliability === 'POOR' && !textValue(data.reliability_reason)) {
      throw new AppError('Poor reliability requires a reason', 400, 'OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED');
    }
    const performedAt = new Date(data.performed_at);
    if (Number.isNaN(performedAt.valueOf()) || performedAt > new Date(Date.now() + 5 * 60 * 1000)) {
      throw new AppError('Performed time is invalid or in the future', 400, 'OPHTHALMOLOGY_RESULT_INVALID');
    }
    this.validateObjectId(data.form_profile_version_id, 'Form profile version id is invalid');
    const profile = await this.repository.getConfiguration(data.form_profile_version_id, session);
    const activeRequired = status === 'DRAFT' || data.source_type === 'MANUAL_CORRECTION';
    if (!profile || profile.branch_id !== task.branch_id || profile.type !== 'FORM_PROFILE' || (activeRequired && profile.status !== 'ACTIVE')
      || !profileSupportsForm(profile.values, data.form_type, data.form_schema_version, task.test_code)) {
      throw new AppError('An active matching branch form profile is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    const payload = data.payload as Record<string, unknown>;
    this.validatePayloadLaterality(task, payload);
    for (const container of Object.values(payload)) if (container && typeof container === 'object' && !Array.isArray(container)) {
      const eyes = container as Record<string, unknown>;
      if (task.laterality === 'OD' && eyes.OS !== undefined && eyes.OS !== null) throw new AppError('OS data conflicts with the OD task', 400, 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID');
      if (task.laterality === 'OS' && eyes.OD !== undefined && eyes.OD !== null) throw new AppError('OD data conflicts with the OS task', 400, 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID');
    }
    await this.validateSpecializedResultReferences(task, data, profile.values, session);
    validateCoreTestPayload(data.form_type, payload, profile.values, status);
    await this.validateResultComparison(task, data, profile.values, session);
    const documentIds = [...new Set([...(data.document_ids ?? []), ...this.collectDocumentIds(payload)])];
    for (const id of documentIds) this.validateObjectId(id, 'Result document id is invalid');
    if (documentIds.length && await this.repository.validPatientDocumentCount(task.patient_id, documentIds, session) !== documentIds.length) {
      throw new AppError('Every result document must be an active document for the same patient', 400, 'OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID');
    }
    return profile;
  }

  private validatePayloadLaterality(task: OphthalmologyTestTask, payload: Record<string, unknown>) {
    const asserted: string[] = [];
    for (const key of ['eye', 'testing_eye']) if (typeof payload[key] === 'string') asserted.push(payload[key] as string);
    if (Array.isArray(payload.image_sets)) for (const set of payload.image_sets) if (set && typeof set === 'object'
      && typeof (set as Record<string, unknown>).eye === 'string') asserted.push((set as Record<string, unknown>).eye as string);
    if (task.laterality === 'OD' && asserted.some((eye) => eye === 'OS' || eye === 'OU')) {
      throw new AppError('Result eye conflicts with the OD task', 400, 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID');
    }
    if (task.laterality === 'OS' && asserted.some((eye) => eye === 'OD' || eye === 'OU')) {
      throw new AppError('Result eye conflicts with the OS task', 400, 'OPHTHALMOLOGY_RESULT_LATERALITY_INVALID');
    }
  }

  private async validateResultComparison(task: OphthalmologyTestTask,
    data: SaveOphthalmologyTestResultDraftDTO | AmendOphthalmologyTestResultDTO, profileValues: Record<string, unknown>, session?: ClientSession) {
    if (data.form_type !== 'VISUAL_FIELD' && data.form_type !== 'OCT') return;
    const comparison = (data.payload as Record<string, unknown>).comparison as Record<string, unknown> | undefined;
    if (!comparison || comparison.outcome === 'NOT_COMPARED') return;
    const resultId = comparison.result_id as string; const clinicalVersion = comparison.clinical_version as number;
    this.validateObjectId(resultId, 'Comparison result id is invalid');
    const prior = await this.repository.getTestResultById(resultId, session);
    const version = prior?.history.find((entry) => entry.clinical_version === clinicalVersion && entry.status === 'COMPLETED');
    const targetEye = ((data.payload as Record<string, unknown>).eye as string | undefined) ?? task.laterality;
    const lateralityCompatible = Boolean(version && (version.laterality === targetEye || version.laterality === 'OU' || targetEye === 'OU'));
    if (!prior || prior.id === (await this.repository.getTestResult(task.id, session))?.id || prior.patient_id !== task.patient_id
      || prior.branch_id !== task.branch_id || prior.department_id !== task.department_id || !version || version.form_type !== data.form_type || !lateralityCompatible
      || version.performed_at >= new Date(data.performed_at)) {
      throw new AppError('Comparison does not reference an eligible prior completed test version', 409, 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE');
    }
    const problem = resultComparisonProblem(data, version, profileValues, version.form_profile_snapshot);
    if (problem) throw new AppError(`Comparison is unavailable: ${problem.toLowerCase().replaceAll('_', ' ')}. Record Not Compared or select a compatible source.`, 409, 'OPHTHALMOLOGY_COMPARISON_INELIGIBLE');
  }

  private async validateSpecializedResultReferences(task: OphthalmologyTestTask,
    data: SaveOphthalmologyTestResultDraftDTO | AmendOphthalmologyTestResultDTO, profileValues: Record<string, unknown>, session?: ClientSession) {
    const payload = data.payload as Record<string, unknown>;
    if (data.form_type === 'CONTACT_LENS') {
      const lenses = payload.lens_details as Record<string, Record<string, unknown>> | undefined;
      for (const eye of ['OD', 'OS']) { const id = lenses?.[eye]?.optical_product_version_id; if (id === undefined) continue;
        if (typeof id !== 'string') throw new AppError(`${eye} optical product version id is invalid`, 400, 'VALIDATION_ERROR');
        this.validateObjectId(id, `${eye} optical product version id is invalid`); const product = await this.repository.getConfiguration(id, session);
        if (!product || product.branch_id !== task.branch_id || product.type !== 'OPTICAL_PRODUCT' || product.status !== 'ACTIVE') {
          throw new AppError(`${eye} requires an active branch optical product version`, 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
        }
      }
      const followUp = payload.follow_up as Record<string, unknown> | undefined;
      if (typeof followUp?.recommended_date === 'string') {
        const date = new Date(followUp.recommended_date); if (Number.isNaN(date.valueOf()) || date <= new Date(data.performed_at)) {
          throw new AppError('Contact lens follow-up date must be after the assessment', 400, 'OPHTHALMOLOGY_RESULT_INVALID');
        }
      }
      if (typeof followUp?.follow_up_id === 'string') {
        this.validateObjectId(followUp.follow_up_id, 'OPD follow-up id is invalid');
        if (!await this.repository.getOpdFollowUpReference(followUp.follow_up_id, task.visit_id, task.patient_id, session)) {
          throw new AppError('OPD follow-up does not belong to this visit and patient', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
        }
      }
    }
    if (data.form_type === 'PAEDIATRIC_VISION') {
      const patient = await this.repository.getPatientAssessmentContext(task.patient_id, session);
      if (!patient) throw new AppError('An active authoritative patient record is required', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
      const performed = new Date(data.performed_at); const birth = patient.date_of_birth; let months = (performed.getUTCFullYear() - birth.getUTCFullYear()) * 12
        + performed.getUTCMonth() - birth.getUTCMonth(); if (performed.getUTCDate() < birth.getUTCDate()) months -= 1;
      const maximum = profileValues.paediatric_max_age_years;
      if (typeof maximum !== 'number' || !Number.isFinite(maximum) || maximum <= 0) {
        throw new AppError('Configured paediatric maximum age is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
      }
      if (months < 0 || months >= maximum * 12) throw new AppError('Patient age is outside the configured paediatric range', 400, 'OPHTHALMOLOGY_RESULT_AGE_INVALID');
      payload.age_at_assessment_months = months; payload.guardian_recorded = patient.guardian_recorded;
      const cycloplegic = payload.cycloplegic_refraction as Record<string, unknown> | null | undefined;
      if (cycloplegic) {
        const medicationId = cycloplegic.medication_configuration_version_id;
        if (typeof medicationId !== 'string') throw new AppError('Cycloplegic medication version id is invalid', 400, 'VALIDATION_ERROR');
        this.validateObjectId(medicationId, 'Cycloplegic medication version id is invalid');
        const medication = await this.repository.getConfiguration(medicationId, session);
        if (!medication || medication.branch_id !== task.branch_id || medication.type !== 'DRUG_OPTION' || medication.status !== 'ACTIVE') {
          throw new AppError('An active branch cycloplegic drug option is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
        }
        const administered = new Date(cycloplegic.administered_at as string); const examined = new Date(cycloplegic.examined_at as string);
        if (Number.isNaN(administered.valueOf()) || Number.isNaN(examined.valueOf()) || administered > examined
          || examined > new Date(performed.getTime() + 5 * 60 * 1000)) {
          throw new AppError('Cycloplegic administration and examination times are invalid', 400, 'OPHTHALMOLOGY_RESULT_INVALID');
        }
      }
    }
  }

  async getDoctorReview(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    return this.repository.getDoctorReviewProjection(context);
  }
  async getClinicalReview(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); return this.repository.getClinicalReviewByVisit(visitId);
  }
  async saveClinicalReviewDraft(visitId: string, data: SaveOphthalmologyClinicalReviewDraftDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    await this.assertConsultationWritable(visitId);
    this.validateReviewInput(data); await this.requireDoctor(context, userId);
    return executeRequiredTransaction(this.repository, async (session) => {
      const current = await this.repository.getClinicalReviewByVisit(visitId, session);
      if ((current?.version ?? 0) !== data.expected_version) throw this.versionConflict('clinical review');
      await this.validateClinicalReviewReferences(context, data, session);
      let saved;
      try { saved = await this.repository.saveClinicalReviewDraft(context, data, userId, session); }
      catch (error) { if (duplicateKey(error)) throw this.versionConflict('clinical review'); throw error; }
      if (!saved) throw this.versionConflict('clinical review');
      await this.repository.audit('ophthalmology.clinical_review.draft_saved', userId, { reviewId: saved.id, contextId: context.id,
        visitId, patientId: context.patient_id, branchId: context.branch_id, resultingVersion: saved.version,
        clinicalVersion: saved.current_clinical_version }, metadata, session); return saved;
    });
  }
  async getOpticalPrescription(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); return this.repository.getOpticalPrescriptionByVisit(visitId);
  }
  async saveOpticalPrescriptionDraft(visitId: string, data: SaveOphthalmologyOpticalPrescriptionDraftDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    await this.assertConsultationWritable(visitId);
    await this.requireDoctor(context, userId); await this.validateOpticalInput(context, data);
    return executeRequiredTransaction(this.repository, async (session) => {
      const current = await this.repository.getOpticalPrescriptionByVisit(visitId, session);
      if ((current?.version ?? 0) !== data.expected_version || current?.status === 'APPROVED') throw this.versionConflict('optical prescription');
      let saved;
      try { saved = await this.repository.saveOpticalPrescriptionDraft(context, data, userId, session); }
      catch (error) { if (duplicateKey(error)) throw this.versionConflict('optical prescription'); throw error; }
      if (!saved) throw this.versionConflict('optical prescription');
      await this.repository.audit('ophthalmology.optical_prescription.draft_saved', userId, { prescriptionId: saved.id,
        contextId: context.id, visitId, patientId: context.patient_id, branchId: context.branch_id,
        resultingVersion: saved.version, clinicalVersion: saved.current_clinical_version }, metadata, session); return saved;
    });
  }
  async approveOpticalPrescription(visitId: string, data: ApproveOphthalmologyOpticalPrescriptionDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    const doctorId = await this.requireDoctor(context, userId);
    return executeRequiredTransaction(this.repository, async (session) => {
      const current = await this.repository.getOpticalPrescriptionByVisit(visitId, session);
      if (!current) throw new AppError('Optical prescription not found', 404, 'OPHTHALMOLOGY_OPTICAL_PRESCRIPTION_NOT_FOUND');
      if (current.status !== data.expected_status) throw this.statusConflict('Optical prescription status changed after it was loaded');
      if (current.version !== data.expected_version) throw this.versionConflict('optical prescription');
      const saved = await this.repository.approveOpticalPrescription(current.id, data.expected_version,
        current.current_clinical_version, userId, doctorId, session);
      if (!saved) throw this.versionConflict('optical prescription');
      await this.repository.audit('ophthalmology.optical_prescription.approved', userId, { prescriptionId: saved.id,
        contextId: context.id, visitId, patientId: context.patient_id, branchId: context.branch_id,
        resultingVersion: saved.version, clinicalVersion: saved.current_clinical_version }, metadata, session); return saved;
    });
  }

  async submitTestTaskForReview(taskId: string, data: TaskStateActionDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    if (data.expected_status !== 'COMPLETED') throw this.statusConflict('Only completed tests may be submitted for review');
    const task = await this.requireScopedTask(taskId, userId);
    return this.transitionTask(task, data, 'SUBMITTED_FOR_REVIEW', 'SUBMITTED_FOR_REVIEW', userId, null,
      { doctorReviewRequired: true }, metadata, async (session) => {
        await this.requireTaskStationMember(task, userId, 'submit a test for review', session);
        const result = await this.repository.getTestResult(task.id, session);
        if (!result || result.status !== 'COMPLETED' || result.current.status !== 'COMPLETED') {
          throw new AppError('Complete the current test result before submitting for review', 409, 'OPHTHALMOLOGY_REVIEW_REQUIRED');
        }
      });
  }

  async reviewTestResult(taskId: string, data: OphthalmologyResultReviewDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const task = await this.requireScopedTask(taskId, userId); const context = await this.repository.getContext(task.context_id);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND');
    await this.requireDoctor(context, userId); await this.assertConsultationWritable(task.visit_id);
    return executeRequiredTransaction(this.repository, async (session) => {
      const updated = await this.repository.reviewTestResult(task.id, data.expected_task_version, data.expected_result_version,
        data.expected_clinical_version, userId, textValue(data.comment), session);
      if (!updated) throw this.versionConflict('test result review');
      await this.repository.audit('ophthalmology.test_result.reviewed', userId, { taskId: task.id, resultClinicalVersion: data.expected_clinical_version,
        visitId: task.visit_id, patientId: task.patient_id, branchId: task.branch_id, previousVersion: data.expected_task_version,
        resultingVersion: updated.version }, metadata, session); return updated;
    });
  }

  async getCompletionReadiness(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId);
    return this.evaluateCompletionReadiness(context);
  }

  async deferResult(visitId: string, data: DeferOphthalmologyResultDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId);
    await this.requireDoctor(context, userId); this.validateObjectId(data.source_id, 'Deferred result source id is invalid');
    this.validateObjectId(data.responsible_doctor_id, 'Responsible doctor id is invalid'); const reason = this.requiredReason(data.reason);
    if (!textValue(data.review_plan) && !data.due_at) throw new AppError('A review plan or due date is required for a deferred result', 400, 'OPHTHALMOLOGY_DEFERRAL_PLAN_REQUIRED');
    if (data.due_at && new Date(data.due_at) <= new Date()) throw new AppError('Deferred result due date must be in the future', 400, 'VALIDATION_ERROR');
    return executeRequiredTransaction(this.repository, async (session) => {
      if (!await this.repository.validDeferralSource(context, data.source_type, data.source_id, session)) {
        throw new AppError('Deferred result source is outside this consultation', 409, 'OPHTHALMOLOGY_REFERENCE_MISMATCH');
      }
      if (!await this.repository.activeDoctorExists(data.responsible_doctor_id, context, session)) {
        throw new AppError('Responsible doctor is not active in this branch and department', 409, 'OPHTHALMOLOGY_DOCTOR_REQUIRED');
      }
      const finalization = await this.repository.ensureFinalization(context, userId, session);
      if (finalization.version !== data.expected_version) throw this.versionConflict('consultation finalization');
      const updated = await this.repository.addResultDeferral(finalization.id, data.expected_version, { ...data, reason }, userId, session);
      if (!updated) throw this.versionConflict('consultation finalization');
      await this.repository.audit('ophthalmology.consultation.result_deferred', userId, { finalizationId: updated.id, visitId,
        patientId: context.patient_id, branchId: context.branch_id, sourceType: data.source_type, sourceId: data.source_id,
        responsibleDoctorId: data.responsible_doctor_id, reason, resultingVersion: updated.version }, metadata, session); return updated;
    });
  }

  async overrideCompletion(visitId: string, data: OverrideOphthalmologyCompletionDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId);
    const doctorId = await this.requireDoctor(context, userId); const reason = this.requiredReason(data.reason);
    const readiness = await this.evaluateCompletionReadiness(context); const unmet = readiness.requirements.filter((entry) => !entry.satisfied);
    const actual = unmet.map((entry) => entry.code).sort(); const expected = [...new Set(data.expected_unmet_codes)].sort();
    if (actual.length === 0 || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new AppError('Unmet completion requirements changed after they were loaded', 409, 'OPHTHALMOLOGY_COMPLETION_REQUIREMENTS_CHANGED');
    }
    const configuration = await this.repository.getConfiguration(context.configuration_version_id);
    if (configuration?.values.allow_override !== true) throw new AppError('The active completion profile does not allow override', 403, 'OPHTHALMOLOGY_COMPLETION_OVERRIDE_DENIED');
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactional = await this.evaluateCompletionReadiness(context, session);
      const currentUnmet = transactional.requirements.filter((entry) => !entry.satisfied);
      if (JSON.stringify(currentUnmet.map((entry) => entry.code).sort()) !== JSON.stringify(expected)) {
        throw new AppError('Unmet completion requirements changed after they were loaded', 409, 'OPHTHALMOLOGY_COMPLETION_REQUIREMENTS_CHANGED');
      }
      const finalization = await this.repository.ensureFinalization(context, userId, session);
      if (finalization.version !== data.expected_version) throw this.versionConflict('consultation finalization');
      const updated = await this.repository.addCompletionOverride(finalization.id, data.expected_version, currentUnmet, reason, doctorId, userId, session);
      if (!updated) throw this.versionConflict('consultation finalization');
      await this.repository.audit('ophthalmology.consultation.completion_overridden', userId, { finalizationId: updated.id,
        visitId, patientId: context.patient_id, branchId: context.branch_id, unmetCodes: expected, reason, resultingVersion: updated.version }, metadata, session);
      return updated;
    });
  }

  async completeConsultation(visitId: string, data: CompleteOphthalmologyConsultationDTO, idempotencyKey: string, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    const visit = await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId);
    const doctorId = await this.requireDoctor(context, userId); this.requireCompletionDependencies();
    const fingerprint = this.fingerprint({ visitId, data }); const existing = await this.repository.getFinalizationByVisit(visitId);
    const replay = existing?.completions.find((entry) => entry.idempotency_key === idempotencyKey);
    if (replay) { if (replay.request_fingerprint !== fingerprint) throw this.idempotencyConflict(); return existing; }
    const scope = await this.visitRepository.resolveBranchScope(userId);
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactionalVisit = await this.visitRepository.getById(visitId, scope, session);
      const transactionalContext = await this.repository.getContextByVisit(visitId, session);
      const consultation = await this.consultationRepository!.getByVisit(visitId, session);
      const review = await this.repository.getClinicalReviewByVisit(visitId, session);
      const optical = await this.repository.getOpticalPrescriptionByVisit(visitId, session);
      if (!transactionalVisit || !transactionalContext || !consultation || !review) throw new AppError('Consultation completion resources are incomplete', 409, 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE');
      if (transactionalContext.version !== data.expected_context_version || consultation.version !== data.expected_consultation_version
        || review.version !== data.expected_clinical_review_version || (data.expected_optical_prescription_version !== undefined
          && (optical?.version ?? null) !== data.expected_optical_prescription_version)) throw this.versionConflict('consultation completion');
      const finalization = await this.repository.ensureFinalization(transactionalContext, userId, session);
      const racedReplay = finalization.completions.find((entry) => entry.idempotency_key === idempotencyKey);
      if (racedReplay) { if (racedReplay.request_fingerprint !== fingerprint) throw this.idempotencyConflict(); return finalization; }
      if (finalization.version !== data.expected_version) throw this.versionConflict('consultation finalization');
      const readiness = await this.evaluateCompletionReadiness(transactionalContext, session);
      const unmet = readiness.requirements.filter((entry) => !entry.satisfied); const latestOverride = finalization.overrides.at(-1);
      const requirementSnapshot = (entries: { code: string; details: string; resource_ids: string[] }[]) => this.fingerprint(entries
        .map((entry) => ({ code: entry.code, details: entry.details, resource_ids: [...entry.resource_ids].sort() }))
        .sort((a, b) => a.code.localeCompare(b.code)));
      const completionConfiguration = await this.repository.getConfiguration(transactionalContext.configuration_version_id, session);
      if (unmet.length > 0 && (completionConfiguration?.values.allow_override !== true || !latestOverride || requirementSnapshot(latestOverride.unmet_snapshot) !== requirementSnapshot(unmet))) {
        throw new AppError('Consultation completion requirements are not satisfied', 409, 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE', { requirements: unmet });
      }
      const initial = finalization.status === 'OPEN';
      if (initial && (transactionalVisit.status !== 'IN_CONSULTATION' || consultation.status !== 'DRAFT' || review.status !== 'DRAFT')) {
        throw this.statusConflict('Shared OPD consultation is not ready for completion');
      }
      if (!initial && finalization.status !== 'AMENDMENT_OPEN') throw this.statusConflict('Consultation is already completed');
      if (consultation.diagnoses.some((diagnosis) => !['OD', 'OS', 'OU'].includes(diagnosis.laterality ?? ''))) {
        throw new AppError('Ocular diagnoses require OD, OS or OU laterality', 400, 'OPD_DIAGNOSIS_LATERALITY_REQUIRED');
      }
      // Draft references may have changed since the plan was saved. A completion
      // override cannot approve a plan linked to another or deleted clinical record.
      this.validateReviewInput(review.current);
      await this.validateClinicalReviewReferences(transactionalContext, review.current, session);
      let completedConsultation = consultation;
      if (initial) {
        completedConsultation = await this.consultationRepository!.saveForVisit({ ...consultation,
          expected_version: consultation.version, expected_status: consultation.status, status: 'COMPLETED', completedAt: new Date(),
          visit: transactionalVisit, currentVersion: consultation.version, currentStatus: consultation.status }, userId, session);
        const completedVisit = await this.visitRepository.updateStatusIf(visitId, ['IN_CONSULTATION'],
          { status: 'CLINICALLY_COMPLETED', notes: consultation.assessment ?? 'Ophthalmology consultation completed.' }, userId, session, transactionalVisit.version);
        if (!completedVisit) throw new AppError('The OPD visit changed after it was loaded', 409, 'OPD_VISIT_STATUS_CONFLICT');
        if (transactionalVisit.appointment_id && !await this.appointmentRepository!.updateStatus(transactionalVisit.appointment_id,
          { status: 'CHECKED_IN', notes: 'Ophthalmology consultation signed by doctor; awaiting settlement.' }, userId, undefined, session)) {
          throw new AppError('Linked appointment not found', 409, 'OPD_APPOINTMENT_CONFLICT');
        }
      }
      if (review.status === 'DRAFT' && !await this.repository.setClinicalReviewCompleted(review.id, review.version, session)) throw this.versionConflict('clinical review');
      const resultingContext = await this.repository.setContextWorkflowStatus(transactionalContext.id, transactionalContext.version,
        initial ? ['UNDER_CONSULTATION', 'CLINICAL_REVIEW', 'REVIEW_COMPLETED'] : ['CLINICAL_REVIEW'], 'CONSULTATION_COMPLETED', userId, session);
      if (!resultingContext) throw this.versionConflict('context');
      const configuration = await this.requireCompletionConfiguration(transactionalContext, session);
      const clinicalVersion = (finalization.completions.at(-1)?.clinical_version ?? 0) + 1;
      if (initial) {
        if (!this.billingService) throw new AppError('Billing integration is unavailable', 503, 'BILLING_INTEGRATION_UNAVAILABLE');
        await this.billingService.finalizeOphthalmologyCharges(transactionalVisit, userId, metadata, session);
      }
      const summary = await this.repository.getDoctorReviewProjection(transactionalContext, session) as Record<string, unknown>;
      const completed = await this.repository.completeFinalization(finalization.id, finalization.version, { clinical_version: clinicalVersion,
        configuration_version_id: configuration.id, configuration_revision: configuration.revision, configuration_snapshot: configuration.values,
        consultation_version: completedConsultation.version, clinical_review_version: review.current_clinical_version,
        optical_prescription_version: optical?.current_clinical_version ?? null, requirements: readiness.requirements, summary,
        doctor_id: doctorId, idempotency_key: idempotencyKey, request_fingerprint: fingerprint,
        supersedes_clinical_version: initial ? null : clinicalVersion - 1 }, userId, session);
      if (!completed) throw this.versionConflict('consultation finalization');
      if (initial) await this.patientRepository!.addTimelineEvent(transactionalContext.patient_id, { event_type: 'OPD_CONSULTATION_COMPLETED',
        title: 'Ophthalmology consultation completed', description: `${visit.visit_number}: doctor-approved Ophthalmology summary recorded.` }, userId, session);
      await this.repository.audit(initial ? 'ophthalmology.consultation.completed' : 'ophthalmology.consultation.amendment_approved', userId,
        { finalizationId: completed.id, visitId, patientId: context.patient_id, branchId: context.branch_id, clinicalVersion,
          doctorId, previousVersion: finalization.version, resultingVersion: completed.version }, metadata, session);
      await this.patientRepository!.auditClinicalEvent(initial ? 'opd.consultation.completed' : 'opd.consultation.amendment_approved', userId,
        { finalizationId: completed.id, visitId, patientId: context.patient_id, clinicalVersion, doctorId,
          previousVersion: finalization.version, resultingVersion: completed.version }, session);
      return completed;
    });
  }

  async getConsultationSummary(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId);
    const [finalization, projection] = await Promise.all([this.repository.getFinalizationByVisit(visitId), this.repository.getDoctorReviewProjection(context)]);
    const summary = this.mapDoctorReviewSummary(projection);
    const sources = await this.repository.getEmergencyReferralTrace(context);
    if (sources.length > 1) throw new AppError('Multiple Emergency referrals reference this appointment. Review the source records before continuing.',
      409, 'OPHTHALMOLOGY_SOURCE_CONFLICT');
    return { finalization, summary: { ...summary, emergency_source: sources[0] ?? null } };
  }

  private mapDoctorReviewSummary(projection: {
    context: OphthalmologyContext;
    patient: Record<string, unknown> | null;
    consultation: Record<string, unknown> | null;
    tasks: Record<string, unknown>[];
    results: Record<string, unknown>[];
    previous_results: Record<string, unknown>[];
    medication_prescriptions: Record<string, unknown>[];
    clinical_orders: Record<string, unknown>[];
    procedure_recommendations: Record<string, unknown>[];
    referrals: Record<string, unknown>[];
    follow_ups: Record<string, unknown>[];
    clinical_review: OphthalmologyClinicalReview | null;
    optical_prescription: OphthalmologyOpticalPrescription | null;
  }) {
    return {
      context: projection.context,
      patient: projection.patient ? {
        id: (projection.patient as Record<string, { toString(): string }>)._id?.toString(),
        patientNumber: projection.patient.patientNumber as string | undefined,
        firstName: projection.patient.firstName as string | undefined,
        lastName: projection.patient.lastName as string | undefined,
        dateOfBirth: projection.patient.dateOfBirth ? new Date(projection.patient.dateOfBirth as string | Date).toISOString() : null,
        gender: (projection.patient.gender as string) ?? null,
        allergies: (projection.patient.allergies as string[]) ?? [],
        alerts: (projection.patient.alerts as string[]) ?? [],
      } : null,
      consultation: projection.consultation ? {
        id: (projection.consultation as Record<string, { toString(): string }>)._id?.toString(),
        assessment: (projection.consultation.assessment as string) ?? '',
        diagnoses: ((projection.consultation.diagnoses as Array<Record<string, unknown>>) ?? []).map((d) => ({
          code: d.code as string,
          display: d.display as string,
          laterality: (d.laterality as string) ?? 'NOT_APPLICABLE',
          status: (d.status as string) ?? 'CONFIRMED',
          type: (d.type as string) ?? 'PRIMARY',
        })),
      } : null,
      clinical_review: projection.clinical_review,
      optical_prescription: projection.optical_prescription,
      tasks: (projection.tasks ?? []).map((t) => {
        const tid = (t as Record<string, { toString(): string }>)._id?.toString() ?? (t.id as string);
        const tname = (t.testName as string) ?? (t.test_name as string) ?? (t.testCode as string) ?? '';
        const compAt = t.completedAt ? new Date(t.completedAt as string | Date).toISOString() : (t.completed_at as string) ?? null;
        return {
          id: tid,
          test_code: (t.testCode as string) ?? (t.test_code as string),
          test_name: tname,
          laterality: (t.laterality as string) ?? 'NOT_APPLICABLE',
          status: t.status as string,
          priority: t.priority as string,
          completed_at: compAt,
        };
      }),
      results: projection.results,
      previous_results: projection.previous_results,
      medication_prescriptions: (projection.medication_prescriptions ?? []).map((p) => {
        const pid = (p as Record<string, { toString(): string }>)._id?.toString() ?? (p.id as string);
        const rawMeds = (p.items as Array<Record<string, unknown>>) ?? (p.medications as Array<Record<string, unknown>>) ?? [];
        return {
          id: pid,
          status: p.status as string | undefined,
          medications: rawMeds.map((m) => ({
            medicine_name: (m.medicineName as string) ?? (m.medicine_name as string) ?? '',
            dosage: (m.dosage as string) ?? '',
            frequency: (m.frequency as string) ?? '',
            duration: (m.duration as string) ?? '',
            instructions: (m.instructions as string) ?? '',
          })),
        };
      }),
      clinical_orders: (projection.clinical_orders ?? []).map((o) => ({
        id: (o as Record<string, { toString(): string }>)._id?.toString() ?? (o.id as string),
        order_type: (o.orderType as string) ?? (o.order_type as string),
        status: o.status as string,
      })),
      procedure_recommendations: (projection.procedure_recommendations ?? []).map((pr) => ({
        id: (pr as Record<string, { toString(): string }>)._id?.toString() ?? (pr.id as string),
        status: pr.status as string | undefined,
        booking_id: pr.bookingId?.toString() ?? null,
        booking_status: (pr.bookingStatus as string) ?? null,
        procedure_name: (pr.serviceName as string) ?? '',
        urgency: (pr.urgency as string) ?? null,
        target_date: pr.targetDate ? new Date(pr.targetDate as string | Date).toISOString() : (pr.target_date as string) ?? null,
        reason: (pr.clinicalReason as string) ?? '',
      })),
      referrals: (projection.referrals ?? []).map((r) => ({
        id: (r as Record<string, { toString(): string }>)._id?.toString() ?? (r.id as string),
        status: r.status as string | undefined,
        appointment_id: r.appointmentId?.toString() ?? null,
        target_department_name: (r.specialty as string) ?? (r.targetDepartmentName as string) ?? '',
        target_doctor_name: (r.referredDoctorName as string) ?? (r.targetDoctorName as string) ?? null,
        reason: (r.reason as string) ?? '',
      })),
      follow_ups: (projection.follow_ups ?? []).map((f) => ({
        id: (f as Record<string, { toString(): string }>)._id?.toString() ?? (f.id as string),
        status: f.status as string | undefined,
        appointment_id: f.appointmentId?.toString() ?? null,
        follow_up_date: f.nextVisitDate ? new Date(f.nextVisitDate as string | Date).toISOString() : null,
        instructions: (f.notes as string) ?? '',
      })),
      invoices: ((projection as Record<string, unknown>).invoices as Array<Record<string, unknown>> ?? []).map((inv) => ({
        invoiceNumber: inv.invoiceNumber as string,
        status: inv.status as string,
        totalAmount: Number(inv.totalAmount ?? 0),
        paidAmount: Number(inv.paidAmount ?? 0),
        balanceAmount: Number(inv.balanceAmount ?? 0),
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate as string | Date).toISOString() : null,
      })),
    };
  }

  async escalateEmergency(visitId: string, data: EscalateOphthalmologyEmergencyDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId);
    const context = await this.requireContextForVisit(visitId);
    await this.assertConsultationWritable(visitId);
    const reason = this.requiredReason(data.reason);
    return executeRequiredTransaction(this.repository, async (session) => {
      const transactionalContext = await this.repository.getContext(context.id, session);
      if (!transactionalContext) throw this.versionConflict('context');
      const existingActive = await this.repository.getActiveAlertByContext(transactionalContext.id, session);
      if (existingActive) {
        if (existingActive.reason === reason) {
          return existingActive;
        }
        throw new AppError('An active emergency alert is already open for this encounter', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
      }
      const intake = await this.repository.getIntakeByContext(context.id, session);
      const recipients = await this.repository.eligibleOphthalmologistUserIds(transactionalContext.branch_id, transactionalContext.department_id, session);
      const triggerCodes = data.trigger_findings && data.trigger_findings.length > 0
        ? data.trigger_findings
        : ['CLINICAL_ESCALATION'];
      const alert = await this.repository.createEmergencyAlert(transactionalContext, intake, reason, userId, session, triggerCodes);
      for (const recipientUserId of recipients) {
        await this.notificationService.createNotification({
          recipient_user_id: recipientUserId,
          recipient_branch_id: transactionalContext.branch_id,
          title: 'Emergency Ophthalmology escalation review required',
          message: `Clinical escalation emergency alert created for visit ${transactionalContext.visit_id}: ${reason}`,
          type: 'GENERAL',
          related_entity_id: alert.id,
        }, session, userId);
      }
      let finalAlert = alert;
      if (recipients.length > 0) {
        const routed = await this.repository.addAlertNotifiedUsers(alert.id, alert.version, recipients, session);
        if (routed) finalAlert = routed;
      }
      await this.repository.audit('ophthalmology.emergency_alert.escalated', userId, {
        alertId: finalAlert.id,
        contextId: transactionalContext.id,
        visitId,
        branchId: transactionalContext.branch_id,
        reason,
        triggerCodes,
        notifiedUserIds: finalAlert.notified_user_ids,
        sourceVersion: finalAlert.source_version,
        resultingVersion: finalAlert.version,
      }, metadata, session);
      return finalAlert;
    });
  }

  async getPatientJourneyStatus(visitId: string, userId: string): Promise<OphthalmologyPatientJourneyStatus> {
    await this.getOphthalmologyVisit(visitId, userId);
    const context = await this.requireContextForVisit(visitId);
    const [intake, alerts, clinicalReview, optical, finalization, projection, publication] = await Promise.all([
      this.repository.getIntakeByContext(context.id),
      this.repository.getAlertsByContext(context.id),
      this.repository.getClinicalReviewByVisit(visitId),
      this.repository.getOpticalPrescriptionByVisit(visitId),
      this.repository.getFinalizationByVisit(visitId),
      this.repository.getDoctorReviewProjection(context),
      this.repository.getPublicationByVisit(visitId),
    ]);
    const tasks = projection.tasks ?? [];

    const activeEmergencyAlerts = alerts.filter((alert) => alert.type === 'EMERGENCY_SCREENING'
      && (alert.status !== 'CLEARED' || alert.clearance?.resumption_permitted !== true));
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => ['COMPLETED', 'REVIEWED'].includes(t.status)).length;
    const pendingTasks = tasks.filter((t) => !['COMPLETED', 'REVIEWED', 'REPEAT_REQUIRED', 'CANCELLED', 'UNABLE_TO_PERFORM'].includes(t.status)).length;
    const allTestsCompleted = totalTasks === 0 || pendingTasks === 0;

    const invoices = projection.invoices.filter((invoice) => invoice.status !== 'CANCELLED');
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
    const paidAmount = invoices.reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0);
    const balanceAmount = invoices.reduce((sum, inv) => sum + (inv.balanceAmount ?? 0), 0);
    const isBillingSettled = invoices.length > 0 && invoices.every((invoice) => invoice.balanceAmount <= 0);

    const unmetObligations: string[] = [];
    if (!isBillingSettled) unmetObligations.push(invoices.length ? 'Billing has an outstanding balance' : 'Billing handoff is not recorded');
    const handledPrescriptionIds = new Set<string>();
    for (const plan of clinicalReview?.current.treatment_plans ?? []) {
      if (plan.status !== 'ACTIVE') continue;
      if (plan.medication_prescription_id) {
        const prescription = projection.medication_prescriptions.find((item) => item._id.toString() === plan.medication_prescription_id);
        handledPrescriptionIds.add(plan.medication_prescription_id);
        if (!prescription || prescription.status !== 'DISPENSED') {
          unmetObligations.push(plan.priority === 'EMERGENCY' ? 'Required emergency medication is not dispensed' : 'Required medication is not dispensed');
        }
      }
      if (plan.referral_id) {
        const referral = projection.referrals.find((item) => item._id.toString() === plan.referral_id);
        if (!referral || referral.status !== 'SUBMITTED') unmetObligations.push('Required referral has not been submitted');
      }
      for (const orderId of plan.clinical_order_ids) {
        const order = projection.clinical_orders.find((item) => item._id.toString() === orderId);
        if (!order || !['VERIFIED', 'COMPLETED'].includes(order.status)) unmetObligations.push('Required diagnostic order is not completed');
      }
      if (plan.procedure_recommendation_id) {
        const procedure = projection.procedure_recommendations.find((item) => item._id.toString() === plan.procedure_recommendation_id);
        if (!procedure || procedure.bookingStatus !== 'COMPLETED') unmetObligations.push('Required procedure is not completed');
      }
    }
    for (const prescription of projection.medication_prescriptions) {
      if (!handledPrescriptionIds.has(prescription._id.toString()) && prescription.status !== 'DISPENSED') {
        unmetObligations.push('Required medication is not dispensed');
      }
    }
    if (!intake || intake.status !== 'COMPLETED') {
      unmetObligations.push('Preliminary intake examination is not completed');
    }
    if (activeEmergencyAlerts.length > 0) {
      unmetObligations.push('Emergency escalation alert is active; clinical emergency disposition required');
    }
    if (!allTestsCompleted) {
      unmetObligations.push(`${pendingTasks} diagnostic test(s) pending completion`);
    }
    if (!clinicalReview || clinicalReview.status !== 'COMPLETED') {
      unmetObligations.push('Clinical consultation review is not completed');
    }
    if (optical && optical.status !== 'APPROVED') {
      unmetObligations.push('Optical prescription is in draft status and requires approval');
    }
    if (!finalization || finalization.status !== 'COMPLETED') {
      unmetObligations.push('Specialty consultation finalization is incomplete');
    }

    const journeyCompleted = unmetObligations.length === 0;

    return {
      context,
      journey_completed: journeyCompleted,
      unmet_obligations: unmetObligations,
      stages: {
        preliminary_intake: {
          completed: intake?.status === 'COMPLETED',
          status: intake?.status ?? 'NOT_STARTED',
          emergency_alert: activeEmergencyAlerts.length > 0,
        },
        diagnostic_testing: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          all_completed: allTestsCompleted,
        },
        clinical_consultation: {
          completed: clinicalReview?.status === 'COMPLETED',
          status: clinicalReview?.status ?? 'NOT_STARTED',
          clinical_review_version: clinicalReview?.current_clinical_version ?? null,
        },
        optical_dispensing: {
          requested: Boolean(optical),
          approved: optical?.status === 'APPROVED',
          version: optical?.version ?? null,
          status: optical?.status ?? null,
        },
        downstream_care: {
          prescriptions_count: (projection.medication_prescriptions ?? []).length,
          clinical_orders_count: (projection.clinical_orders ?? []).length,
          procedure_recommendations_count: (projection.procedure_recommendations ?? []).length,
          referrals_count: (projection.referrals ?? []).length,
          follow_ups_count: (projection.follow_ups ?? []).length,
        },
        billing: {
          invoices_count: invoices.length,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
          is_settled: isBillingSettled,
        },
        portal_publication: {
          published: publication?.status === 'APPROVED_FOR_PORTAL',
          version: publication?.version ?? null,
        },
      },
    };
  }

  async getCompletionHistory(visitId: string, userId: string) {
    await this.getOphthalmologyVisit(visitId, userId); await this.requireContextForVisit(visitId);
    return this.repository.getFinalizationByVisit(visitId);
  }

  async reopenConsultation(visitId: string, data: ReopenOphthalmologyConsultationDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId); await this.requireDoctor(context, userId);
    const reason = this.requiredReason(data.reason);
    return executeRequiredTransaction(this.repository, async (session) => {
      const finalization = await this.repository.getFinalizationByVisit(visitId, session);
      if (!finalization || finalization.status !== data.expected_status || finalization.version !== data.expected_version) throw this.versionConflict('consultation finalization');
      const reopened = await this.repository.reopenFinalization(finalization.id, data.expected_version, reason, userId, session);
      if (!reopened) throw this.versionConflict('consultation finalization');
      const updatedContext = await this.repository.setContextWorkflowStatus(context.id, context.version, ['CONSULTATION_COMPLETED'], 'CLINICAL_REVIEW', userId, session);
      if (!updatedContext) throw this.versionConflict('context');
      const withdrawnPublications = await this.repository.withdrawConsultationPublications(context.id, `Consultation reopened: ${reason}`, userId, session);
      await this.repository.audit('ophthalmology.consultation.reopened', userId, { finalizationId: reopened.id, visitId,
        patientId: context.patient_id, branchId: context.branch_id, reason, withdrawnPublications, resultingVersion: reopened.version }, metadata, session); return reopened;
    });
  }

  async amendConsultation(visitId: string, data: AmendOphthalmologyConsultationDTO, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    await this.getOphthalmologyVisit(visitId, userId); const context = await this.requireContextForVisit(visitId); await this.requireDoctor(context, userId);
    this.validateObjectId(data.episode_id, 'Amendment episode id is invalid'); const reason = this.requiredReason(data.reason);
    if (JSON.stringify(canonicalize(data.before_value)) === JSON.stringify(canonicalize(data.after_value))) {
      throw new AppError('Amendment before and after values must differ', 400, 'VALIDATION_ERROR');
    }
    return executeRequiredTransaction(this.repository, async (session) => {
      const finalization = await this.repository.getFinalizationByVisit(visitId, session);
      if (!finalization || finalization.status !== data.expected_status || finalization.version !== data.expected_version) throw this.versionConflict('consultation finalization');
      if (!['patient_instructions', 'clinical_summary', 'follow_up_decision', 'treatment_plans'].includes(data.section)) throw new AppError('This amendment section requires a supported typed source correction', 422, 'OPHTHALMOLOGY_AMENDMENT_SECTION_UNSUPPORTED');
      const parsed = clinicalCorrectionSchema.safeParse({ section: data.section, after_value: data.after_value });
      if (!parsed.success) throw new AppError('Amendment section or value does not match a supported clinical source schema', 422, 'OPHTHALMOLOGY_AMENDMENT_SECTION_INVALID');
      const correction = parsed.data;
      const review = await this.repository.getClinicalReviewByVisit(visitId, session);
      if (!review) throw new AppError('Clinical review source was not found', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
      const before = review.current[correction.section];
      if (JSON.stringify(canonicalize(before)) !== JSON.stringify(canonicalize(data.before_value))) throw this.versionConflict('amendment source');
      if (correction.section === 'treatment_plans') {
        for (const plan of correction.after_value) if (plan.id && !review.current.treatment_plans.some((previous) => previous.id === plan.id)) throw new AppError('Treatment plan identity is outside this source version', 400, 'OPHTHALMOLOGY_REFERENCE_MISMATCH');
        const proposed = { expected_version: review.version, clinical_summary: review.current.clinical_summary, treatment_plans: correction.after_value,
          follow_up_decision: review.current.follow_up_decision, patient_instructions: review.current.patient_instructions };
        this.validateReviewInput(proposed); await this.validateClinicalReviewReferences(context, proposed, session);
        const beforeClinical = review.current.treatment_plans.map(({ clinician_user_id, legacy_category, ...plan }) => {
          void clinician_user_id; void legacy_category; return plan;
        });
        if (JSON.stringify(canonicalize(beforeClinical)) === JSON.stringify(canonicalize(correction.after_value))) throw new AppError('Amendment must change clinical source values', 400, 'VALIDATION_ERROR');
      } else if ((typeof correction.after_value === 'string' ? correction.after_value.trim() || null : correction.after_value) === (before ?? null)) throw new AppError('Amendment must change clinical source values', 400, 'VALIDATION_ERROR');
      if (correction.section === 'follow_up_decision') await this.validateClinicalReviewReferences(context, review.current, session);
      const corrected = await this.repository.correctClinicalReviewSection(visitId, review.version, correction, userId, session);
      if (!corrected) throw this.versionConflict('amendment source');
      const updated = await this.repository.appendAmendment(finalization.id, data.expected_version, data.episode_id,
        { ...data, before_value: before ?? null, after_value: corrected.current[correction.section], reason }, userId, session); if (!updated) throw this.versionConflict('consultation amendment');
      await this.repository.audit('ophthalmology.consultation.amended', userId, { finalizationId: updated.id, episodeId: data.episode_id,
        visitId, patientId: context.patient_id, branchId: context.branch_id, section: data.section, reason,
        beforeValueHash: this.fingerprint(data.before_value), afterValueHash: this.fingerprint(data.after_value),
        resultingVersion: updated.version }, metadata, session); return updated;
    });
  }

  private async evaluateCompletionReadiness(context: OphthalmologyContext, session?: ClientSession): Promise<OphthalmologyCompletionReadiness> {
    await this.requireEmergencyClearance(context.id, session);
    const configuration = await this.requireCompletionConfiguration(context, session);
    const required = configuration.values.required_requirements;
    if (!Array.isArray(required) || required.length === 0) throw new AppError('Completion profile requires required_requirements', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    const allowed = new Set<OphthalmologyCompletionRequirementCode>(['INTAKE_COMPLETED', 'MANDATORY_TESTS_REVIEWED', 'ALL_RESULTS_RESOLVED',
      'ALERTS_ACKNOWLEDGED', 'DIAGNOSIS_RECORDED', 'CLINICAL_REVIEW_RECORDED', 'TREATMENT_PLAN_RECORDED',
      'OPTICAL_APPROVED_IF_PRESENT', 'FOLLOW_UP_DECISION_RECORDED']);
    const codes = [...new Set(required.filter((entry): entry is OphthalmologyCompletionRequirementCode => typeof entry === 'string'
      && allowed.has(entry as OphthalmologyCompletionRequirementCode)))];
    if (codes.length !== required.length) throw new AppError('Completion profile contains unsupported requirement codes', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    const [intake, alerts, evidence, consultation, review, optical, finalization] = await Promise.all([
      this.repository.getIntakeByContext(context.id, session), this.repository.getAlertsByContext(context.id, session),
      this.repository.getCompletionEvidence(context, session), this.consultationRepository?.getByVisit(context.visit_id, session),
      this.repository.getClinicalReviewByVisit(context.visit_id, session), this.repository.getOpticalPrescriptionByVisit(context.visit_id, session),
      this.repository.getFinalizationByVisit(context.visit_id, session),
    ]);
    if (!consultation) throw new AppError('OPD consultation draft is required', 409, 'OPHTHALMOLOGY_COMPLETION_INCOMPLETE');
    if (review) {
      this.validateReviewInput(review.current);
      await this.validateClinicalReviewReferences(context, review.current, session);
    }
    const deferred = new Set(finalization?.deferrals.map((entry) => `${entry.source_type}:${entry.source_id}`) ?? []);
    const mandatoryCodes = new Set(Array.isArray(configuration.values.mandatory_test_codes)
      ? (configuration.values.mandatory_test_codes as unknown[]).filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.toUpperCase()) : []);
    const activeTasks = evidence.tasks.filter((task) => !['CANCELLED', 'UNABLE_TO_PERFORM', 'REPEAT_REQUIRED'].includes(task.status));
    if (codes.includes('MANDATORY_TESTS_REVIEWED') && mandatoryCodes.size === 0) {
      throw new AppError('Configure mandatory_test_codes for mandatory-test completion checks', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    const resolvedTask = (task: OphthalmologyTestTask) => {
      if (deferred.has(`TEST_TASK:${task.id}`)) return true;
      const result = evidence.results.find((entry) => entry.task_id === task.id);
      return task.status === 'REVIEWED' && result?.status === 'COMPLETED' && result.current.status === 'COMPLETED'
        && task.reviewed_clinical_version === result.current_clinical_version;
    };
    const mandatoryTasks = activeTasks.filter((task) => mandatoryCodes.has(task.test_code));
    const missingMandatoryCodes = [...mandatoryCodes].filter((code) => !mandatoryTasks.some((task) => task.test_code === code));
    const unresolvedOrders = evidence.clinical_orders.filter((order) => !['VERIFIED', 'COMPLETED'].includes(order.status)
      && !deferred.has(`CLINICAL_ORDER:${order.id}`));
    const checks: Record<OphthalmologyCompletionRequirementCode, { satisfied: boolean; details: string; resource_ids: string[] }> = {
      INTAKE_COMPLETED: { satisfied: intake?.status === 'COMPLETED', details: 'Ophthalmology intake must be completed.', resource_ids: intake ? [intake.id] : [] },
      MANDATORY_TESTS_REVIEWED: { satisfied: missingMandatoryCodes.length === 0 && mandatoryTasks.every(resolvedTask),
        details: missingMandatoryCodes.length ? `Required test orders are missing: ${missingMandatoryCodes.join(', ')}.` : 'Configured mandatory tests must be reviewed or explicitly deferred.', resource_ids: mandatoryTasks.filter((task) => !resolvedTask(task)).map((task) => task.id) },
      ALL_RESULTS_RESOLVED: { satisfied: activeTasks.every(resolvedTask) && unresolvedOrders.length === 0,
        details: 'All test and investigation results must be reviewed or explicitly deferred.', resource_ids: [...activeTasks.filter((task) => !resolvedTask(task)).map((task) => task.id), ...unresolvedOrders.map((order) => order.id)] },
      ALERTS_ACKNOWLEDGED: { satisfied: alerts.every((alert) => alert.status === 'ACKNOWLEDGED' || alert.status === 'CLEARED'), details: 'All active alerts must be acknowledged or clinically cleared.', resource_ids: alerts.filter((alert) => alert.status === 'ACTIVE').map((alert) => alert.id) },
      DIAGNOSIS_RECORDED: { satisfied: consultation.diagnoses.length > 0 && consultation.diagnoses.every((diagnosis) => ['OD', 'OS', 'OU'].includes(diagnosis.laterality ?? '')), details: 'Structured ocular diagnoses must include OD, OS or OU laterality.', resource_ids: [consultation.id] },
      CLINICAL_REVIEW_RECORDED: { satisfied: Boolean(review?.current.clinical_summary.trim()), details: 'Doctor clinical review must be recorded.', resource_ids: review ? [review.id] : [] },
      TREATMENT_PLAN_RECORDED: { satisfied: Boolean(review?.current.treatment_plans.length), details: 'At least one diagnosis-linked treatment plan must be recorded.', resource_ids: review ? [review.id] : [] },
      OPTICAL_APPROVED_IF_PRESENT: { satisfied: !optical || optical.status === 'APPROVED', details: 'An optical prescription must be approved when present.', resource_ids: optical ? [optical.id] : [] },
      FOLLOW_UP_DECISION_RECORDED: { satisfied: Boolean(review?.current.follow_up_decision), details: 'Follow-up or no-follow-up decision must be recorded.', resource_ids: review ? [review.id] : [] },
    };
    const requirements = codes.map((code) => ({ code, ...checks[code] }));
    return { ready: requirements.every((entry) => entry.satisfied), context_version: context.version, consultation_version: consultation.version,
      clinical_review_version: review?.version ?? null, optical_prescription_version: optical?.version ?? null,
      configuration_version_id: configuration.id, configuration_revision: configuration.revision, requirements };
  }

  private async requireCompletionConfiguration(context: OphthalmologyContext, session?: ClientSession) {
    const configuration = await this.repository.getConfiguration(context.configuration_version_id, session);
    const matches = await this.repository.getActiveCompletionProfiles(context.branch_id, context.visit_subtype, session);
    if (!configuration || configuration.type !== 'COMPLETION_PROFILE' || configuration.status !== 'ACTIVE'
      || matches.length !== 1 || matches[0]?.id !== configuration.id) {
      throw new AppError('An active completion profile matching the visit subtype is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    return configuration;
  }

  private async requireContextForVisit(visitId: string) {
    const context = await this.repository.getContextByVisit(visitId);
    if (!context) throw new AppError('Ophthalmology context not found', 404, 'OPHTHALMOLOGY_CONTEXT_NOT_FOUND'); return context;
  }

  private requireCompletionDependencies() {
    if (!this.consultationRepository || !this.appointmentRepository || !this.patientRepository) {
      throw new AppError('Ophthalmology completion integration is unavailable', 503, 'OPHTHALMOLOGY_COMPLETION_DEPENDENCY_UNAVAILABLE');
    }
  }

  private async assertConsultationWritable(visitId: string) {
    const finalization = await this.repository.getFinalizationByVisit(visitId);
    if (finalization && finalization.status !== 'OPEN') throw new AppError('Completed consultation is read-only; use the amendment workflow', 409, 'OPHTHALMOLOGY_CONSULTATION_LOCKED');
  }
  private async validateClinicalReviewReferences(context: OphthalmologyContext, data: ClinicalReviewValidationInput, session?: ClientSession) {
      const diagnoses = await this.repository.getDiagnosisKeys(context.visit_id, session);
      if (data.treatment_plans.length > 0 && diagnoses.length === 0) {
        throw new AppError('At least one consultation diagnosis is required', 400, 'OPHTHALMOLOGY_DIAGNOSIS_REQUIRED');
      }
      for (const plan of data.treatment_plans) {
        const diagnosis = diagnoses.find((item) => item.code === plan.diagnosis_code.trim().toUpperCase()
          && (item.laterality === plan.diagnosis_laterality || item.laterality === 'NOT_APPLICABLE'));
        if (!diagnosis) {
          throw new AppError('Every treatment plan must reference a current consultation diagnosis and laterality', 400, 'OPHTHALMOLOGY_DIAGNOSIS_MISMATCH');
        }
        if (diagnosis.status === 'RULED_OUT' && ['PLANNED', 'ACTIVE'].includes(plan.status)) {
          throw new AppError('Planned or active treatment cannot reference a ruled-out diagnosis', 409,
            'OPHTHALMOLOGY_RULED_OUT_DIAGNOSIS_ACTIVE_TREATMENT');
        }
      }
      if (!await this.repository.validateReviewReferences(context, data, session)) {
        throw new AppError('A treatment plan reference is outside this patient, encounter, branch, or department context', 400, 'OPHTHALMOLOGY_REFERENCE_MISMATCH');
      }
  }
  private validateReviewInput(data: ClinicalReviewValidationInput) {
    const keys = new Set<string>();
    for (const plan of data.treatment_plans) {
      for (const id of [plan.medication_prescription_id, plan.optical_prescription_id, plan.procedure_recommendation_id, plan.referral_id, plan.follow_up_id,
        ...(plan.clinical_order_ids ?? [])]) if (id) this.validateObjectId(id, 'Treatment plan reference id is invalid');
      if (new Set(plan.clinical_order_ids ?? []).size !== (plan.clinical_order_ids ?? []).length) {
        throw new AppError('Treatment plan clinical order references must be unique', 400, 'VALIDATION_ERROR');
      }
      this.validateTreatmentPlanAction(plan);
      const key = `${plan.diagnosis_code.trim().toUpperCase()}:${plan.diagnosis_laterality}:${plan.action_type}`;
      if (keys.has(key)) throw new AppError('Duplicate treatment plan entries are not allowed', 400, 'VALIDATION_ERROR'); keys.add(key);
    }
  }
  private validateTreatmentPlanAction(plan: TreatmentPlanValidationInput) {
    if (!plan.action_type) {
      throw new AppError('Treatment plan action type must be explicitly classified', 400, 'OPHTHALMOLOGY_TREATMENT_ACTION_TYPE_REQUIRED');
    }
    const present = {
      MEDICATION: Boolean(plan.medication_prescription_id), OPTICAL: Boolean(plan.optical_prescription_id),
      INVESTIGATION: Boolean(plan.clinical_order_ids?.length), PROCEDURE: Boolean(plan.procedure_recommendation_id),
      REFERRAL: Boolean(plan.referral_id), FOLLOW_UP: Boolean(plan.follow_up_id),
    } as const;
    if (plan.action_type !== 'OTHER' && !present[plan.action_type]) {
      throw new AppError(`Treatment action ${plan.action_type} requires its matching downstream reference`, 400,
        'OPHTHALMOLOGY_TREATMENT_REFERENCE_REQUIRED');
    }
    const conflicting = Object.entries(present).some(([type, hasReference]) => hasReference && type !== plan.action_type);
    if (conflicting || (plan.action_type === 'OTHER' && Object.values(present).some(Boolean))) {
      throw new AppError('Treatment action contains a reference owned by another action type', 400,
        'OPHTHALMOLOGY_TREATMENT_REFERENCE_CONFLICT');
    }
  }
  private async validateOpticalInput(context: OphthalmologyContext, data: SaveOphthalmologyOpticalPrescriptionDraftDTO) {
    if (!data.power.OD && !data.power.OS) throw new AppError('At least one eye prescription is required', 400, 'VALIDATION_ERROR');
    for (const eye of ['OD', 'OS'] as const) { const power = data.power[eye]; if (power?.cylinder != null && power.axis == null) {
      throw new AppError(`Axis is required when ${eye} cylinder is supplied`, 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED'); } }
    if (data.pupillary_distance.format === 'BINOCULAR' && data.pupillary_distance.binocular == null) {
      throw new AppError('Binocular pupillary distance is required', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    if (data.pupillary_distance.format === 'MONOCULAR' && (data.pupillary_distance.OD == null || data.pupillary_distance.OS == null)) {
      throw new AppError('OD and OS pupillary distances are required', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    if (['BIFOCAL', 'PROGRESSIVE'].includes(data.prescription_type) && (!data.segment_height
      || (data.power.OD && data.segment_height.OD == null) || (data.power.OS && data.segment_height.OS == null))) {
      throw new AppError('Segment height is required for prescribed eyes', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    const validUntil = new Date(data.valid_until); const reviewDate = data.review_date ? new Date(data.review_date) : null;
    if (validUntil <= new Date() || (reviewDate && reviewDate > validUntil)) throw new AppError('Prescription validity and review dates are invalid', 400, 'VALIDATION_ERROR');
    const configuration = await this.repository.getConfiguration(context.configuration_version_id);
    if (!configuration || configuration.status !== 'ACTIVE') throw new AppError('Active Ophthalmology configuration is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    const allowed = (key: string) => Array.isArray(configuration.values[key])
      ? new Set((configuration.values[key] as unknown[]).filter((value): value is string => typeof value === 'string').map((value) => value.toUpperCase())) : null;
    const lenses = allowed('lens_types'); const materials = allowed('lens_materials'); const coatings = allowed('coating_codes');
    if ((lenses && !lenses.has(data.lens_type.toUpperCase())) || (materials && !materials.has(data.material.toUpperCase()))
      || (coatings && data.coating_codes.some((code) => !coatings.has(code.toUpperCase())))) {
      throw new AppError('Optical selection is not in the active configuration', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
  }
  private async requireDoctor(context: OphthalmologyContext, userId: string) {
    let doctorId = await this.repository.getActiveDoctorId(userId, context.branch_id, context.department_id);
    if (!doctorId && await this.repository.isSuperAdmin(userId)) {
      doctorId = await this.repository.getAnyActiveDoctorId(context.branch_id, context.department_id);
    }
    if (!doctorId) {
      throw new AppError('An active Ophthalmology doctor is required', 403, 'OPHTHALMOLOGY_DOCTOR_REQUIRED');
    }
    return doctorId;
  }

  private resultRequiresDoctorReview(formType: string, payload: Record<string, unknown>, reliability: string) {
    if (reliability === 'POOR' || formType === 'B_SCAN' || formType === 'BIOMETRY_IOL') return true;
    if (formType === 'CONTACT_LENS' && (payload.record_stage === 'FINAL' || ['DOCTOR_REVIEW', 'CONTRAINDICATED'].includes(payload.outcome as string))) return true;
    if (formType === 'PAEDIATRIC_VISION' && Array.isArray(payload.result_codes)
      && payload.result_codes.some((value) => typeof value === 'string' && ['DEVELOPMENTAL_REVIEW', 'REPEAT'].includes(value))) return true;
    const reviewCodes = ['DOCTOR_REVIEW', 'ORTHOPTIC_REVIEW', 'URGENT_REVIEW'];
    return ['technician_observation_codes', 'impression_codes'].some((key) => Array.isArray(payload[key])
      && (payload[key] as unknown[]).some((value) => typeof value === 'string' && reviewCodes.includes(value)));
  }

  private async requireTestTask(id: string) {
    this.validateObjectId(id, 'Ophthalmology test task id is invalid'); const task = await this.repository.getTestTask(id);
    if (!task) throw new AppError('Ophthalmology test task not found', 404, 'OPHTHALMOLOGY_TEST_TASK_NOT_FOUND'); return task;
  }
  private async requireScopedTask(id: string, userId: string) { const task = await this.requireTestTask(id); await this.requireBranchAccess(userId, task.branch_id); return task; }
  private assertExpected(task: OphthalmologyTestTask, data: TaskStateActionDTO) {
    if (task.status !== data.expected_status) throw this.statusConflict('Test task status changed after it was loaded');
    if (task.version !== data.expected_version) throw this.versionConflict('test task');
  }
  private statusConflict(message: string) { return new AppError(message, 409, 'OPHTHALMOLOGY_STATUS_CONFLICT'); }
  private async validateTaskStation(task: OphthalmologyTestTask, stationId: string, assignedUserId: string | null, session?: ClientSession) {
    this.validateObjectId(stationId, 'Station id is invalid'); const station = await this.repository.getStation(stationId, session);
    if (!station || station.status !== 'ACTIVE' || station.branch_id !== task.branch_id || station.department_id !== task.department_id
      || !station.supported_test_types.includes(task.test_code)) throw new AppError('Active matching station does not support this test', 409, 'OPHTHALMOLOGY_STATION_UNAVAILABLE');
    if (assignedUserId) { this.validateObjectId(assignedUserId, 'Assigned user id is invalid');
      if (!await this.repository.eligibleTestAssignee(assignedUserId, stationId, task.branch_id, task.department_id, session)) {
        throw new AppError('Assigned user is not an eligible active station member', 409, 'OPHTHALMOLOGY_ASSIGNMENT_DENIED'); } }
  }
  private async requireTaskStationMember(task: OphthalmologyTestTask, userId: string, action: string, session?: ClientSession) {
    if (!task.station_id || !await this.repository.isStationMember(userId, task.station_id, session)) {
      throw new AppError(`Only an active station member may ${action}`, 403, 'OPHTHALMOLOGY_ASSIGNMENT_DENIED');
    }
  }
  private async validateStartEligibility(task: OphthalmologyTestTask, userId: string, deviceCode: string | null, session?: ClientSession) {
    if (!task.station_id || task.assigned_user_id !== userId
      || !await this.repository.eligibleTestAssignee(userId, task.station_id, task.branch_id, task.department_id, session)) {
      throw new AppError('Only the eligible assigned station user may start this test', 403, 'OPHTHALMOLOGY_ASSIGNMENT_DENIED');
    }
    if (task.priority !== 'EMERGENCY') await this.requireEmergencyClearance(task.context_id, session);
    const station = await this.repository.getStation(task.station_id, session);
    if (deviceCode) { const device = station?.devices.find((entry) => entry.code === deviceCode); if (!device || device.status !== 'ACTIVE'
      || device.calibration_status === 'DUE' || (device.calibration_status === 'CURRENT' && device.calibration_due_at && device.calibration_due_at <= new Date())) {
      throw new AppError('The selected station device is inactive or not currently calibrated', 409, 'OPHTHALMOLOGY_DEVICE_UNAVAILABLE'); } }
  }
  private async assignTask(task: OphthalmologyTestTask, expectedStatus: OphthalmologyTestTask['status'], expectedVersion: number,
    stationId: string, assignedUserId: string | null, userId: string, reason: string | null, reassign: boolean, metadata: OphthalmologyRequestMetadata) {
    await this.assertConsultationWritable(task.visit_id);
    if (task.status !== expectedStatus) throw this.statusConflict('Test task status changed after it was loaded'); if (task.version !== expectedVersion) throw this.versionConflict('test task');
    await this.validateTaskStation(task, stationId, assignedUserId); return executeRequiredTransaction(this.repository, async (session) => {
      await this.validateTaskStation(task, stationId, assignedUserId, session); const updated = await this.repository.assignTestTask(task.id,
        expectedStatus, expectedVersion, stationId, assignedUserId, userId, reason, reassign, session); if (!updated) throw this.versionConflict('test task');
      await this.repository.audit(reassign ? 'ophthalmology.test_task.reassigned' : 'ophthalmology.test_task.assigned', userId, { taskId: task.id,
        contextId: task.context_id, branchId: task.branch_id, previousStatus: task.status, resultingStatus: updated.status,
        stationId, assignedUserId, reason, previousVersion: task.version, resultingVersion: updated.version }, metadata, session); return updated;
    });
  }
  private async transitionTask(task: OphthalmologyTestTask, data: TaskStateActionDTO, toStatus: OphthalmologyTestTask['status'],
    action: 'SUBMITTED_FOR_REVIEW' | 'CALLED' | 'PATIENT_UNAVAILABLE' | 'STARTED' | 'DRAFT_SAVED' | 'COMPLETED' | 'AMENDED' | 'UNABLE_TO_PERFORM' | 'CANCELLED', userId: string, reason: string | null,
    set: Record<string, unknown>, metadata: OphthalmologyRequestMetadata, guard?: (session: ClientSession) => Promise<void>) {
    await this.assertConsultationWritable(task.visit_id); this.assertExpected(task, data); return executeRequiredTransaction(this.repository, async (session) => {
      if (guard) await guard(session);
      const updated = await this.repository.transitionTestTask(task.id, data.expected_status, data.expected_version, toStatus, action, userId, reason, set, session);
      if (!updated) throw this.versionConflict('test task'); await this.repository.audit(`ophthalmology.test_task.${action.toLowerCase()}`, userId,
        { taskId: task.id, contextId: task.context_id, branchId: task.branch_id, previousStatus: task.status, resultingStatus: updated.status,
          reason, previousVersion: task.version, resultingVersion: updated.version }, metadata, session); return updated;
    });
  }
  private async requireEmergencyClearance(contextId: string, session?: ClientSession) {
    const alerts = await this.repository.getAlertsByContext(contextId, session);
    const emergencyAlerts = alerts.filter((alert) => alert.type === 'EMERGENCY_SCREENING');
    if (emergencyAlerts.length === 0) return;

    const uncleared = emergencyAlerts.find((alert) => alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED');
    if (uncleared) {
      throw new AppError(
        'Emergency clinical disposition is not recorded. Acknowledgement does not clear routine care; continue the Emergency pathway.',
        409,
        'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
      );
    }

    const notPermitted = emergencyAlerts.find(
      (alert) => !alert.clearance || alert.clearance.resumption_permitted !== true,
    );
    if (notPermitted) {
      throw new AppError(
        'Emergency clearance does not permit resumption of routine OPD care; continue the Emergency or Inpatient pathway.',
        409,
        'OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED',
      );
    }
  }

  private configuredTests(configuration: OphthalmologyConfiguration) {
    const raw = configuration.values.tests; if (!Array.isArray(raw) || raw.length === 0) throw new AppError('Active test catalogue has no tests', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    return raw.filter((entry) => typeof entry !== 'object' || entry === null || !('active' in entry) || (entry as Record<string, unknown>).active === true).map((entry) => {
      if (typeof entry === 'string' && entry.trim()) return { code: entry.trim().toUpperCase(), name: entry.trim() };
      if (typeof entry !== 'object' || entry === null) throw new AppError('Invalid test catalogue entry', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
      const item = entry as Record<string, unknown>; if (typeof item.code !== 'string' || !item.code.trim()) throw new AppError('Invalid test catalogue entry', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.code.trim();
      return { code: item.code.trim().toUpperCase(), name };
    });
  }
  private fingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
  private requiredReason(value: string) { const reason = value.trim(); if (!reason) throw new AppError('A non-blank reason is required', 400, 'OPHTHALMOLOGY_REASON_REQUIRED'); return reason; }
  private idempotencyConflict() { return new AppError('Idempotency key was already used with a different request', 409, 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT'); }

  private async getOphthalmologyVisit(visitId: string, userId: string) {
    this.validateObjectId(visitId, 'OPD visit id is invalid'); const scope = await this.visitRepository.resolveBranchScope(userId);
    const visit = await this.visitRepository.getById(visitId, scope); if (!visit) throw new AppError('OPD visit not found', 404, 'NOT_FOUND');
    const isSuperAdmin = await this.repository.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      await this.requireOphthalmologyDepartment(visit.department_id, visit.branch_id);
    }
    return visit;
  }
  private async requireOphthalmologyDepartment(departmentId: string, branchId: string) {
    if (!await this.repository.isActiveOphthalmologyDepartment(departmentId, branchId)) {
      throw new AppError('The authoritative OPD visit department is not an active Ophthalmology department', 400, 'OPHTHALMOLOGY_DEPARTMENT_REQUIRED');
    }
  }
  private validateSubtypeMapping(visit: OpdVisit, subtype: OphthalmologyVisitSubtype) {
    if (visit.visit_type !== 'WALK_IN' && visit.visit_type !== sharedVisitType[subtype]) {
      throw new AppError('Ophthalmology subtype conflicts with the authoritative OPD visit type', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
    }
  }
  private initialWorkflowStatus(visit: OpdVisit): OphthalmologyWorkflowStatus {
    if (visit.status === 'CHECKED_IN') return 'CHECKED_IN';
    if (visit.status === 'WAITING_FOR_VITALS') return 'PRELIMINARY_EXAMINATION';
    if (visit.status === 'READY_FOR_CONSULTATION') return 'AWAITING_DOCTOR';
    if (visit.status === 'IN_CONSULTATION') return 'UNDER_CONSULTATION';
    throw new AppError('Ophthalmology context cannot be activated for the current OPD visit status', 409, 'OPHTHALMOLOGY_STATUS_CONFLICT');
  }
  private async validateBindings(branchId: string, subtype: OphthalmologyVisitSubtype, configurationId: string, workflowId: string, session?: ClientSession) {
    this.validateObjectId(configurationId, 'Configuration version id is invalid'); this.validateObjectId(workflowId, 'Workflow profile version id is invalid');
    const [configuration, workflow] = await Promise.all([this.repository.getConfiguration(configurationId, session), this.repository.getWorkflowProfile(workflowId, session)]);
    if (!configuration || configuration.branch_id !== branchId || configuration.status !== 'ACTIVE' || configuration.type !== 'COMPLETION_PROFILE') {
      throw new AppError('An active branch Completion Profile configuration is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    if (!workflow || workflow.branch_id !== branchId || workflow.status !== 'ACTIVE' || workflow.visit_subtype !== subtype) {
      throw new AppError('An active branch workflow profile for the visit subtype is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
  }
  private async validateIntakeConfigurationBindings(context: OphthalmologyContext, complaintId: string, emergencyId: string,
    requireActive: boolean, session?: ClientSession) {
    this.validateObjectId(complaintId, 'Complaint configuration version id is invalid');
    this.validateObjectId(emergencyId, 'Emergency configuration version id is invalid');
    const complaint = await this.repository.getConfiguration(complaintId, session);
    const emergency = await this.repository.getConfiguration(emergencyId, session);
    if (!complaint || complaint.branch_id !== context.branch_id || complaint.type !== 'COMPLAINT'
      || (requireActive && complaint.status !== 'ACTIVE')) {
      throw new AppError('A valid active branch complaint configuration is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    if (!emergency || emergency.branch_id !== context.branch_id || emergency.type !== 'CLINICAL_THRESHOLD'
      || (requireActive && emergency.status !== 'ACTIVE')) {
      throw new AppError('A valid active branch emergency-screening configuration is required', 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    return { complaint, emergency };
  }
  private async validatePreviousReports(patientId: string, documentIds: string[], session?: ClientSession) {
    for (const id of documentIds) this.validateObjectId(id, 'Previous report document id is invalid');
    if (new Set(documentIds).size !== documentIds.length) throw new AppError('Previous report document ids must be unique', 400, 'VALIDATION_ERROR');
    if (await this.repository.activePatientDocumentCount(patientId, documentIds, session) !== documentIds.length) {
      throw new AppError('Every previous report must be an active document for this patient', 400, 'OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID');
    }
  }
  private validateIntakeStructure(data: SaveOphthalmologyIntakeDraftDTO) {
    assertOphthalmologyLaterality('CONTEXT', data.affected_eye);
    for (const items of [data.complaint_codes, data.associated_symptom_codes ?? [], data.previous_eye_disease_codes ?? [],
      data.family_history_codes ?? [], data.emergency_criterion_codes ?? []]) this.validateCodeList(items);
    const positiveHistory = (data.previous_eye_disease_codes?.length ?? 0) > 0 || (data.previous_eye_surgeries?.length ?? 0) > 0
      || (data.current_eye_treatments?.length ?? 0) > 0 || (data.previous_eye_injury_or_laser?.length ?? 0) > 0
      || Boolean(data.spectacle_use?.uses) || Boolean(data.contact_lens_use?.uses) || Boolean(data.long_term_steroid_use)
      || (data.family_history_codes?.length ?? 0) > 0;
    if (data.no_significant_ophthalmic_history && positiveHistory) {
      throw new AppError('No significant ophthalmic history conflicts with positive history entries', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    for (const surgery of data.previous_eye_surgeries ?? []) {
      assertOphthalmologyLaterality('DIAGNOSIS', surgery.laterality);
      const surgeryDate = new Date(surgery.date);
      if (Number.isNaN(surgeryDate.getTime()) || surgeryDate > new Date()) throw new AppError('Previous eye surgery date is invalid', 400, 'VALIDATION_ERROR');
    }
    for (const entry of data.previous_eye_injury_or_laser ?? []) {
      assertOphthalmologyLaterality('DIAGNOSIS', entry.laterality);
      if (entry.date) { const entryDate = new Date(entry.date);
        if (Number.isNaN(entryDate.getTime()) || entryDate > new Date()) throw new AppError('Previous eye injury or laser date is invalid', 400, 'VALIDATION_ERROR'); }
    }
    for (const usage of [data.spectacle_use, data.contact_lens_use]) {
      if (usage && !usage.uses && (usage.age_months != null || usage.wearing_pattern?.trim())) {
        throw new AppError('Vision-correction details require use to be selected', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
      }
    }
    if (!data.long_term_steroid_use && data.long_term_steroid_details?.trim()) {
      throw new AppError('Steroid details require long-term steroid use to be selected', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    if ((data.emergency_criterion_codes ?? []).some((code) => ['OTHER', 'OTHER_URGENT_CONDITION'].includes(code.trim().toUpperCase()))
      && !data.other_urgent_condition_detail?.trim()) {
      throw new AppError('Other urgent condition requires details', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
  }
  private validateIntakeCompletion(intake: OphthalmologyIntake, complaint: OphthalmologyConfiguration, emergency: OphthalmologyConfiguration) {
    if (intake.complaint_codes.length === 0 || intake.duration_value == null || intake.duration_value <= 0 || !intake.duration_unit || !intake.onset) {
      throw new AppError('Complaint, positive duration, duration unit, and onset are required to complete intake', 400, 'OPHTHALMOLOGY_COMPLETION_BLOCKED');
    }
    const complaintEntries = this.configuredEntries(complaint, 'options');
    const complaintCodes = new Set(complaintEntries.map((entry) => entry.code));
    for (const code of [...intake.complaint_codes, ...intake.associated_symptom_codes]) {
      if (!complaintCodes.has(code)) throw new AppError(`Complaint code ${code} is not in the active complaint configuration`, 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    if (complaintEntries.some((entry) => intake.complaint_codes.includes(entry.code) && entry.requiresDescription) && !intake.description?.trim()) {
      throw new AppError('A configured complaint requires a description', 400, 'OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED');
    }
    const emergencyCodes = new Set(this.configuredEntries(emergency, 'criteria').map((entry) => entry.code));
    for (const code of intake.emergency_criterion_codes) {
      if (!emergencyCodes.has(code)) throw new AppError(`Emergency criterion ${code} is not in the active configuration`, 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    }
    if (!intake.shared_medical_history_reviewed || !intake.shared_allergy_reviewed) {
      throw new AppError('Shared medical history and allergy review must be confirmed', 400, 'OPHTHALMOLOGY_COMPLETION_BLOCKED');
    }
  }
  private configuredEntries(configuration: OphthalmologyConfiguration, key: 'options' | 'criteria') {
    const raw = configuration.values[key];
    if (!Array.isArray(raw) || raw.length === 0) throw new AppError(`Active ${configuration.type} configuration has no ${key}`,
      400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    const activeEntries = raw.filter((entry) => typeof entry !== 'object' || entry === null
      || !('active' in entry) || (entry as Record<string, unknown>).active === true);
    if (activeEntries.length === 0) throw new AppError(`Active ${configuration.type} configuration has no active ${key}`,
      400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
    return activeEntries.map((entry) => {
      if (typeof entry === 'string' && entry.trim()) return { code: entry.trim().toUpperCase(), label: entry.trim(), requiresDescription: false };
      if (typeof entry !== 'object' || entry === null) throw new AppError(`Invalid ${configuration.type} configuration entry`, 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
      const item = entry as Record<string, unknown>;
      if (typeof item.code !== 'string' || !item.code.trim()) {
        throw new AppError(`Invalid ${configuration.type} configuration entry`, 400, 'OPHTHALMOLOGY_CONFIGURATION_REQUIRED');
      }
      return { code: item.code.trim().toUpperCase(), label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.code.trim(),
        requiresDescription: item.requires_description === true };
    });
  }
  private emergencyReason(codes: string[], configuration: OphthalmologyConfiguration) {
    const labels = new Map(this.configuredEntries(configuration, 'criteria').map((entry) => [entry.code, entry.label]));
    return codes.map((code) => labels.get(code) ?? code).join(', ');
  }
  private validateCodeList(items: string[]) {
    const normalized = items.map((item) => item.trim().toUpperCase());
    if (normalized.some((item) => !item) || new Set(normalized).size !== normalized.length) {
      throw new AppError('Configured code selections must be non-empty and unique', 400, 'VALIDATION_ERROR');
    }
  }
  private sameContext(current: OphthalmologyContext, data: CreateOphthalmologyContextDTO) {
    return current.visit_subtype === data.visit_subtype && current.affected_eye === data.affected_eye
      && current.configuration_version_id === data.configuration_version_id
      && current.workflow_profile_version_id === data.workflow_profile_version_id;
  }
  private async requireBranchAccess(userId: string, branchId: string) {
    this.validateObjectId(branchId, 'Branch id is invalid'); if (!await this.repository.hasBranchAccess(userId, branchId)) {
      throw new AppError('Branch access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    }
  }
  private async getScopedConfiguration(id: string, userId: string) {
    this.validateObjectId(id, 'Configuration id is invalid'); const current = await this.repository.getConfiguration(id);
    if (!current) throw new AppError('Ophthalmology configuration not found', 404, 'OPHTHALMOLOGY_CONFIGURATION_NOT_FOUND');
    await this.requireBranchAccess(userId, current.branch_id); return current;
  }
  private async getScopedWorkflow(id: string, userId: string) {
    this.validateObjectId(id, 'Workflow profile id is invalid'); const current = await this.repository.getWorkflowProfile(id);
    if (!current) throw new AppError('Ophthalmology workflow profile not found', 404, 'OPHTHALMOLOGY_WORKFLOW_NOT_FOUND');
    await this.requireBranchAccess(userId, current.branch_id); return current;
  }
  private async validateStationMembers(userIds: string[], branchId: string, departmentId: string) {
    for (const id of userIds) this.validateObjectId(id, 'Station member user id is invalid');
    if (new Set(userIds).size !== userIds.length) throw new AppError('Station member users must be unique', 400, 'VALIDATION_ERROR');
    if (await this.repository.eligibleStationMemberCount(userIds, branchId, departmentId) !== userIds.length) {
      throw new AppError('Every station member must be active and assigned to the station branch and Ophthalmology department', 400, 'OPHTHALMOLOGY_ASSIGNMENT_DENIED');
    }
  }
  private validateStationLists(data: Pick<CreateOphthalmologyStationDTO, 'supported_test_types' | 'devices'>) {
    const testCodes = (data.supported_test_types ?? []).map((item) => item.trim().toUpperCase());
    const deviceCodes = (data.devices ?? []).map((item) => item.code.trim().toUpperCase());
    if (testCodes.some((item) => !item) || new Set(testCodes).size !== testCodes.length) throw new AppError('Station test types must be non-empty and unique', 400, 'VALIDATION_ERROR');
    if (deviceCodes.some((item) => !item) || new Set(deviceCodes).size !== deviceCodes.length) throw new AppError('Station device codes must be non-empty and unique', 400, 'VALIDATION_ERROR');
    for (const device of data.devices ?? []) {
      if (device.calibrated_at && device.calibration_due_at && new Date(device.calibration_due_at) <= new Date(device.calibrated_at)) {
        throw new AppError('A device calibration due date must be after its calibration date', 400, 'VALIDATION_ERROR');
      }
    }
  }
  private validateWorkflowStages(stages: CreateOphthalmologyWorkflowProfileDTO['stages']) {
    const codes = stages.map((stage) => stage.code.trim().toUpperCase());
    if (codes.length === 0 || codes.some((code) => !code) || new Set(codes).size !== codes.length) throw new AppError('Workflow stage codes must be non-empty and unique', 400, 'VALIDATION_ERROR');
    for (const stage of stages) { const tests = stage.test_codes.map((code) => code.trim().toUpperCase());
      if (tests.some((code) => !code) || new Set(tests).size !== tests.length) throw new AppError('Workflow stage test codes must be non-empty and unique', 400, 'VALIDATION_ERROR'); }
  }
  private validateObjectId(value: string, message: string) { if (!Types.ObjectId.isValid(value)) throw new AppError(message, 400, 'VALIDATION_ERROR'); }
  private versionConflict(resource: string) { return new AppError(`The Ophthalmology ${resource} changed after it was loaded`, 409, 'OPHTHALMOLOGY_VERSION_CONFLICT'); }
}
