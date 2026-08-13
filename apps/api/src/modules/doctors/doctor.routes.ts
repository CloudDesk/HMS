import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  availableSlotsQuerySchema,
  createDoctorBodySchema,
  createDoctorLeaveBodySchema,
  doctorChildIdParamsSchema,
  doctorIdParamsSchema,
  listDoctorExceptionsQuerySchema,
  listDoctorLeavesQuerySchema,
  listDoctorsQuerySchema,
  mapDoctorUserBodySchema,
  saveDoctorAvailabilityBodySchema,
  saveDoctorExceptionBodySchema,
  updateDoctorBodySchema,
  updateDoctorStatusBodySchema,
} from './doctor.schemas.js';
import type {
  CreateDoctorDTO,
  CreateDoctorLeaveDTO,
  DoctorAvailabilityExceptionListQuery,
  DoctorAvailableSlotsQuery,
  DoctorLeaveListQuery,
  DoctorListQuery,
  MapDoctorUserDTO,
  SaveDoctorAvailabilityDTO,
  SaveDoctorAvailabilityExceptionDTO,
  UpdateDoctorDTO,
  UpdateDoctorStatusDTO,
} from './doctor.types.js';

type DoctorIdParams = { id: string };
type DoctorChildIdParams = { id: string; childId: string };

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerDoctorRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: DoctorListQuery }>(
    '/api/doctors',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View'),
      schema: { querystring: listDoctorsQuerySchema },
    },
    async (request) => ok(await services.doctors.list(request.query)),
  );

  app.get(
    '/api/doctors/me',
    { preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View') },
    async (request) => ok(await services.doctors.getCurrentDoctor(request.user!.id)),
  );

  app.get(
    '/api/doctors/user-options',
    { preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View') },
    async () => ok(await services.doctors.listUserOptions()),
  );

  app.get<{ Querystring: DoctorListQuery }>(
    '/api/doctors/export',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Export'),
      schema: { querystring: listDoctorsQuerySchema },
    },
    async (request, reply) => {
      const stream = await services.doctors.export(
        request.query,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="hms-doctors.csv"')
        .send(stream);
    },
  );

  app.get<{ Params: DoctorIdParams }>(
    '/api/doctors/:id',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View'),
      schema: { params: doctorIdParamsSchema },
    },
    async (request) => ok(await services.doctors.getById(request.params.id)),
  );

  app.post<{ Body: CreateDoctorDTO }>(
    '/api/doctors',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Create'),
      schema: { body: createDoctorBodySchema },
    },
    async (request, reply) => {
      if (request.body.account_access.create_login_account) {
        const canProvisionLogin = await services.permissions.userHasPermission(
          request.user!.id,
          'Doctors',
          'Doctor Directory',
          'Provision Login',
        );
        if (!canProvisionLogin) {
          await services.permissions.auditDeniedAccess(
            request.user!.id,
            'Doctors',
            'Doctor Directory',
            'Provision Login',
            metadataFromRequest(request),
          );
          throw new AppError('Permission required to provision a doctor login', 403, 'PERMISSION_REQUIRED');
        }
      }

      const doctor = await services.doctors.create(
        request.body,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.status(201).send(ok(doctor));
    },
  );

  app.patch<{ Params: DoctorIdParams; Body: UpdateDoctorDTO }>(
    '/api/doctors/:id',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: updateDoctorBodySchema },
    },
    async (request) =>
      ok(
        await services.doctors.update(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Params: DoctorIdParams; Body: UpdateDoctorStatusDTO }>(
    '/api/doctors/:id/status',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: updateDoctorStatusBodySchema },
    },
    async (request) =>
      ok(
        await services.doctors.updateStatus(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Params: DoctorIdParams; Body: MapDoctorUserDTO }>(
    '/api/doctors/:id/user-mapping',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: mapDoctorUserBodySchema },
    },
    async (request) =>
      ok(
        await services.doctors.mapUser(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Params: DoctorIdParams; Body: SaveDoctorAvailabilityDTO }>(
    '/api/doctors/:id/availability',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: saveDoctorAvailabilityBodySchema },
    },
    async (request) =>
      ok(
        await services.doctors.updateAvailability(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.get<{ Params: DoctorIdParams; Querystring: DoctorAvailableSlotsQuery }>(
    '/api/doctors/:id/available-slots',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'View'),
      schema: { params: doctorIdParamsSchema, querystring: availableSlotsQuerySchema },
    },
    async (request) => ok(await services.doctors.availableSlots(request.params.id, request.query)),
  );

  app.get<{ Params: DoctorIdParams; Querystring: DoctorLeaveListQuery }>(
    '/api/doctors/:id/leaves',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'View'),
      schema: { params: doctorIdParamsSchema, querystring: listDoctorLeavesQuerySchema },
    },
    async (request) => ok(await services.doctors.listLeaves(request.params.id, request.query)),
  );

  app.post<{ Params: DoctorIdParams; Body: CreateDoctorLeaveDTO }>(
    '/api/doctors/:id/leaves',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: createDoctorLeaveBodySchema },
    },
    async (request, reply) => {
      const leave = await services.doctors.createLeave(
        request.params.id,
        request.body,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.status(201).send(ok(leave));
    },
  );

  app.patch<{ Params: DoctorChildIdParams }>(
    '/api/doctors/:id/leaves/:childId/cancel',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: { params: doctorChildIdParamsSchema },
    },
    async (request) =>
      ok(
        await services.doctors.cancelLeave(
          request.params.id,
          request.params.childId,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.get<{ Params: DoctorIdParams; Querystring: DoctorAvailabilityExceptionListQuery }>(
    '/api/doctors/:id/availability-exceptions',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'View'),
      schema: { params: doctorIdParamsSchema, querystring: listDoctorExceptionsQuerySchema },
    },
    async (request) => ok(await services.doctors.listExceptions(request.params.id, request.query)),
  );

  app.post<{ Params: DoctorIdParams; Body: SaveDoctorAvailabilityExceptionDTO }>(
    '/api/doctors/:id/availability-exceptions',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: { params: doctorIdParamsSchema, body: saveDoctorExceptionBodySchema },
    },
    async (request) =>
      ok(
        await services.doctors.saveException(
          request.params.id,
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.delete<{ Params: DoctorChildIdParams }>(
    '/api/doctors/:id/availability-exceptions/:childId',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: { params: doctorChildIdParamsSchema },
    },
    async (request) => {
      await services.doctors.deleteException(
        request.params.id,
        request.params.childId,
        request.user!.id,
        metadataFromRequest(request),
      );
      return ok({ success: true });
    },
  );
};
