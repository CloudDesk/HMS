import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createPatientBodySchema,
  createPatientDocumentBodySchema,
  listPatientDocumentsQuerySchema,
  listPatientsQuerySchema,
  patientDocumentIdParamsSchema,
  patientIdParamsSchema,
  updatePatientBodySchema,
} from './patient.schemas.js';
import type { CreatePatientDTO, CreatePatientDocumentDTO, PatientListQuery, UpdatePatientDTO } from './patient.types.js';

type PatientIdParams = {
  id: string;
};

type PatientDocumentIdParams = {
  id: string;
  documentId: string;
};

type PatientDocumentsQuery = {
  document_type?: string;
};

export const registerPatientRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: PatientListQuery }>(
    '/api/patients',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        querystring: listPatientsQuerySchema,
      },
    },
    async (request) => ok(await services.patients.list(request.query)),
  );

  app.get<{ Params: PatientIdParams }>(
    '/api/patients/:id',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        params: patientIdParamsSchema,
      },
    },
    async (request) => ok(await services.patients.getById(request.params.id)),
  );

  app.post<{ Body: CreatePatientDTO }>(
    '/api/patients',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'Create'),
      schema: {
        body: createPatientBodySchema,
      },
    },
    async (request, reply) => {
      const patient = await services.patients.create(request.body, request.user!.id);
      return reply.status(201).send(ok(patient));
    },
  );

  app.patch<{ Params: PatientIdParams; Body: UpdatePatientDTO }>(
    '/api/patients/:id',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'Edit'),
      schema: {
        params: patientIdParamsSchema,
        body: updatePatientBodySchema,
      },
    },
    async (request) => ok(await services.patients.update(request.params.id, request.body, request.user!.id)),
  );

  app.get<{ Params: PatientIdParams }>(
    '/api/patients/:id/history',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        params: patientIdParamsSchema,
      },
    },
    async (request) => ok(await services.patients.getHistory(request.params.id)),
  );

  app.get<{ Params: PatientIdParams }>(
    '/api/patients/:id/timeline',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        params: patientIdParamsSchema,
      },
    },
    async (request) => ok(await services.patients.getTimeline(request.params.id)),
  );

  app.get<{ Params: PatientIdParams; Querystring: PatientDocumentsQuery }>(
    '/api/patients/:id/documents',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'View'),
      schema: {
        params: patientIdParamsSchema,
        querystring: listPatientDocumentsQuerySchema,
      },
    },
    async (request) => ok(await services.patients.listDocuments(request.params.id, request.query.document_type)),
  );

  app.post<{ Params: PatientIdParams; Body: CreatePatientDocumentDTO }>(
    '/api/patients/:id/documents',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'Create'),
      schema: {
        params: patientIdParamsSchema,
        body: createPatientDocumentBodySchema,
      },
    },
    async (request, reply) => {
      const document = await services.patients.createDocument(request.params.id, request.body, request.user!.id);
      return reply.status(201).send(ok(document));
    },
  );

  app.delete<{ Params: PatientDocumentIdParams }>(
    '/api/patients/:id/documents/:documentId',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'Delete'),
      schema: {
        params: patientDocumentIdParamsSchema,
      },
    },
    async (request) =>
      ok(await services.patients.deleteDocument(request.params.id, request.params.documentId, request.user!.id)),
  );
};
