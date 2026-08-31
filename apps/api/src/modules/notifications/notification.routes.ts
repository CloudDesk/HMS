import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  createNotificationBodySchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from './notification.schemas.js';
import type { CreateNotificationDTO, NotificationListQuery } from './notification.types.js';

export const registerNotificationRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.post<{ Body: CreateNotificationDTO }>(
    '/api/notifications',
    {
      preHandler: requirePermission(services, 'Administration', 'Notifications', 'Create'),
      schema: {
        body: createNotificationBodySchema,
      },
    },
    async (request) => ok(await services.notification.createGlobalNotification(
      request.body,
      request.user!.id,
    )),
  );

  app.get<{ Querystring: NotificationListQuery }>(
    '/api/notifications',
    {
      preHandler: requirePermission(services, 'Administration', 'Notifications', 'View'),
      schema: {
        querystring: listNotificationsQuerySchema,
      },
    },
    async (request) => ok(await services.notification.listNotifications(
      request.query,
      request.user!.id,
    )),
  );

  app.get<{ Querystring: Pick<NotificationListQuery, 'is_read' | 'page' | 'limit'> }>(
    '/api/notifications/me',
    {
      preHandler: authenticate(services),
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            is_read: { type: 'boolean' },
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => {
      return ok(await services.notification.listForUser(request.user!.id, request.query));
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
      const notification = await services.notification.markAsRead(id, request.user!.id);
      if (!notification) {
        return reply.status(404).send({ error: { message: 'Notification not found' } });
      }
      return ok(notification);
    },
  );
};
