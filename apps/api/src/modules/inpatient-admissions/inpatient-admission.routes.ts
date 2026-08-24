import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { admissionRequestActionSchema, admissionRequestBranchSchema, cancelAdmissionRequestSchema, confirmAdmissionRequestSchema, createAdmissionRequestSchema, inpatientAdmissionIdSchema, listAdmissionRequestsSchema, listInpatientAdmissionsSchema, validateAdmissionRequestSchema } from './inpatient-admission.schemas.js';
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', error.flatten());
    }
    throw error;
  }
};
export const registerInpatientAdmissionRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/admissions/inpatients', { preHandler: requirePermission(services, 'Admissions', 'Inpatient Admissions', 'View') }, async (request) => ok(await services.inpatientAdmissions.list(parse(listInpatientAdmissionsSchema, request.query), request.user!.id)));
  app.get('/api/admissions/inpatients/:id', { preHandler: requirePermission(services, 'Admissions', 'Inpatient Admissions', 'View') }, async (request) => { const params = parse(inpatientAdmissionIdSchema, request.params); const query = parse(listInpatientAdmissionsSchema.pick({ branch_id: true }), request.query); return ok(await services.inpatientAdmissions.get(params.id, query.branch_id, request.user!.id)); });
  app.get('/api/admissions/requests', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'View') }, async (request) => ok(await services.inpatientAdmissions.listRequests(parse(listAdmissionRequestsSchema, request.query), request.user!.id)));
  app.get('/api/admissions/requests/:id', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'View') }, async (request) => { const params = parse(admissionRequestActionSchema, request.params); const query = parse(admissionRequestBranchSchema, request.query); return ok(await services.inpatientAdmissions.getRequest(params.id, query.branch_id, request.user!.id)); });
  app.post('/api/admissions/requests', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.inpatientAdmissions.createRequest(parse(createAdmissionRequestSchema, request.body), request.user!.id, metadata(request)))));
  app.post('/api/admissions/recommendations', { preHandler: requirePermission(services, 'Admissions', 'Admission Recommendations', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.inpatientAdmissions.createRequest(parse(createAdmissionRequestSchema, request.body), request.user!.id, metadata(request)))));
  app.patch('/api/admissions/requests/:id/validate', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'Validate') }, async (request) => { const params = parse(admissionRequestActionSchema, request.params); const query = parse(admissionRequestBranchSchema, request.query); return ok(await services.inpatientAdmissions.validateRequest(params.id, query.branch_id, parse(validateAdmissionRequestSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/admissions/requests/:id/confirm', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'Confirm') }, async (request) => { const params = parse(admissionRequestActionSchema, request.params); const query = parse(admissionRequestBranchSchema, request.query); return ok(await services.inpatientAdmissions.confirmRequest(params.id, query.branch_id, parse(confirmAdmissionRequestSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/admissions/requests/:id/cancel', { preHandler: requirePermission(services, 'Admissions', 'Admission Requests', 'Cancel') }, async (request) => { const params = parse(admissionRequestActionSchema, request.params); const query = parse(admissionRequestBranchSchema, request.query); return ok(await services.inpatientAdmissions.cancelRequest(params.id, query.branch_id, parse(cancelAdmissionRequestSchema, request.body), request.user!.id, metadata(request))); });
};
