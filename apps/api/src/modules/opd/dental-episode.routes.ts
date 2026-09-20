import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createDentalEpisodeSchema,
  dentalEpisodeParamsSchema,
  linkVisitToEpisodeSchema,
  patientEpisodesParamsSchema,
  patientToothHistoryQuerySchema,
  updateDentalEpisodeStatusSchema,
} from './dental-episode.schemas.js';

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

export const registerDentalEpisodeRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  // Create a new Dental Treatment Episode
  app.post(
    '/api/opd/dental/episodes',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const body = parse(createDentalEpisodeSchema, request.body);
      return ok(
        await services.dentalEpisodes.createEpisode(body, request.user!.id),
      );
    },
  );

  // Get Dental Treatment Episode by ID
  app.get(
    '/api/opd/dental/episodes/:episodeId',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(dentalEpisodeParamsSchema, request.params);
      return ok(
        await services.dentalEpisodes.getById(params.episodeId),
      );
    },
  );

  // List Dental Treatment Episodes for a patient
  app.get(
    '/api/opd/dental/patients/:patientId/episodes',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(patientEpisodesParamsSchema, request.params);
      return ok(
        await services.dentalEpisodes.listByPatient(params.patientId),
      );
    },
  );

  // Link an OPD visit to a Dental Treatment Episode
  app.post(
    '/api/opd/dental/episodes/:episodeId/link-visit',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalEpisodeParamsSchema, request.params);
      const body = parse(linkVisitToEpisodeSchema, request.body);
      return ok(
        await services.dentalEpisodes.linkVisitToEpisode(
          params.episodeId,
          body.visit_id,
          request.user!.id,
        ),
      );
    },
  );

  // Update Dental Treatment Episode status
  app.patch(
    '/api/opd/dental/episodes/:episodeId/status',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalEpisodeParamsSchema, request.params);
      const body = parse(updateDentalEpisodeStatusSchema, request.body);
      return ok(
        await services.dentalEpisodes.updateStatus(
          params.episodeId,
          body.status,
          request.user!.id,
          body.notes,
        ),
      );
    },
  );

  // Get cumulative historical tooth findings for a patient across all previous visits
  app.get(
    '/api/opd/dental/patients/:patientId/tooth-history',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(patientEpisodesParamsSchema, request.params);
      const query = parse(patientToothHistoryQuerySchema, request.query);
      return ok(
        await services.dentalEpisodes.getHistoricalToothFindings(
          params.patientId,
          query.exclude_visit_id,
        ),
      );
    },
  );
};
