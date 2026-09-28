import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePermission } from '../../middleware/require-permission.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  consentRequirementSchema,
  consentTemplateIdSchema,
  consentTemplateListSchema,
  saveConsentTemplateSchema,
  updateFormDefinitionSchema,
} from './consent.schemas.js';

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => schema.parse(value);
const metadata = (request: FastifyRequest) => ({ ipAddress: request.ip, userAgent: request.headers['user-agent'] });

export const registerConsentRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get('/api/consents/requirements', { preHandler: requirePermission(services, 'Patients', 'Consent', 'View') },
    async (request) => ok(await services.consents.requirements(parse(consentRequirementSchema, request.query), request.user!.id)));

  app.get('/api/consent-templates', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'View') },
    async (request) => ok(await services.consents.list(parse(consentTemplateListSchema, request.query), request.user!.id)));

  app.get('/api/consent-templates/:id', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'View') },
    async (request) => {
      const { id } = parse(consentTemplateIdSchema, request.params);
      return ok(await services.consents.getById(id, request.user!.id));
    });

  app.post('/api/consent-templates', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'Create') },
    async (request, reply) => reply.status(201).send(ok(await services.consents.create(parse(saveConsentTemplateSchema, request.body), request.user!.id, metadata(request)))));

  app.patch('/api/consent-templates/:id', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'Edit') },
    async (request) => {
      const { id } = parse(consentTemplateIdSchema, request.params);
      return ok(await services.consents.update(id, parse(saveConsentTemplateSchema, request.body), request.user!.id, metadata(request)));
    });

  app.post('/api/consent-templates/:id/form-definition', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'Edit') },
    async (request) => {
      const { id } = parse(consentTemplateIdSchema, request.params);
      const body = parse(updateFormDefinitionSchema, request.body);
      return ok(await services.consents.saveFormDefinition(id, body.branch_id, body.form_definition, request.user!.id, metadata(request)));
    });

  app.post('/api/consent-templates/:id/publish', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'Edit') },
    async (request) => {
      const { id } = parse(consentTemplateIdSchema, request.params);
      const body = request.body as { branch_id?: string };
      if (!body?.branch_id) throw new Error('branch_id is required');
      return ok(await services.consents.publish(id, body.branch_id, request.user!.id, metadata(request)));
    });

  app.post('/api/consent-templates/:id/versions', { preHandler: requirePermission(services, 'Administration', 'Consent Templates', 'Create') },
    async (request, reply) => {
      const { id } = parse(consentTemplateIdSchema, request.params);
      const body = request.body as { branch_id?: string };
      if (!body?.branch_id) throw new Error('branch_id is required');
      const next = await services.consents.createNextVersion(id, body.branch_id, request.user!.id, metadata(request));
      return reply.status(201).send(ok(next));
    });
};
