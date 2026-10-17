import type { MultipartFields, MultipartValue } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAnyPermission, requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  acknowledgeOphthalmologyAlertBodySchema,
  completeOphthalmologyIntakeBodySchema,
  createOphthalmologyConfigurationBodySchema,
  createOphthalmologyContextBodySchema,
  createOphthalmologyStationBodySchema,
  createOphthalmologyWorkflowProfileBodySchema,
  ophthalmologyConfigurationListQuerySchema,
  ophthalmologyIdParamsSchema,
  ophthalmologyStationListQuerySchema,
  ophthalmologyVisitParamsSchema,
  ophthalmologyVisitAlertParamsSchema,
  ophthalmologyWorkflowProfileListQuerySchema,
  updateOphthalmologyConfigurationBodySchema,
  updateOphthalmologyContextBodySchema,
  updateOphthalmologyStationBodySchema,
  updateOphthalmologyWorkflowProfileBodySchema,
  versionActionBodySchema,
  routeOphthalmologyEmergencyBodySchema,
  saveOphthalmologyIntakeDraftBodySchema,
  ophthalmologyTestTaskHeadersSchema,
  ophthalmologyTestTaskListQuerySchema,
  createOphthalmologyTestTaskBodySchema,
  assignOphthalmologyTestTaskBodySchema,
  reassignOphthalmologyTestTaskBodySchema,
  callOphthalmologyTestTaskBodySchema,
  submitOphthalmologyTestTaskForReviewBodySchema,
  patientUnavailableOphthalmologyTestTaskBodySchema,
  startOphthalmologyTestTaskBodySchema,
  unableOphthalmologyTestTaskBodySchema,
  cancelOphthalmologyTestTaskBodySchema,
  repeatOphthalmologyTestTaskBodySchema,
  routeOphthalmologyTestTaskBodySchema,
  saveOphthalmologyTestResultDraftBodySchema,
  completeOphthalmologyTestResultBodySchema,
  amendOphthalmologyTestResultBodySchema,
  saveOphthalmologyClinicalReviewDraftBodySchema,
  saveOphthalmologyOpticalPrescriptionDraftBodySchema,
  approveOphthalmologyOpticalPrescriptionBodySchema,
  reviewOphthalmologyTestResultBodySchema,
  deferOphthalmologyResultBodySchema,
  overrideOphthalmologyCompletionBodySchema,
  completeOphthalmologyConsultationBodySchema,
  reopenOphthalmologyConsultationBodySchema,
  correctOphthalmologyConsultationBodySchema,
  correctOphthalmologyClinicalReviewBodySchema,
  correctOphthalmologyOpticalPrescriptionBodySchema,
} from './ophthalmology.schemas.js';
import type {
  AcknowledgeOphthalmologyAlertDTO,
  CompleteOphthalmologyIntakeDTO,
  CreateOphthalmologyConfigurationDTO,
  CreateOphthalmologyContextDTO,
  CreateOphthalmologyStationDTO,
  CreateOphthalmologyWorkflowProfileDTO,
  OphthalmologyConfigurationListQuery,
  OphthalmologyStationListQuery,
  OphthalmologyWorkflowProfileListQuery,
  RouteOphthalmologyEmergencyDTO,
  SaveOphthalmologyIntakeDraftDTO,
  UpdateOphthalmologyConfigurationDTO,
  UpdateOphthalmologyContextDTO,
  UpdateOphthalmologyStationDTO,
  UpdateOphthalmologyWorkflowProfileDTO,
  VersionActionDTO,
  OphthalmologyTestTaskListQuery,
  CreateOphthalmologyTestTaskDTO,
  AssignOphthalmologyTestTaskDTO,
  ReassignOphthalmologyTestTaskDTO,
  TaskStateActionDTO,
  SubmitOphthalmologyTestTaskForReviewDTO,
  ReasonedTaskStateActionDTO,
  StartOphthalmologyTestTaskDTO,
  RepeatOphthalmologyTestTaskDTO,
  RouteOphthalmologyTestTaskDTO,
  SaveOphthalmologyTestResultDraftDTO,
  CompleteOphthalmologyTestResultDTO,
  AmendOphthalmologyTestResultDTO,
  SaveOphthalmologyClinicalReviewDraftDTO,
  SaveOphthalmologyOpticalPrescriptionDraftDTO,
  ApproveOphthalmologyOpticalPrescriptionDTO,
  OphthalmologyResultReviewDTO,
  DeferOphthalmologyResultDTO,
  OverrideOphthalmologyCompletionDTO,
  CompleteOphthalmologyConsultationDTO,
  ReopenOphthalmologyConsultationDTO,
  CorrectOphthalmologyConsultationDTO,
  CorrectOphthalmologyClinicalReviewDTO,
  CorrectOphthalmologyOpticalPrescriptionDTO,
} from './ophthalmology.types.js';
import { ophthalmologyAttachmentListQuerySchema, ophthalmologyDashboardQuerySchema, ophthalmologyPublicationBodySchema, ophthalmologyPublicationHeadersSchema,
  ophthalmologyReportParamsSchema, ophthalmologyReportQuerySchema,
  withdrawOphthalmologyPublicationBodySchema } from './ophthalmology-phase10.schemas.js';
import type { CreateOphthalmologyPublicationDTO, OphthalmologyAttachmentListQuery, OphthalmologyAttachmentProvenance,
  OphthalmologyDashboardQuery, OphthalmologyReportQuery, OphthalmologyReportType, WithdrawOphthalmologyPublicationDTO } from './ophthalmology-phase10.types.js';

type VisitParams = { visitId: string };
type IdParams = { id: string };
type VisitAlertParams = { visitId: string; id: string };
type IdempotencyHeaders = { 'idempotency-key': string };
type ReportParams = { reportType: OphthalmologyReportType };
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const readMultipartField = (fields: MultipartFields, name: string) => {
  const field = fields[name]; const first = Array.isArray(field) ? field[0] : field;
  if (!first || first.type !== 'field') return null;
  const value = (first as MultipartValue).value;
  if (typeof value !== 'string') return null;
  return value.trim() || null;
};
const requireMultipartField = (fields: MultipartFields, name: string, label: string) => {
  const value = readMultipartField(fields, name);
  if (!value) throw new AppError(`${label} is required`, 400, 'VALIDATION_ERROR');
  return value;
};
const isAttachmentProvenance = (value: string): value is OphthalmologyAttachmentProvenance =>
  value === 'MANUAL_UPLOAD' || value === 'DEVICE_IMPORT';

export const registerOphthalmologyRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.post<{ Headers: IdempotencyHeaders }>('/api/ophthalmology/attachments', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Edit'),
    schema: { headers: ophthalmologyPublicationHeadersSchema },
  }, async (request, reply) => {
    const file = await request.file();
    if (!file) throw new AppError('Attachment file is required', 400, 'VALIDATION_ERROR');
    const data = await file.toBuffer();
    const provenance = requireMultipartField(file.fields, 'provenance', 'Provenance');
    if (!isAttachmentProvenance(provenance)) throw new AppError('Attachment provenance is invalid', 400, 'VALIDATION_ERROR');
    const attachment = await services.ophthalmologyPhase10.uploadAttachment({
      task_id: requireMultipartField(file.fields, 'task_id', 'Task id'), result_id: readMultipartField(file.fields, 'result_id'),
      title: requireMultipartField(file.fields, 'title', 'Title'), acquired_at: requireMultipartField(file.fields, 'acquired_at', 'Acquired at'),
      provenance, file_name: file.filename, mime_type: file.mimetype, file_size_bytes: data.byteLength, data,
    }, request.headers['idempotency-key'], request.user!.id, metadata(request));
    return reply.status(201).send(ok(attachment));
  });
  app.get<{ Querystring: OphthalmologyAttachmentListQuery }>('/api/ophthalmology/attachments', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'View'),
    schema: { querystring: ophthalmologyAttachmentListQuerySchema },
  }, async (request) => ok(await services.ophthalmologyPhase10.listAttachments(request.query, request.user!.id)));
  app.post<{ Body: CreateOphthalmologyPublicationDTO; Headers: IdempotencyHeaders }>('/api/ophthalmology/publications', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Portal Publication', 'Publish'),
    schema: { headers: ophthalmologyPublicationHeadersSchema, body: ophthalmologyPublicationBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmologyPhase10.publish(request.body,
    request.headers['idempotency-key'], request.user!.id, metadata(request)))));
  app.post<{ Params: IdParams; Body: WithdrawOphthalmologyPublicationDTO }>('/api/ophthalmology/publications/:id/withdraw', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Portal Publication', 'Withdraw'),
    schema: { params: ophthalmologyIdParamsSchema, body: withdrawOphthalmologyPublicationBodySchema },
  }, async (request) => ok(await services.ophthalmologyPhase10.withdraw(request.params.id, request.body, request.user!.id, metadata(request))));
  app.get<{ Params: ReportParams; Querystring: OphthalmologyReportQuery }>('/api/ophthalmology/reports/:reportType', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Reports', 'View'),
    schema: { params: ophthalmologyReportParamsSchema, querystring: ophthalmologyReportQuerySchema },
  }, async (request) => ok(await services.ophthalmologyPhase10.report(request.params.reportType, request.query, request.user!.id)));
  app.get<{ Querystring: OphthalmologyDashboardQuery }>('/api/ophthalmology/dashboard', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Reports', 'View'), schema: { querystring: ophthalmologyDashboardQuerySchema },
  }, async (request) => ok(await services.ophthalmologyPhase10.dashboard(request.query, request.user!.id)));
  app.post<{ Querystring: OphthalmologyDashboardQuery }>('/api/ophthalmology/dashboard/refresh', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Reports', 'Export'), schema: { querystring: ophthalmologyDashboardQuerySchema },
  }, async (request) => ok(await services.ophthalmologyPhase10.refreshDashboard(request.query, request.user!.id)));
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/doctor-review', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getDoctorReview(request.params.visitId, request.user!.id)));
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/clinical-review', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getClinicalReview(request.params.visitId, request.user!.id)));
  app.put<{ Params: VisitParams; Body: SaveOphthalmologyClinicalReviewDraftDTO }>('/api/opd/visits/:visitId/ophthalmology/clinical-review/draft', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Diagnose'),
    schema: { params: ophthalmologyVisitParamsSchema, body: saveOphthalmologyClinicalReviewDraftBodySchema },
  }, async (request) => ok(await services.ophthalmology.saveClinicalReviewDraft(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/optical-prescription', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Optical Prescription', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getOpticalPrescription(request.params.visitId, request.user!.id)));
  app.put<{ Params: VisitParams; Body: SaveOphthalmologyOpticalPrescriptionDraftDTO }>('/api/opd/visits/:visitId/ophthalmology/optical-prescription/draft', {
    preHandler: requireAnyPermission(services, [
      { moduleName: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Create' },
      { moduleName: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
    ]),
    schema: { params: ophthalmologyVisitParamsSchema, body: saveOphthalmologyOpticalPrescriptionDraftBodySchema },
  }, async (request) => ok(await services.ophthalmology.saveOpticalPrescriptionDraft(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: ApproveOphthalmologyOpticalPrescriptionDTO }>('/api/opd/visits/:visitId/ophthalmology/optical-prescription/approve', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Optical Prescription', 'Approve'),
    schema: { params: ophthalmologyVisitParamsSchema, body: approveOphthalmologyOpticalPrescriptionBodySchema },
  }, async (request) => ok(await services.ophthalmology.approveOpticalPrescription(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.get<{ Querystring: OphthalmologyTestTaskListQuery }>('/api/ophthalmology/test-tasks', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'View'), schema: { querystring: ophthalmologyTestTaskListQuerySchema },
  }, async (request) => ok(await services.ophthalmology.listTestTasks(request.query, request.user!.id)));
  app.get<{ Params: IdParams }>('/api/ophthalmology/test-tasks/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'View'), schema: { params: ophthalmologyIdParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getTestTask(request.params.id, request.user!.id)));
  app.post<{ Params: VisitParams; Body: CreateOphthalmologyTestTaskDTO; Headers: IdempotencyHeaders }>('/api/opd/visits/:visitId/ophthalmology/test-tasks', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Edit'),
    schema: { params: ophthalmologyVisitParamsSchema, headers: ophthalmologyTestTaskHeadersSchema, body: createOphthalmologyTestTaskBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmology.createTestTask(request.params.visitId, request.body,
    request.headers['idempotency-key'], request.user!.id, metadata(request)))));
  app.post<{ Params: IdParams; Body: AssignOphthalmologyTestTaskDTO }>('/api/ophthalmology/test-tasks/:id/assign', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Assign'), schema: { params: ophthalmologyIdParamsSchema, body: assignOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.assignTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: ReassignOphthalmologyTestTaskDTO }>('/api/ophthalmology/test-tasks/:id/reassign', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Reassign'), schema: { params: ophthalmologyIdParamsSchema, body: reassignOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.reassignTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: TaskStateActionDTO }>('/api/ophthalmology/test-tasks/:id/call', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Call'), schema: { params: ophthalmologyIdParamsSchema, body: callOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.callTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: ReasonedTaskStateActionDTO }>('/api/ophthalmology/test-tasks/:id/patient-unavailable', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Call'), schema: { params: ophthalmologyIdParamsSchema, body: patientUnavailableOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.patientUnavailable(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: StartOphthalmologyTestTaskDTO }>('/api/ophthalmology/test-tasks/:id/start', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Start'), schema: { params: ophthalmologyIdParamsSchema, body: startOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.startTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: ReasonedTaskStateActionDTO }>('/api/ophthalmology/test-tasks/:id/unable', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Cancel'), schema: { params: ophthalmologyIdParamsSchema, body: unableOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.unableTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: ReasonedTaskStateActionDTO }>('/api/ophthalmology/test-tasks/:id/cancel', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Cancel'), schema: { params: ophthalmologyIdParamsSchema, body: cancelOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.cancelTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: SubmitOphthalmologyTestTaskForReviewDTO }>('/api/ophthalmology/test-tasks/:id/submit-for-review', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Complete'),
    schema: { params: ophthalmologyIdParamsSchema, body: submitOphthalmologyTestTaskForReviewBodySchema },
  }, async (request) => ok(await services.ophthalmology.submitTestTaskForReview(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: RepeatOphthalmologyTestTaskDTO; Headers: IdempotencyHeaders }>('/api/ophthalmology/test-tasks/:id/request-repeat', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Review', 'Request Repeat'),
    schema: { params: ophthalmologyIdParamsSchema, headers: ophthalmologyTestTaskHeadersSchema, body: repeatOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.repeatTestTask(request.params.id, request.body, request.headers['idempotency-key'], request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: RouteOphthalmologyTestTaskDTO }>('/api/ophthalmology/test-tasks/:id/route', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Reassign'), schema: { params: ophthalmologyIdParamsSchema, body: routeOphthalmologyTestTaskBodySchema },
  }, async (request) => ok(await services.ophthalmology.routeTestTask(request.params.id, request.body, request.user!.id, metadata(request))));
  app.get<{ Params: IdParams }>('/api/ophthalmology/test-tasks/:id/result', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'View'), schema: { params: ophthalmologyIdParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getTestResult(request.params.id, request.user!.id)));
  app.put<{ Params: IdParams; Body: SaveOphthalmologyTestResultDraftDTO }>('/api/ophthalmology/test-tasks/:id/result/draft', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Edit'),
    schema: { params: ophthalmologyIdParamsSchema, body: saveOphthalmologyTestResultDraftBodySchema },
  }, async (request) => ok(await services.ophthalmology.saveTestResultDraft(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: CompleteOphthalmologyTestResultDTO }>('/api/ophthalmology/test-tasks/:id/result/complete', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Queue', 'Complete'),
    schema: { params: ophthalmologyIdParamsSchema, body: completeOphthalmologyTestResultBodySchema },
  }, async (request) => ok(await services.ophthalmology.completeTestResult(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: AmendOphthalmologyTestResultDTO }>('/api/ophthalmology/test-tasks/:id/result/amendments', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Review', 'Amend'),
    schema: { params: ophthalmologyIdParamsSchema, body: amendOphthalmologyTestResultBodySchema },
  }, async (request) => ok(await services.ophthalmology.amendTestResult(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: OphthalmologyResultReviewDTO }>('/api/ophthalmology/test-tasks/:id/result/review', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Test Review', 'Review'),
    schema: { params: ophthalmologyIdParamsSchema, body: reviewOphthalmologyTestResultBodySchema },
  }, async (request) => ok(await services.ophthalmology.reviewTestResult(request.params.id, request.body, request.user!.id, metadata(request))));

  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/completion-readiness', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getCompletionReadiness(request.params.visitId, request.user!.id)));
  app.post<{ Params: VisitParams; Body: DeferOphthalmologyResultDTO }>('/api/opd/visits/:visitId/ophthalmology/result-deferrals', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Override'),
    schema: { params: ophthalmologyVisitParamsSchema, body: deferOphthalmologyResultBodySchema },
  }, async (request) => ok(await services.ophthalmology.deferResult(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: OverrideOphthalmologyCompletionDTO }>('/api/opd/visits/:visitId/ophthalmology/completion-overrides', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Override'),
    schema: { params: ophthalmologyVisitParamsSchema, body: overrideOphthalmologyCompletionBodySchema },
  }, async (request) => ok(await services.ophthalmology.overrideCompletion(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: CompleteOphthalmologyConsultationDTO; Headers: IdempotencyHeaders }>('/api/opd/visits/:visitId/ophthalmology/complete', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Complete'),
    schema: { params: ophthalmologyVisitParamsSchema, headers: ophthalmologyTestTaskHeadersSchema, body: completeOphthalmologyConsultationBodySchema },
  }, async (request) => ok(await services.ophthalmology.completeConsultation(request.params.visitId, request.body,
    request.headers['idempotency-key'], request.user!.id, metadata(request))));
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/summary', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getConsultationSummary(request.params.visitId, request.user!.id)));
  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/completion-history', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getCompletionHistory(request.params.visitId, request.user!.id)));
  app.post<{ Params: VisitParams; Body: ReopenOphthalmologyConsultationDTO }>('/api/opd/visits/:visitId/ophthalmology/reopen', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Reopen'),
    schema: { params: ophthalmologyVisitParamsSchema, body: reopenOphthalmologyConsultationBodySchema },
  }, async (request) => ok(await services.ophthalmology.reopenConsultation(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: CorrectOphthalmologyConsultationDTO }>('/api/opd/visits/:visitId/ophthalmology/corrections/consultation', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Amend'),
    schema: { params: ophthalmologyVisitParamsSchema, body: correctOphthalmologyConsultationBodySchema },
  }, async (request) => ok(await services.ophthalmology.correctConsultation(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: CorrectOphthalmologyClinicalReviewDTO }>('/api/opd/visits/:visitId/ophthalmology/corrections/clinical-review', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Amend'),
    schema: { params: ophthalmologyVisitParamsSchema, body: correctOphthalmologyClinicalReviewBodySchema },
  }, async (request) => ok(await services.ophthalmology.correctClinicalReview(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: CorrectOphthalmologyOpticalPrescriptionDTO }>('/api/opd/visits/:visitId/ophthalmology/corrections/optical-prescription', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Consultation', 'Amend'),
    schema: { params: ophthalmologyVisitParamsSchema, body: correctOphthalmologyOpticalPrescriptionBodySchema },
  }, async (request) => ok(await services.ophthalmology.correctOpticalPrescription(request.params.visitId, request.body, request.user!.id, metadata(request))));

  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/context', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getContext(request.params.visitId, request.user!.id)));
  app.post<{ Params: VisitParams; Body: CreateOphthalmologyContextDTO }>('/api/opd/visits/:visitId/ophthalmology/context', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Edit'), schema: { params: ophthalmologyVisitParamsSchema, body: createOphthalmologyContextBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmology.createContext(request.params.visitId, request.body, request.user!.id, metadata(request)))));
  app.patch<{ Params: VisitParams; Body: UpdateOphthalmologyContextDTO }>('/api/opd/visits/:visitId/ophthalmology/context', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Edit'), schema: { params: ophthalmologyVisitParamsSchema, body: updateOphthalmologyContextBodySchema },
  }, async (request) => ok(await services.ophthalmology.updateContext(request.params.visitId, request.body, request.user!.id, metadata(request))));

  app.get<{ Params: VisitParams }>('/api/opd/visits/:visitId/ophthalmology/intake', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'View'), schema: { params: ophthalmologyVisitParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getIntake(request.params.visitId, request.user!.id)));
  app.put<{ Params: VisitParams; Body: SaveOphthalmologyIntakeDraftDTO }>('/api/opd/visits/:visitId/ophthalmology/intake/draft', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Edit'),
    schema: { params: ophthalmologyVisitParamsSchema, body: saveOphthalmologyIntakeDraftBodySchema },
  }, async (request) => ok(await services.ophthalmology.saveIntakeDraft(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitParams; Body: CompleteOphthalmologyIntakeDTO }>('/api/opd/visits/:visitId/ophthalmology/intake/complete', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Edit'),
    schema: { params: ophthalmologyVisitParamsSchema, body: completeOphthalmologyIntakeBodySchema },
  }, async (request) => ok(await services.ophthalmology.completeIntake(request.params.visitId, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitAlertParams; Body: RouteOphthalmologyEmergencyDTO }>('/api/opd/visits/:visitId/ophthalmology/alerts/:id/route', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Escalate'),
    schema: { params: ophthalmologyVisitAlertParamsSchema, body: routeOphthalmologyEmergencyBodySchema },
  }, async (request) => ok(await services.ophthalmology.routeEmergency(request.params.visitId, request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: VisitAlertParams; Body: AcknowledgeOphthalmologyAlertDTO }>('/api/opd/visits/:visitId/ophthalmology/alerts/:id/acknowledge', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Intake', 'Escalate'),
    schema: { params: ophthalmologyVisitAlertParamsSchema, body: acknowledgeOphthalmologyAlertBodySchema },
  }, async (request) => ok(await services.ophthalmology.acknowledgeAlert(request.params.visitId, request.params.id, request.body, request.user!.id, metadata(request))));

  app.get<{ Querystring: OphthalmologyConfigurationListQuery }>('/api/ophthalmology/configurations', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'View'), schema: { querystring: ophthalmologyConfigurationListQuerySchema },
  }, async (request) => ok(await services.ophthalmology.listConfigurations(request.query, request.user!.id)));
  app.post<{ Body: CreateOphthalmologyConfigurationDTO }>('/api/ophthalmology/configurations', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Create'), schema: { body: createOphthalmologyConfigurationBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmology.createConfiguration(request.body, request.user!.id, metadata(request)))));
  app.patch<{ Params: IdParams; Body: UpdateOphthalmologyConfigurationDTO }>('/api/ophthalmology/configurations/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Edit'), schema: { params: ophthalmologyIdParamsSchema, body: updateOphthalmologyConfigurationBodySchema },
  }, async (request) => ok(await services.ophthalmology.updateConfiguration(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: VersionActionDTO }>('/api/ophthalmology/configurations/:id/activate', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Edit'), schema: { params: ophthalmologyIdParamsSchema, body: versionActionBodySchema },
  }, async (request) => ok(await services.ophthalmology.activateConfiguration(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: VersionActionDTO }>('/api/ophthalmology/configurations/:id/deactivate', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Deactivate'), schema: { params: ophthalmologyIdParamsSchema, body: versionActionBodySchema },
  }, async (request) => ok(await services.ophthalmology.deactivateConfiguration(request.params.id, request.body, request.user!.id, metadata(request))));

  app.get<{ Querystring: OphthalmologyStationListQuery }>('/api/ophthalmology/stations', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'View'), schema: { querystring: ophthalmologyStationListQuerySchema },
  }, async (request) => ok(await services.ophthalmology.listStations(request.query, request.user!.id)));
  app.get<{ Params: IdParams }>('/api/ophthalmology/stations/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'View'), schema: { params: ophthalmologyIdParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getStation(request.params.id, request.user!.id)));
  app.post<{ Body: CreateOphthalmologyStationDTO }>('/api/ophthalmology/stations', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Create'), schema: { body: createOphthalmologyStationBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmology.createStation(request.body, request.user!.id, metadata(request)))));
  app.patch<{ Params: IdParams; Body: UpdateOphthalmologyStationDTO }>('/api/ophthalmology/stations/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Edit'), schema: { params: ophthalmologyIdParamsSchema, body: updateOphthalmologyStationBodySchema },
  }, async (request) => ok(await services.ophthalmology.updateStation(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: VersionActionDTO }>('/api/ophthalmology/stations/:id/deactivate', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Deactivate'), schema: { params: ophthalmologyIdParamsSchema, body: versionActionBodySchema },
  }, async (request) => ok(await services.ophthalmology.deactivateStation(request.params.id, request.body, request.user!.id, metadata(request))));

  app.get<{ Querystring: OphthalmologyWorkflowProfileListQuery }>('/api/ophthalmology/workflow-profiles', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'View'), schema: { querystring: ophthalmologyWorkflowProfileListQuerySchema },
  }, async (request) => ok(await services.ophthalmology.listWorkflowProfiles(request.query, request.user!.id)));
  app.get<{ Params: IdParams }>('/api/ophthalmology/workflow-profiles/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'View'), schema: { params: ophthalmologyIdParamsSchema },
  }, async (request) => ok(await services.ophthalmology.getWorkflowProfile(request.params.id, request.user!.id)));
  app.post<{ Body: CreateOphthalmologyWorkflowProfileDTO }>('/api/ophthalmology/workflow-profiles', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Create'), schema: { body: createOphthalmologyWorkflowProfileBodySchema },
  }, async (request, reply) => reply.status(201).send(ok(await services.ophthalmology.createWorkflowProfile(request.body, request.user!.id, metadata(request)))));
  app.patch<{ Params: IdParams; Body: UpdateOphthalmologyWorkflowProfileDTO }>('/api/ophthalmology/workflow-profiles/:id', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Edit'), schema: { params: ophthalmologyIdParamsSchema, body: updateOphthalmologyWorkflowProfileBodySchema },
  }, async (request) => ok(await services.ophthalmology.updateWorkflowProfile(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: VersionActionDTO }>('/api/ophthalmology/workflow-profiles/:id/activate', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Edit'), schema: { params: ophthalmologyIdParamsSchema, body: versionActionBodySchema },
  }, async (request) => ok(await services.ophthalmology.activateWorkflowProfile(request.params.id, request.body, request.user!.id, metadata(request))));
  app.post<{ Params: IdParams; Body: VersionActionDTO }>('/api/ophthalmology/workflow-profiles/:id/deactivate', {
    preHandler: requirePermission(services, 'OPD', 'Ophthalmology Configuration', 'Deactivate'), schema: { params: ophthalmologyIdParamsSchema, body: versionActionBodySchema },
  }, async (request) => ok(await services.ophthalmology.deactivateWorkflowProfile(request.params.id, request.body, request.user!.id, metadata(request))));
};
