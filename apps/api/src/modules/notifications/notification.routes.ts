import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createNotificationBodySchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from './notification.schemas.js';
import type { CreateNotificationDTO } from './notification.types.js';

export const registerNotificationRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.post<{ Body: CreateNotificationDTO }>(
    '/api/notifications',
    {
      preHandler: authenticate(services),
      schema: {
        body: createNotificationBodySchema,
      },
    },
    async (request) => ok(await services.notification.createNotification(request.body)),
  );

  app.get(
    '/api/notifications',
    {
      preHandler: authenticate(services),
      schema: {
        querystring: listNotificationsQuerySchema,
      },
    },
    async (request) => {
      const query = request.query as any;
      return ok(await services.notification.listNotifications(query));
    },
  );

  app.get(
    '/api/notifications/me',
    {
      preHandler: authenticate(services),
      schema: {
        querystring: {
          type: 'object',
          properties: {
            is_read: { type: 'boolean' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as any;
      query.recipient_user_id = request.user!.id;
      return ok(await services.notification.listNotifications(query));
    },
  );

  app.patch(
    '/api/notifications/:id/read',
    {
      preHandler: authenticate(services),
      schema: {
        params: notificationIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const notification = await services.notification.markAsRead(id);
      if (!notification) {
        return reply.status(404).send({ error: { message: 'Notification not found' } });
      }
      return ok(notification);
    },
  );
};
