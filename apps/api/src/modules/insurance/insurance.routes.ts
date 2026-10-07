import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  checkCoverageSchema,
  createBenefitConfigSchema,
  createMemberSchema,
  createPayerSchema,
  createPolicySchema,
  createSchemeSchema,
  idParamsSchema,
  listBenefitConfigsSchema,
  listEligibilityVerificationsSchema,
  listMembersSchema,
  listPayersSchema,
  listPoliciesSchema,
  listSchemesSchema,
  updateBenefitConfigSchema,
  updateMemberSchema,
  updatePayerSchema,
  updatePolicySchema,
  updateSchemeSchema,
  verifyBenefitSchema,
  verifyEligibilitySchema,
} from './insurance.schemas.js';

const metadata = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', error.flatten());
    }
    throw error;
  }
};

export const registerInsuranceRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  // ================= PAYERS =================
  app.post(
    '/api/insurance/payers',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Create') },
    async (request, reply) => {
      const body = parse(createPayerSchema, request.body);
      const payer = await services.insurance.createPayer(body, request.user!.id, metadata(request));
      return reply.status(201).send(ok(payer));
    }
  );

  app.get(
    '/api/insurance/payers',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const query = parse(listPayersSchema, request.query);
      return ok(await services.insurance.listPayers(query));
    }
  );

  app.get(
    '/api/insurance/payers/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getPayer(params.id));
    }
  );

  app.patch(
    '/api/insurance/payers/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Edit') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const body = parse(updatePayerSchema, request.body);
      return ok(await services.insurance.updatePayer(params.id, body, request.user!.id, metadata(request)));
    }
  );

  // ================= SCHEMES =================
  app.post(
    '/api/insurance/schemes',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Create') },
    async (request, reply) => {
      const body = parse(createSchemeSchema, request.body);
      const scheme = await services.insurance.createScheme(body, request.user!.id, metadata(request));
      return reply.status(201).send(ok(scheme));
    }
  );

  app.get(
    '/api/insurance/schemes',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const query = parse(listSchemesSchema, request.query);
      return ok(await services.insurance.listSchemes(query));
    }
  );

  app.get(
    '/api/insurance/schemes/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getScheme(params.id));
    }
  );

  app.patch(
    '/api/insurance/schemes/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Edit') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const body = parse(updateSchemeSchema, request.body);
      return ok(await services.insurance.updateScheme(params.id, body, request.user!.id, metadata(request)));
    }
  );

  // ================= POLICIES =================
  app.post(
    '/api/insurance/policies',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Create') },
    async (request, reply) => {
      const body = parse(createPolicySchema, request.body);
      const policy = await services.insurance.createPolicy(body, request.user!.id, metadata(request));
      return reply.status(201).send(ok(policy));
    }
  );

  app.get(
    '/api/insurance/policies',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const query = parse(listPoliciesSchema, request.query);
      return ok(await services.insurance.listPolicies(query));
    }
  );

  app.get(
    '/api/insurance/policies/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getPolicy(params.id));
    }
  );

  app.patch(
    '/api/insurance/policies/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Edit') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const body = parse(updatePolicySchema, request.body);
      return ok(await services.insurance.updatePolicy(params.id, body, request.user!.id, metadata(request)));
    }
  );

  // ================= MEMBERS =================
  app.post(
    '/api/insurance/members',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Create') },
    async (request, reply) => {
      const body = parse(createMemberSchema, request.body);
      const member = await services.insurance.createMember(body, request.user!.id, metadata(request));
      return reply.status(201).send(ok(member));
    }
  );

  app.get(
    '/api/insurance/members',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const query = parse(listMembersSchema, request.query);
      return ok(await services.insurance.listMembers(query));
    }
  );

  app.get(
    '/api/insurance/members/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getMember(params.id));
    }
  );

  app.patch(
    '/api/insurance/members/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'Edit') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const body = parse(updateMemberSchema, request.body);
      return ok(await services.insurance.updateMember(params.id, body, request.user!.id, metadata(request)));
    }
  );

  // ================= COVERAGE STATUS & READINESS =================
  app.get(
    '/api/insurance/members/:id/coverage-status',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const query = request.query as { asOfDate?: string };
      return ok(await services.insurance.checkCoverage({ memberId: params.id, asOfDate: query.asOfDate }));
    }
  );

  app.post(
    '/api/insurance/coverage/check',
    { preHandler: requirePermission(services, 'Insurance', 'Configuration', 'View') },
    async (request) => {
      const body = parse(checkCoverageSchema, request.body);
      return ok(await services.insurance.checkCoverage(body));
    }
  );

  // ================= SHA ELIGIBILITY VERIFICATION =================
  app.post(
    '/api/insurance/eligibility/verify',
    { preHandler: requirePermission(services, 'Insurance', 'Eligibility', 'Verify') },
    async (request, reply) => {
      const body = parse(verifyEligibilitySchema, request.body);
      const result = await services.insurance.verifyEligibility(body, request.user!.id, metadata(request));
      return reply.status(200).send(ok(result));
    }
  );

  app.get(
    '/api/insurance/eligibility/verifications',
    { preHandler: requirePermission(services, 'Insurance', 'Eligibility', 'View') },
    async (request) => {
      const query = parse(listEligibilityVerificationsSchema, request.query);
      return ok(await services.insurance.listEligibilityVerifications(query));
    }
  );

  app.get(
    '/api/insurance/eligibility/verifications/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Eligibility', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getEligibilityVerification(params.id));
    }
  );

  // ================= BENEFIT CONFIGURATION & VERIFICATION =================
  app.post(
    '/api/insurance/benefits',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Manage') },
    async (request, reply) => {
      const body = parse(createBenefitConfigSchema, request.body);
      const result = await services.insurance.createBenefitConfig(body, request.user!.id, metadata(request));
      return reply.status(201).send(ok(result));
    }
  );

  app.get(
    '/api/insurance/benefits',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') },
    async (request) => {
      const query = parse(listBenefitConfigsSchema, request.query);
      return ok(await services.insurance.listBenefitConfigs(query));
    }
  );

  app.get(
    '/api/insurance/benefits/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      return ok(await services.insurance.getBenefitConfig(params.id));
    }
  );

  app.put(
    '/api/insurance/benefits/:id',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Manage') },
    async (request) => {
      const params = parse(idParamsSchema, request.params);
      const body = parse(updateBenefitConfigSchema, request.body);
      return ok(await services.insurance.updateBenefitConfig(params.id, body, request.user!.id, metadata(request)));
    }
  );

  app.post(
    '/api/insurance/benefits/verify',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Verify') },
    async (request, reply) => {
      const body = parse(verifyBenefitSchema, request.body);
      const result = await services.insurance.verifyBenefit(body, request.user!.id, metadata(request));
      return reply.status(200).send(ok(result));
    }
  );
};
