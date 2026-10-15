import { createClaimSchema, listClaimsSchema, validateClaimSchema } from './insurance-claim.schemas.js';
import {
  claimLifecycleReportQuerySchema,
  remittanceReconciliationReportQuerySchema,
  outstandingWorkReportQuerySchema,
  claimHistoryParamsSchema,
} from './dha/dha-claim-reporting.schemas.js';
import { insuranceEncounterQuery, encounterCoverageSchema, shaMappingSchema, shaMappingListSchema, shaMappingDeactivateSchema } from './insurance-integration.schemas.js';
import { z } from 'zod';
import { authorizationId, authorizationRequestSchema, authorizationActionSchema, authorizationCancelSchema, authorizationListSchema } from './insurance-authorization.schemas.js';
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

  app.post('/api/insurance/authorizations', { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'Manage') }, async (request, reply) => {
    const body = parse(authorizationRequestSchema, request.body);
    return reply.status(201).send(ok(await services.insuranceAuthorization.requestPreauthorization(body, request.user!.id, metadata(request))));
  });
  app.get('/api/insurance/authorizations', { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'View') }, async request => {
    return ok(await services.insuranceAuthorization.list(parse(authorizationListSchema, request.query), request.user!.id));
  });
  app.get('/api/insurance/authorizations/:id', { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'View') }, async request => {
    const params = parse(idParamsSchema, request.params);
    return ok(await services.insuranceAuthorization.get(parse(authorizationId, params.id), request.user!.id));
  });
  app.post('/api/insurance/authorizations/:id/submit', { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'Submit') }, async request => {
    const params = parse(idParamsSchema, request.params);
    const body = parse(authorizationActionSchema, request.body);
    return ok(await services.insuranceAuthorization.submit(parse(authorizationId, params.id), body.version, request.user!.id, metadata(request)));
  });
  app.post('/api/insurance/authorizations/:id/cancel', { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'Manage') }, async request => {
    const params = parse(idParamsSchema, request.params);
    const body = parse(authorizationCancelSchema, request.body);
    return ok(await services.insuranceAuthorization.cancel(parse(authorizationId, params.id), body.version, body.reason, request.user!.id, metadata(request)));
  });

  const encounterParams = z.object({ encounterId: authorizationId });
  app.post('/api/insurance/claims', { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Create') }, async (request, reply) => {
    return reply.status(201).send(ok(await services.insuranceClaims.create(parse(createClaimSchema, request.body), request.user!.id, metadata(request))));
  });
  app.get('/api/insurance/claims', { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') }, async request => {
    return ok(await services.insuranceClaims.list(parse(listClaimsSchema, request.query), request.user!.id));
  });
  app.get('/api/insurance/claims/:id', { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') }, async request => {
    const params = parse(idParamsSchema, request.params);
    return ok(await services.insuranceClaims.get(parse(authorizationId, params.id), request.user!.id));
  });
  app.get('/api/insurance/claims/:id/readiness', { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') }, async request => {
    const params = parse(idParamsSchema, request.params);
    return ok(await services.insuranceClaims.readiness(parse(authorizationId, params.id), request.user!.id));
  });
  app.post('/api/insurance/claims/:id/validate', { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') }, async request => {
    const params = parse(idParamsSchema, request.params); const body = parse(validateClaimSchema, request.body);
    return ok(await services.insuranceClaims.validate(parse(authorizationId, params.id), body.version, request.user!.id, metadata(request)));
  });

  const claimSubmitParamsSchema = z.object({
    claimId: authorizationId,
  });

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-submit',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimSubmission.mockSubmitClaim(params.claimId, {
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-preview',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimPreview.mockPreviewClaim(params.claimId, {
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-discharge',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimDischarge.mockDischargeClaim(params.claimId, {
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  const claimAdjudicateBodySchema = z
    .object({
      decision: z
        .enum([
          'MOCK_PENDING',
          'MOCK_APPROVED',
          'MOCK_PARTIALLY_APPROVED',
          'MOCK_REJECTED',
          'MOCK_QUERY',
        ])
        .optional(),
    })
    .optional();

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-adjudication',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const body = request.body ? parse(claimAdjudicateBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimAdjudication.mockAdjudicateClaim(params.claimId, {
          decision: body?.decision,
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  const claimQueryCreateBodySchema = z
    .object({
      queryReason: z.string().optional(),
    })
    .optional();

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-query',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const body = request.body ? parse(claimQueryCreateBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimQuery.mockCreateQuery(params.claimId, {
          queryReason: body?.queryReason,
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  const claimQueryRespondParamsSchema = z.object({
    claimId: authorizationId,
    queryId: authorizationId,
  });

  const claimQueryRespondBodySchema = z.object({
    responseNote: z.string().min(3).max(2000),
    documentIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
    resolveImmediately: z.boolean().optional(),
  });

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-query/:queryId/respond',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimQueryRespondParamsSchema, request.params);
      const body = parse(claimQueryRespondBodySchema, request.body);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimQuery.mockRespondToQuery(
          params.claimId,
          params.queryId,
          body,
          {
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );

  const claimAppealCreateBodySchema = z
    .object({
      appealReason: z.string().optional(),
    })
    .optional();

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-appeal',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const body = request.body ? parse(claimAppealCreateBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimAppeal.mockCreateAppeal(params.claimId, {
          appealReason: body?.appealReason,
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  const claimAppealSubmitParamsSchema = z.object({
    claimId: authorizationId,
    appealId: authorizationId,
  });

  const claimAppealSubmitBodySchema = z.object({
    appealNote: z.string().min(3).max(2000),
    documentIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(),
    decision: z.enum(['MOCK_UPHELD', 'MOCK_OVERTURNED', 'SUBMITTED']).optional(),
    decisionReason: z.string().optional(),
  });

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-appeal/:appealId/submit',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimAppealSubmitParamsSchema, request.params);
      const body = parse(claimAppealSubmitBodySchema, request.body);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimAppeal.mockSubmitAppeal(
          params.claimId,
          params.appealId,
          body,
          {
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-remittance-advice',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimSubmitParamsSchema, request.params);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaRemittanceAdvice.mockGenerateRemittanceAdvice(params.claimId, {
          actorUserId: user.id,
          correlationId,
          metadata: metadata(request),
        }),
      );
    },
  );

  const claimAllocateParamsSchema = z.object({
    claimId: authorizationId,
    remittanceAdviceId: authorizationId,
  });

  const claimAllocateBodySchema = z.object({
    amount: z.number().positive(),
    currency: z.string().min(3).max(3).optional(),
    idempotencyKey: z.string().min(1).max(100).optional(),
  });

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/allocate',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimAllocateParamsSchema, request.params);
      const body = parse(claimAllocateBodySchema, request.body);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaPaymentAllocation.mockAllocatePayment(
          params.claimId,
          params.remittanceAdviceId,
          body,
          {
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );

  const claimReconcileParamsSchema = z.object({
    claimId: authorizationId,
    remittanceAdviceId: authorizationId,
  });

  const claimReconcileBodySchema = z
    .object({
      idempotencyKey: z.string().min(1).max(100).optional(),
    })
    .optional();

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/reconcile',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimReconcileParamsSchema, request.params);
      const body = request.body ? parse(claimReconcileBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaPaymentReconciliation.mockReconcilePayment(
          params.claimId,
          params.remittanceAdviceId,
          body,
          {
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );

  app.get(
    '/api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/reconciliations',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const params = parse(claimReconcileParamsSchema, request.params);
      const user = request.user!;
      return ok(
        await services.dhaPaymentReconciliation.getReconciliations(
          params.claimId,
          params.remittanceAdviceId,
          {
            actorUserId: user.id,
          },
        ),
      );
    },
  );

  const claimClosureParamsSchema = z.object({
    claimId: authorizationId,
  });

  const claimClosureBodySchema = z
    .object({
      reason: z.string().min(1).max(500).optional(),
      idempotencyKey: z.string().min(1).max(100).optional(),
    })
    .optional();

  app.get(
    '/api/insurance/claims/:claimId/dha/closure-readiness',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const params = parse(claimClosureParamsSchema, request.params);
      const user = request.user!;
      return ok(
        await services.dhaClaimClosure.evaluateClosureReadiness(params.claimId, {
          actorUserId: user.id,
        }),
      );
    },
  );

  app.post(
    '/api/insurance/claims/:claimId/dha/mock-close',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'Validate') },
    async (request) => {
      const params = parse(claimClosureParamsSchema, request.params);
      const body = request.body ? parse(claimClosureBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaClaimClosure.mockCloseClaim(
          params.claimId,
          body,
          {
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );

  app.get(
    '/api/insurance/claims/:claimId/dha/closures',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const params = parse(claimClosureParamsSchema, request.params);
      const user = request.user!;
      return ok(
        await services.dhaClaimClosure.getClosures(params.claimId, {
          actorUserId: user.id,
        }),
      );
    },
  );

  // ================= REPORTING & AUDIT VIEWS (PHASE 10.8) =================
  app.get(
    '/api/insurance/reports/claim-lifecycle',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const query = parse(claimLifecycleReportQuerySchema, request.query);
      const user = request.user!;
      return ok(
        await services.dhaClaimReporting.getClaimLifecycleSummary(query, {
          actorUserId: user.id,
        }),
      );
    },
  );

  app.get(
    '/api/insurance/reports/remittance-reconciliation',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const query = parse(remittanceReconciliationReportQuerySchema, request.query);
      const user = request.user!;
      return ok(
        await services.dhaClaimReporting.getRemittanceReconciliationSummary(query, {
          actorUserId: user.id,
        }),
      );
    },
  );

  app.get(
    '/api/insurance/reports/outstanding-work',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const query = parse(outstandingWorkReportQuerySchema, request.query);
      const user = request.user!;
      return ok(
        await services.dhaClaimReporting.getOutstandingWorkSummary(query, {
          actorUserId: user.id,
        }),
      );
    },
  );

  app.get(
    '/api/insurance/claims/:claimId/dha/history',
    { preHandler: requirePermission(services, 'Insurance', 'Claims', 'View') },
    async (request) => {
      const params = parse(claimHistoryParamsSchema, request.params);
      const user = request.user!;
      return ok(
        await services.dhaClaimReporting.getClaimAuditHistory(params.claimId, {
          actorUserId: user.id,
        }),
      );
    },
  );



  const serviceParams = encounterParams.extend({ serviceId: authorizationId });
  app.get('/api/insurance/encounters/:encounterId/context', { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') }, async request => {
    const params = parse(encounterParams, request.params);
    const query = parse(insuranceEncounterQuery, request.query);
    return ok(await services.insuranceIntegration.context(params.encounterId, query.encounterType, request.user!.id));
  });
  app.post('/api/insurance/encounters/:encounterId/services/:serviceId/coverage', { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Verify') }, async request => {
    const params = parse(serviceParams, request.params);
    const query = parse(insuranceEncounterQuery, request.query);
    return ok(await services.insuranceIntegration.coverage(params.encounterId, query.encounterType, params.serviceId, parse(encounterCoverageSchema, request.body), request.user!.id, metadata(request)));
  });
  app.post('/api/insurance/sha-service-mappings', { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Manage') }, async (request, reply) => {
    return reply.status(201).send(ok(await services.insuranceIntegration.createMapping(parse(shaMappingSchema, request.body), request.user!.id, metadata(request))));
  });
  app.get('/api/insurance/sha-service-mappings', { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') }, async request => {
    return ok(await services.insuranceIntegration.listMappings(parse(shaMappingListSchema, request.query)));
  });
  app.post('/api/insurance/sha-service-mappings/:id/deactivate', { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'Manage') }, async request => {
    const params = parse(idParamsSchema, request.params);
    const body = parse(shaMappingDeactivateSchema, request.body);
    return ok(await services.insuranceIntegration.deactivateMapping(parse(authorizationId, params.id), body.version, body.reason, request.user!.id, metadata(request)));
  });

  const dhaPatientVerifyParams = z.object({
    patientId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid patient ID format'),
  });
  app.post(
    '/api/insurance/dha/patients/:patientId/verify',
    { preHandler: requirePermission(services, 'Insurance', 'Eligibility', 'Verify') },
    async (request) => {
      const params = parse(dhaPatientVerifyParams, request.params);
      const user = request.user!;
      return ok(
        await services.dhaPatientRegistry.verifyPatient(
          params.patientId,
          user.id,
        ),
      );
    },
  );

  app.get(
    '/api/insurance/dha/patients/:patientId/sub-benefits',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') },
    async (request) => {
      const params = parse(dhaPatientVerifyParams, request.params);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaSubBenefits.getSubBenefits(params.patientId, {
          actorUserId: user.id,
          correlationId,
        }),
      );
    },
  );

  const dhaInterventionsQuery = z.object({
    subBenefitCode: z.string().min(1, 'subBenefitCode is required'),
  });

  app.get(
    '/api/insurance/dha/patients/:patientId/interventions',
    { preHandler: requirePermission(services, 'Insurance', 'Benefits', 'View') },
    async (request) => {
      const params = parse(dhaPatientVerifyParams, request.params);
      const query = parse(dhaInterventionsQuery, request.query);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaInterventionCoverage.getInterventions(
          params.patientId,
          query.subBenefitCode,
          {
            actorUserId: user.id,
            correlationId,
          },
        ),
      );
    },
  );

  const dhaPreauthReadinessQuery = z.object({
    subBenefitCode: z.string().optional(),
    interventionCode: z.string().optional(),
    needsPreauth: z.preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
    contractConfirmed: z.preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  });

  const dhaPreauthReadinessParams = z.object({
    authorizationId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid authorization ID format'),
  });

  app.get(
    '/api/insurance/dha/authorizations/:authorizationId/readiness',
    { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'View') },
    async (request) => {
      const params = parse(dhaPreauthReadinessParams, request.params);
      const query = parse(dhaPreauthReadinessQuery, request.query);
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaPreauthorizationReadiness.getReadiness(
          params.authorizationId,
          {
            ...query,
            actorUserId: user.id,
            correlationId,
          },
        ),
      );
    },
  );

  const dhaConsentBodySchema = z
    .object({
      otp: z.string().optional(),
    })
    .optional();

  app.post(
    '/api/insurance/dha/authorizations/:authorizationId/consent',
    { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'Manage') },
    async (request) => {
      const params = parse(dhaPreauthReadinessParams, request.params);
      const body = request.body ? parse(dhaConsentBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaPreauthorization.processConsent(
          params.authorizationId,
          {
            otp: body?.otp,
            actorUserId: user.id,
            correlationId,
          },
        ),
      );
    },
  );

  const dhaSubmitPreauthBodySchema = z
    .object({
      otp: z.string().optional(),
      consentReference: z.string().optional(),
    })
    .optional();

  app.post(
    '/api/insurance/dha/authorizations/:authorizationId/submit',
    { preHandler: requirePermission(services, 'Insurance', 'Authorization', 'Submit') },
    async (request) => {
      const params = parse(dhaPreauthReadinessParams, request.params);
      const body = request.body ? parse(dhaSubmitPreauthBodySchema, request.body) : undefined;
      const user = request.user!;
      const correlationId = (request.headers['x-correlation-id'] as string) || undefined;
      return ok(
        await services.dhaPreauthorization.submitPreauthorization(
          params.authorizationId,
          {
            otp: body?.otp,
            consentReference: body?.consentReference,
            actorUserId: user.id,
            correlationId,
            metadata: metadata(request),
          },
        ),
      );
    },
  );
};
