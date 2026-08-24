import type { MultipartFields, MultipartValue } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createPatientBodySchema,
  listPatientDocumentsQuerySchema,
  listPatientTimelineQuerySchema,
  listPatientsQuerySchema,
  patientDocumentIdParamsSchema,
  patientIdParamsSchema,
  updatePatientBodySchema,
} from './patient.schemas.js';
import type {
  CreatePatientDTO,
  PatientDocumentType,
  PatientConsentStatus,
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
  visit_id?: string;
  admission_id?: string;
  procedure_id?: string;
  context_type?: 'PATIENT' | 'PROCEDURE' | 'ADMISSION';
  page?: number;
  limit?: number;
};

const patientDocumentTypes = ['IDENTITY', 'INSURANCE', 'CLINICAL', 'CONSENT', 'OTHER'];
const patientConsentStatuses = ['NOT_REQUIRED', 'PENDING', 'ATTACHED', 'VERIFIED'];

const requireConsentPermission = async (
  services: ServiceRegistry,
  request: FastifyRequest,
  action: 'Attach' | 'Delete',
) => {
  if (await services.permissions.userHasPermission(request.user!.id, 'Patients', 'Consent', action)) return;
  await services.permissions.auditDeniedAccess(request.user!.id, 'Patients', 'Consent', action, {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });
  throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
};

const isPatientDocumentType = (value: string): value is PatientDocumentType => patientDocumentTypes.includes(value);
const isPatientConsentStatus = (value: string): value is PatientConsentStatus => patientConsentStatuses.includes(value);

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
    async (request) => ok(await services.patients.list(request.query, request.user!.id)),
  );

  app.get<{ Params: PatientIdParams }>(
    '/api/patients/:id',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Records', 'View'),
      schema: {
        params: patientIdParamsSchema,
      },
    },
    async (request) => ok(await services.patients.getById(request.params.id, request.user!.id)),
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
    async (request) => ok(await services.patients.getHistory(request.params.id, request.user!.id)),
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
    async (request) => ok(await services.patients.getTimeline(request.params.id, request.query, request.user!.id)),
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
    async (request) =>
      ok(
        await services.patients.listDocuments(request.params.id, {
          document_type: request.query.document_type && isPatientDocumentType(request.query.document_type)
            ? request.query.document_type
            : undefined,
          visit_id: request.query.visit_id,
          admission_id: request.query.admission_id,
          procedure_id: request.query.procedure_id,
          context_type: request.query.context_type,
          page: request.query.page,
          limit: request.query.limit,
        }, request.user!.id),
      ),
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
      if (documentType === 'CONSENT') await requireConsentPermission(services, request, 'Attach');

      const data = await file.toBuffer();
      const visitId = readMultipartField(file.fields, 'visit_id');
      const admissionId = readMultipartField(file.fields, 'admission_id');
      const procedureId = readMultipartField(file.fields, 'procedure_id');
      const contextType = readMultipartField(file.fields, 'context_type');
      const templateId = readMultipartField(file.fields, 'consent_template_id');
      const branchId = readMultipartField(file.fields, 'branch_id');
      const consentStatusValue = readMultipartField(file.fields, 'consent_status');
      if (consentStatusValue && !isPatientConsentStatus(consentStatusValue)) {
        throw new AppError('Consent status is invalid', 400, 'VALIDATION_ERROR');
      }
      const consentStatus = consentStatusValue && isPatientConsentStatus(consentStatusValue) ? consentStatusValue : null;
      if (visitId) {
        const visit = await services.opdVisits.getById(visitId);
        if (visit.patient_id !== request.params.id) {
          throw new AppError('OPD visit does not belong to this patient', 400, 'VISIT_PATIENT_MISMATCH');
        }
      }
      if (documentType !== 'CONSENT' && admissionId) {
        if (!branchId) throw new AppError('Branch is required for an admission document', 400, 'VALIDATION_ERROR');
        const admission = await services.inpatientAdmissions.get(admissionId, branchId, request.user!.id);
        if (admission.patient_id !== request.params.id) {
          throw new AppError('Admission does not belong to this patient', 400, 'ADMISSION_PATIENT_MISMATCH');
        }
      }
      if (documentType !== 'CONSENT' && procedureId) {
        const procedure = await services.opdVisits.getById(procedureId);
        if (procedure.visit_type !== 'PROCEDURE' || procedure.patient_id !== request.params.id) {
          throw new AppError('Procedure encounter does not belong to this patient', 400, 'INVALID_PROCEDURE_CONTEXT');
        }
        if (branchId && procedure.branch_id !== branchId) {
          throw new AppError('Procedure encounter does not belong to the selected branch', 400, 'INVALID_PROCEDURE_CONTEXT');
        }
      }
      let consentMetadata: Pick<CreatePatientDTO, never> & {
        context_type?: 'PATIENT' | 'PROCEDURE' | 'ADMISSION'; context_id?: string;
        admission_id?: string; procedure_id?: string; consent_template_id?: string;
        consent_category?: string; consent_version?: number;
      } = {};
      if (documentType === 'CONSENT') {
        if (!templateId || !branchId || !contextType || !['PATIENT', 'PROCEDURE', 'ADMISSION'].includes(contextType)) {
          throw new AppError('Consent template, branch, and context are required', 400, 'VALIDATION_ERROR');
        }
        const typedContext = contextType as 'PATIENT' | 'PROCEDURE' | 'ADMISSION';
        const template = await services.consents.get(templateId, branchId, request.user!.id);
        if (template.context_type !== typedContext) throw new AppError('Consent template does not support this context', 400, 'CONSENT_CONTEXT_MISMATCH');
        let contextId = request.params.id;
        if (typedContext === 'PROCEDURE') {
          if (!visitId) throw new AppError('Procedure encounter is required', 400, 'VALIDATION_ERROR');
          const visit = await services.opdVisits.getById(visitId);
          if (visit.visit_type !== 'PROCEDURE' || visit.branch_id !== branchId) throw new AppError('Valid procedure encounter is required in the selected branch', 400, 'INVALID_PROCEDURE_CONTEXT');
          contextId = visitId;
        } else if (typedContext === 'ADMISSION') {
          if (!admissionId) throw new AppError('Admission is required', 400, 'VALIDATION_ERROR');
          const admission = await services.inpatientAdmissions.get(admissionId, branchId, request.user!.id);
          if (admission.patient_id !== request.params.id) throw new AppError('Admission does not belong to this patient', 400, 'ADMISSION_PATIENT_MISMATCH');
          contextId = admissionId;
        } else {
          const patient = await services.patients.getById(request.params.id, request.user!.id);
          if (patient.registration_branch_id !== branchId) throw new AppError('Patient is not registered in the selected branch', 400, 'PATIENT_BRANCH_MISMATCH');
        }
        consentMetadata = { context_type: typedContext, context_id: contextId,
          admission_id: typedContext === 'ADMISSION' ? admissionId ?? undefined : undefined,
          procedure_id: typedContext === 'PROCEDURE' ? visitId ?? undefined : undefined,
          consent_template_id: template.id, consent_category: template.category, consent_version: template.version };
      }
      const document = await services.patients.uploadDocument(
        request.params.id,
        {
          document_type: documentType,
          visit_id: visitId,
          admission_id: documentType === 'CONSENT' ? consentMetadata.admission_id : admissionId,
          procedure_id: documentType === 'CONSENT' ? consentMetadata.procedure_id : procedureId,
          ...consentMetadata,
          title: requireMultipartField(file.fields, 'title', 'Title'),
          file_name: file.filename,
          mime_type: file.mimetype,
          file_size_bytes: data.byteLength,
          description: readMultipartField(file.fields, 'description'),
          consent_status: consentStatus,
          signed_at: readMultipartField(file.fields, 'signed_at'),
          valid_until: readMultipartField(file.fields, 'valid_until'),
          signed_by_name: readMultipartField(file.fields, 'signed_by_name'),
          context_type: readMultipartField(file.fields, 'context_type') as 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING' | undefined,
          context_id: readMultipartField(file.fields, 'context_id'),
          consent_kind: readMultipartField(file.fields, 'consent_kind'),
          data,
        },
        request.user!.id,
      );

      return reply.status(201).send(ok(document));
    },
  );

  app.put<{ Params: PatientDocumentIdParams }>(
    '/api/patients/:id/documents/:documentId/upload',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'Edit'),
      schema: { params: patientDocumentIdParamsSchema },
    },
    async (request) => {
      const existing = await services.patients.getDocument(
        request.params.id,
        request.params.documentId,
        request.user!.id,
      );
      if (existing.document_type === 'CONSENT') {
        await requireConsentPermission(services, request, 'Attach');
      }
      const file = await request.file();
      if (!file) {
        throw new AppError('Replacement document file is required', 400, 'VALIDATION_ERROR');
      }
      const documentType = requireMultipartField(file.fields, 'document_type', 'Document type');
      if (!isPatientDocumentType(documentType)) {
        throw new AppError('Document type is invalid', 400, 'VALIDATION_ERROR');
      }
      if (existing.document_type === 'CONSENT' && documentType !== 'CONSENT') {
        throw new AppError('A consent document must remain a consent when replaced', 409, 'CONSENT_TYPE_IMMUTABLE');
      }
      const data = await file.toBuffer();
      const consentStatusValue = readMultipartField(file.fields, 'consent_status');
      if (consentStatusValue && !isPatientConsentStatus(consentStatusValue)) {
        throw new AppError('Consent status is invalid', 400, 'VALIDATION_ERROR');
      }
      const consentStatus = consentStatusValue && isPatientConsentStatus(consentStatusValue) ? consentStatusValue : null;
      return ok(
        await services.patients.replaceDocument(
          request.params.id,
          request.params.documentId,
          {
            document_type: documentType,
            title: requireMultipartField(file.fields, 'title', 'Title'),
            file_name: file.filename,
            mime_type: file.mimetype,
            file_size_bytes: data.byteLength,
            description: readMultipartField(file.fields, 'description'),
            consent_status: consentStatus,
            signed_at: readMultipartField(file.fields, 'signed_at'),
            valid_until: readMultipartField(file.fields, 'valid_until'),
            signed_by_name: readMultipartField(file.fields, 'signed_by_name'),
            data,
          },
          request.user!.id,
        ),
      );
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
      const download = await services.patients.downloadDocument(request.params.id, request.params.documentId, request.user!.id);
      return reply
        .header('content-type', download.contentType)
        .header('content-disposition', `attachment; filename="${safeDownloadFileName(download.document.file_name)}"`)
        .send(download.data);
    },
  );

  app.patch<{ Params: PatientDocumentIdParams }>(
    '/api/patients/:id/documents/:documentId/consent/verify',
    { preHandler: requirePermission(services, 'Patients', 'Consent', 'Verify'), schema: { params: patientDocumentIdParamsSchema } },
    async (request) => ok(await services.patients.verifyConsent(request.params.id, request.params.documentId, request.user!.id)),
  );

  app.delete<{ Params: PatientDocumentIdParams }>(
    '/api/patients/:id/documents/:documentId',
    {
      preHandler: requirePermission(services, 'Patients', 'Patient Documents', 'Delete'),
      schema: {
        params: patientDocumentIdParamsSchema,
      },
    },
    async (request) => {
      const existing = await services.patients.getDocument(
        request.params.id,
        request.params.documentId,
        request.user!.id,
      );
      if (existing.document_type === 'CONSENT') {
        await requireConsentPermission(services, request, 'Delete');
      }
      return ok(await services.patients.deleteDocument(request.params.id, request.params.documentId, request.user!.id));
    },
  );
};
