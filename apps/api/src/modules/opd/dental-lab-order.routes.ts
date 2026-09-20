import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createDentalLabOrderSchema,
  dentalLabOrderParamsSchema,
  episodeLabOrdersParamsSchema,
  updateDentalLabOrderStatusSchema,
} from './dental-lab-order.schemas.js';

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

export const registerDentalLabOrderRoutes = async (
  app: FastifyInstance,
  services: ServiceRegistry,
) => {
  // Create a new Dental Prosthetic Lab Order
  app.post(
    '/api/opd/dental/lab-orders',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const body = parse(createDentalLabOrderSchema, request.body);
      return ok(
        await services.dentalLabOrders.createOrder(body, request.user!.id),
      );
    },
  );

  // Get Dental Prosthetic Lab Order by ID
  app.get(
    '/api/opd/dental/lab-orders/:id',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(dentalLabOrderParamsSchema, request.params);
      return ok(
        await services.dentalLabOrders.getOrder(params.id, request.user!.id),
      );
    },
  );

  // List Dental Prosthetic Lab Orders for an Episode
  app.get(
    '/api/opd/dental/episodes/:episodeId/lab-orders',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'View'),
    },
    async (request) => {
      const params = parse(episodeLabOrdersParamsSchema, request.params);
      return ok(
        await services.dentalLabOrders.listOrdersByEpisode(
          params.episodeId,
          request.user!.id,
        ),
      );
    },
  );

  // Update Dental Prosthetic Lab Order Status
  app.patch(
    '/api/opd/dental/lab-orders/:id/status',
    {
      preHandler: requirePermission(services, 'OPD', 'OPD Consultation', 'Edit'),
    },
    async (request) => {
      const params = parse(dentalLabOrderParamsSchema, request.params);
      const body = parse(updateDentalLabOrderStatusSchema, request.body);
      return ok(
        await services.dentalLabOrders.updateOrderStatus(
          params.id,
          body,
          request.user!.id,
        ),
      );
    },
  );
};
