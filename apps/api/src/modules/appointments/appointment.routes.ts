import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  appointmentIdParamsSchema,
  createAppointmentBodySchema,
  listAppointmentsQuerySchema,
  updateAppointmentBodySchema,
  updateAppointmentStatusBodySchema,
} from './appointment.schemas.js';
import type {
  AppointmentListQuery,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  UpdateAppointmentStatusDTO,
} from './appointment.types.js';

type AppointmentIdParams = {
  id: string;
};

export const registerAppointmentRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: AppointmentListQuery }>(
    '/api/appointments',
    {
      preHandler: requirePermission(services, 'Appointments', 'Appointment Records', 'View'),
      schema: {
        querystring: listAppointmentsQuerySchema,
      },
    },
    async (request) => ok(await services.appointments.list(request.query, request.user!.id)),
  );

  app.get<{ Params: AppointmentIdParams }>(
    '/api/appointments/:id',
    {
      preHandler: requirePermission(services, 'Appointments', 'Appointment Records', 'View'),
      schema: {
        params: appointmentIdParamsSchema,
      },
    },
    async (request) => ok(await services.appointments.getById(request.params.id, request.user!.id)),
  );

  app.post<{ Body: CreateAppointmentDTO }>(
    '/api/appointments',
    {
      preHandler: requirePermission(services, 'Appointments', 'Appointment Booking', 'Create'),
      schema: {
        body: createAppointmentBodySchema,
      },
    },
    async (request, reply) => {
      const appointment = await services.appointments.create(request.body, request.user!.id);
      return reply.status(201).send(ok(appointment));
    },
  );

  app.patch<{ Params: AppointmentIdParams; Body: UpdateAppointmentDTO }>(
    '/api/appointments/:id',
    {
      preHandler: requirePermission(services, 'Appointments', 'Appointment Booking', 'Edit'),
      schema: {
        params: appointmentIdParamsSchema,
        body: updateAppointmentBodySchema,
      },
    },
    async (request) => ok(await services.appointments.update(request.params.id, request.body, request.user!.id)),
  );

  app.patch<{ Params: AppointmentIdParams; Body: UpdateAppointmentStatusDTO }>(
    '/api/appointments/:id/status',
    {
      preHandler: requirePermission(services, 'Appointments', 'Appointment Records', 'Edit'),
      schema: {
        params: appointmentIdParamsSchema,
        body: updateAppointmentStatusBodySchema,
      },
    },
    async (request) => ok(await services.appointments.updateStatus(request.params.id, request.body, request.user!.id)),
  );
};
