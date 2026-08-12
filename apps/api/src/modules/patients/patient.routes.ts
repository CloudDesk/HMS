import type { MultipartFields, MultipartValue } from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createPatientBodySchema,
  createPatientDocumentBodySchema,
  listPatientDocumentsQuerySchema,
  listPatientTimelineQuerySchema,
  listPatientsQuerySchema,
  patientDocumentIdParamsSchema,
  patientIdParamsSchema,
  updatePatientBodySchema,
} from './patient.schemas.js';
import type {
  CreatePatientDTO,
  CreatePatientDocumentDTO,
  PatientDocumentType,
  PatientListQuery,
  PatientTimelineListQuery,
  UpdatePatientDTO,
} from './patient.types.js';

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

const patientDocumentTypes = ['IDENTITY', 'INSURANCE', 'CLINICAL', 'CONSENT', 'OTHER'];

const isPatientDocumentType = (value: string): value is PatientDocumentType => patientDocumentTypes.includes(value);

const readMultipartField = (fields: MultipartFields, name: string) => {
  const field = fields[name];
  const firstField = Array.isArray(field) ? field[0] : field;

  if (!firstField || firstField.type !== 'field') {
    return null;
  }

  const value = (firstField as MultipartValue).value;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const requireMultipartField = (fields: MultipartFields, name: string, label: string) => {
  const value = readMultipartField(fields, name);
  if (!value) {
    throw new AppError(`${label} is required`, 400, 'VALIDATION_ERROR');
  }

  return value;
};

const safeDownloadFileName = (fileName: string) => fileName.replace(/[\r\n"]/g, '_');

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

  app.get<{ Params: PatientIdParams; Querystring: PatientTimelineListQuery }>(
    '/api/patients/:id/timeline',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        params: patientIdParamsSchema,
        querystring: listPatientTimelineQuerySchema,
      },
    },
    async (request) => ok(await services.patients.getTimeline(request.params.id, request.query)),
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

  app.post<{ Params: PatientIdParams }>(
    '/api/patients/:id/documents/upload',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'Create'),
      schema: {
        params: patientIdParamsSchema,
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        throw new AppError('Document file is required', 400, 'VALIDATION_ERROR');
      }

      const documentType = requireMultipartField(file.fields, 'document_type', 'Document type');
      if (!isPatientDocumentType(documentType)) {
        throw new AppError('Document type is invalid', 400, 'VALIDATION_ERROR');
      }

      const data = await file.toBuffer();
      const document = await services.patients.uploadDocument(
        request.params.id,
        {
          document_type: documentType,
          title: requireMultipartField(file.fields, 'title', 'Title'),
          file_name: file.filename,
          mime_type: file.mimetype,
          file_size_bytes: data.byteLength,
          description: readMultipartField(file.fields, 'description'),
          data,
        },
        request.user!.id,
      );

      return reply.status(201).send(ok(document));
    },
  );

  app.get<{ Params: PatientDocumentIdParams }>(
    '/api/patients/:id/documents/:documentId/download',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'View'),
      schema: {
        params: patientDocumentIdParamsSchema,
      },
    },
    async (request, reply) => {
      const download = await services.patients.downloadDocument(request.params.id, request.params.documentId);
      return reply
        .header('content-type', download.contentType)
        .header('content-disposition', `attachment; filename="${safeDownloadFileName(download.document.file_name)}"`)
        .send(download.data);
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
