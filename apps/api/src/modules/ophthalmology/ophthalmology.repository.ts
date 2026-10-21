import type { ClinicalCorrection } from './ophthalmology-clinical-correction.js';
import type { OphthalmologyAssignmentLookupQuery } from './ophthalmology.types.js';
import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { publicationDocumentIds, synchronizeAttachmentPublication } from './ophthalmology-phase10.repository.js';
import { OphthalmologyPublicationModel } from './ophthalmology-phase10.model.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { EmergencyEncounterModel } from '../emergency/emergency.model.js';
import { OpdConsultationModel } from '../opd/opd-consultation.model.js';
import { OpdClinicalOrderModel } from '../opd/opd-clinical-order.model.js';
import { OpdFollowUpModel } from '../opd/opd-follow-up.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { OpdPrescriptionModel } from '../opd/opd-prescription.model.js';
import { OpdReferralModel } from '../opd/opd-referral.model.js';
import { PatientDocumentModel, PatientModel } from '../patients/patient.model.js';
import { ProcedureBookingModel, ProcedureRecommendationModel } from '../surgery/surgery.model.js';
import { PermissionModel } from '../permissions/permission.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import {
  OphthalmologyConfigurationModel,
  OphthalmologyContextModel,
  OphthalmologyStationModel,
  OphthalmologyWorkflowProfileModel,
  type OphthalmologyConfigurationFields,
  type OphthalmologyContextFields,
  type OphthalmologyStationFields,
  type OphthalmologyWorkflowProfileFields,
} from './ophthalmology.model.js';
import {
  OphthalmologyAlertModel,
  OphthalmologyIntakeModel,
  type OphthalmologyAlertFields,
  type OphthalmologyIntakeFields,
} from './ophthalmology-intake.model.js';
import { OphthalmologyTestTaskModel, type OphthalmologyTestTaskFields } from './ophthalmology-test-task.model.js';
import { OphthalmologyTestResultModel, type OphthalmologyTestResultFields,
  type OphthalmologyTestResultVersionFields } from './ophthalmology-test-result.model.js';
import { OphthalmologyClinicalReviewModel, OphthalmologyOpticalPrescriptionModel,
  type OphthalmologyClinicalReviewFields, type OphthalmologyClinicalReviewVersionFields,
  type OphthalmologyOpticalPrescriptionFields, type OphthalmologyOpticalPrescriptionVersionFields } from './ophthalmology-review.model.js';
import { OphthalmologyConsultationFinalizationModel,
  type OphthalmologyConsultationFinalizationFields } from './ophthalmology-consultation.model.js';
import type {
  CreateOphthalmologyConfigurationDTO,
  CreateOphthalmologyContextDTO,
  CreateOphthalmologyStationDTO,
  CreateOphthalmologyWorkflowProfileDTO,
  OphthalmologyConfiguration,
  OphthalmologyConfigurationListQuery,
  OphthalmologyConfigurationStatus,
  OphthalmologyConfigurationType,
  OphthalmologyContext,
  OphthalmologyAlert,
  OphthalmologyIntake,
  OphthalmologyRequestMetadata,
  OphthalmologyStation,
  OphthalmologyStationListQuery,
  OphthalmologyVisitSubtype,
  OphthalmologyWorkflowProfile,
  OphthalmologyWorkflowProfileListQuery,
  OphthalmologyWorkflowStatus,
  OphthalmologyTestTask,
  OphthalmologyTestTaskListQuery,
  OphthalmologyTestTaskStatus,
  CreateOphthalmologyTestTaskDTO,
  SaveOphthalmologyIntakeDraftDTO,
  UpdateOphthalmologyConfigurationDTO,
  UpdateOphthalmologyContextDTO,
  UpdateOphthalmologyStationDTO,
  UpdateOphthalmologyWorkflowProfileDTO,
  OphthalmologyTestResult,
  SaveOphthalmologyTestResultDraftDTO,
  AmendOphthalmologyTestResultDTO,
  OphthalmologyClinicalReview,
  OphthalmologyOpticalPrescription,
  SaveOphthalmologyClinicalReviewDraftDTO,
  SaveOphthalmologyOpticalPrescriptionDraftDTO,
  OphthalmologyCompletionRequirement,
} from './ophthalmology.types.js';
import type { OpdVisit } from '../opd/opd-visit.types.js';

type ContextRecord = OphthalmologyContextFields & { _id: Types.ObjectId };
type ConfigurationRecord = OphthalmologyConfigurationFields & { _id: Types.ObjectId };
type StationRecord = OphthalmologyStationFields & { _id: Types.ObjectId };
type WorkflowRecord = OphthalmologyWorkflowProfileFields & { _id: Types.ObjectId };
type IntakeRecord = OphthalmologyIntakeFields & { _id: Types.ObjectId };
type AlertRecord = OphthalmologyAlertFields & { _id: Types.ObjectId };
type TestTaskRecord = OphthalmologyTestTaskFields & { _id: Types.ObjectId };
type TestResultRecord = OphthalmologyTestResultFields & { _id: Types.ObjectId };
type ClinicalReviewRecord = OphthalmologyClinicalReviewFields & { _id: Types.ObjectId };
type OpticalPrescriptionRecord = OphthalmologyOpticalPrescriptionFields & { _id: Types.ObjectId };
type FinalizationRecord = OphthalmologyConsultationFinalizationFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const text = (value?: string | null) => value?.trim() || null;
const date = (value?: string | null) => value ? new Date(value) : null;
const pageMeta = (total: number, page: number, limit: number) => ({ total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toClinicalReviewVersion = (item: OphthalmologyClinicalReviewVersionFields) => ({
  clinical_version: item.clinicalVersion, clinical_summary: item.clinicalSummary,
  follow_up_decision: item.followUpDecision ?? null, patient_instructions: item.patientInstructions ?? null,
  treatment_plans: item.treatmentPlans.map((plan) => ({ id: plan._id.toString(), diagnosis_code: plan.diagnosisCode,
    diagnosis_laterality: plan.diagnosisLaterality, treatment: plan.treatment, category: plan.category, priority: plan.priority,
    status: plan.status, medication_prescription_id: plan.medicationPrescriptionId?.toString() ?? null,
    clinical_order_ids: plan.clinicalOrderIds.map(String), procedure_recommendation_id: plan.procedureRecommendationId?.toString() ?? null,
    referral_id: plan.referralId?.toString() ?? null, follow_up_id: plan.followUpId?.toString() ?? null,
    clinician_user_id: plan.clinicianUserId.toString() })),
  created_by: item.createdBy.toString(), created_at: item.createdAt,
});
const toClinicalReview = (item: ClinicalReviewRecord): OphthalmologyClinicalReview => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), current_clinical_version: item.currentClinicalVersion,
  status: item.status, current: toClinicalReviewVersion(item.versions[item.versions.length - 1]!),
  history: item.versions.map(toClinicalReviewVersion), version: item.version, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toOpticalVersion = (item: OphthalmologyOpticalPrescriptionVersionFields) => ({
  clinical_version: item.clinicalVersion, status: item.status, prescription_type: item.prescriptionType,
  power: { OD: item.power.OD ? { sphere: item.power.OD.sphere, cylinder: item.power.OD.cylinder ?? null, axis: item.power.OD.axis ?? null,
    addition: item.power.OD.addition ?? null, prism: item.power.OD.prism ?? null, prism_base: item.power.OD.prismBase ?? null } : null,
    OS: item.power.OS ? { sphere: item.power.OS.sphere, cylinder: item.power.OS.cylinder ?? null, axis: item.power.OS.axis ?? null,
      addition: item.power.OS.addition ?? null, prism: item.power.OS.prism ?? null, prism_base: item.power.OS.prismBase ?? null } : null },
  pupillary_distance: item.pupillaryDistance, segment_height: item.segmentHeight ?? null, lens_type: item.lensType,
  material: item.material, coating_codes: item.coatingCodes, usage_instructions: item.usageInstructions, valid_until: item.validUntil,
  review_date: item.reviewDate ?? null, approver_user_id: item.approverUserId?.toString() ?? null,
  approver_doctor_id: item.approverDoctorId?.toString() ?? null, approved_at: item.approvedAt ?? null,
  created_by: item.createdBy.toString(), created_at: item.createdAt,
});
const toOpticalPrescription = (item: OpticalPrescriptionRecord): OphthalmologyOpticalPrescription => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), current_clinical_version: item.currentClinicalVersion,
  status: item.status, current: toOpticalVersion(item.versions[item.versions.length - 1]!), history: item.versions.map(toOpticalVersion),
  version: item.version, created_at: item.createdAt, updated_at: item.updatedAt,
});

const toContext = (item: ContextRecord): OphthalmologyContext => ({
  id: item._id.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), doctor_id: item.doctorId.toString(),
  visit_subtype: item.visitSubtype, affected_eye: item.affectedEye, workflow_status: item.workflowStatus,
  configuration_version_id: item.configurationVersionId.toString(), workflow_profile_version_id: item.workflowProfileVersionId.toString(),
  version: item.version ?? 0, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toConfiguration = (item: ConfigurationRecord): OphthalmologyConfiguration => ({
  id: item._id.toString(), branch_id: item.branchId.toString(), type: item.type, code: item.code, name: item.name,
  description: item.description ?? null, revision: item.revision, status: item.status, effective_from: item.effectiveFrom ?? null,
  effective_to: item.effectiveTo ?? null, values: item.values ?? {}, version: item.version ?? 0,
  created_at: item.createdAt, updated_at: item.updatedAt,
});
const toStation = (item: StationRecord): OphthalmologyStation => ({
  id: item._id.toString(), branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), code: item.code,
  name: item.name, description: item.description ?? null, status: item.status,
  supported_test_types: item.supportedTestTypes ?? [], member_user_ids: (item.memberUserIds ?? []).map(String),
  devices: (item.devices ?? []).map((device) => ({ code: device.code, name: device.name, status: device.status,
    calibration_status: device.calibrationStatus, calibrated_at: device.calibratedAt ?? null,
    calibration_due_at: device.calibrationDueAt ?? null })), version: item.version ?? 0,
  created_at: item.createdAt, updated_at: item.updatedAt,
});
const toWorkflow = (item: WorkflowRecord): OphthalmologyWorkflowProfile => ({
  id: item._id.toString(), branch_id: item.branchId.toString(), visit_subtype: item.visitSubtype, name: item.name,
  revision: item.revision, status: item.status, effective_from: item.effectiveFrom ?? null, effective_to: item.effectiveTo ?? null,
  stages: (item.stages ?? []).map((stage) => ({ code: stage.code, name: stage.name, mode: stage.mode,
    test_codes: stage.testCodes ?? [], bypass_allowed: stage.bypassAllowed })), version: item.version ?? 0,
  created_at: item.createdAt, updated_at: item.updatedAt,
});
const toIntake = (item: IntakeRecord): OphthalmologyIntake => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), status: item.status,
  complaint_configuration_version_id: item.complaintConfigurationVersionId.toString(), emergency_configuration_version_id: item.emergencyConfigurationVersionId.toString(),
  complaint_codes: item.complaintCodes ?? [], affected_eye: item.affectedEye, duration_value: item.durationValue ?? null,
  duration_unit: item.durationUnit ?? null, onset: item.onset ?? null, progression: item.progression ?? null, severity: item.severity ?? null,
  associated_symptom_codes: item.associatedSymptomCodes ?? [], description: item.description ?? null,
  no_significant_ophthalmic_history: item.noSignificantOphthalmicHistory, previous_eye_disease_codes: item.previousEyeDiseaseCodes ?? [],
  previous_eye_surgeries: (item.previousEyeSurgeries ?? []).map((entry) => ({ procedure: entry.procedure, laterality: entry.laterality, date: entry.date })),
  current_eye_treatments: (item.currentEyeTreatments ?? []).map((entry) => ({ type: entry.type, details: entry.details })),
  previous_eye_injury_or_laser: (item.previousEyeInjuryOrLaser ?? []).map((entry) => ({ type: entry.type, laterality: entry.laterality,
    date: entry.date ?? null, details: entry.details })),
  spectacle_use: { uses: item.spectacleUse?.uses ?? false, age_months: item.spectacleUse?.ageMonths ?? null,
    wearing_pattern: item.spectacleUse?.wearingPattern ?? null },
  contact_lens_use: { uses: item.contactLensUse?.uses ?? false, age_months: item.contactLensUse?.ageMonths ?? null,
    wearing_pattern: item.contactLensUse?.wearingPattern ?? null },
  long_term_steroid_use: item.longTermSteroidUse, long_term_steroid_details: item.longTermSteroidDetails ?? null,
  family_history_codes: item.familyHistoryCodes ?? [], previous_report_document_ids: (item.previousReportDocumentIds ?? []).map(String),
  shared_medical_history_reviewed: item.sharedMedicalHistoryReviewed, shared_allergy_reviewed: item.sharedAllergyReviewed,
  emergency_criterion_codes: item.emergencyCriterionCodes ?? [], other_urgent_condition_detail: item.otherUrgentConditionDetail ?? null,
  completed_by: item.completedBy?.toString() ?? null, completed_at: item.completedAt ?? null, version: item.version ?? 0,
  created_at: item.createdAt, updated_at: item.updatedAt,
});
const toAlert = (item: AlertRecord): OphthalmologyAlert => ({
  id: item._id.toString(), context_id: item.contextId.toString(), intake_id: item.intakeId.toString(), visit_id: item.visitId.toString(),
  patient_id: item.patientId.toString(), branch_id: item.branchId.toString(), department_id: item.departmentId.toString(),
  type: item.type, status: item.status, source_version: item.sourceVersion, criterion_codes: item.criterionCodes ?? [], reason: item.reason,
  notified_user_ids: (item.notifiedUserIds ?? []).map(String), triggered_by: item.triggeredBy.toString(), triggered_at: item.triggeredAt,
  acknowledged_by: item.acknowledgedBy?.toString() ?? null, acknowledged_at: item.acknowledgedAt ?? null,
  acknowledgement_note: item.acknowledgementNote ?? null, version: item.version ?? 0, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toTestTask = (item: TestTaskRecord): OphthalmologyTestTask => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), test_catalogue_version_id: item.testCatalogueVersionId.toString(),
  workflow_profile_version_id: item.workflowProfileVersionId.toString(), workflow_stage_code: item.workflowStageCode ?? null,
  test_code: item.testCode, test_name: item.testName, laterality: item.laterality, priority: item.priority, source_type: item.sourceType,
  source_order_id: item.sourceOrderId?.toString() ?? null, source_order_item_id: item.sourceOrderItemId?.toString() ?? null,
  source_order_type: item.sourceOrderType ?? null, status: item.status, station_id: item.stationId?.toString() ?? null,
  assigned_user_id: item.assignedUserId?.toString() ?? null, device_code: item.deviceCode ?? null,
  special_instructions: item.specialInstructions ?? null, doctor_review_required: item.doctorReviewRequired,
  repeat_of_task_id: item.repeatOfTaskId?.toString() ?? null, repeat_task_id: item.repeatTaskId?.toString() ?? null,
  repeat_root_task_id: item.repeatRootTaskId?.toString() ?? null,
  assignment_history: (item.assignmentHistory ?? []).map((entry) => ({ action: entry.action,
    from_station_id: entry.fromStationId?.toString() ?? null, to_station_id: entry.toStationId.toString(),
    from_user_id: entry.fromUserId?.toString() ?? null, to_user_id: entry.toUserId?.toString() ?? null,
    reason: entry.reason ?? null, actor_user_id: entry.actorUserId.toString(), occurred_at: entry.occurredAt })),
  transition_history: (item.transitionHistory ?? []).map((entry) => ({ action: entry.action, from_status: entry.fromStatus,
    to_status: entry.toStatus, reason: entry.reason ?? null, actor_user_id: entry.actorUserId.toString(), occurred_at: entry.occurredAt })),
  routing_history: (item.routingHistory ?? []).map((entry) => ({ target: entry.target,
    target_task_id: entry.targetTaskId?.toString() ?? null, target_station_id: entry.targetStationId?.toString() ?? null,
    reason: entry.reason ?? null, actor_user_id: entry.actorUserId.toString(), occurred_at: entry.occurredAt })),
  ordered_at: item.orderedAt, assigned_at: item.assignedAt ?? null, waiting_since: item.waitingSince ?? null,
  called_at: item.calledAt ?? null, started_at: item.startedAt ?? null, completed_at: item.completedAt ?? null, unable_at: item.unableAt ?? null,
  cancelled_at: item.cancelledAt ?? null, reviewed_by: item.reviewedBy?.toString() ?? null, reviewed_at: item.reviewedAt ?? null,
  reviewed_clinical_version: item.reviewedClinicalVersion ?? null, review_comment: item.reviewComment ?? null,
  version: item.version ?? 0, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toResultVersion = (item: OphthalmologyTestResultVersionFields) => ({
  clinical_version: item.clinicalVersion, status: item.status, form_type: item.formType, form_schema_version: item.formSchemaVersion,
  form_profile_version_id: item.formProfileVersionId.toString(), form_profile_revision: item.formProfileRevision,
  form_profile_snapshot: item.formProfileSnapshot ?? {}, laterality: item.laterality, station_id: item.stationId.toString(),
  device_code: item.deviceCode ?? null, performer_user_id: item.performerUserId.toString(), performed_at: item.performedAt,
  device_snapshot: item.deviceSnapshot ? { code: item.deviceSnapshot.code, name: item.deviceSnapshot.name,
    calibration_status: item.deviceSnapshot.calibrationStatus, calibrated_at: item.deviceSnapshot.calibratedAt ?? null,
    calibration_due_at: item.deviceSnapshot.calibrationDueAt ?? null } : null,
  source_type: item.sourceType, reliability: item.reliability, reliability_reason: item.reliabilityReason ?? null,
  comments: item.comments ?? null, document_ids: (item.documentIds ?? []).map(String), payload: item.payload ?? {},
  supersedes_clinical_version: item.supersedesClinicalVersion ?? null, amendment_reason: item.amendmentReason ?? null,
  completed_at: item.completedAt ?? null, created_by: item.createdBy.toString(), created_at: item.createdAt,
});
const toTestResult = (item: TestResultRecord): OphthalmologyTestResult => {
  const history = item.versions.map(toResultVersion); const current = history.find((entry) => entry.clinical_version === item.currentClinicalVersion);
  if (!current) throw new Error('Ophthalmology result current version is missing');
  return { id: item._id.toString(), task_id: item.taskId.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(),
    patient_id: item.patientId.toString(), branch_id: item.branchId.toString(), department_id: item.departmentId.toString(),
    current_clinical_version: item.currentClinicalVersion, status: item.status, current, history, version: item.version ?? 0,
    created_at: item.createdAt, updated_at: item.updatedAt };
};
const toFinalization = (item: FinalizationRecord) => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), status: item.status, version: item.version,
  deferrals: item.deferrals.map((entry) => ({ id: entry._id.toString(), source_type: entry.sourceType, source_id: entry.sourceId.toString(),
    reason: entry.reason, review_plan: entry.reviewPlan ?? null, due_at: entry.dueAt ?? null,
    responsible_doctor_id: entry.responsibleDoctorId.toString(), recorded_by: entry.recordedBy.toString(), recorded_at: entry.recordedAt })),
  overrides: item.overrides.map((entry) => ({ id: entry._id.toString(), unmet_codes: entry.unmetCodes,
    unmet_snapshot: entry.unmetSnapshot.map((requirement) => ({ code: requirement.code, details: requirement.details, resource_ids: requirement.resourceIds })),
    reason: entry.reason, doctor_id: entry.doctorId.toString(), actor_user_id: entry.actorUserId.toString(), created_at: entry.createdAt })),
  completions: item.completions.map((entry) => ({ clinical_version: entry.clinicalVersion,
    configuration_version_id: entry.configurationVersionId.toString(), configuration_revision: entry.configurationRevision,
    configuration_snapshot: entry.configurationSnapshot, consultation_version: entry.consultationVersion,
    clinical_review_version: entry.clinicalReviewVersion, optical_prescription_version: entry.opticalPrescriptionVersion ?? null,
    requirement_snapshot: entry.requirementSnapshot.map((requirement) => ({ code: requirement.code, satisfied: requirement.satisfied,
      details: requirement.details, resource_ids: requirement.resourceIds })), summary_snapshot: entry.summarySnapshot,
    approver_user_id: entry.approverUserId.toString(), approver_doctor_id: entry.approverDoctorId.toString(), approved_at: entry.approvedAt,
    idempotency_key: entry.idempotencyKey, request_fingerprint: entry.requestFingerprint,
    supersedes_clinical_version: entry.supersedesClinicalVersion ?? null })),
  amendment_episodes: item.amendmentEpisodes.map((entry) => ({ id: entry._id.toString(), source_clinical_version: entry.sourceClinicalVersion,
    reason: entry.reason, status: entry.status, opened_by: entry.openedBy.toString(), opened_at: entry.openedAt,
    changes: entry.changes.map((change) => ({ section: change.section, before_value: change.beforeValue,
      after_value: change.afterValue, reason: change.reason, changed_by: change.changedBy.toString(), changed_at: change.changedAt })) })),
  created_at: item.createdAt, updated_at: item.updatedAt,
});
const uniqueCodes = (items?: string[]) => [...new Set((items ?? []).map((item) => item.trim().toUpperCase()))];
const intakeSet = (data: SaveOphthalmologyIntakeDraftDTO) => ({
  complaintConfigurationVersionId: oid(data.complaint_configuration_version_id), emergencyConfigurationVersionId: oid(data.emergency_configuration_version_id),
  complaintCodes: uniqueCodes(data.complaint_codes), affectedEye: data.affected_eye, durationValue: data.duration_value ?? null,
  durationUnit: data.duration_unit ?? null, onset: data.onset ?? null, progression: data.progression ?? null, severity: data.severity ?? null,
  associatedSymptomCodes: uniqueCodes(data.associated_symptom_codes), description: text(data.description),
  noSignificantOphthalmicHistory: data.no_significant_ophthalmic_history, previousEyeDiseaseCodes: uniqueCodes(data.previous_eye_disease_codes),
  previousEyeSurgeries: (data.previous_eye_surgeries ?? []).map((entry) => ({ procedure: entry.procedure.trim(), laterality: entry.laterality, date: new Date(entry.date) })),
  currentEyeTreatments: (data.current_eye_treatments ?? []).map((entry) => ({ type: entry.type.trim(), details: entry.details.trim() })),
  previousEyeInjuryOrLaser: (data.previous_eye_injury_or_laser ?? []).map((entry) => ({ type: entry.type, laterality: entry.laterality,
    date: entry.date ? new Date(entry.date) : null, details: entry.details.trim() })),
  spectacleUse: { uses: data.spectacle_use?.uses ?? false, ageMonths: data.spectacle_use?.age_months ?? null,
    wearingPattern: text(data.spectacle_use?.wearing_pattern) },
  contactLensUse: { uses: data.contact_lens_use?.uses ?? false, ageMonths: data.contact_lens_use?.age_months ?? null,
    wearingPattern: text(data.contact_lens_use?.wearing_pattern) },
  longTermSteroidUse: data.long_term_steroid_use ?? false, longTermSteroidDetails: text(data.long_term_steroid_details),
  familyHistoryCodes: uniqueCodes(data.family_history_codes), previousReportDocumentIds: (data.previous_report_document_ids ?? []).map(oid),
  sharedMedicalHistoryReviewed: data.shared_medical_history_reviewed ?? false, sharedAllergyReviewed: data.shared_allergy_reviewed ?? false,
  emergencyCriterionCodes: uniqueCodes(data.emergency_criterion_codes), otherUrgentConditionDetail: text(data.other_urgent_condition_detail),
});
const devices = (items: CreateOphthalmologyStationDTO['devices'] | UpdateOphthalmologyStationDTO['devices']) =>
  items?.map((item) => ({ code: item.code.trim().toUpperCase(), name: item.name.trim(), status: item.status ?? 'ACTIVE',
    calibrationStatus: item.calibration_status ?? 'NOT_REQUIRED', calibratedAt: date(item.calibrated_at),
    calibrationDueAt: date(item.calibration_due_at) }));
const stages = (items: CreateOphthalmologyWorkflowProfileDTO['stages']) => items.map((item) => ({
  code: item.code.trim().toUpperCase(), name: item.name.trim(), mode: item.mode,
  testCodes: [...new Set(item.test_codes.map((code) => code.trim().toUpperCase()))], bypassAllowed: item.bypass_allowed,
}));

export class OphthalmologyRepository {
  session() { return mongoose.startSession(); }

  async hasBranchAccess(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('branchIds roleIds').lean(),
      BranchModel.exists({ _id: oid(branchId), status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch) return false;
    if ((user.branchIds ?? []).some((id) => id.toString() === branchId)) return true;
    return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }));
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('roleIds').lean();
    if (!user) return false;
    return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }));
  }

  async getAnyActiveDoctorId(branchId: string, departmentId?: string): Promise<string | null> {
    const filter: Record<string, unknown> = { branchId: oid(branchId), status: 'ACTIVE', deletedAt: null };
    if (departmentId) filter.departmentId = oid(departmentId);
    const doc = await DoctorModel.findOne(filter).select('_id').lean();
    return doc?._id.toString() ?? null;
  }

  async isActiveOphthalmologyDepartment(departmentId: string, branchId: string) {
    return Boolean(await DepartmentModel.exists({
      _id: oid(departmentId), branchIds: oid(branchId), status: 'ACTIVE', isClinical: true, deletedAt: null,
      $or: [{ code: /^OPHTHALMOLOGY$/i }, { name: /^OPHTHALMOLOGY$/i }],
    }));
  }

  async eligibleStationMemberCount(userIds: string[], branchId: string, departmentId: string) {
    if (userIds.length === 0) return 0;
    return UserModel.countDocuments({
      _id: { $in: userIds.map(oid) }, branchIds: oid(branchId), departmentIds: oid(departmentId), status: 'active', deletedAt: null,
    });
  }

  async getContextByVisit(visitId: string, session?: ClientSession) {
    const query = OphthalmologyContextModel.findOne({ visitId: oid(visitId) });
    if (session) query.session(session);
    const item = await query.lean<ContextRecord>();
    return item ? toContext(item) : null;
  }
  async getContext(id: string, session?: ClientSession) {
    const query = OphthalmologyContextModel.findById(oid(id)); if (session) query.session(session);
    const item = await query.lean<ContextRecord>(); return item ? toContext(item) : null;
  }

  async createContext(
    visit: OpdVisit,
    data: CreateOphthalmologyContextDTO,
    workflowStatus: OphthalmologyWorkflowStatus,
    userId: string,
    session: ClientSession,
  ) {
    const records = await OphthalmologyContextModel.create([{
      visitId: oid(visit.id), patientId: oid(visit.patient_id), branchId: oid(visit.branch_id), departmentId: oid(visit.department_id),
      doctorId: oid(visit.doctor_id), visitSubtype: data.visit_subtype, affectedEye: data.affected_eye, workflowStatus,
      configurationVersionId: oid(data.configuration_version_id), workflowProfileVersionId: oid(data.workflow_profile_version_id),
      version: 0, createdBy: oid(userId), updatedBy: oid(userId),
    }], { session });
    const record = records[0];
    if (!record) throw new Error('Ophthalmology context creation failed');
    return toContext(record.toObject<ContextRecord>());
  }

  async updateContext(id: string, currentVersion: number, data: UpdateOphthalmologyContextDTO, userId: string, session: ClientSession) {
    const record = await OphthalmologyContextModel.findOneAndUpdate(
      { _id: oid(id), version: currentVersion },
      { $set: { ...(data.visit_subtype ? { visitSubtype: data.visit_subtype } : {}),
        ...(data.affected_eye ? { affectedEye: data.affected_eye } : {}),
        ...(data.workflow_profile_version_id ? { workflowProfileVersionId: oid(data.workflow_profile_version_id) } : {}),
        updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<ContextRecord>();
    return record ? toContext(record) : null;
  }

  async getConfiguration(id: string, session?: ClientSession) {
    const query = OphthalmologyConfigurationModel.findById(oid(id)); if (session) query.session(session);
    const item = await query.lean<ConfigurationRecord>(); return item ? toConfiguration(item) : null;
  }
  async getActiveCompletionProfiles(branchId: string, subtype: OphthalmologyVisitSubtype, session?: ClientSession) {
    const query = OphthalmologyConfigurationModel.find({ branchId: oid(branchId), type: 'COMPLETION_PROFILE', status: 'ACTIVE',
      'values.visit_subtypes': subtype }); if (session) query.session(session);
    return (await query.lean<ConfigurationRecord[]>()).map(toConfiguration);
  }
  async listConfigurations(query: OphthalmologyConfigurationListQuery) {
    const currentPage = query.page ?? 1; const currentLimit = query.limit ?? 20;
    const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.type) filter.type = query.type; if (query.status) filter.status = query.status;
    if (query.code) filter.code = query.code.trim().toUpperCase();
    if (query.search) { const rx = new RegExp(escapeRegex(query.search), 'i'); filter.$or = [{ code: rx }, { name: rx }]; }
    const [rows, total] = await Promise.all([
      OphthalmologyConfigurationModel.find(filter).sort({ type: 1, code: 1, revision: -1 }).skip((currentPage - 1) * currentLimit).limit(currentLimit).lean<ConfigurationRecord[]>(),
      OphthalmologyConfigurationModel.countDocuments(filter),
    ]);
    return { data: rows.map(toConfiguration), meta: pageMeta(total, currentPage, currentLimit) };
  }
  async nextConfigurationRevision(branchId: string, type: OphthalmologyConfigurationType, code: string) {
    const latest = await OphthalmologyConfigurationModel.findOne({ branchId: oid(branchId), type, code }).sort({ revision: -1 }).select('revision').lean();
    return (latest?.revision ?? 0) + 1;
  }
  async createConfiguration(data: CreateOphthalmologyConfigurationDTO, revision: number, userId: string) {
    const record = await OphthalmologyConfigurationModel.create({ branchId: oid(data.branch_id), type: data.type,
      code: data.code.trim().toUpperCase(), name: data.name.trim(), description: text(data.description), revision, status: 'DRAFT',
      effectiveFrom: date(data.effective_from), values: data.values ?? {}, version: 0, createdBy: oid(userId), updatedBy: oid(userId) });
    return toConfiguration(record.toObject<ConfigurationRecord>());
  }
  async updateConfiguration(id: string, data: UpdateOphthalmologyConfigurationDTO, userId: string) {
    const record = await OphthalmologyConfigurationModel.findOneAndUpdate(
      { _id: oid(id), status: 'DRAFT', version: data.expected_version },
      { $set: { ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: text(data.description) } : {}),
        ...(data.effective_from !== undefined ? { effectiveFrom: date(data.effective_from) } : {}),
        ...(data.values !== undefined ? { values: data.values } : {}), updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true },
    ).lean<ConfigurationRecord>(); return record ? toConfiguration(record) : null;
  }
  async deactivateOtherConfigurations(current: OphthalmologyConfiguration, userId: string, session: ClientSession) {
    await OphthalmologyConfigurationModel.updateMany(
      { _id: { $ne: oid(current.id) }, branchId: oid(current.branch_id), type: current.type, code: current.code, status: 'ACTIVE' },
      { $set: { status: 'INACTIVE', effectiveTo: new Date(), deactivatedBy: oid(userId), deactivatedAt: new Date(),
        deactivationReason: 'Superseded by a newer active revision', updatedBy: oid(userId) }, $inc: { version: 1 } }, { session });
  }
  async setConfigurationStatus(id: string, expectedVersion: number, fromStatus: OphthalmologyConfigurationStatus, status: 'ACTIVE' | 'INACTIVE', userId: string, reason: string | null, session: ClientSession) {
    const now = new Date();
    const record = await OphthalmologyConfigurationModel.findOneAndUpdate(
      { _id: oid(id), version: expectedVersion, status: fromStatus },
      { $set: { status, ...(status === 'ACTIVE' ? { effectiveFrom: now, effectiveTo: null } : { effectiveTo: now,
        deactivatedBy: oid(userId), deactivatedAt: now, deactivationReason: reason }), updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<ConfigurationRecord>(); return record ? toConfiguration(record) : null;
  }

  async getStation(id: string, session?: ClientSession) { const query = OphthalmologyStationModel.findById(oid(id)); if (session) query.session(session); const item = await query.lean<StationRecord>(); return item ? toStation(item) : null; }
  async listStations(query: OphthalmologyStationListQuery) {
    const currentPage = query.page ?? 1; const currentLimit = query.limit ?? 20; const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.status) filter.status = query.status; if (query.test_type) filter.supportedTestTypes = query.test_type.trim().toUpperCase();
    if (query.search) { const rx = new RegExp(escapeRegex(query.search), 'i'); filter.$or = [{ code: rx }, { name: rx }]; }
    const [rows, total] = await Promise.all([OphthalmologyStationModel.find(filter).sort({ name: 1, _id: 1 }).skip((currentPage - 1) * currentLimit).limit(currentLimit).lean<StationRecord[]>(), OphthalmologyStationModel.countDocuments(filter)]);
    return { data: rows.map(toStation), meta: pageMeta(total, currentPage, currentLimit) };
  }
  async createStation(data: CreateOphthalmologyStationDTO, userId: string) {
    const record = await OphthalmologyStationModel.create({ branchId: oid(data.branch_id), departmentId: oid(data.department_id),
      code: data.code.trim().toUpperCase(), name: data.name.trim(), description: text(data.description), status: 'ACTIVE',
      supportedTestTypes: [...new Set((data.supported_test_types ?? []).map((item) => item.trim().toUpperCase()))],
      devices: devices(data.devices) ?? [], memberUserIds: (data.member_user_ids ?? []).map(oid), version: 0,
      createdBy: oid(userId), updatedBy: oid(userId) }); return toStation(record.toObject<StationRecord>());
  }
  async updateStation(id: string, data: UpdateOphthalmologyStationDTO, userId: string) {
    const record = await OphthalmologyStationModel.findOneAndUpdate({ _id: oid(id), version: data.expected_version },
      { $set: { ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: text(data.description) } : {}),
        ...(data.supported_test_types ? { supportedTestTypes: [...new Set(data.supported_test_types.map((item) => item.trim().toUpperCase()))] } : {}),
        ...(data.devices ? { devices: devices(data.devices) } : {}), ...(data.member_user_ids ? { memberUserIds: data.member_user_ids.map(oid) } : {}),
        updatedBy: oid(userId) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true }).lean<StationRecord>();
    return record ? toStation(record) : null;
  }
  async setStationStatus(id: string, expectedVersion: number, fromStatus: 'ACTIVE', userId: string, session: ClientSession) {
    const record = await OphthalmologyStationModel.findOneAndUpdate(
      { _id: oid(id), version: expectedVersion, status: fromStatus },
      { $set: { status: 'INACTIVE', updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<StationRecord>();
    return record ? toStation(record) : null;
  }

  async getWorkflowProfile(id: string, session?: ClientSession) { const query = OphthalmologyWorkflowProfileModel.findById(oid(id)); if (session) query.session(session); const item = await query.lean<WorkflowRecord>(); return item ? toWorkflow(item) : null; }
  async listWorkflowProfiles(query: OphthalmologyWorkflowProfileListQuery) {
    const currentPage = query.page ?? 1; const currentLimit = query.limit ?? 20; const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.visit_subtype) filter.visitSubtype = query.visit_subtype; if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([OphthalmologyWorkflowProfileModel.find(filter).sort({ visitSubtype: 1, revision: -1 }).skip((currentPage - 1) * currentLimit).limit(currentLimit).lean<WorkflowRecord[]>(), OphthalmologyWorkflowProfileModel.countDocuments(filter)]);
    return { data: rows.map(toWorkflow), meta: pageMeta(total, currentPage, currentLimit) };
  }
  async nextWorkflowRevision(branchId: string, subtype: OphthalmologyVisitSubtype) { const latest = await OphthalmologyWorkflowProfileModel.findOne({ branchId: oid(branchId), visitSubtype: subtype }).sort({ revision: -1 }).select('revision').lean(); return (latest?.revision ?? 0) + 1; }
  async createWorkflowProfile(data: CreateOphthalmologyWorkflowProfileDTO, revision: number, userId: string) {
    const record = await OphthalmologyWorkflowProfileModel.create({ branchId: oid(data.branch_id), visitSubtype: data.visit_subtype,
      name: data.name.trim(), revision, status: 'DRAFT', effectiveFrom: date(data.effective_from), stages: stages(data.stages), version: 0,
      createdBy: oid(userId), updatedBy: oid(userId) }); return toWorkflow(record.toObject<WorkflowRecord>());
  }
  async updateWorkflowProfile(id: string, data: UpdateOphthalmologyWorkflowProfileDTO, userId: string) {
    const record = await OphthalmologyWorkflowProfileModel.findOneAndUpdate({ _id: oid(id), status: 'DRAFT', version: data.expected_version },
      { $set: { ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.effective_from !== undefined ? { effectiveFrom: date(data.effective_from) } : {}),
        ...(data.stages ? { stages: stages(data.stages) } : {}), updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true }).lean<WorkflowRecord>(); return record ? toWorkflow(record) : null;
  }
  async deactivateOtherWorkflows(current: OphthalmologyWorkflowProfile, userId: string, session: ClientSession) {
    await OphthalmologyWorkflowProfileModel.updateMany({ _id: { $ne: oid(current.id) }, branchId: oid(current.branch_id), visitSubtype: current.visit_subtype, status: 'ACTIVE' },
      { $set: { status: 'INACTIVE', effectiveTo: new Date(), deactivatedBy: oid(userId), deactivatedAt: new Date(), deactivationReason: 'Superseded by a newer active revision', updatedBy: oid(userId) }, $inc: { version: 1 } }, { session });
  }
  async setWorkflowStatus(id: string, expectedVersion: number, fromStatus: OphthalmologyConfigurationStatus, status: 'ACTIVE' | 'INACTIVE', userId: string, reason: string | null, session: ClientSession) {
    const now = new Date(); const record = await OphthalmologyWorkflowProfileModel.findOneAndUpdate({ _id: oid(id), version: expectedVersion, status: fromStatus },
      { $set: { status, ...(status === 'ACTIVE' ? { effectiveFrom: now, effectiveTo: null } : { effectiveTo: now, deactivatedBy: oid(userId), deactivatedAt: now, deactivationReason: reason }), updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<WorkflowRecord>(); return record ? toWorkflow(record) : null;
  }

  async getIntakeByContext(contextId: string, session?: ClientSession) {
    const query = OphthalmologyIntakeModel.findOne({ contextId: oid(contextId) }); if (session) query.session(session);
    const item = await query.lean<IntakeRecord>(); return item ? toIntake(item) : null;
  }
  async createIntake(context: OphthalmologyContext, data: SaveOphthalmologyIntakeDraftDTO, userId: string, session: ClientSession) {
    const records = await OphthalmologyIntakeModel.create([{ contextId: oid(context.id), visitId: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), departmentId: oid(context.department_id), status: 'DRAFT', ...intakeSet(data), version: 0,
      createdBy: oid(userId), updatedBy: oid(userId) }], { session });
    const record = records[0]; if (!record) throw new Error('Ophthalmology intake creation failed');
    return toIntake(record.toObject<IntakeRecord>());
  }
  async updateIntakeDraft(id: string, expectedVersion: number, data: SaveOphthalmologyIntakeDraftDTO, userId: string, session: ClientSession) {
    const record = await OphthalmologyIntakeModel.findOneAndUpdate({ _id: oid(id), status: 'DRAFT', version: expectedVersion },
      { $set: { ...intakeSet(data), updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<IntakeRecord>();
    return record ? toIntake(record) : null;
  }
  async completeIntake(id: string, expectedVersion: number, userId: string, session: ClientSession) {
    const now = new Date();
    const record = await OphthalmologyIntakeModel.findOneAndUpdate({ _id: oid(id), status: 'DRAFT', version: expectedVersion },
      { $set: { status: 'COMPLETED', completedBy: oid(userId), completedAt: now, updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<IntakeRecord>();
    return record ? toIntake(record) : null;
  }
  async setContextWorkflowForIntake(contextId: string, expectedVersion: number, userId: string, session: ClientSession) {
    const record = await OphthalmologyContextModel.findOneAndUpdate({ _id: oid(contextId), version: expectedVersion,
      workflowStatus: { $in: ['CHECKED_IN', 'PRELIMINARY_EXAMINATION'] } },
      { $set: { workflowStatus: 'AWAITING_DOCTOR', updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<ContextRecord>();
    return record ? toContext(record) : null;
  }
  async activePatientDocumentCount(patientId: string, documentIds: string[], session?: ClientSession) {
    if (documentIds.length === 0) return 0;
    const query = PatientDocumentModel.countDocuments({ _id: { $in: documentIds.map(oid) }, patientId: oid(patientId), status: 'ACTIVE' });
    if (session) query.session(session); return query;
  }
  async getSharedHistory(visitId: string) {
    const item = await OpdConsultationModel.findOne({ visitId: oid(visitId), deletedAt: null })
      .select('historyPresentIllness pastHistory familyHistory allergies').lean();
    return { history_present_illness: item?.historyPresentIllness ?? null, past_history: item?.pastHistory ?? null,
      family_history: item?.familyHistory ?? null, allergies: item?.allergies ?? null };
  }
  async resolveDepartmentScope(userId: string): Promise<string[] | null> {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('departmentIds roleIds').lean();
    if (!user) return [];
    if (await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null })) return null;
    return (user.departmentIds ?? []).map((id) => id.toString());
  }

  async eligibleOphthalmologistUserIds(branchId: string, departmentId: string, session?: ClientSession) {
    const permissionQuery = PermissionModel.findOne({ module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View', status: 'active', deletedAt: null }).select('_id');
    if (session) permissionQuery.session(session); const permission = await permissionQuery.lean(); if (!permission) return [];
    const roleQuery = RoleModel.find({ permissionIds: permission._id, status: 'active', deletedAt: null }).select('_id');
    if (session) roleQuery.session(session); const roles = await roleQuery.lean(); if (roles.length === 0) return [];
    const userQuery = UserModel.find({ roleIds: { $in: roles.map((role) => role._id) }, branchIds: oid(branchId), departmentIds: oid(departmentId),
      status: 'active', deletedAt: null }).select('_id');
    if (session) userQuery.session(session); const users = await userQuery.lean(); if (users.length === 0) return [];
    const doctorQuery = DoctorModel.find({ userId: { $in: users.map((user) => user._id) }, branchId: oid(branchId), departmentId: oid(departmentId),
      status: 'ACTIVE', deletedAt: null }).select('userId');
    if (session) doctorQuery.session(session); const doctors = await doctorQuery.lean();
    return doctors.flatMap((doctor) => doctor.userId ? [doctor.userId.toString()] : []);
  }
  async getAlertsByContext(contextId: string, session?: ClientSession) {
    const query = OphthalmologyAlertModel.find({ contextId: oid(contextId) }).sort({ triggeredAt: -1 }); if (session) query.session(session);
    return (await query.lean<AlertRecord[]>()).map(toAlert);
  }
  async getAlert(id: string, session?: ClientSession) {
    const query = OphthalmologyAlertModel.findById(oid(id)); if (session) query.session(session);
    const item = await query.lean<AlertRecord>(); return item ? toAlert(item) : null;
  }
  async createEmergencyAlert(context: OphthalmologyContext, intake: OphthalmologyIntake, reason: string, userId: string, session: ClientSession) {
    const now = new Date();
    const records = await OphthalmologyAlertModel.create([{ contextId: oid(context.id), intakeId: oid(intake.id), visitId: oid(context.visit_id),
      patientId: oid(context.patient_id), branchId: oid(context.branch_id), departmentId: oid(context.department_id), type: 'EMERGENCY_SCREENING',
      status: 'ACTIVE', sourceVersion: intake.version, criterionCodes: intake.emergency_criterion_codes, reason, notifiedUserIds: [],
      triggeredBy: oid(userId), triggeredAt: now, version: 0 }], { session });
    const record = records[0]; if (!record) throw new Error('Ophthalmology alert creation failed'); return toAlert(record.toObject<AlertRecord>());
  }
  async addAlertNotifiedUsers(id: string, expectedVersion: number, userIds: string[], session: ClientSession) {
    if (userIds.length === 0) return this.getAlert(id, session);
    const record = await OphthalmologyAlertModel.findOneAndUpdate({ _id: oid(id), status: 'ACTIVE', version: expectedVersion },
      { $addToSet: { notifiedUserIds: { $each: userIds.map(oid) } }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<AlertRecord>(); return record ? toAlert(record) : null;
  }
  async acknowledgeAlert(id: string, expectedVersion: number, userId: string, note: string | null, session: ClientSession) {
    const now = new Date();
    const record = await OphthalmologyAlertModel.findOneAndUpdate({ _id: oid(id), status: 'ACTIVE', version: expectedVersion },
      { $set: { status: 'ACKNOWLEDGED', acknowledgedBy: oid(userId), acknowledgedAt: now, acknowledgementNote: note }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<AlertRecord>(); return record ? toAlert(record) : null;
  }

  async getTestTask(id: string, session?: ClientSession) {
    const query = OphthalmologyTestTaskModel.findById(oid(id)); if (session) query.session(session);
    const item = await query.lean<TestTaskRecord>(); return item ? toTestTask(item) : null;
  }
  async priorResultVersions(task: OphthalmologyTestTask, current: OphthalmologyTestResult, page: number, limit: number) {
    const pipeline: PipelineStage[] = [
      { $match: { patientId: oid(task.patient_id), branchId: oid(task.branch_id), departmentId: oid(task.department_id), _id: { $ne: oid(current.id) }, 'versions.formType': current.current.form_type } },
      { $unwind: '$versions' },
      { $match: { 'versions.status': 'COMPLETED', 'versions.formType': current.current.form_type, 'versions.performedAt': { $lt: current.current.performed_at } } },
      { $sort: { 'versions.performedAt': -1, _id: 1, 'versions.clinicalVersion': -1 } },
    ];
    type Prior = { result_id: string; clinical_version: number; form_type: string; form_schema_version: string; performed_at: Date; payload: Record<string, unknown>; profile: Record<string, unknown> };
    const [data, counts] = await Promise.all([
      OphthalmologyTestResultModel.aggregate<Prior>([...pipeline, { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { _id: 0, result_id: { $toString: '$_id' }, clinical_version: '$versions.clinicalVersion', form_type: '$versions.formType', form_schema_version: '$versions.formSchemaVersion', performed_at: '$versions.performedAt',
          payload: { eye: '$versions.payload.eye', machine: '$versions.payload.machine', program: '$versions.payload.program', strategy: '$versions.payload.strategy', oct_type: '$versions.payload.oct_type', requested_scans: '$versions.payload.requested_scans', result_indices: '$versions.payload.result_indices', measurements: '$versions.payload.measurements' },
          profile: { comparison_units: '$versions.formProfileSnapshot.comparison_units' } } }]),
      OphthalmologyTestResultModel.aggregate<{ total: number }>([...pipeline, { $count: 'total' }]),
    ]);
    const total = counts[0]?.total ?? 0;
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getTestResult(taskId: string, session?: ClientSession) {
    const query = OphthalmologyTestResultModel.findOne({ taskId: oid(taskId) }); if (session) query.session(session);
    const item = await query.lean<TestResultRecord>(); return item ? toTestResult(item) : null;
  }
  async getTestResultById(id: string, session?: ClientSession) {
    const query = OphthalmologyTestResultModel.findById(oid(id)); if (session) query.session(session);
    const item = await query.lean<TestResultRecord>(); return item ? toTestResult(item) : null;
  }
  async getPatientAssessmentContext(patientId: string, session?: ClientSession) {
    const query = PatientModel.findOne({ _id: oid(patientId), status: 'ACTIVE', deletedAt: null }).select('dateOfBirth parentGuardian').lean();
    if (session) query.session(session); const patient = await query;
    return patient ? { date_of_birth: patient.dateOfBirth, guardian_recorded: Boolean(patient.parentGuardian?.trim()) } : null;
  }
  async getOpdFollowUpReference(id: string, visitId: string, patientId: string, session?: ClientSession) {
    const query = OpdFollowUpModel.findOne({ _id: oid(id), visitId: oid(visitId), patientId: oid(patientId), deletedAt: null }).select('_id').lean();
    if (session) query.session(session); return Boolean(await query);
  }
  async validPatientDocumentCount(patientId: string, documentIds: string[], session?: ClientSession) {
    if (documentIds.length === 0) return 0;
    const query = PatientDocumentModel.countDocuments({ _id: { $in: documentIds.map(oid) }, patientId: oid(patientId), status: 'ACTIVE' });
    if (session) query.session(session); return query;
  }
  async createTestResultDraft(task: OphthalmologyTestTask, data: SaveOphthalmologyTestResultDraftDTO,
    profile: OphthalmologyConfiguration, userId: string, session: ClientSession) {
    const now = new Date(); const station = await this.getStation(task.station_id!, session);
    const device = station?.devices.find((item) => item.code === task.device_code);
    const version = {
      clinicalVersion: 1, status: 'DRAFT' as const, formType: data.form_type, formSchemaVersion: data.form_schema_version,
      formProfileVersionId: oid(profile.id), formProfileRevision: profile.revision, formProfileSnapshot: profile.values,
      laterality: task.laterality, stationId: oid(task.station_id!), deviceCode: task.device_code,
      deviceSnapshot: device ? { code: device.code, name: device.name, calibrationStatus: device.calibration_status,
        calibratedAt: device.calibrated_at, calibrationDueAt: device.calibration_due_at } : null, performerUserId: oid(userId),
      performedAt: new Date(data.performed_at), sourceType: data.source_type, reliability: data.reliability,
      reliabilityReason: text(data.reliability_reason), comments: text(data.comments), documentIds: (data.document_ids ?? []).map(oid),
      payload: data.payload as Record<string, unknown>, supersedesClinicalVersion: null, amendmentReason: null,
      completedAt: null, createdBy: oid(userId), createdAt: now,
    };
    const records = await OphthalmologyTestResultModel.create([{ taskId: oid(task.id), contextId: oid(task.context_id), visitId: oid(task.visit_id),
      patientId: oid(task.patient_id), branchId: oid(task.branch_id), departmentId: oid(task.department_id), currentClinicalVersion: 1,
      status: 'DRAFT', versions: [version], version: 0, createdBy: oid(userId), updatedBy: oid(userId) }], { session });
    const record = records[0]; if (!record) throw new Error('Ophthalmology test result creation failed');
    return toTestResult(record.toObject<TestResultRecord>());
  }
  async updateTestResultDraft(task: OphthalmologyTestTask, expectedVersion: number, data: SaveOphthalmologyTestResultDraftDTO,
    profile: OphthalmologyConfiguration, userId: string, session: ClientSession) {
    const now = new Date(); const station = await this.getStation(task.station_id!, session);
    const device = station?.devices.find((item) => item.code === task.device_code); const set = {
      'versions.$[current].formType': data.form_type, 'versions.$[current].formSchemaVersion': data.form_schema_version,
      'versions.$[current].formProfileVersionId': oid(profile.id), 'versions.$[current].formProfileRevision': profile.revision,
      'versions.$[current].formProfileSnapshot': profile.values, 'versions.$[current].performedAt': new Date(data.performed_at),
      'versions.$[current].deviceCode': task.device_code, 'versions.$[current].deviceSnapshot': device ? { code: device.code, name: device.name,
        calibrationStatus: device.calibration_status, calibratedAt: device.calibrated_at, calibrationDueAt: device.calibration_due_at } : null,
      'versions.$[current].sourceType': data.source_type, 'versions.$[current].reliability': data.reliability,
      'versions.$[current].reliabilityReason': text(data.reliability_reason), 'versions.$[current].comments': text(data.comments),
      'versions.$[current].documentIds': (data.document_ids ?? []).map(oid), 'versions.$[current].payload': data.payload,
      'versions.$[current].createdBy': oid(userId), 'versions.$[current].createdAt': now, updatedBy: oid(userId),
    };
    const record = await OphthalmologyTestResultModel.findOneAndUpdate({ taskId: oid(task.id), status: 'DRAFT', version: expectedVersion },
      { $set: set, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session,
        arrayFilters: [{ 'current.clinicalVersion': 1, 'current.status': 'DRAFT' }] }).lean<TestResultRecord>();
    return record ? toTestResult(record) : null;
  }
  async completeTestResult(taskId: string, expectedVersion: number, payload: Record<string, unknown>, userId: string, session: ClientSession) {
    const now = new Date(); const record = await OphthalmologyTestResultModel.findOneAndUpdate({ taskId: oid(taskId), status: 'DRAFT', version: expectedVersion },
      { $set: { status: 'COMPLETED', 'versions.$[current].status': 'COMPLETED', 'versions.$[current].completedAt': now,
        'versions.$[current].payload': payload, updatedBy: oid(userId) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session,
        arrayFilters: [{ 'current.clinicalVersion': 1, 'current.status': 'DRAFT' }] }).lean<TestResultRecord>();
    return record ? toTestResult(record) : null;
  }
  async amendTestResult(task: OphthalmologyTestTask, expectedVersion: number, data: AmendOphthalmologyTestResultDTO,
    reason: string, profile: OphthalmologyConfiguration, userId: string, session: ClientSession) {
    const current = await this.getTestResult(task.id, session); if (!current || current.version !== expectedVersion || current.status !== 'COMPLETED') return null;
    const now = new Date(); const nextClinicalVersion = current.current_clinical_version + 1;
    const station = await this.getStation(task.station_id!, session); const device = station?.devices.find((item) => item.code === task.device_code);
    const next = { clinicalVersion: nextClinicalVersion, status: 'COMPLETED' as const, formType: data.form_type,
      formSchemaVersion: data.form_schema_version, formProfileVersionId: oid(profile.id), formProfileRevision: profile.revision,
      formProfileSnapshot: profile.values, laterality: task.laterality, stationId: oid(task.station_id!), deviceCode: task.device_code,
      deviceSnapshot: device ? { code: device.code, name: device.name, calibrationStatus: device.calibration_status,
        calibratedAt: device.calibrated_at, calibrationDueAt: device.calibration_due_at } : null,
      performerUserId: oid(userId), performedAt: new Date(data.performed_at), sourceType: data.source_type,
      reliability: data.reliability, reliabilityReason: text(data.reliability_reason), comments: text(data.comments),
      documentIds: (data.document_ids ?? []).map(oid), payload: data.payload as Record<string, unknown>,
      supersedesClinicalVersion: current.current_clinical_version, amendmentReason: reason, completedAt: now,
      createdBy: oid(userId), createdAt: now };
    const record = await OphthalmologyTestResultModel.findOneAndUpdate({ taskId: oid(task.id), status: 'COMPLETED', version: expectedVersion,
      currentClinicalVersion: current.current_clinical_version }, { $set: { currentClinicalVersion: nextClinicalVersion, updatedBy: oid(userId) },
      $push: { versions: next }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<TestResultRecord>();
    return record ? toTestResult(record) : null;
  }
  async getTestTaskByIdempotency(contextId: string, key: string, session?: ClientSession) {
    const query = OphthalmologyTestTaskModel.findOne({ contextId: oid(contextId), idempotencyKey: key }); if (session) query.session(session);
    const item = await query.lean<TestTaskRecord>(); return item ? { task: toTestTask(item), fingerprint: item.requestFingerprint } : null;
  }
  async getRepeatTask(originalId: string, session?: ClientSession) {
    const query = OphthalmologyTestTaskModel.findOne({ repeatOfTaskId: oid(originalId) }); if (session) query.session(session);
    const item = await query.lean<TestTaskRecord>(); return item ? toTestTask(item) : null;
  }
  async getClinicalOrderItem(orderId: string, itemId: string, context: OphthalmologyContext, session?: ClientSession) {
    const query = OpdClinicalOrderModel.findOne({ _id: oid(orderId), visitId: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), status: { $ne: 'DRAFT' }, deletedAt: null }).select('orderType items');
    if (session) query.session(session); const order = await query.lean();
    if (!order) return null; const item = order.items.find((candidate) => candidate._id.toString() === itemId);
    return item ? { order_type: order.orderType, item_name: item.investigationName || item.serviceName } : null;
  }
  async createTestTask(context: OphthalmologyContext, data: CreateOphthalmologyTestTaskDTO, testName: string,
    sourceOrderType: 'LABORATORY' | 'IMAGING' | null, key: string, fingerprint: string, userId: string, session: ClientSession) {
    const now = new Date();
    const records = await OphthalmologyTestTaskModel.create([{ contextId: oid(context.id), visitId: oid(context.visit_id),
      patientId: oid(context.patient_id), branchId: oid(context.branch_id), departmentId: oid(context.department_id),
      testCatalogueVersionId: oid(data.test_catalogue_version_id), workflowProfileVersionId: oid(context.workflow_profile_version_id),
      workflowStageCode: text(data.workflow_stage_code)?.toUpperCase(), testCode: data.test_code.trim().toUpperCase(), testName,
      laterality: data.laterality, priority: data.priority, sourceType: data.source_type,
      sourceOrderId: data.source_order_id ? oid(data.source_order_id) : null, sourceOrderItemId: data.source_order_item_id ? oid(data.source_order_item_id) : null,
      sourceOrderType, status: 'ORDERED', specialInstructions: text(data.special_instructions), doctorReviewRequired: false,
      idempotencyKey: key, requestFingerprint: fingerprint, orderedAt: now, version: 0, createdBy: oid(userId), updatedBy: oid(userId) }], { session });
    const record = records[0]; if (!record) throw new Error('Ophthalmology test task creation failed');
    return toTestTask(record.toObject<TestTaskRecord>());
  }
  async listTestTasks(query: OphthalmologyTestTaskListQuery, userId: string) {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('branchIds departmentIds roleIds').lean();
    if (!user) return { data: [], meta: pageMeta(0, query.page ?? 1, query.limit ?? 20) };
    const superAdmin = Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }));
    const branches = query.branch_id ? [oid(query.branch_id)] : (superAdmin ? undefined : user.branchIds ?? []);
    const stationFilter: Record<string, unknown> = { status: 'ACTIVE', memberUserIds: oid(userId) }; if (branches) stationFilter.branchId = { $in: branches };
    const stations = await OphthalmologyStationModel.find(stationFilter).select('_id').lean();
    const doctorPermission = await PermissionModel.findOne({ module: 'OPD', screen: 'Ophthalmology Consultation', action: 'View', status: 'active', deletedAt: null }).select('_id').lean();
    const doctorRole = doctorPermission ? await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, permissionIds: doctorPermission._id,
      status: 'active', deletedAt: null }) : null;
    const doctors = doctorRole ? await DoctorModel.find({ userId: oid(userId), status: 'ACTIVE', deletedAt: null,
      ...(branches ? { branchId: { $in: branches } } : {}) }).select('branchId departmentId').lean() : [];
    const visibility: Record<string, unknown>[] = [{ createdBy: oid(userId), assignedUserId: null, status: 'ORDERED', departmentId: { $in: user.departmentIds ?? [] } }, { assignedUserId: oid(userId) }, { stationId: { $in: stations.map((station) => station._id) } }];
    for (const doctor of doctors) visibility.push({ doctorReviewRequired: true, branchId: doctor.branchId, departmentId: doctor.departmentId });
    const filter: Record<string, unknown> = { $or: visibility }; if (branches) filter.branchId = { $in: branches };
    if (query.station_id) filter.stationId = oid(query.station_id); if (query.assigned_user_id) filter.assignedUserId = oid(query.assigned_user_id);
    if (query.status) filter.status = query.status; if (query.test_code) filter.testCode = query.test_code.trim().toUpperCase();
    if (query.priority) filter.priority = query.priority; if (query.source_type) filter.sourceType = query.source_type;
    if (query.visit_id) filter.visitId = oid(query.visit_id); if (query.patient_id) filter.patientId = oid(query.patient_id);
    if (query.search) { const rx = new RegExp(escapeRegex(query.search), 'i'); filter.$and = [{ $or: [{ testCode: rx }, { testName: rx }] }]; }
    const page = query.page ?? 1; const limit = query.limit ?? 20; const direction = query.direction === 'asc' ? 1 : -1;
    const sortField = ({ assigned_at: 'assignedAt', waiting_since: 'waitingSince', priority: 'priority', updated_at: 'updatedAt' } as const)[query.sort ?? 'updated_at'];
    const physicalDirection = sortField === 'priority' ? (direction === 1 ? -1 : 1) : direction;
    const sort: Record<string, 1 | -1> = { [sortField]: physicalDirection, _id: direction };
    const [items, total] = await Promise.all([OphthalmologyTestTaskModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)
      .select('-specialInstructions -assignmentHistory -transitionHistory -routingHistory -idempotencyKey -requestFingerprint').lean<TestTaskRecord[]>(),
    OphthalmologyTestTaskModel.countDocuments(filter)]);
    return { data: items.map(toTestTask), meta: pageMeta(total, page, limit) };
  }
  async canViewTestTask(task: OphthalmologyTestTask, userId: string) {
    if (!await this.hasBranchAccess(userId, task.branch_id)) return false; if (task.assigned_user_id === userId) return true;
    if (task.status === 'ORDERED' && !task.assigned_user_id && await UserModel.exists({ _id: oid(userId), status: 'active', deletedAt: null, departmentIds: oid(task.department_id) })
      && await OphthalmologyTestTaskModel.exists({ _id: oid(task.id), createdBy: oid(userId) })) return true;
    if (task.station_id && await OphthalmologyStationModel.exists({ _id: oid(task.station_id), status: 'ACTIVE', memberUserIds: oid(userId) })) return true;
    return task.doctor_review_required && (await this.eligibleOphthalmologistUserIds(task.branch_id, task.department_id)).includes(userId);
  }
  async listTaskClinicalConfigurations(task: OphthalmologyTestTask, query: { type: 'FORM_PROFILE' | 'OPTICAL_PRODUCT' | 'DRUG_OPTION'; page?: number; limit?: number }) {
    const filter: Record<string, unknown> = { branchId: oid(task.branch_id), type: query.type, status: 'ACTIVE' };
    if (query.type === 'FORM_PROFILE') filter['values.test_codes'] = new RegExp(`^${escapeRegex(task.test_code)}$`, 'i');
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([OphthalmologyConfigurationModel.find(filter).sort({ code: 1, revision: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean<ConfigurationRecord[]>(), OphthalmologyConfigurationModel.countDocuments(filter)]);
    return { data: rows.map(toConfiguration), meta: pageMeta(total, page, limit) };
  }
  async listTaskStations(task: OphthalmologyTestTask, query: OphthalmologyAssignmentLookupQuery) {
    const filter: Record<string, unknown> = { branchId: oid(task.branch_id), departmentId: oid(task.department_id), status: 'ACTIVE', supportedTestTypes: task.test_code };
    if (query.search) { const regex = new RegExp(escapeRegex(query.search), 'i'); filter.$or = [{ name: regex }, { code: regex }]; }
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([OphthalmologyStationModel.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean<StationRecord[]>(), OphthalmologyStationModel.countDocuments(filter)]);
    return { data: rows.map(toStation), meta: pageMeta(total, page, limit) };
  }
  async listTaskAssignees(task: OphthalmologyTestTask, station: OphthalmologyStation, query: OphthalmologyAssignmentLookupQuery) {
    const permission = await PermissionModel.findOne({ module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start', status: 'active', deletedAt: null }).select('_id').lean();
    const roles = permission ? await RoleModel.find({ permissionIds: permission._id, status: 'active', deletedAt: null }).select('_id').lean() : [];
    const filter: Record<string, unknown> = { _id: { $in: station.member_user_ids.map(oid) }, roleIds: { $in: roles.map((role) => role._id) }, branchIds: oid(task.branch_id), departmentIds: oid(task.department_id), status: 'active', deletedAt: null };
    if (query.search) filter.fullName = new RegExp(escapeRegex(query.search), 'i');
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([UserModel.find(filter).select('_id fullName').sort({ fullName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), UserModel.countDocuments(filter)]);
    return { data: rows.map((row) => ({ id: row._id.toString(), full_name: row.fullName })), meta: pageMeta(total, page, limit) };
  }
  async eligibleTestAssignee(userId: string, stationId: string, branchId: string, departmentId: string, session?: ClientSession) {
    const stationQuery = OphthalmologyStationModel.exists({ _id: oid(stationId), branchId: oid(branchId), departmentId: oid(departmentId),
      status: 'ACTIVE', memberUserIds: oid(userId) }); if (session) stationQuery.session(session); if (!await stationQuery) return false;
    const permissionQuery = PermissionModel.findOne({ module: 'OPD', screen: 'Ophthalmology Test Queue', action: 'Start', status: 'active', deletedAt: null }).select('_id');
    if (session) permissionQuery.session(session); const permission = await permissionQuery.lean(); if (!permission) return false;
    const roleQuery = RoleModel.find({ permissionIds: permission._id, status: 'active', deletedAt: null }).select('_id');
    if (session) roleQuery.session(session); const roles = await roleQuery.lean();
    const userQuery = UserModel.exists({ _id: oid(userId), roleIds: { $in: roles.map((role) => role._id) }, branchIds: oid(branchId),
      departmentIds: oid(departmentId), status: 'active', deletedAt: null }); if (session) userQuery.session(session); return Boolean(await userQuery);
  }
  async isStationMember(userId: string, stationId: string, session?: ClientSession) {
    const query = OphthalmologyStationModel.exists({ _id: oid(stationId), status: 'ACTIVE', memberUserIds: oid(userId) });
    if (session) query.session(session); return Boolean(await query);
  }
  async transitionTestTask(id: string, expectedStatus: OphthalmologyTestTaskStatus, expectedVersion: number,
    toStatus: OphthalmologyTestTaskStatus, action: OphthalmologyTestTaskFields['transitionHistory'][number]['action'], userId: string,
    reason: string | null, set: Record<string, unknown>, session: ClientSession) {
    const now = new Date();
    const record = await OphthalmologyTestTaskModel.findOneAndUpdate({ _id: oid(id), status: expectedStatus, version: expectedVersion },
      { $set: { status: toStatus, ...set, updatedBy: oid(userId) }, $push: { transitionHistory: { action, fromStatus: expectedStatus,
        toStatus, reason, actorUserId: oid(userId), occurredAt: now }, ...(action === 'UNABLE_TO_PERFORM' ? { routingHistory: {
          target: 'OPHTHALMOLOGIST', targetTaskId: null, targetStationId: null, reason, actorUserId: oid(userId), occurredAt: now } } : {}) },
        $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<TestTaskRecord>(); return record ? toTestTask(record) : null;
  }
  async assignTestTask(id: string, expectedStatus: OphthalmologyTestTaskStatus, expectedVersion: number, stationId: string,
    assignedUserId: string | null, userId: string, reason: string | null, reassign: boolean, session: ClientSession) {
    const current = await this.getTestTask(id, session); if (!current) return null; const now = new Date();
    const resultingStatus: OphthalmologyTestTaskStatus = reassign ? expectedStatus : 'PATIENT_WAITING';
    const record = await OphthalmologyTestTaskModel.findOneAndUpdate({ _id: oid(id), status: expectedStatus, version: expectedVersion },
      { $set: { status: resultingStatus, stationId: oid(stationId), assignedUserId: assignedUserId ? oid(assignedUserId) : null,
        assignedAt: now, ...(reassign ? {} : { waitingSince: now }), updatedBy: oid(userId) },
        $push: { assignmentHistory: { action: reassign ? 'REASSIGNED' : 'ASSIGNED', fromStationId: current.station_id ? oid(current.station_id) : null,
          toStationId: oid(stationId), fromUserId: current.assigned_user_id ? oid(current.assigned_user_id) : null,
          toUserId: assignedUserId ? oid(assignedUserId) : null, reason, actorUserId: oid(userId), occurredAt: now } }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<TestTaskRecord>(); return record ? toTestTask(record) : null;
  }
  async routeTestTask(id: string, expectedStatus: OphthalmologyTestTaskStatus, expectedVersion: number, target: 'NEXT_STATION' | 'OPHTHALMOLOGIST',
    targetTaskId: string | null, targetStationId: string | null, reason: string | null, userId: string, session: ClientSession) {
    const now = new Date();
    const record = await OphthalmologyTestTaskModel.findOneAndUpdate({ _id: oid(id), status: expectedStatus, version: expectedVersion },
      { $set: { ...(target === 'OPHTHALMOLOGIST' ? { doctorReviewRequired: true } : {}), updatedBy: oid(userId) },
        $push: { routingHistory: { target, targetTaskId: targetTaskId ? oid(targetTaskId) : null,
          targetStationId: targetStationId ? oid(targetStationId) : null, reason, actorUserId: oid(userId), occurredAt: now } }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<TestTaskRecord>(); return record ? toTestTask(record) : null;
  }
  async createRepeatTask(original: OphthalmologyTestTask, stationId: string, assignedUserId: string | null, reason: string,
    key: string, fingerprint: string, userId: string, session: ClientSession) {
    const now = new Date();
    const records = await OphthalmologyTestTaskModel.create([{ contextId: oid(original.context_id), visitId: oid(original.visit_id), patientId: oid(original.patient_id),
      branchId: oid(original.branch_id), departmentId: oid(original.department_id), testCatalogueVersionId: oid(original.test_catalogue_version_id),
      workflowProfileVersionId: oid(original.workflow_profile_version_id), workflowStageCode: original.workflow_stage_code, testCode: original.test_code,
      testName: original.test_name, laterality: original.laterality, priority: original.priority, sourceType: original.source_type,
      sourceOrderId: original.source_order_id ? oid(original.source_order_id) : null, sourceOrderItemId: original.source_order_item_id ? oid(original.source_order_item_id) : null,
      sourceOrderType: original.source_order_type, status: 'PATIENT_WAITING', stationId: oid(stationId), assignedUserId: assignedUserId ? oid(assignedUserId) : null,
      specialInstructions: original.special_instructions, doctorReviewRequired: false, repeatOfTaskId: oid(original.id),
      repeatRootTaskId: oid(original.repeat_root_task_id ?? original.id), idempotencyKey: key, requestFingerprint: fingerprint,
      assignmentHistory: [{ action: 'ASSIGNED', toStationId: oid(stationId), toUserId: assignedUserId ? oid(assignedUserId) : null,
        reason, actorUserId: oid(userId), occurredAt: now }], orderedAt: now, assignedAt: now, waitingSince: now, version: 0,
      createdBy: oid(userId), updatedBy: oid(userId) }], { session });
    const record = records[0]; if (!record) throw new Error('Ophthalmology repeat task creation failed'); return toTestTask(record.toObject<TestTaskRecord>());
  }
  async linkRepeatTask(original: OphthalmologyTestTask, repeatId: string, reason: string, userId: string, session: ClientSession) {
    const now = new Date(); const record = await OphthalmologyTestTaskModel.findOneAndUpdate({ _id: oid(original.id), status: original.status, version: original.version },
      { $set: { status: 'REPEAT_REQUIRED', repeatTaskId: oid(repeatId), updatedBy: oid(userId) },
        $push: { transitionHistory: { action: 'REPEAT_REQUESTED', fromStatus: original.status, toStatus: 'REPEAT_REQUIRED', reason,
          actorUserId: oid(userId), occurredAt: now } }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<TestTaskRecord>(); return record ? toTestTask(record) : null;
  }

  async getClinicalReviewByVisit(visitId: string, session?: ClientSession) {
    const query = OphthalmologyClinicalReviewModel.findOne({ visitId: oid(visitId) }); if (session) query.session(session);
    const record = await query.lean<ClinicalReviewRecord>(); return record ? toClinicalReview(record) : null;
  }
  async saveClinicalReviewDraft(context: OphthalmologyContext, data: SaveOphthalmologyClinicalReviewDraftDTO,
    userId: string, session: ClientSession) {
    const current = await this.getClinicalReviewByVisit(context.visit_id, session); const now = new Date();
    const version: OphthalmologyClinicalReviewVersionFields = { clinicalVersion: (current?.current_clinical_version ?? 0) + 1,
      clinicalSummary: data.clinical_summary.trim(), treatmentPlans: data.treatment_plans.map((plan) => ({ _id: new Types.ObjectId(),
        diagnosisCode: plan.diagnosis_code.trim().toUpperCase(), diagnosisLaterality: plan.diagnosis_laterality,
        treatment: plan.treatment.trim(), category: plan.category.trim().toUpperCase(), priority: plan.priority, status: plan.status,
        medicationPrescriptionId: plan.medication_prescription_id ? oid(plan.medication_prescription_id) : null,
        clinicalOrderIds: (plan.clinical_order_ids ?? []).map(oid),
        procedureRecommendationId: plan.procedure_recommendation_id ? oid(plan.procedure_recommendation_id) : null,
        referralId: plan.referral_id ? oid(plan.referral_id) : null, followUpId: plan.follow_up_id ? oid(plan.follow_up_id) : null,
        clinicianUserId: oid(userId) })), followUpDecision: data.follow_up_decision ?? null,
      patientInstructions: text(data.patient_instructions), createdBy: oid(userId), createdAt: now };
    if (!current) {
      if (data.expected_version !== 0) return null;
      const records = await OphthalmologyClinicalReviewModel.create([{ contextId: oid(context.id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), branchId: oid(context.branch_id), departmentId: oid(context.department_id),
        currentClinicalVersion: 1, status: 'DRAFT', versions: [version], version: 1, createdBy: oid(userId), updatedBy: oid(userId) }], { session });
      return toClinicalReview(records[0]!.toObject<ClinicalReviewRecord>());
    }
    const record = await OphthalmologyClinicalReviewModel.findOneAndUpdate({ _id: oid(current.id), version: data.expected_version },
      { $set: { currentClinicalVersion: version.clinicalVersion, updatedBy: oid(userId) }, $push: { versions: version }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<ClinicalReviewRecord>(); return record ? toClinicalReview(record) : null;
  }

  async getOpticalPrescriptionByVisit(visitId: string, session?: ClientSession) {
    const query = OphthalmologyOpticalPrescriptionModel.findOne({ visitId: oid(visitId) }); if (session) query.session(session);
    const record = await query.lean<OpticalPrescriptionRecord>(); return record ? toOpticalPrescription(record) : null;
  }
  private opticalVersion(data: SaveOphthalmologyOpticalPrescriptionDraftDTO, clinicalVersion: number, userId: string) {
    const power = (eye: 'OD' | 'OS') => { const item = data.power[eye]; return item ? { sphere: item.sphere, cylinder: item.cylinder ?? null,
      axis: item.axis ?? null, addition: item.addition ?? null, prism: item.prism ?? null, prismBase: text(item.prism_base) } : null; };
    return { clinicalVersion, status: 'DRAFT' as const, prescriptionType: data.prescription_type, power: { OD: power('OD'), OS: power('OS') },
      pupillaryDistance: data.pupillary_distance, segmentHeight: data.segment_height ?? null,
      lensType: data.lens_type.trim().toUpperCase(), material: data.material.trim().toUpperCase(),
      coatingCodes: data.coating_codes.map((item) => item.trim().toUpperCase()), usageInstructions: data.usage_instructions.trim(),
      validUntil: new Date(data.valid_until), reviewDate: date(data.review_date), approverUserId: null, approverDoctorId: null,
      approvedAt: null, createdBy: oid(userId), createdAt: new Date() } satisfies OphthalmologyOpticalPrescriptionVersionFields;
  }
  async saveOpticalPrescriptionDraft(context: OphthalmologyContext, data: SaveOphthalmologyOpticalPrescriptionDraftDTO,
    userId: string, session: ClientSession) {
    const current = await this.getOpticalPrescriptionByVisit(context.visit_id, session);
    const version = this.opticalVersion(data, (current?.current_clinical_version ?? 0) + 1, userId);
    if (!current) {
      if (data.expected_version !== 0) return null;
      const records = await OphthalmologyOpticalPrescriptionModel.create([{ contextId: oid(context.id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), branchId: oid(context.branch_id), departmentId: oid(context.department_id),
        currentClinicalVersion: 1, status: 'DRAFT', versions: [version], version: 1, createdBy: oid(userId), updatedBy: oid(userId) }], { session });
      return toOpticalPrescription(records[0]!.toObject<OpticalPrescriptionRecord>());
    }
    const record = await OphthalmologyOpticalPrescriptionModel.findOneAndUpdate({ _id: oid(current.id), status: 'DRAFT', version: data.expected_version },
      { $set: { currentClinicalVersion: version.clinicalVersion, updatedBy: oid(userId) }, $push: { versions: version }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<OpticalPrescriptionRecord>(); return record ? toOpticalPrescription(record) : null;
  }
  async approveOpticalPrescription(id: string, expectedVersion: number, clinicalVersion: number, userId: string, doctorId: string, session: ClientSession) {
    const now = new Date(); const record = await OphthalmologyOpticalPrescriptionModel.findOneAndUpdate(
      { _id: oid(id), status: 'DRAFT', version: expectedVersion },
      { $set: { status: 'APPROVED', 'versions.$[current].status': 'APPROVED', 'versions.$[current].approverUserId': oid(userId),
        'versions.$[current].approverDoctorId': oid(doctorId), 'versions.$[current].approvedAt': now, updatedBy: oid(userId) }, $inc: { version: 1 } },
      { arrayFilters: [{ 'current.clinicalVersion': clinicalVersion }], returnDocument: 'after', lean: true, session }).lean<OpticalPrescriptionRecord>();
    return record ? toOpticalPrescription(record) : null;
  }
  async getActiveDoctorId(userId: string, branchId: string, departmentId: string, session?: ClientSession) {
    const query = DoctorModel.findOne({ userId: oid(userId), branchId: oid(branchId), departmentId: oid(departmentId),
      status: 'ACTIVE', deletedAt: null }).select('_id'); if (session) query.session(session); return (await query.lean())?._id.toString() ?? null;
  }
  async validateReviewReferences(context: OphthalmologyContext, data: SaveOphthalmologyClinicalReviewDraftDTO, session: ClientSession) {
    // Follow-ups inherit scope from their visit; the shared model has no branchId.
    if (!await OpdVisitModel.exists({ _id: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), departmentId: oid(context.department_id), deletedAt: null }).session(session)) return false;
    for (const plan of data.treatment_plans) {
      if (plan.medication_prescription_id && !await OpdPrescriptionModel.exists({ _id: oid(plan.medication_prescription_id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), branchId: oid(context.branch_id), deletedAt: null }).session(session)) return false;
      for (const id of plan.clinical_order_ids ?? []) if (!await OpdClinicalOrderModel.exists({ _id: oid(id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), branchId: oid(context.branch_id), deletedAt: null }).session(session)) return false;
      if (plan.procedure_recommendation_id && !await ProcedureRecommendationModel.exists({ _id: oid(plan.procedure_recommendation_id),
        encounterType: 'OPD_VISIT', encounterId: oid(context.visit_id), patientId: oid(context.patient_id), branchId: oid(context.branch_id) }).session(session)) return false;
      if (plan.referral_id && !await OpdReferralModel.exists({ _id: oid(plan.referral_id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), branchId: oid(context.branch_id), deletedAt: null }).session(session)) return false;
      if (plan.follow_up_id && !await OpdFollowUpModel.exists({ _id: oid(plan.follow_up_id), visitId: oid(context.visit_id),
        patientId: oid(context.patient_id), deletedAt: null }).session(session)) return false;
    }
    return true;
  }
  async getDiagnosisKeys(visitId: string, session?: ClientSession) {
    const query = OpdConsultationModel.findOne({ visitId: oid(visitId), deletedAt: null }).select('diagnoses'); if (session) query.session(session);
    const item = await query.lean(); return (item?.diagnoses ?? []).map((diagnosis) => ({ code: diagnosis.code.trim().toUpperCase(),
      laterality: diagnosis.laterality ?? 'NOT_APPLICABLE' }));
  }
  async getEmergencyReferralTrace(context: OphthalmologyContext) {
    const visit = await OpdVisitModel.findOne({ _id: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), departmentId: oid(context.department_id), deletedAt: null }).select('appointmentId').lean();
    if (!visit?.appointmentId) return [];
    const appointmentId = visit.appointmentId.toString();
    const appointment = await AppointmentModel.exists({ _id: visit.appointmentId, patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), departmentId: oid(context.department_id), deletedAt: null });
    if (!appointment) return [];
    // Trace metadata only: never expose Emergency assessment/notes through an OPD permission.
    const sources = await EmergencyEncounterModel.find({ branchId: oid(context.branch_id), patientId: oid(context.patient_id),
      'referral.appointmentId': visit.appointmentId, 'referral.targetDepartmentId': oid(context.department_id) })
      .select('_id encounterNumber referral.submittedAt referral.priority').limit(2).lean();
    return sources.map((source) => ({ emergency_encounter_id: source._id.toString(), encounter_number: source.encounterNumber,
      appointment_id: appointmentId, visit_id: context.visit_id, patient_id: context.patient_id,
      referred_at: source.referral?.submittedAt ?? null, priority: source.referral?.priority ?? null }));
  }

  async getDoctorReviewProjection(context: OphthalmologyContext, session?: ClientSession) {
    const scope = { visitId: oid(context.visit_id), patientId: oid(context.patient_id) };
    const [patient, consultation, tasks, results, prescriptions, orders, procedures, referrals, followUps, clinicalReview, opticalPrescription] = await Promise.all([
      PatientModel.findById(oid(context.patient_id)).select('patientNumber firstName lastName dateOfBirth gender allergies alerts').session(session ?? null).lean(),
      OpdConsultationModel.findOne({ visitId: oid(context.visit_id), deletedAt: null }).select('-deletedBy -__v').session(session ?? null).lean(),
      OphthalmologyTestTaskModel.find(scope).select('-idempotencyKey -requestFingerprint -assignmentHistory -transitionHistory -routingHistory').session(session ?? null).lean(),
      OphthalmologyTestResultModel.find(scope).select('-__v').session(session ?? null).lean(),
      OpdPrescriptionModel.find({ ...scope, deletedAt: null }).select('-__v').session(session ?? null).lean(),
      OpdClinicalOrderModel.find({ ...scope, deletedAt: null }).select('-__v').session(session ?? null).lean(),
      ProcedureRecommendationModel.find({ patientId: oid(context.patient_id), branchId: oid(context.branch_id), encounterType: 'OPD_VISIT', encounterId: oid(context.visit_id) }).select('-__v').session(session ?? null).lean(),
      OpdReferralModel.find({ ...scope, deletedAt: null }).select('-__v').session(session ?? null).lean(),
      OpdFollowUpModel.find({ ...scope, deletedAt: null }).select('-__v').session(session ?? null).lean(),
      this.getClinicalReviewByVisit(context.visit_id, session), this.getOpticalPrescriptionByVisit(context.visit_id, session),
    ]);
    const previousResults = await OphthalmologyTestResultModel.find({ patientId: oid(context.patient_id), branchId: oid(context.branch_id),
      visitId: { $ne: oid(context.visit_id) } }).sort({ updatedAt: -1 }).limit(50).select('-__v').session(session ?? null).lean();
    const bookings = await ProcedureBookingModel.find({ _id: { $in: procedures.flatMap((entry) => entry.bookingId ? [entry.bookingId] : []) },
      patientId: oid(context.patient_id), branchId: oid(context.branch_id), recommendationId: { $in: procedures.map((entry) => entry._id) } })
      .select('_id recommendationId status').session(session ?? null).lean();
    return { context, patient, consultation, tasks, results, previous_results: previousResults, medication_prescriptions: prescriptions,
      clinical_orders: orders, procedure_recommendations: procedures.map((entry) => ({ ...entry,
        bookingStatus: bookings.find((booking) => booking._id.equals(entry.bookingId) && booking.recommendationId.equals(entry._id))?.status ?? null })),
      referrals, follow_ups: followUps, clinical_review: clinicalReview,
      optical_prescription: opticalPrescription };
  }

  async getCompletionEvidence(context: OphthalmologyContext, session?: ClientSession) {
    const scope = { contextId: oid(context.id) };
    const taskQuery = OphthalmologyTestTaskModel.find(scope); const resultQuery = OphthalmologyTestResultModel.find(scope);
    const orderQuery = OpdClinicalOrderModel.find({ visitId: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), deletedAt: null }).select('_id status orderType version');
    if (session) { taskQuery.session(session); resultQuery.session(session); orderQuery.session(session); }
    const [tasks, results, orders] = await Promise.all([taskQuery.lean<TestTaskRecord[]>(), resultQuery.lean<TestResultRecord[]>(), orderQuery.lean()]);
    return { tasks: tasks.map(toTestTask), results: results.map(toTestResult), clinical_orders: orders.map((entry) => ({
      id: entry._id.toString(), status: entry.status, order_type: entry.orderType, version: entry.version ?? 0,
    })) };
  }

  async getFinalizationByVisit(visitId: string, session?: ClientSession) {
    const query = OphthalmologyConsultationFinalizationModel.findOne({ visitId: oid(visitId) }); if (session) query.session(session);
    const item = await query.lean<FinalizationRecord>(); return item ? toFinalization(item) : null;
  }

  async ensureFinalization(context: OphthalmologyContext, userId: string, session: ClientSession) {
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ visitId: oid(context.visit_id) },
      { $setOnInsert: { contextId: oid(context.id), visitId: oid(context.visit_id), patientId: oid(context.patient_id),
        branchId: oid(context.branch_id), departmentId: oid(context.department_id), status: 'OPEN', version: 0,
        deferrals: [], overrides: [], completions: [], amendmentEpisodes: [], createdBy: oid(userId), updatedBy: oid(userId) } },
      { upsert: true, returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>();
    if (!record) throw new Error('Ophthalmology consultation finalization could not be initialized'); return toFinalization(record);
  }

  async reviewTestResult(taskId: string, expectedTaskVersion: number, expectedResultVersion: number,
    expectedClinicalVersion: number, userId: string, comment: string | null, session: ClientSession) {
    const result = await OphthalmologyTestResultModel.findOne({ taskId: oid(taskId), status: 'COMPLETED', version: expectedResultVersion,
      currentClinicalVersion: expectedClinicalVersion }).session(session).lean<TestResultRecord>();
    if (!result) return null;
    const currentTask = await OphthalmologyTestTaskModel.findOne({ _id: oid(taskId), status: { $in: ['COMPLETED', 'SUBMITTED_FOR_REVIEW'] },
      version: expectedTaskVersion }).session(session).lean<TestTaskRecord>(); if (!currentTask) return null;
    const now = new Date(); const record = await OphthalmologyTestTaskModel.findOneAndUpdate(
      { _id: oid(taskId), status: { $in: ['COMPLETED', 'SUBMITTED_FOR_REVIEW'] }, version: expectedTaskVersion },
      { $set: { status: 'REVIEWED', reviewedBy: oid(userId), reviewedAt: now, reviewedClinicalVersion: expectedClinicalVersion,
        reviewComment: comment, updatedBy: oid(userId) }, $push: { transitionHistory: { action: 'REVIEWED',
        fromStatus: currentTask.status, toStatus: 'REVIEWED', reason: comment, actorUserId: oid(userId), occurredAt: now } },
        $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<TestTaskRecord>();
    return record ? toTestTask(record) : null;
  }

  async addResultDeferral(finalizationId: string, expectedVersion: number, data: { source_type: 'TEST_TASK' | 'CLINICAL_ORDER';
    source_id: string; reason: string; review_plan?: string | null; due_at?: string | null; responsible_doctor_id: string },
    userId: string, session: ClientSession) {
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ _id: oid(finalizationId), status: 'OPEN', version: expectedVersion },
      { $push: { deferrals: { _id: new Types.ObjectId(), sourceType: data.source_type, sourceId: oid(data.source_id), reason: data.reason.trim(),
        reviewPlan: text(data.review_plan), dueAt: date(data.due_at), responsibleDoctorId: oid(data.responsible_doctor_id),
        recordedBy: oid(userId), recordedAt: new Date() } }, $set: { updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>(); return record ? toFinalization(record) : null;
  }

  async addCompletionOverride(finalizationId: string, expectedVersion: number, unmet: OphthalmologyCompletionRequirement[],
    reason: string, doctorId: string, userId: string, session: ClientSession) {
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ _id: oid(finalizationId), status: 'OPEN', version: expectedVersion },
      { $push: { overrides: { _id: new Types.ObjectId(), unmetCodes: unmet.map((entry) => entry.code),
        unmetSnapshot: unmet.map((entry) => ({ code: entry.code, details: entry.details, resourceIds: entry.resource_ids })),
        reason, doctorId: oid(doctorId), actorUserId: oid(userId), createdAt: new Date() } },
        $set: { updatedBy: oid(userId) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>();
    return record ? toFinalization(record) : null;
  }

  async completeFinalization(finalizationId: string, expectedVersion: number, completion: { clinical_version: number;
    configuration_version_id: string; configuration_revision: number; configuration_snapshot: Record<string, unknown>;
    consultation_version: number; clinical_review_version: number; optical_prescription_version: number | null;
    requirements: OphthalmologyCompletionRequirement[]; summary: Record<string, unknown>; doctor_id: string; idempotency_key: string;
    request_fingerprint: string; supersedes_clinical_version: number | null }, userId: string, session: ClientSession) {
    const current = await OphthalmologyConsultationFinalizationModel.findOne({ _id: oid(finalizationId), version: expectedVersion }).session(session).lean<FinalizationRecord>();
    if (!current || !['OPEN', 'AMENDMENT_OPEN'].includes(current.status)) return null;
    const completionSet: Record<string, unknown> = { status: 'COMPLETED', updatedBy: oid(userId) };
    if (current.status === 'AMENDMENT_OPEN') completionSet['amendmentEpisodes.$[episode].status'] = 'COMPLETED';
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ _id: oid(finalizationId),
      status: { $in: ['OPEN', 'AMENDMENT_OPEN'] }, version: expectedVersion }, { $push: { completions: {
        clinicalVersion: completion.clinical_version, configurationVersionId: oid(completion.configuration_version_id),
        configurationRevision: completion.configuration_revision, configurationSnapshot: completion.configuration_snapshot,
        consultationVersion: completion.consultation_version, clinicalReviewVersion: completion.clinical_review_version,
        opticalPrescriptionVersion: completion.optical_prescription_version, requirementSnapshot: completion.requirements.map((entry) => ({
          code: entry.code, satisfied: entry.satisfied, details: entry.details, resourceIds: entry.resource_ids })),
        summarySnapshot: completion.summary, approverUserId: oid(userId), approverDoctorId: oid(completion.doctor_id), approvedAt: new Date(),
        idempotencyKey: completion.idempotency_key, requestFingerprint: completion.request_fingerprint,
        supersedesClinicalVersion: completion.supersedes_clinical_version } }, $set: completionSet, $inc: { version: 1 } },
      { ...(current.status === 'AMENDMENT_OPEN' ? { arrayFilters: [{ 'episode.status': 'OPEN' }] } : {}),
        returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>();
    return record ? toFinalization(record) : null;
  }

  async setClinicalReviewCompleted(id: string, expectedVersion: number, session: ClientSession) {
    return OphthalmologyClinicalReviewModel.findOneAndUpdate({ _id: oid(id), status: 'DRAFT', version: expectedVersion },
      { $set: { status: 'COMPLETED' }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<ClinicalReviewRecord>();
  }

  async setContextWorkflowStatus(id: string, expectedVersion: number, expectedStatuses: OphthalmologyWorkflowStatus[],
    status: OphthalmologyWorkflowStatus, userId: string, session: ClientSession) {
    const record = await OphthalmologyContextModel.findOneAndUpdate({ _id: oid(id), version: expectedVersion, workflowStatus: { $in: expectedStatuses } },
      { $set: { workflowStatus: status, updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<ContextRecord>(); return record ? toContext(record) : null;
  }

  async reopenFinalization(finalizationId: string, expectedVersion: number, reason: string, userId: string, session: ClientSession) {
    const current = await OphthalmologyConsultationFinalizationModel.findById(oid(finalizationId)).session(session).lean<FinalizationRecord>();
    const sourceClinicalVersion = current?.completions.at(-1)?.clinicalVersion; if (!sourceClinicalVersion) return null;
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ _id: oid(finalizationId), status: 'COMPLETED', version: expectedVersion },
      { $set: { status: 'AMENDMENT_OPEN', updatedBy: oid(userId) }, $push: { amendmentEpisodes: { _id: new Types.ObjectId(),
        sourceClinicalVersion, reason, status: 'OPEN', openedBy: oid(userId), openedAt: new Date(), changes: [] } }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>(); return record ? toFinalization(record) : null;
  }

  async correctClinicalReviewSection(visitId: string, expectedVersion: number, correction: ClinicalCorrection, userId: string, session: ClientSession) {
    const current = await OphthalmologyClinicalReviewModel.findOne({ visitId: oid(visitId), version: expectedVersion }).session(session).lean<ClinicalReviewRecord>();
    const previous = current?.versions.find((version) => version.clinicalVersion === current.currentClinicalVersion);
    if (!current || !previous) return null;
    const next: OphthalmologyClinicalReviewVersionFields = { ...previous, clinicalVersion: current.currentClinicalVersion + 1,
      ...(correction.section === 'patient_instructions' ? { patientInstructions: correction.after_value?.trim() || null } :
        correction.section === 'clinical_summary' ? { clinicalSummary: correction.after_value } :
        correction.section === 'follow_up_decision' ? { followUpDecision: correction.after_value } :
        { treatmentPlans: correction.after_value.map((plan) => ({ _id: plan.id ? oid(plan.id) : new Types.ObjectId(),
          diagnosisCode: plan.diagnosis_code, diagnosisLaterality: plan.diagnosis_laterality, treatment: plan.treatment, category: plan.category,
          priority: plan.priority, status: plan.status, medicationPrescriptionId: plan.medication_prescription_id ? oid(plan.medication_prescription_id) : null,
          clinicalOrderIds: plan.clinical_order_ids.map(oid), procedureRecommendationId: plan.procedure_recommendation_id ? oid(plan.procedure_recommendation_id) : null,
          referralId: plan.referral_id ? oid(plan.referral_id) : null, followUpId: plan.follow_up_id ? oid(plan.follow_up_id) : null, clinicianUserId: oid(userId) })) }),
      createdBy: oid(userId), createdAt: new Date() };
    const record = await OphthalmologyClinicalReviewModel.findOneAndUpdate({ _id: current._id, version: expectedVersion },
      { $set: { status: 'DRAFT', currentClinicalVersion: next.clinicalVersion, updatedBy: oid(userId) },
        $push: { versions: next }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<ClinicalReviewRecord>();
    return record ? toClinicalReview(record) : null;
  }

  async withdrawConsultationPublications(contextId: string, reason: string, userId: string, session: ClientSession) {
    const sources = await OphthalmologyPublicationModel.find({ contextId: oid(contextId), status: 'APPROVED_FOR_PORTAL', sourceType: 'TEST_RESULT' }).select('patientId portalPayload').session(session).lean();
    const result = await OphthalmologyPublicationModel.updateMany({ contextId: oid(contextId), status: 'APPROVED_FOR_PORTAL' },
      { $set: { status: 'WITHDRAWN', withdrawnBy: oid(userId), withdrawnAt: new Date(), withdrawalReason: reason }, $inc: { version: 1 } }, { session });
    for (const source of sources) await synchronizeAttachmentPublication(source.patientId.toString(), publicationDocumentIds(source.portalPayload), session);
    return result.modifiedCount;
  }

  async appendAmendment(finalizationId: string, expectedVersion: number, episodeId: string, change: { section: string;
    before_value: unknown; after_value: unknown; reason: string }, userId: string, session: ClientSession) {
    const record = await OphthalmologyConsultationFinalizationModel.findOneAndUpdate({ _id: oid(finalizationId), status: 'AMENDMENT_OPEN',
      version: expectedVersion, amendmentEpisodes: { $elemMatch: { _id: oid(episodeId), status: 'OPEN' } } },
      { $push: { 'amendmentEpisodes.$.changes': { section: change.section.trim(), beforeValue: change.before_value,
        afterValue: change.after_value, reason: change.reason.trim(), changedBy: oid(userId), changedAt: new Date() } },
        $set: { updatedBy: oid(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<FinalizationRecord>(); return record ? toFinalization(record) : null;
  }

  async validDeferralSource(context: OphthalmologyContext, type: 'TEST_TASK' | 'CLINICAL_ORDER', id: string, session: ClientSession) {
    if (type === 'TEST_TASK') return Boolean(await OphthalmologyTestTaskModel.exists({ _id: oid(id), contextId: oid(context.id) }).session(session));
    return Boolean(await OpdClinicalOrderModel.exists({ _id: oid(id), visitId: oid(context.visit_id), patientId: oid(context.patient_id),
      branchId: oid(context.branch_id), deletedAt: null }).session(session));
  }

  async activeDoctorExists(doctorId: string, context: OphthalmologyContext, session: ClientSession) {
    return Boolean(await DoctorModel.exists({ _id: oid(doctorId), branchId: oid(context.branch_id), departmentId: oid(context.department_id),
      status: 'ACTIVE', deletedAt: null }).session(session));
  }

  async audit(eventType: string, actorUserId: string, resource: Record<string, unknown>, metadata: OphthalmologyRequestMetadata, session?: ClientSession) {
    const record = { actorUserId, eventType, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: resource };
    if (session) { await AuditLogModel.create([record], { session }); return; }
    await AuditLogModel.create(record);
  }
}
