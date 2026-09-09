import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  opdDentalVisitParamsSchema,
  saveOpdDentalExaminationSchema,
} from './opd-dental-examination.schemas.js';

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

export const registerOpdDentalExaminationRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  app.get(
    '/api/opd/visits/:visitId/dental-examination',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(opdDentalVisitParamsSchema, request.params);
      return ok(
        await services.opdDentalExaminations.getByVisit(
          params.visitId,
          request.user!.id,
        ),
      );
    },
  );

  app.put(
    '/api/opd/visits/:visitId/dental-examination',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(opdDentalVisitParamsSchema, request.params);
      const body = parse(saveOpdDentalExaminationSchema, request.body);
      return ok(
        await services.opdDentalExaminations.saveDraft(
          params.visitId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  app.post(
    '/api/opd/visits/:visitId/dental-examination/complete',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(opdDentalVisitParamsSchema, request.params);
      const body = parse(saveOpdDentalExaminationSchema, request.body);
      return ok(
        await services.opdDentalExaminations.complete(
          params.visitId,
          body,
          request.user!.id,
        ),
      );
    },
  );
};
