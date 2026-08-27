import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { confirmBookingSchema, createBookingSchema, createRecommendationSchema, reasonSchema, rescheduleBookingSchema, surgeryAlternativesSchema, surgeryBranchSchema, surgeryIdSchema, surgeryListSchema } from './surgery.schemas.js';
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
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
export const registerSurgeryRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/surgery/recommendations', { preHandler: requirePermission(services, 'Surgery', 'Recommendations', 'View') }, async (request) => ok(await services.surgery.listRecommendations(parse(surgeryListSchema, request.query), request.user!.id)));
  app.post('/api/surgery/recommendations', { preHandler: requirePermission(services, 'Surgery', 'Recommendations', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.surgery.createRecommendation(parse(createRecommendationSchema, request.body), request.user!.id, metadata(request)))));
  app.post('/api/surgery/recommendations/:id/cancel', { preHandler: requirePermission(services, 'Surgery', 'Recommendations', 'Cancel') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.cancelRecommendation(params.id, query.branch_id, parse(reasonSchema, request.body), request.user!.id, metadata(request))); });
  app.get('/api/surgery/bookings', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'View') }, async (request) => ok(await services.surgery.listBookings(parse(surgeryListSchema, request.query), request.user!.id)));
  app.get('/api/surgery/bookings/:id', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'View') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.getBooking(params.id, query.branch_id, request.user!.id)); });
  app.get('/api/surgery/bookings/:id/prescription', { preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'View') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(clinicalContextBranchSchema, request.query); return ok(await services.surgery.getPrescription(params.id, query.branch_id, request.user!.id)); });
  app.post('/api/surgery/bookings/:id/prescription', { preHandler: requirePermission(services, 'OPD', 'OPD Prescription', 'Edit') }, async (request, reply) => { const params = parse(surgeryIdSchema, request.params); const query = parse(clinicalContextBranchSchema, request.query); return reply.status(201).send(ok(await services.surgery.submitPrescription(params.id, query.branch_id, parse(clinicalContextPrescriptionSchema, request.body), request.user!.id, metadata(request)))); });
  app.get('/api/surgery/bookings/:id/clinical-orders/:orderType', { preHandler: requirePermission(services, 'OPD', 'OPD Clinical Orders', 'View') }, async (request) => { const params = parse(clinicalContextParamsSchema, request.params); const query = parse(clinicalContextBranchSchema, request.query); return ok(await services.surgery.getClinicalOrder(params.id, query.branch_id, params.orderType, request.user!.id)); });
  app.post('/api/surgery/bookings/:id/clinical-orders/:orderType', { preHandler: requirePermission(services, 'OPD', 'OPD Clinical Orders', 'Edit') }, async (request, reply) => { const params = parse(clinicalContextParamsSchema, request.params); const query = parse(clinicalContextBranchSchema, request.query); return reply.status(201).send(ok(await services.surgery.submitClinicalOrder(params.id, query.branch_id, params.orderType, parse(clinicalContextOrderSchema, request.body), request.user!.id, metadata(request)))); });
  app.post('/api/surgery/bookings', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.surgery.createBooking(parse(createBookingSchema, request.body), request.user!.id, metadata(request)))));
  app.post('/api/surgery/bookings/:id/confirm', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'Confirm') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.confirmBooking(params.id, query.branch_id, parse(confirmBookingSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/surgery/bookings/:id/reschedule', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'Reschedule') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.rescheduleBooking(params.id, query.branch_id, parse(rescheduleBookingSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/surgery/bookings/:id/cancel', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'Cancel') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.cancelBooking(params.id, query.branch_id, parse(reasonSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/surgery/bookings/:id/complete', { preHandler: requirePermission(services, 'Surgery', 'Bookings', 'Complete') }, async (request) => { const params = parse(surgeryIdSchema, request.params); const query = parse(surgeryBranchSchema, request.query); return ok(await services.surgery.completeBooking(params.id, query.branch_id, request.user!.id, metadata(request))); });
  app.get('/api/surgery/schedule', { preHandler: requirePermission(services, 'Surgery', 'Schedule', 'View') }, async (request) => ok(await services.surgery.listBookings(parse(surgeryListSchema, request.query), request.user!.id)));
  app.get('/api/surgery/availability/alternatives', { preHandler: requirePermission(services, 'Surgery', 'Schedule', 'View') }, async (request) => { const query = parse(surgeryAlternativesSchema, request.query); return ok(await services.surgery.alternatives(query.branch_id, query.department_id, query.service_id, query.scheduled_start, request.user!.id, query.doctor_id)); });
};
