import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
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
  patientUnavailableOphthalmologyTestTaskBodySchema,
  startOphthalmologyTestTaskBodySchema,
  unableOphthalmologyTestTaskBodySchema,
  cancelOphthalmologyTestTaskBodySchema,
  repeatOphthalmologyTestTaskBodySchema,
  routeOphthalmologyTestTaskBodySchema,
  saveOphthalmologyTestResultDraftBodySchema,
  completeOphthalmologyTestResultBodySchema,
  amendOphthalmologyTestResultBodySchema,
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
  ReasonedTaskStateActionDTO,
  StartOphthalmologyTestTaskDTO,
  RepeatOphthalmologyTestTaskDTO,
  RouteOphthalmologyTestTaskDTO,
  SaveOphthalmologyTestResultDraftDTO,
  CompleteOphthalmologyTestResultDTO,
  AmendOphthalmologyTestResultDTO,
} from './ophthalmology.types.js';

type VisitParams = { visitId: string };
type IdParams = { id: string };
type VisitAlertParams = { visitId: string; id: string };
type IdempotencyHeaders = { 'idempotency-key': string };
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });

export const registerOphthalmologyRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
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
