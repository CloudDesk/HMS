import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { requirePermission, requireAnyPermission } from '../../middleware/require-permission.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  consultationSchema,
  bookEmergencyReferralSchema,
  createEmergencySchema,
  dispositionSchema,
  emergencyBranchSchema,
  emergencyIdSchema,
  emergencyListSchema,
  emergencyReferralListSchema,
  emergencyReferralSchema,
  linkPatientSchema,
  orderSchema,
  priorityOverrideSchema,
  reasonSchema,
  triageSchema,
} from './emergency.schemas.js';

export const emergencyTriageCompletionPermissions = [
  { moduleName: 'Emergency', screen: 'Triage', action: 'Assess' },
  { moduleName: 'Emergency', screen: 'Consultation', action: 'Edit' },
  { moduleName: 'Emergency', screen: 'Encounters', action: 'Edit' },
];

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldMessages = error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? `${field}: ${issue.message}` : issue.message;
      });
      throw new AppError(
        fieldMessages.join('; ') || 'Request validation failed',
        400,
        'VALIDATION_ERROR',
        error.flatten(),
      );
    }
    throw error;
  }
};
const meta = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});
type EmergencyDetail = Awaited<ReturnType<ServiceRegistry['emergency']['get']>>;
const redactEmergencyDetail = async (
  services: ServiceRegistry,
  request: FastifyRequest,
  detail: EmergencyDetail,
) => {
  const userId = request.user!.id;
  const [viewTriage, viewConsultation, viewOrders, viewDisposition] = await Promise.all([
    services.permissions.userHasPermission(userId, 'Emergency', 'Triage', 'View'),
    services.permissions.userHasPermission(userId, 'Emergency', 'Consultation', 'View'),
    services.permissions.userHasPermission(userId, 'Emergency', 'Orders', 'View'),
    services.permissions.userHasPermission(userId, 'Emergency', 'Disposition', 'View'),
  ]);
  return {
    ...detail,
    triage:
      viewTriage || !detail.triage
        ? detail.triage
        : {
            level: detail.triage.level,
            effective_level: detail.triage.effective_level,
            area: detail.triage.area,
            assessed_at: detail.triage.assessed_at,
          },
    consultation: viewConsultation ? detail.consultation : null,
    orders: viewOrders ? detail.orders : [],
    disposition: viewDisposition ? detail.disposition : null,
  };
};
const dispositionPermission = async (
  services: ServiceRegistry,
  request: FastifyRequest,
  decision: string,
) => {
  const action =
    decision === 'DISCHARGE'
      ? 'Discharge'
      : decision === 'TRANSFER'
        ? 'Transfer'
        : decision === 'ADMIT'
          ? 'ConvertToIP'
          : 'MarkLeft';
  if (
    await services.permissions.userHasPermission(
      request.user!.id,
      'Emergency',
      'Disposition',
      action,
    )
  )
    return;
  await services.permissions.auditDeniedAccess(
    request.user!.id,
    'Emergency',
    'Disposition',
    action,
    meta(request),
  );
  throw new AppError('Permission required', 403, 'PERMISSION_REQUIRED');
};
export const registerEmergencyRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get(
    '/api/emergency/referrals',
    { preHandler: requirePermission(services, 'OPD', 'OPD Referral', 'View') },
    async (request) =>
      ok(await services.emergency.listReferrals(parse(emergencyReferralListSchema, request.query), request.user!.id)),
  );
  app.get(
    '/api/emergency/encounters/:id/referral',
    { preHandler: requirePermission(services, 'OPD', 'OPD Referral', 'View') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params);
      const query = parse(emergencyBranchSchema, request.query);
      return ok(await services.emergency.getReferral(params.id, query.branch_id, request.user!.id));
    },
  );
  app.post(
    '/api/emergency/encounters/:id/referral',
    { preHandler: requirePermission(services, 'Emergency', 'Consultation', 'Edit') },
    async (request, reply) => {
      const params = parse(emergencyIdSchema, request.params);
      const query = parse(emergencyBranchSchema, request.query);
      return reply.status(201).send(ok(await services.emergency.submitReferral(
        params.id,
        query.branch_id,
        parse(emergencyReferralSchema, request.body),
        request.user!.id,
        meta(request),
      )));
    },
  );
  app.post(
    '/api/emergency/encounters/:id/referral/book',
    {
      preHandler: [
        ...requirePermission(services, 'OPD', 'OPD Referral', 'View'),
        ...requirePermission(services, 'Appointments', 'Appointment Booking', 'Create'),
      ],
    },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params);
      const query = parse(emergencyBranchSchema, request.query);
      return ok(await services.emergency.bookReferral(
        params.id,
        query.branch_id,
        parse(bookEmergencyReferralSchema, request.body),
        request.user!.id,
        meta(request),
      ));
    },
  );
  app.get(
    '/api/emergency/encounters',
    { preHandler: requirePermission(services, 'Emergency', 'Encounters', 'View') },
    async (request) =>
      ok(
        await services.emergency.list(parse(emergencyListSchema, request.query), request.user!.id),
      ),
  );
  app.get(
    '/api/emergency/summary',
    { preHandler: requirePermission(services, 'Emergency', 'Encounters', 'View') },
    async (request) => {
      const query = parse(emergencyBranchSchema, request.query);
      return ok(await services.emergency.summary(query.branch_id, request.user!.id));
    },
  );
  app.get(
    '/api/emergency/encounters/:id',
    { preHandler: requirePermission(services, 'Emergency', 'Encounters', 'View') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),

        query = parse(emergencyBranchSchema, request.query);
      const detail = await services.emergency.get(params.id, query.branch_id, request.user!.id);
      return ok(await redactEmergencyDetail(services, request, detail));
    },
  );
  app.post(
    '/api/emergency/encounters',
    { preHandler: requirePermission(services, 'Emergency', 'Encounters', 'Register') },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          ok(
            await services.emergency.create(
              parse(createEmergencySchema, request.body),
              request.user!.id,
              meta(request),
            ),
          ),
        ),
  );
  app.post(
    '/api/emergency/encounters/:id/link-patient',
    { preHandler: requirePermission(services, 'Emergency', 'Patient Linking', 'Link') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query),
        body = parse(linkPatientSchema, request.body);
      return ok(
        await services.emergency.linkPatient(
          params.id,
          query.branch_id,
          body.patient_id,
          body.reason,
          false,
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/correct-patient',
    { preHandler: requirePermission(services, 'Emergency', 'Patient Linking', 'Correct') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query),
        body = parse(linkPatientSchema, request.body);
      return ok(
        await services.emergency.linkPatient(
          params.id,
          query.branch_id,
          body.patient_id,
          body.reason,
          true,
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/triage',
    {
      preHandler: requireAnyPermission(services, emergencyTriageCompletionPermissions),
    },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.triage(
          params.id,
          query.branch_id,
          parse(triageSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/override-priority',
    { preHandler: requirePermission(services, 'Emergency', 'Triage', 'OverridePriority') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query),
        body = parse(priorityOverrideSchema, request.body);
      return ok(
        await services.emergency.overridePriority(
          params.id,
          query.branch_id,
          body.level,
          body.reason,
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/call',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'Emergency', screen: 'Consultation', action: 'Edit' },
        { moduleName: 'Emergency', screen: 'Triage', action: 'Assess' },
        { moduleName: 'Emergency', screen: 'Encounters', action: 'Edit' },
      ]),
    },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.call(params.id, query.branch_id, request.user!.id, meta(request)),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/skip',
    {
      preHandler: requireAnyPermission(services, [
        { moduleName: 'Emergency', screen: 'Consultation', action: 'Edit' },
        { moduleName: 'Emergency', screen: 'Triage', action: 'Assess' },
        { moduleName: 'Emergency', screen: 'Encounters', action: 'Edit' },
      ]),
    },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.skip(
          params.id,
          query.branch_id,
          parse(reasonSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.put(
    '/api/emergency/encounters/:id/consultation',
    { preHandler: requirePermission(services, 'Emergency', 'Consultation', 'Edit') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.consultation(
          params.id,
          query.branch_id,
          parse(consultationSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/orders',
    { preHandler: requirePermission(services, 'Emergency', 'Orders', 'Create') },
    async (request, reply) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return reply
        .status(201)
        .send(
          ok(
            await services.emergency.order(
              params.id,
              query.branch_id,
              parse(orderSchema, request.body),
              request.user!.id,
              meta(request),
            ),
          ),
        );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/disposition',
    { preHandler: authenticate(services) },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query),
        body = parse(dispositionSchema, request.body);
      await dispositionPermission(services, request, body.decision);
      return ok(
        await services.emergency.disposition(
          params.id,
          query.branch_id,
          body,
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/no-show',
    { preHandler: requirePermission(services, 'Emergency', 'Disposition', 'MarkNoShow') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.markNoShow(
          params.id,
          query.branch_id,
          parse(reasonSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/left',
    { preHandler: requirePermission(services, 'Emergency', 'Disposition', 'MarkLeft') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.markLeft(
          params.id,
          query.branch_id,
          parse(reasonSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
  app.post(
    '/api/emergency/encounters/:id/cancel',
    { preHandler: requirePermission(services, 'Emergency', 'Disposition', 'Cancel') },
    async (request) => {
      const params = parse(emergencyIdSchema, request.params),
        query = parse(emergencyBranchSchema, request.query);
      return ok(
        await services.emergency.cancel(
          params.id,
          query.branch_id,
          parse(reasonSchema, request.body),
          request.user!.id,
          meta(request),
        ),
      );
    },
  );
};
