import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  auditLogQuerySchema,
  generalSettingsBodySchema,
  hospitalSettingsBodySchema,
  localizationSettingsBodySchema,
  settingsSectionParamsSchema,
  userPreferencesBodySchema,
} from './settings.schemas.js';
import type { GeneralSettingsInput, HospitalSettingsInput } from './settings.service.js';
import type {
  AuditLogQuery,
  LocalizationSettings,
  SettingsSection,
  UserPreferenceSettings,
} from './settings.types.js';

type SectionParams = { section: SettingsSection };

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerSettingsRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get(
    '/api/settings/runtime/first-day-of-week',
    { preHandler: authenticate(services) },
    async () => ok({
      firstDayOfWeek: await services.settings.getRuntimeFirstDayOfWeek() ?? 'Sunday',
    }),
  );

  app.get(
    '/api/settings',
    { preHandler: requirePermission(services, 'Administration', 'Settings', 'View') },
    async () => ok(await services.settings.get()),
  );

  app.patch<{ Body: GeneralSettingsInput }>(
    '/api/settings/general',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit'),
      schema: { body: generalSettingsBodySchema },
    },
    async (request) =>
      ok(
        await services.settings.updateGeneral(
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Body: HospitalSettingsInput }>(
    '/api/settings/hospital',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit'),
      schema: { body: hospitalSettingsBodySchema },
    },
    async (request) =>
      ok(
        await services.settings.updateHospital(
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Body: LocalizationSettings }>(
    '/api/settings/localization',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit'),
      schema: { body: localizationSettingsBodySchema },
    },
    async (request) =>
      ok(
        await services.settings.updateLocalization(
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.patch<{ Body: UserPreferenceSettings }>(
    '/api/settings/user-preferences',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit'),
      schema: { body: userPreferencesBodySchema },
    },
    async (request) =>
      ok(
        await services.settings.updateUserPreferences(
          request.body,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.post<{ Params: SectionParams }>(
    '/api/settings/:section/reset',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit'),
      schema: { params: settingsSectionParamsSchema },
    },
    async (request) =>
      ok(
        await services.settings.reset(
          request.params.section,
          request.user!.id,
          metadataFromRequest(request),
        ),
      ),
  );

  app.post(
    '/api/settings/hospital/logo',
    { preHandler: requirePermission(services, 'Administration', 'Settings', 'Edit') },
    async (request) => {
      const file = await request.file();
      if (!file) {
        throw new AppError('Hospital logo file is required', 400, 'LOGO_REQUIRED');
      }

      return ok(
        await services.settings.uploadHospitalLogo(
          await file.toBuffer(),
          file.mimetype,
          request.user!.id,
          metadataFromRequest(request),
        ),
      );
    },
  );

  app.get(
    '/api/settings/hospital/logo',
    { preHandler: requirePermission(services, 'Administration', 'Settings', 'View') },
    async (_request, reply) => {
      const logo = await services.settings.downloadHospitalLogo();
      return reply.type(logo.contentType).send(logo.stream);
    },
  );

  app.get<{ Querystring: AuditLogQuery }>(
    '/api/settings/audit-logs',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'View'),
      schema: { querystring: auditLogQuerySchema },
    },
    async (request) => ok(await services.settings.listAuditLogs(request.query)),
  );

  app.get<{ Querystring: AuditLogQuery }>(
    '/api/settings/audit-logs/export',
    {
      preHandler: requirePermission(services, 'Administration', 'Settings', 'Export'),
      schema: { querystring: auditLogQuerySchema },
    },
    async (request, reply) => {
      const stream = await services.settings.exportAuditLogs(
        request.query,
        request.user!.id,
        metadataFromRequest(request),
      );
      return reply.header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="hms-audit-logs.csv"').send(stream);
    },
  );
};
