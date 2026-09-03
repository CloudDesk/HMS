import type { MultipartFields, MultipartValue } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  establishRefreshSession,
  setRefreshSessionCookie,
} from '../auth/auth-session-cookie.js';
import {
  patientPortalAppointmentsResponseSchema,
  patientPortalContextResponseSchema,
  patientPortalDocumentsResponseSchema,
  patientPortalInvoiceDetailResponseSchema,
  patientPortalOverviewResponseSchema,
  patientPortalSessionResponseSchema,
  patientOtpRequestResponseSchema,
  patientOtpVerifyResponseSchema,
} from './patient-portal.schemas.js';

const provisionSchema = z.object({
  patient_id: z.string().min(1),
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email(),
  password: z.string().min(1),
});
type ProvisionBody = z.infer<typeof provisionSchema>;

const guardianProfileSchema = z.object({
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
  address: z.object({
    line1: z.string().trim().max(200).nullable().optional(), city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(), country: z.string().trim().max(100).nullable().optional(),
    postal_code: z.string().trim().max(30).nullable().optional(),
  }).optional(),
  identification: z.object({ type: z.string().trim().max(80).nullable().optional(), number: z.string().trim().max(120).nullable().optional() }).optional(),
  legal_consent_accepted: z.literal(true),
});

const registerSchema = z.object({
  account_type: z.enum(['PATIENT', 'GUARDIAN']),
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(20),
  otp: z.string().regex(/^\d{4}$/),
  guardian_profile: guardianProfileSchema.optional(),
}).superRefine((value, context) => {
  if (value.account_type === 'GUARDIAN' && !value.guardian_profile) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['guardian_profile'], message: 'Guardian details and consent are required' });
  }
});
type RegisterBody = z.infer<typeof registerSchema>;

const otpLoginSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  otp: z.string().regex(/^\d{4}$/),
});
type OtpLoginBody = z.infer<typeof otpLoginSchema>;

const guardianActivationSchema = otpLoginSchema.extend({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
  address: guardianProfileSchema.shape.address,
  identification: guardianProfileSchema.shape.identification,
  legal_consent_accepted: z.literal(true),
});
type GuardianActivationBody = z.infer<typeof guardianActivationSchema>;

const existingPatientActivationSchema = otpLoginSchema.extend({
  patient_number: z.string().trim().regex(/^HMS-\d{4}-\d{6}$/i),
  date_of_birth: z.string().date(),
  email: z.string().trim().email(),
});
type ExistingPatientActivationBody = z.infer<typeof existingPatientActivationSchema>;

const requestOtpSchema = z.object({
  phone: z.string().trim().min(7).max(20),
});
type RequestOtpBody = z.infer<typeof requestOtpSchema>;

const verifyOtpSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  otp: z.string().regex(/^\d{4}$/),
});
type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;

const patientProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  date_of_birth: z.string().date(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  preferred_branch_id: z.string().min(1),
  blood_group: z.string().trim().max(10).nullable().optional(),
  emergency_contact: z.object({
    name: z.string().trim().max(160).nullable().optional(),
    relationship: z.string().trim().max(80).nullable().optional(),
    phone: z.string().trim().min(7).max(20).nullable().optional(),
  }).optional(),
  address: z.object({
    line1: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    postal_code: z.string().trim().max(30).nullable().optional(),
  }).optional(),
});
type PatientProfileBody = z.infer<typeof patientProfileSchema>;

const updatePatientProfileSchema = patientProfileSchema.extend({
  middle_name: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  emergency_contact: z.object({
    name: z.string().trim().max(160).nullable().optional(),
    relationship: z.string().trim().max(80).nullable().optional(),
    phone: z.string().trim().min(7).max(20).nullable().optional(),
  }).optional(),
});
type UpdatePatientProfileBody = z.infer<typeof updatePatientProfileSchema>;

const updateGuardianProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
  address: guardianProfileSchema.shape.address.optional(),
  identification: guardianProfileSchema.shape.identification.optional(),
});
type UpdateGuardianProfileBody = z.infer<typeof updateGuardianProfileSchema>;

const dependentSchema = patientProfileSchema.extend({ relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']) });
type DependentBody = z.infer<typeof dependentSchema>;

const linkDependentSchema = z.object({
  patient_number: z.string().trim().regex(/^HMS-\d{4}-\d{6}$/i),
  date_of_birth: z.string().date(),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN']),
  legal_consent_accepted: z.literal(true),
});
type LinkDependentBody = z.infer<typeof linkDependentSchema>;

const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  search: z.string().trim().max(100).optional(),
  department_id: z.string().trim().optional(),
  branch_id: z.string().trim().optional(),
});
type PublicListQuery = z.input<typeof publicListQuerySchema>;

const slotsQuerySchema = z.object({ date: z.string().date() });
type SlotsQuery = z.infer<typeof slotsQuerySchema>;

const bookAppointmentSchema = z.object({
  patient_id: z.string().min(1),
  doctor_id: z.string().min(1),
  appointment_date: z.string().date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration_minutes: z.number().int().min(5).max(240),
  visit_type: z.enum(['NEW_CONSULTATION', 'FOLLOW_UP', 'PROCEDURE']),
  reason: z.string().trim().min(3).max(500),
});
type BookAppointmentBody = z.infer<typeof bookAppointmentSchema>;

const portalAppointmentStatuses = [
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED', 'COMPLETED',
] as const;
const portalAppointmentsQuerySchema = z.object({
  patient_id: z.string().min(1),
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  status: z.enum(portalAppointmentStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
type PortalAppointmentsQuery = z.input<typeof portalAppointmentsQuerySchema>;

const rescheduleAppointmentSchema = z.object({
  doctor_id: z.string().min(1),
  appointment_date: z.string().date(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration_minutes: z.number().int().min(5).max(240),
});
type RescheduleAppointmentBody = z.infer<typeof rescheduleAppointmentSchema>;

const portalDocumentsQuerySchema = z.object({
  patient_id: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type PortalDocumentsQuery = z.input<typeof portalDocumentsQuerySchema>;

const portalDocumentTypes = ['INSURANCE', 'CLINICAL', 'OTHER'] as const;
const readPortalMultipartField = (fields: MultipartFields, name: string) => {
  const field = fields[name];
  const value = Array.isArray(field) ? field[0] : field;
  if (!value || value.type !== 'field' || typeof (value as MultipartValue).value !== 'string') return null;
  const trimmed = ((value as MultipartValue).value as string).trim();
  return trimmed || null;
};
const safePortalFileName = (fileName: string) => fileName.replace(/[\r\n"]/g, '_');

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

export const registerPatientPortalRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.get<{ Querystring: PublicListQuery }>('/api/patient-portal/public/branches', async (request) => {
    const query = publicListQuerySchema.parse(request.query);
    return ok(await services.patientPortal.listPublicBranches(query));
  });

  app.get<{ Querystring: PublicListQuery }>('/api/patient-portal/public/departments', async (request) => {
    const query = publicListQuerySchema.parse(request.query);
    return ok(await services.patientPortal.listPublicDepartments({
      page: query.page, limit: query.limit, search: query.search, branchId: query.branch_id,
    }));
  });

  app.get<{ Querystring: PublicListQuery }>('/api/patient-portal/public/services', async (request) => {
    const query = publicListQuerySchema.parse(request.query);
    return ok(await services.patientPortal.listPublicServices({
      page: query.page,
      limit: query.limit,
      search: query.search,
      departmentId: query.department_id,
      branchId: query.branch_id,
    }));
  });

  app.get<{ Querystring: PublicListQuery }>('/api/patient-portal/public/doctors', async (request) => {
    const query = publicListQuerySchema.parse(request.query);
    return ok(await services.patientPortal.listPublicDoctors({
      page: query.page,
      limit: query.limit,
      search: query.search,
      departmentId: query.department_id,
      branchId: query.branch_id,
    }));
  });

  app.get<{ Params: { id: string }; Querystring: SlotsQuery }>('/api/patient-portal/public/doctors/:id/slots', async (request) => {
    const query = slotsQuerySchema.parse(request.query);
    return ok(await services.patientPortal.availableSlots(request.params.id, query.date));
  });

  app.post<{ Body: RequestOtpBody }>('/api/patient-portal/otp/request', {
    schema: { response: { 200: patientOtpRequestResponseSchema } },
  }, async (request) => {
    const parsed = requestOtpSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter a valid mobile number', 400, 'VALIDATION_ERROR');
    return ok(await services.patientPortal.requestOtp(parsed.data.phone, metadataFromRequest(request)));
  });

  app.post<{ Body: VerifyOtpBody }>('/api/patient-portal/otp/verify', {
    schema: { response: { 200: patientOtpVerifyResponseSchema } },
  }, async (request) => {
    const parsed = verifyOtpSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter a valid mobile number and 4-digit code', 400, 'VALIDATION_ERROR');
    await services.patientPortal.verifyOtp(parsed.data.phone, parsed.data.otp, metadataFromRequest(request));
    return ok({ success: true });
  });

  app.post<{ Body: RegisterBody }>('/api/patient-portal/signup', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Invalid portal registration details', 400, 'VALIDATION_ERROR');
    const verification = await services.patientPortal.verifyAndConsumeOtp(
      parsed.data.phone,
      parsed.data.otp,
      metadataFromRequest(request),
    );
    const account = await services.patientPortal.register({
      accountType: parsed.data.account_type,
      fullName: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      guardianProfile: parsed.data.guardian_profile ? {
        relationship: parsed.data.guardian_profile.relationship,
        legalConsentAccepted: parsed.data.guardian_profile.legal_consent_accepted,
        address: parsed.data.guardian_profile.address ? { ...parsed.data.guardian_profile.address, postalCode: parsed.data.guardian_profile.address.postal_code } : undefined,
        identification: parsed.data.guardian_profile.identification,
      } : undefined,
    }, metadataFromRequest(request));
    const session = await services.auth.loginPatientAfterOtpVerification(
      parsed.data.phone,
      verification,
      metadataFromRequest(request),
    );
    setRefreshSessionCookie(reply, session.tokens.refreshToken);
    return reply.status(201).send(ok(account));
  });

  app.post<{ Body: OtpLoginBody }>('/api/patient-portal/login/otp', {
    schema: { response: { 200: patientPortalSessionResponseSchema } },
  }, async (request, reply) => {
    const parsed = otpLoginSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter a valid mobile number and 4-digit code', 400, 'VALIDATION_ERROR');
    
    await services.patientPortal.assertOtpValidForPendingFlow(parsed.data.phone, parsed.data.otp, metadataFromRequest(request));

    const status = await services.patientPortal.getUnlinkedPatientLoginStatus(parsed.data.phone);
    if (status === 'MINOR_REQUIRES_GUARDIAN') {
      throw new AppError(
        'This patient is a minor. A parent or guardian account must be linked before signing in.',
        409,
        'MINOR_GUARDIAN_ACCOUNT_REQUIRED',
      );
    }
    if (status === 'MULTIPLE_PATIENT_MATCHES') {
      throw new AppError(
        'More than one patient record uses this mobile number. Contact hospital reception to verify and link the correct record.',
        409,
        'MULTIPLE_PATIENT_MATCHES',
      );
    }
    if (status === 'NEW_PATIENT_REQUIRES_REGISTRATION') {
      throw new AppError('No portal account or patient record matches this number. Register as a new patient first.', 409, 'NEW_PATIENT_REQUIRES_REGISTRATION');
    }

    const verification = await services.patientPortal.verifyAndConsumeOtp(
      parsed.data.phone,
      parsed.data.otp,
    );
    if (status === 'ACCOUNT_NOT_LINKED') {
      await services.patientPortal.activateExistingPatientByPhone(parsed.data.phone, metadataFromRequest(request));
    }

    const session = await services.auth.loginPatientAfterOtpVerification(
      parsed.data.phone,
      verification,
      metadataFromRequest(request),
    );
    return ok(establishRefreshSession(reply, session));
  });

  app.post<{ Body: ExistingPatientActivationBody }>('/api/patient-portal/existing-patient/activate', async (request, reply) => {
    const parsed = existingPatientActivationSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter a valid MRN, registered mobile number, date of birth, email and code', 400, 'VALIDATION_ERROR');
    const verification = await services.patientPortal.verifyAndConsumeOtp(
      parsed.data.phone,
      parsed.data.otp,
      metadataFromRequest(request),
    );
    const result = await services.patientPortal.activateExistingPatient({
      patientNumber: parsed.data.patient_number, phone: parsed.data.phone,
      dateOfBirth: parsed.data.date_of_birth, email: parsed.data.email,
    }, metadataFromRequest(request));
    const session = await services.auth.loginPatientAfterOtpVerification(
      parsed.data.phone,
      verification,
      metadataFromRequest(request),
    );
    setRefreshSessionCookie(reply, session.tokens.refreshToken);
    return reply.status(201).send(ok(result));
  });

  app.post<{ Body: GuardianActivationBody }>('/api/patient-portal/guardian-activation', async (request, reply) => {
    const parsed = guardianActivationSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter valid parent or guardian details', 400, 'VALIDATION_ERROR');
    const verification = await services.patientPortal.verifyAndConsumeOtp(parsed.data.phone, parsed.data.otp, metadataFromRequest(request));
    await services.patientPortal.activateGuardianForMinor({
      fullName: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      relationship: parsed.data.relationship,
      address: parsed.data.address ? { ...parsed.data.address, postalCode: parsed.data.address.postal_code } : undefined,
      identification: parsed.data.identification,
      legalConsentAccepted: parsed.data.legal_consent_accepted,
    }, metadataFromRequest(request));
    const session = await services.auth.loginPatientAfterOtpVerification(
      parsed.data.phone,
      verification,
      metadataFromRequest(request),
    );
    return ok(establishRefreshSession(reply, session));
  });

  app.get('/api/patient-portal/context', {
    preHandler: authenticate(services),
    schema: { response: { 200: patientPortalContextResponseSchema } },
  }, async (request) =>
    ok(await services.patientPortal.context(request.user!.id)));

  app.get<{ Querystring: { patient_id?: string } }>(
    '/api/patient-portal/overview',
    {
      preHandler: authenticate(services),
      schema: { response: { 200: patientPortalOverviewResponseSchema } },
    },
    async (request) => ok(await services.patientPortal.overview(request.user!.id, request.query.patient_id)),
  );

  app.get<{ Params: { patientId: string; invoiceId: string } }>(
    '/api/patient-portal/patients/:patientId/invoices/:invoiceId',
    {
      preHandler: authenticate(services),
      schema: { response: { 200: patientPortalInvoiceDetailResponseSchema } },
    },
    async (request) => ok(await services.patientPortal.invoice(
      request.user!.id,
      request.params.patientId,
      request.params.invoiceId,
    )),
  );

  app.get<{ Querystring: PortalDocumentsQuery }>(
    '/api/patient-portal/documents',
    {
      preHandler: authenticate(services),
      schema: { response: { 200: patientPortalDocumentsResponseSchema } },
    },
    async (request) => {
      const query = portalDocumentsQuerySchema.parse(request.query);
      return ok(await services.patientPortal.listDocuments(request.user!.id, query.patient_id, query.page, query.limit));
    },
  );

  app.post('/api/patient-portal/documents/upload', { preHandler: authenticate(services) }, async (request, reply) => {
    const file = await request.file();
    if (!file) throw new AppError('Choose a document to upload', 400, 'DOCUMENT_REQUIRED');
    const patientId = readPortalMultipartField(file.fields, 'patient_id');
    const documentType = readPortalMultipartField(file.fields, 'document_type');
    const title = readPortalMultipartField(file.fields, 'title');
    if (!patientId || !title || !documentType || !portalDocumentTypes.includes(documentType as typeof portalDocumentTypes[number])) {
      throw new AppError('Patient, document category and title are required', 400, 'VALIDATION_ERROR');
    }
    const data = await file.toBuffer();
    const document = await services.patientPortal.uploadDocument(request.user!.id, patientId, {
      document_type: documentType as typeof portalDocumentTypes[number],
      title,
      file_name: file.filename,
      mime_type: file.mimetype,
      file_size_bytes: data.byteLength,
      description: readPortalMultipartField(file.fields, 'description'),
      document_date: readPortalMultipartField(file.fields, 'document_date'),
      provider_name: readPortalMultipartField(file.fields, 'provider_name'),
      data,
    });
    return reply.status(201).send(ok(document));
  });

  app.get<{ Params: { patientId: string; documentId: string } }>('/api/patient-portal/patients/:patientId/documents/:documentId/download', { preHandler: authenticate(services) }, async (request, reply) => {
    const download = await services.patientPortal.downloadDocument(request.user!.id, request.params.patientId, request.params.documentId);
    return reply.header('content-type', download.contentType).header('content-disposition', `attachment; filename="${safePortalFileName(download.document.file_name)}"`).send(download.data);
  });

  app.patch<{ Params: { patientId: string }; Body: UpdatePatientProfileBody }>('/api/patient-portal/patients/:patientId', { preHandler: authenticate(services) }, async (request) => {
    const parsed = updatePatientProfileSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Invalid patient profile details', 400, 'VALIDATION_ERROR');
    return ok(await services.patientPortal.updatePatientProfile(request.user!.id, request.params.patientId, {
      firstName: parsed.data.first_name,
      middleName: parsed.data.middle_name,
      lastName: parsed.data.last_name,
      dateOfBirth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      email: parsed.data.email,
      phone: parsed.data.phone,
      preferredBranchId: parsed.data.preferred_branch_id,
      bloodGroup: parsed.data.blood_group,
      address: parsed.data.address ? { ...parsed.data.address, postalCode: parsed.data.address.postal_code } : undefined,
      emergencyContact: parsed.data.emergency_contact,
    }));
  });

  app.patch<{ Params: { patientId: string }; Body: UpdateGuardianProfileBody }>('/api/patient-portal/patients/:patientId/guardian-profile', { preHandler: authenticate(services) }, async (request) => {
    const parsed = updateGuardianProfileSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Invalid parent or guardian details', 400, 'VALIDATION_ERROR');
    return ok(await services.patientPortal.updateGuardianProfile(request.user!.id, request.params.patientId, {
      fullName: parsed.data.full_name,
      relationship: parsed.data.relationship,
      address: parsed.data.address ? { ...parsed.data.address, postalCode: parsed.data.address.postal_code } : undefined,
      identification: parsed.data.identification,
    }));
  });

  app.post<{ Body: PatientProfileBody }>('/api/patient-portal/profile', { preHandler: authenticate(services) }, async (request, reply) => {
    const parsed = patientProfileSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Invalid patient profile details', 400, 'VALIDATION_ERROR');
    const result = await services.patientPortal.completePatientProfile(request.user!.id, {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      dateOfBirth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      preferredBranchId: parsed.data.preferred_branch_id,
      bloodGroup: parsed.data.blood_group,
      emergencyContact: parsed.data.emergency_contact ? {
        name: parsed.data.emergency_contact.name,
        relationship: parsed.data.emergency_contact.relationship,
        phone: parsed.data.emergency_contact.phone,
      } : undefined,
      address: parsed.data.address ? { ...parsed.data.address, postalCode: parsed.data.address.postal_code } : undefined,
    });
    return reply.status(201).send(ok(result));
  });

  app.post<{ Body: DependentBody }>('/api/patient-portal/dependents', { preHandler: authenticate(services) }, async (request, reply) => {
    const parsed = dependentSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Invalid dependent details', 400, 'VALIDATION_ERROR');
    const result = await services.patientPortal.addDependent(request.user!.id, {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      dateOfBirth: parsed.data.date_of_birth,
      gender: parsed.data.gender,
      preferredBranchId: parsed.data.preferred_branch_id,
      relationship: parsed.data.relationship,
      bloodGroup: parsed.data.blood_group,
      address: parsed.data.address ? { ...parsed.data.address, postalCode: parsed.data.address.postal_code } : undefined,
    });
    return reply.status(201).send(ok(result));
  });

  app.post<{ Body: LinkDependentBody }>('/api/patient-portal/dependents/link', { preHandler: authenticate(services) }, async (request, reply) => {
    const parsed = linkDependentSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Enter a valid patient MRN, date of birth, relationship and consent', 400, 'VALIDATION_ERROR');
    const result = await services.patientPortal.linkExistingDependent(request.user!.id, {
      patientNumber: parsed.data.patient_number, dateOfBirth: parsed.data.date_of_birth,
      relationship: parsed.data.relationship, legalConsentAccepted: parsed.data.legal_consent_accepted,
    });
    return reply.status(201).send(ok(result));
  });

  app.post<{ Body: BookAppointmentBody }>('/api/patient-portal/appointments', { preHandler: authenticate(services) }, async (request, reply) => {
    const input = bookAppointmentSchema.parse(request.body);
    const result = await services.patientPortal.bookAppointment(request.user!.id, input);
    return reply.status(201).send(ok(result));
  });

  app.get<{ Querystring: PortalAppointmentsQuery }>(
    '/api/patient-portal/appointments',
    {
      preHandler: authenticate(services),
      schema: { response: { 200: patientPortalAppointmentsResponseSchema } },
    },
    async (request) => {
      const query = portalAppointmentsQuerySchema.parse(request.query);
      return ok(await services.patientPortal.listAppointments(request.user!.id, query.patient_id, {
      scope: query.scope,
      status: query.status,
      page: query.page,
      limit: query.limit,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/patient-portal/appointments/:id/reschedule-eligibility', { preHandler: authenticate(services) }, async (request) =>
    ok(await services.patientPortal.rescheduleEligibility(request.user!.id, request.params.id)));

  app.patch<{ Params: { id: string }; Body: RescheduleAppointmentBody }>('/api/patient-portal/appointments/:id/reschedule', { preHandler: authenticate(services) }, async (request) => {
    const input = rescheduleAppointmentSchema.parse(request.body);
    return ok(await services.patientPortal.rescheduleAppointment(request.user!.id, request.params.id, input));
  });

  app.post<{ Body: ProvisionBody }>(
    '/api/patient-portal/accounts',
    { preHandler: requirePermission(services, 'Patients', 'Patient Records', 'Edit') },
    async (request, reply) => {
      const parsed = provisionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError('Invalid patient portal account details', 400, 'VALIDATION_ERROR');
      }
      const account = await services.patientPortal.provision({
        patientId: parsed.data.patient_id,
        username: parsed.data.username,
        email: parsed.data.email,
        password: parsed.data.password,
      }, request.user!.id, metadataFromRequest(request));
      return reply.status(201).send(ok(account));
    },
  );
};
