import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  insuranceApprovalCancellationSchema,
  insuranceApprovalDecisionSchema,
  insuranceApprovalRequestCreateSchema,
  insuranceApprovalRequestListSchema,
  insuranceApprovalRuleCreateSchema,
  insuranceApprovalRuleListSchema,
  insuranceApprovalRuleUpdateSchema,
  insuranceConfigurationUpdateSchema,
  insuranceContractActionSchema,
  insuranceContractCreateSchema,
  insuranceContractListSchema,
  insuranceContractUpdateSchema,
  insuranceIdParamsSchema,
  insurancePayerCreateSchema,
  insurancePayerListSchema,
  insurancePayerUpdateSchema,
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

  app.get('/api/insurance/payers', { preHandler: requirePermission(services, 'Insurance', 'Payers', 'View') }, async (request) => ok(await services.insurance.listPayers(parse(insurancePayerListSchema, request.query))));
  app.get('/api/insurance/payers/:id', { preHandler: requirePermission(services, 'Insurance', 'Payers', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.getPayer(id)); });
  app.post('/api/insurance/payers', { preHandler: requirePermission(services, 'Insurance', 'Payers', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.insurance.createPayer(parse(insurancePayerCreateSchema, request.body), request.user!.id, metadata(request)))));
  app.patch('/api/insurance/payers/:id', { preHandler: requirePermission(services, 'Insurance', 'Payers', 'Edit') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.updatePayer(id, parse(insurancePayerUpdateSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/payers/:id/actions/:action', { preHandler: requirePermission(services, 'Insurance', 'Payers', 'Activate') }, async (request) => { const params = parse(insuranceProviderActionParamsSchema, request.params); return ok(await services.insurance.transitionPayer(params.id, params.action, parse(insuranceStatusActionSchema, request.body), request.user!.id, metadata(request))); });

  app.get('/api/insurance/contracts', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'View') }, async (request) => ok(await services.insurance.listContracts(parse(insuranceContractListSchema, request.query), request.user!.id)));
  app.get('/api/insurance/contracts/:id', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.getContract(id, request.user!.id)); });
  app.post('/api/insurance/contracts', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Create') }, async (request, reply) => reply.status(201).send(ok(await services.insurance.createContract(parse(insuranceContractCreateSchema, request.body), request.user!.id, metadata(request)))));
  app.patch('/api/insurance/contracts/:id', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Edit') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.updateContract(id, parse(insuranceContractUpdateSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/contracts/:id/actions/submit', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Submit') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.transitionContract(id, 'submit', parse(insuranceContractActionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/contracts/:id/actions/activate', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Activate') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.transitionContract(id, 'activate', parse(insuranceContractActionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/contracts/:id/actions/suspend', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Activate') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.transitionContract(id, 'suspend', parse(insuranceContractActionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/contracts/:id/actions/expire', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Activate') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.transitionContract(id, 'expire', parse(insuranceContractActionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/contracts/:id/actions/terminate', { preHandler: requirePermission(services, 'Insurance', 'Contracts', 'Activate') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.transitionContract(id, 'terminate', parse(insuranceContractActionSchema, request.body), request.user!.id, metadata(request))); });

  app.get('/api/insurance/approval-rules', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'View') }, async (request) => ok(await services.insurance.listApprovalRules(parse(insuranceApprovalRuleListSchema, request.query), request.user!.id)));
  app.get('/api/insurance/approval-rules/:id', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.getApprovalRule(id, request.user!.id)); });
  app.post('/api/insurance/approval-rules', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Configure') }, async (request, reply) => reply.status(201).send(ok(await services.insurance.createApprovalRule(parse(insuranceApprovalRuleCreateSchema, request.body), request.user!.id, metadata(request)))));
  app.patch('/api/insurance/approval-rules/:id', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Configure') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.updateApprovalRule(id, parse(insuranceApprovalRuleUpdateSchema, request.body), request.user!.id, metadata(request))); });

  app.get('/api/insurance/approval-requests', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'View') }, async (request) => ok(await services.insurance.listApprovalRequests(parse(insuranceApprovalRequestListSchema, request.query), request.user!.id)));
  app.get('/api/insurance/approval-requests/:id', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'View') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.getApprovalRequest(id, request.user!.id)); });
  app.post('/api/insurance/approval-requests', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Request') }, async (request, reply) => reply.status(201).send(ok(await services.insurance.createApprovalRequest(parse(insuranceApprovalRequestCreateSchema, request.body), request.user!.id, metadata(request)))));
  app.post('/api/insurance/approval-requests/:id/actions/approve', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Decide') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.decideApprovalRequest(id, 'approve', parse(insuranceApprovalDecisionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/approval-requests/:id/actions/reject', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Decide') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.decideApprovalRequest(id, 'reject', parse(insuranceApprovalDecisionSchema, request.body), request.user!.id, metadata(request))); });
  app.post('/api/insurance/approval-requests/:id/actions/cancel', { preHandler: requirePermission(services, 'Insurance', 'Approvals', 'Request') }, async (request) => { const { id } = parse(insuranceIdParamsSchema, request.params); return ok(await services.insurance.cancelApprovalRequest(id, parse(insuranceApprovalCancellationSchema, request.body), request.user!.id, metadata(request))); });
};
