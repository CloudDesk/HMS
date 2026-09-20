import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission, requireAnyPermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  assignDoctorStageSchema,
  cancelStageAppointmentSchema,
  createDentalStageSchema,
  dentalStageParamsSchema,
  episodeStageParamsSchema,
  episodeStagesQuerySchema,
  rescheduleDentalStageSchema,
  scheduleDentalStageSchema,
  updateDentalStageStatusSchema,
} from './dental-stage.schemas.js';

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldMessages = error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? `${field}: ${issue.message}` : issue.message;
      });
      throw new AppError(
        fieldMessages.join('; ') || 'Request validation failed',
        400,
        'VALIDATION_ERROR',
        error.flatten(),
      );
    }
    throw error;
  }
};

export const registerDentalStageRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  // Create a new Dental Treatment Stage for an Episode
  app.post(
    '/api/opd/dental/episodes/:episodeId/stages',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(episodeStageParamsSchema, request.params);
      const body = parse(createDentalStageSchema, request.body);
      return ok(
        await services.dentalStages.createStage(
          params.episodeId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // List Dental Treatment Stages for an Episode
  app.get(
    '/api/opd/dental/episodes/:episodeId/stages',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(episodeStageParamsSchema, request.params);
      const query = parse(episodeStagesQuerySchema, request.query);
      return ok(
        await services.dentalStages.listStages(
          params.episodeId,
          query.plan_item_id,
          request.user!.id,
        ),
      );
    },
  );

  // Get a specific Dental Treatment Stage by ID
  app.get(
    '/api/opd/dental/stages/:stageId',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      return ok(
        await services.dentalStages.getStage(
          params.stageId,
          request.user!.id,
        ),
      );
    },
  );

  // Assign or reassign doctor to a treatment stage
  app.patch(
    '/api/opd/dental/stages/:stageId/doctor',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const body = parse(assignDoctorStageSchema, request.body);
      return ok(
        await services.dentalStages.assignDoctor(
          params.stageId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Update Dental Treatment Stage status
  app.patch(
    '/api/opd/dental/stages/:stageId/status',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const body = parse(updateDentalStageStatusSchema, request.body);
      return ok(
        await services.dentalStages.updateStatus(
          params.stageId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Delete a PLANNED Dental Treatment Stage
  app.delete(
    '/api/opd/dental/stages/:stageId',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const success = await services.dentalStages.deleteStage(
        params.stageId,
        request.user!.id,
      );
      return ok({ success });
    },
  );

  // Schedule an appointment for a Dental Treatment Stage
  app.post(
    '/api/opd/dental/stages/:stageId/schedule',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'OPD', screen: 'OPD Consultation', action: 'Edit' },
        { moduleName: 'Appointments', screen: 'Appointment Booking', action: 'Create' },
      ]),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const body = parse(scheduleDentalStageSchema, request.body);
      return ok(
        await services.dentalStages.scheduleStage(
          params.stageId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Reschedule an appointment for a Dental Treatment Stage
  app.post(
    '/api/opd/dental/stages/:stageId/reschedule',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'OPD', screen: 'OPD Consultation', action: 'Edit' },
        { moduleName: 'Appointments', screen: 'Appointment Booking', action: 'Edit' },
      ]),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const body = parse(rescheduleDentalStageSchema, request.body);
      return ok(
        await services.dentalStages.rescheduleStage(
          params.stageId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Cancel an appointment linked to a Dental Treatment Stage
  app.post(
    '/api/opd/dental/stages/:stageId/cancel-appointment',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'OPD', screen: 'OPD Consultation', action: 'Edit' },
        { moduleName: 'Appointments', screen: 'Appointment Booking', action: 'Edit' },
        { moduleName: 'Appointments', screen: 'Appointment Records', action: 'Edit' },
      ]),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      const body = parse(cancelStageAppointmentSchema, request.body);
      return ok(
        await services.dentalStages.cancelStageAppointment(
          params.stageId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Get the appointment linked to a Dental Treatment Stage
  app.get(
    '/api/opd/dental/stages/:stageId/appointment',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'OPD', screen: 'OPD Consultation', action: 'View' },
        { moduleName: 'Appointments', screen: 'Appointment Records', action: 'View' },
      ]),
    },
    async (request) => {
      const params = parse(dentalStageParamsSchema, request.params);
      return ok(
        await services.dentalStages.getStageAppointment(
          params.stageId,
          request.user!.id,
        ),
      );
    },
  );
};
