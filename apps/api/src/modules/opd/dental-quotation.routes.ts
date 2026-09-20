import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  acceptDentalQuotationSchema,
  createDentalQuotationSchema,
  dentalQuotationParamsSchema,
  episodeQuotationParamsSchema,
  patientQuotationsParamsSchema,
  postponeDentalQuotationSchema,
  rejectDentalQuotationSchema,
} from './dental-quotation.schemas.js';

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

export const registerDentalQuotationRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  // Create a Draft Quotation for a Dental Episode
  app.post(
    '/api/opd/dental/episodes/:episodeId/quotations',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(episodeQuotationParamsSchema, request.params);
      const body = parse(createDentalQuotationSchema, request.body);
      return ok(
        await services.dentalQuotations.createDraftQuotation(
          params.episodeId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // List Quotations for an Episode
  app.get(
    '/api/opd/dental/episodes/:episodeId/quotations',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(episodeQuotationParamsSchema, request.params);
      return ok(
        await services.dentalQuotations.listQuotationsByEpisode(
          params.episodeId,
          request.user!.id,
        ),
      );
    },
  );

  // List Quotations for a Patient (Patient Portal or Clinical)
  app.get(
    '/api/opd/dental/quotations/patient/:patientId',
    {
      preHandler: authenticate(services),
    },
    async (request) => {
      const params = parse(patientQuotationsParamsSchema, request.params);
      return ok(
        await services.dentalQuotations.listQuotationsByPatient(
          params.patientId,
          request.user!.id,
        ),
      );
    },
  );

  // Get a single Quotation by ID
  app.get(
    '/api/opd/dental/quotations/:quotationId',
    {
      preHandler: authenticate(services),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      return ok(
        await services.dentalQuotations.getQuotation(
          params.quotationId,
          request.user!.id,
        ),
      );
    },
  );

  // Update a Draft Quotation
  app.put(
    '/api/opd/dental/quotations/:quotationId',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      const body = parse(createDentalQuotationSchema, request.body);
      return ok(
        await services.dentalQuotations.updateDraftQuotation(
          params.quotationId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Send a Draft Quotation to Patient
  app.post(
    '/api/opd/dental/quotations/:quotationId/send',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      return ok(
        await services.dentalQuotations.sendQuotation(
          params.quotationId,
          request.user!.id,
        ),
      );
    },
  );

  // Patient Accepts an Option in Quotation
  app.post(
    '/api/opd/dental/quotations/:quotationId/accept',
    {
      preHandler: authenticate(services),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      const body = parse(acceptDentalQuotationSchema, request.body);
      return ok(
        await services.dentalQuotations.acceptQuotation(
          params.quotationId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Patient Rejects Quotation
  app.post(
    '/api/opd/dental/quotations/:quotationId/reject',
    {
      preHandler: authenticate(services),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      const body = parse(rejectDentalQuotationSchema, request.body);
      return ok(
        await services.dentalQuotations.rejectQuotation(
          params.quotationId,
          body,
          request.user!.id,
        ),
      );
    },
  );

  // Patient Postpones Decision on Quotation
  app.post(
    '/api/opd/dental/quotations/:quotationId/postpone',
    {
      preHandler: authenticate(services),
    },
    async (request) => {
      const params = parse(dentalQuotationParamsSchema, request.params);
      const body = parse(postponeDentalQuotationSchema, request.body);
      return ok(
        await services.dentalQuotations.postponeQuotation(
          params.quotationId,
          body,
          request.user!.id,
        ),
      );
    },
  );
};

