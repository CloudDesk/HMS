import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createDoctorBodySchema,
  doctorIdParamsSchema,
  listDoctorsQuerySchema,
  saveDoctorAvailabilityBodySchema,
  updateDoctorBodySchema,
} from './doctor.schemas.js';
import type { CreateDoctorDTO, DoctorListQuery, SaveDoctorAvailabilityDTO, UpdateDoctorDTO } from './doctor.types.js';

type DoctorIdParams = {
  id: string;
};

export const registerDoctorRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: DoctorListQuery }>(
    '/api/doctors',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View'),
      schema: {
        querystring: listDoctorsQuerySchema,
      },
    },
    async (request) => ok(await services.doctors.list(request.query)),
  );

  app.get<{ Params: DoctorIdParams }>(
    '/api/doctors/:id',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'View'),
      schema: {
        params: doctorIdParamsSchema,
      },
    },
    async (request) => ok(await services.doctors.getById(request.params.id)),
  );

  app.post<{ Body: CreateDoctorDTO }>(
    '/api/doctors',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Create'),
      schema: {
        body: createDoctorBodySchema,
      },
    },
    async (request, reply) => {
      const doctor = await services.doctors.create(request.body, request.user!.id);
      return reply.status(201).send(ok(doctor));
    },
  );

  app.patch<{ Params: DoctorIdParams; Body: UpdateDoctorDTO }>(
    '/api/doctors/:id',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Directory', 'Edit'),
      schema: {
        params: doctorIdParamsSchema,
        body: updateDoctorBodySchema,
      },
    },
    async (request) => ok(await services.doctors.update(request.params.id, request.body, request.user!.id)),
  );

  app.patch<{ Params: DoctorIdParams; Body: SaveDoctorAvailabilityDTO }>(
    '/api/doctors/:id/availability',
    {
      preHandler: requirePermission(services, 'Doctors', 'Doctor Availability', 'Edit'),
      schema: {
        params: doctorIdParamsSchema,
        body: saveDoctorAvailabilityBodySchema,
      },
    },
    async (request) =>
      ok(await services.doctors.updateAvailability(request.params.id, request.body, request.user!.id)),
  );
};
