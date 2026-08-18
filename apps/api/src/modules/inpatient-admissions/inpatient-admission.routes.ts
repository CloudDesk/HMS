import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { createInpatientAdmissionSchema, inpatientAdmissionIdSchema, listInpatientAdmissionsSchema } from './inpatient-admission.schemas.js';
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => schema.parse(value);
export const registerInpatientAdmissionRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/admissions/inpatients', { preHandler: requirePermission(services, 'Admissions', 'Inpatient Admissions', 'View') }, async (request) => ok(await services.inpatientAdmissions.list(parse(listInpatientAdmissionsSchema, request.query), request.user!.id)));
  app.get('/api/admissions/inpatients/:id', { preHandler: requirePermission(services, 'Admissions', 'Inpatient Admissions', 'View') }, async (request) => { const params = parse(inpatientAdmissionIdSchema, request.params); const query = parse(listInpatientAdmissionsSchema.pick({ branch_id: true }), request.query); return ok(await services.inpatientAdmissions.get(params.id, query.branch_id, request.user!.id)); });
  app.post('/api/admissions/inpatients', { preHandler: requirePermission(services, 'Admissions', 'Inpatient Admissions', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.inpatientAdmissions.create(parse(createInpatientAdmissionSchema, request.body), request.user!.id, metadata(request)))));
};
