import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  registerDeviceBodySchema,
  unregisterDeviceBodySchema,
  refreshPushTokenBodySchema,
} from './device.schemas.js';
import type { RegisterDeviceDTO, UnregisterDeviceDTO, RefreshPushTokenDTO } from './device.types.js';

export const registerDeviceRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.post<{ Body: RegisterDeviceDTO }>(
    '/api/mobile/devices/register',
    {
      preHandler: authenticate(services),
      schema: {
        body: registerDeviceBodySchema,
      },
    },
    async (request) => {
      const device = await services.devices.registerDevice(request.user!.id, request.body);
      return ok(device);
    }
  );

  app.post<{ Body: UnregisterDeviceDTO }>(
    '/api/mobile/devices/unregister',
    {
      preHandler: authenticate(services),
      schema: {
        body: unregisterDeviceBodySchema,
      },
    },
    async (request) => {
      const result = await services.devices.unregisterDevice(request.user!.id, request.body ?? {});
      return ok(result);
    }
  );

  app.post<{ Body: RefreshPushTokenDTO }>(
    '/api/mobile/devices/token-refresh',
    {
      preHandler: authenticate(services),
      schema: {
        body: refreshPushTokenBodySchema,
      },
    },
    async (request) => {
      const result = await services.devices.refreshPushToken(request.user!.id, request.body);
      return ok(result);
    }
  );
};
