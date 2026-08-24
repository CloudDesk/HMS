import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { cancelSchema, confirmSchema, idSchema, listSchema, reverseSchema, saveSchema } from './pharmacy-dispensing.schemas.js';
import type { PharmacyDispensingListQuery } from './pharmacy-dispensing.types.js';

const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });
const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => schema.parse(value);

export const registerPharmacyDispensingRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/pharmacy/dispensings', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'View') }, async (request) => {
    return ok(await services.pharmacyDispensing.list(parse(listSchema, request.query) as PharmacyDispensingListQuery, request.user!.id));
  });
  app.get('/api/pharmacy/dispensings/:id', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'View') }, async (request) => {
    const { id } = parse(idSchema, request.params); return ok(await services.pharmacyDispensing.get(id, request.user!.id));
  });
  app.put('/api/pharmacy/dispensings/:id', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'Edit') }, async (request) => {
    const { id } = parse(idSchema, request.params); return ok(await services.pharmacyDispensing.save(id, parse(saveSchema, request.body), request.user!.id, metadata(request)));
  });
  app.post('/api/pharmacy/dispensings/:id/confirm', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'Dispense') }, async (request) => {
    const { id } = parse(idSchema, request.params); const body = parse(confirmSchema, request.body);
    return ok(await services.pharmacyDispensing.confirm(id, body.version, body.idempotency_key, request.user!.id, metadata(request)));
  });
  app.post('/api/pharmacy/dispensings/:id/cancel', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'Cancel') }, async (request) => {
    const { id } = parse(idSchema, request.params); const body = parse(cancelSchema, request.body);
    return ok(await services.pharmacyDispensing.cancel(id, body.version, body.reason, request.user!.id, metadata(request)));
  });
  app.post('/api/pharmacy/dispensings/:id/reverse', { preHandler: requirePermission(services, 'Pharmacy', 'Dispensing', 'Reverse') }, async (request) => {
    const { id } = parse(idSchema, request.params); const body = parse(reverseSchema, request.body);
    return ok(await services.pharmacyDispensing.reverse(id, body.version, body.reason, body.idempotency_key, request.user!.id, metadata(request)));
  });
};
