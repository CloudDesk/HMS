import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  chairsideImageEpisodeParamsSchema,
  chairsideImageIdParamsSchema,
  chairsideImageVisitParamsSchema,
  listChairsideImagesQuerySchema,
} from './dental-chairside-image.schemas.js';

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

const metadata = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerDentalChairsideImageRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  // Upload chairside image for a visit
  app.post(
    '/api/opd/visits/:visitId/dental-chairside-images',
    {
      preHandler: authenticate(services),
    },
    async (request, reply) => {
      const params = parse(chairsideImageVisitParamsSchema, request.params);
      const userId = request.user!.id;

      const hasEditPermission =
        (await services.permissions.userHasPermission(userId, 'OPD', 'OPD Consultation', 'Edit')) ||
        (await services.permissions.userHasPermission(userId, 'OPD', 'OPD Clinical Orders', 'Edit'));

      if (!hasEditPermission) {
        await services.permissions.auditDeniedAccess(
          userId,
          'OPD',
          'OPD Consultation',
          'Edit',
          metadata(request),
        );
        throw new AppError('Permission required to upload chairside dental images', 403, 'PERMISSION_REQUIRED');
      }

      let fileBuffer: Buffer | null = null;
      let fileName = '';
      let mimeType = '';
      let toothNumber: number | null = null;
      let episodeIdStr: string | null = null;
      let notesStr: string | null = null;

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          fileName = part.filename;
          mimeType = part.mimetype;
        } else if (part.type === 'field') {
          const val = typeof part.value === 'string' ? part.value.trim() : '';
          if (part.fieldname === 'toothNumber' || part.fieldname === 'tooth_number') {
            toothNumber = val && !Number.isNaN(Number(val)) ? Number(val) : null;
          } else if (part.fieldname === 'episodeId' || part.fieldname === 'episode_id') {
            episodeIdStr = val || null;
          } else if (part.fieldname === 'notes') {
            notesStr = val || null;
          }
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new AppError('Image file is required', 400, 'VALIDATION_ERROR');
      }

      const defaultFileName = toothNumber ? `Tooth_${toothNumber}_${Date.now()}.png` : 'Tooth_Image.png';

      const created = await services.dentalChairsideImages.uploadChairsideImage(
        params.visitId,
        {
          file_name: fileName || defaultFileName,
          mime_type: mimeType || 'image/png',
          file_size_bytes: fileBuffer.length,
          data: fileBuffer,
          tooth_number: toothNumber,
          episode_id: episodeIdStr?.trim() || null,
          notes: notesStr?.trim() || null,
        },
        userId,
      );

      return reply.status(201).send(ok(created));
    },
  );

  // List chairside images for a visit
  app.get(
    '/api/opd/visits/:visitId/dental-chairside-images',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(chairsideImageVisitParamsSchema, request.params);
      const query = parse(listChairsideImagesQuerySchema, request.query);
      return ok(
        await services.dentalChairsideImages.listByVisit(
          params.visitId,
          query,
          request.user!.id,
        ),
      );
    },
  );

  // List chairside images for an episode
  app.get(
    '/api/opd/dental-episodes/:episodeId/dental-chairside-images',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(chairsideImageEpisodeParamsSchema, request.params);
      return ok(
        await services.dentalChairsideImages.listByEpisode(params.episodeId),
      );
    },
  );

  // Download / stream chairside image
  app.get(
    '/api/opd/dental-chairside-images/:id/download',
    {
      preHandler: authenticate(services),
    },
    async (request, reply) => {
      const params = parse(chairsideImageIdParamsSchema, request.params);
      const userId = request.user!.id;

      const hasViewPermission =
        (await services.permissions.userHasPermission(userId, 'OPD', 'OPD Consultation', 'View')) ||
        (await services.permissions.userHasPermission(userId, 'OPD', 'OPD Clinical Orders', 'View')) ||
        (await services.permissions.userHasPermission(userId, 'Imaging', 'Orders', 'View'));

      if (!hasViewPermission) {
        await services.permissions.auditDeniedAccess(
          userId,
          'OPD',
          'OPD Consultation',
          'View',
          metadata(request),
        );
        throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
      }

      const download = await services.dentalChairsideImages.downloadImage(
        params.id,
        userId,
      );

      const safeName = download.image.file_name.replace(/["\r\n]/g, '');
      return reply
        .header('content-type', download.contentType)
        .header('content-disposition', `inline; filename="${safeName}"`)
        .send(download.data);
    },
  );

  // Soft delete chairside image
  app.delete(
    '/api/opd/dental-chairside-images/:id',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(chairsideImageIdParamsSchema, request.params);
      return ok(
        await services.dentalChairsideImages.deleteImage(
          params.id,
          request.user!.id,
        ),
      );
    },
  );
};
