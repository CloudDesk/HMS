import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  insuranceConfigurationUpdateSchema,
  insuranceIdParamsSchema,
  insuranceProviderActionParamsSchema,
  insuranceProviderBranchCreateSchema,
  insuranceProviderBranchListSchema,
  insuranceProviderBranchUpdateSchema,
  insuranceProviderCreateSchema,
  insuranceProviderListSchema,
  insuranceProviderUpdateSchema,
  insuranceStatusActionSchema,
} from './insurance.schemas.js';

const metadata = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
  correlationId: request.id,
});
const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', error.flatten());
    throw error;
  }
};

export const registerInsuranceRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/insurance/configuration', { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') }, async () => ok(await services.insurance.getConfiguration()));
  app.patch('/api/insurance/configuration', { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Manage') }, async (request) => ok(await services.insurance.updateConfiguration(parse(insuranceConfigurationUpdateSchema, request.body), request.user!.id, metadata(request))));

  app.get('/api/insurance/providers', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'View') }, async (request) => ok(await services.insurance.listProviders(parse(insuranceProviderListSchema, request.query))));
  app.get('/api/insurance/providers/:id', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.getProvider(id)); });
  app.post('/api/insurance/providers', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.insurance.createProvider(parse(insuranceProviderCreateSchema, request.body), request.user!.id, metadata(request)))));
  app.patch('/api/insurance/providers/:id', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'Edit') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.updateProvider(id, parse(insuranceProviderUpdateSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/providers/:id/actions/:action', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'Activate') }, async (request) => { const params = parse(insuranceProviderActionParamsSchema, request.params); return ok(await services.insurance.transitionProvider(params.id, params.action, parse(insuranceStatusActionSchema, request.body), request.user!.id, metadata(request))); });

  app.get('/api/insurance/providers/:id/branches', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.listProviderBranches(id, parse(insuranceProviderBranchListSchema, request.query), request.user!.id)); });
  app.post('/api/insurance/providers/:id/branches', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'Edit') }, async (request, reply) => { const { id } = parse(insuranceIdParamsSchema, request.params); return reply.status(201).send(ok(await services.insurance.createProviderBranch(id, parse(insuranceProviderBranchCreateSchema, request.body), request.user!.id, metadata(request)))); });
  app.patch('/api/insurance/provider-branches/:id', { preHandler: requirePermission(services, 'Insurance', 'Providers', 'Edit') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.updateProviderBranch(id, parse(insuranceProviderBranchUpdateSchema, request.body), request.user!.id, metadata(request))); });
};
