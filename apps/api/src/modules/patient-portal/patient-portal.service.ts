import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { CreateAppointmentDTO, PortalRescheduleAppointmentDTO } from '../appointments/appointment.types.js';
import type { DoctorService } from '../doctors/doctor.service.js';
import type { PatientService } from '../patients/patient.service.js';
import type { UploadPatientDocumentDTO } from '../patients/patient.types.js';
import type { RequestMetadata } from '../users/user.types.js';
import type { UserService } from '../users/user.service.js';
import { PatientPortalRepository } from './patient-portal.repository.js';
import type { PatientAccessRelationship } from './patient-access-grant.model.js';
import type { PatientOtpService } from './patient-otp.service.js';

type ProvisionInput = {
  patientId: string;
  username: string;
  email: string;
  password: string;
};

type RegisterInput = {
  accountType: 'PATIENT' | 'GUARDIAN';
  fullName: string;
  email: string;
  phone: string;
  guardianProfile?: GuardianProfileInput;
  initialDependent?: PatientProfileInput & { relationship: 'PARENT' | 'LEGAL_GUARDIAN' };
};

type GuardianProfileInput = {
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
  identification?: { type?: string | null; number?: string | null };
  legalConsentAccepted: boolean;
};

type ActivateGuardianInput = {
  fullName: string;
  email: string;
  phone: string;
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address?: GuardianProfileInput['address'];
  identification?: GuardianProfileInput['identification'];
  legalConsentAccepted: boolean;
};

type ActivateExistingPatientInput = {
  patientNumber: string;
  phone: string;
  dateOfBirth: string;
  email: string;
};

type PatientProfileInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  bloodGroup?: string | null;
  address?: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
  preferredBranchId: string;
  emergencyContact?: { name?: string | null; relationship?: string | null; phone?: string | null };
};

type UpdatePatientProfileInput = PatientProfileInput & {
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  emergencyContact?: { name?: string | null; relationship?: string | null; phone?: string | null };
};

type UpdateGuardianProfileInput = {
  fullName: string;
  relationship: 'PARENT' | 'LEGAL_GUARDIAN';
  address?: GuardianProfileInput['address'];
  identification?: GuardianProfileInput['identification'];
};

const isMinor = (dateOfBirth: string) => {
  const birthDate = new Date(dateOfBirth);
  const adultDate = new Date(birthDate);
  adultDate.setFullYear(adultDate.getFullYear() + 15);
  return adultDate > new Date();
};

export class PatientPortalService {
  constructor(
    private readonly repository: PatientPortalRepository,
    private readonly users: UserService,
    private readonly appointments: AppointmentService,
    private readonly doctors: DoctorService,
    private readonly patients: PatientService,
    private readonly otp: PatientOtpService,
  ) {}

  listPublicBranches(query: { page: number; limit: number; search?: string }) {
    return this.repository.listPublicBranches(query);
  }

  listPublicDepartments(query: { page: number; limit: number; search?: string; branchId?: string }) {
    this.validateOptionalId(query.branchId, 'Branch id is invalid');
    return this.repository.listPublicDepartments(query);
  }

  listPublicServices(query: { page: number; limit: number; search?: string; departmentId?: string; branchId?: string }) {
    this.validateOptionalId(query.departmentId, 'Department id is invalid');
    this.validateOptionalId(query.branchId, 'Branch id is invalid');
    return this.repository.listPublicServices(query);
  }

  listPublicDoctors(query: { page: number; limit: number; search?: string; departmentId?: string; branchId?: string }) {
    this.validateOptionalId(query.departmentId, 'Department id is invalid');
    this.validateOptionalId(query.branchId, 'Branch id is invalid');
    return this.repository.listPublicDoctors(query);
  }

  availableSlots(doctorId: string, date: string) {
    return this.doctors.availableSlots(doctorId, { date });
  }

  async context(userId: string) {
    const context = await this.repository.listAccessiblePatients(userId);
    if (!context) throw new AppError('A patient or guardian portal account is required', 403, 'PATIENT_PORTAL_ACCOUNT_REQUIRED');
    return context;
  }

  async overview(userId: string, requestedPatientId?: string) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId) {
      throw new AppError('No accessible patient record was found', 404, 'PATIENT_PORTAL_PROFILE_REQUIRED');
    }
    const overview = await this.repository.getOverview(patientId);
    if (!overview) throw new AppError('Linked patient record not found', 404, 'PATIENT_NOT_FOUND');
    return overview;
  }

  async listAppointments(userId: string, requestedPatientId: string, query: {
    scope: 'upcoming' | 'past';
    status?: string;
    page: number;
    limit: number;
  }) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId || patientId !== requestedPatientId) {
      throw new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED');
    }
    await this.appointments.reconcilePastAppointments(patientId);
    return this.repository.listAppointments(patientId, query);
  }

  async rescheduleEligibility(userId: string, appointmentId: string) {
    const appointment = await this.appointments.getForPortal(appointmentId);
    const patientId = await this.repository.resolveAccessiblePatientId(userId, appointment.patient_id);
    if (!patientId || patientId !== appointment.patient_id) {
      throw new AppError('You do not have access to this appointment', 403, 'PATIENT_ACCESS_DENIED');
    }
    return this.appointments.getPortalRescheduleEligibility(appointment);
  }

  async rescheduleAppointment(
    userId: string,
    appointmentId: string,
    input: PortalRescheduleAppointmentDTO,
  ) {
    const appointment = await this.appointments.getForPortal(appointmentId);
    const patientId = await this.repository.resolveAccessiblePatientId(userId, appointment.patient_id);
    if (!patientId || patientId !== appointment.patient_id) {
      throw new AppError('You cannot reschedule this appointment', 403, 'PATIENT_ACCESS_DENIED');
    }
    return this.appointments.rescheduleForPortal(appointmentId, input, userId);
  }

  async invoice(userId: string, requestedPatientId: string, invoiceId: string) {
    this.validateOptionalId(invoiceId, 'Invoice id is invalid');
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId) throw new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED');
    const invoice = await this.repository.getInvoiceDetails(patientId, invoiceId);
    if (!invoice) throw new AppError('Invoice not found for this patient', 404, 'INVOICE_NOT_FOUND');
    return invoice;
  }

  async listDocuments(userId: string, requestedPatientId: string, page = 1, limit = 20) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId) throw new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED');
    return this.patients.listDocumentsForPortal(patientId, { page, limit });
  }

  async uploadDocument(userId: string, requestedPatientId: string, data: UploadPatientDocumentDTO) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId) throw new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED');
    const context = await this.context(userId);
    return this.patients.uploadDocumentForPortal(patientId, {
      ...data,
      source: context.account.type === 'GUARDIAN' ? 'GUARDIAN' : 'PATIENT',
      review_status: 'PENDING',
    }, userId);
  }

  async downloadDocument(userId: string, requestedPatientId: string, documentId: string) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, requestedPatientId);
    if (!patientId) throw new AppError('You do not have access to this patient record', 403, 'PATIENT_ACCESS_DENIED');
    return this.patients.downloadDocumentForPortal(patientId, documentId);
  }

  async register(input: RegisterInput, metadata: RequestMetadata) {
    if (input.accountType === 'PATIENT' && await this.repository.hasPatientMatchingContact(input.email, input.phone)) {
      throw new AppError(
        'An existing patient record uses this email or mobile number. Ask hospital staff to activate portal access for that record.',
        409,
        'EXISTING_PATIENT_REQUIRES_ACTIVATION',
      );
    }
    if (input.accountType === 'GUARDIAN' && !input.guardianProfile?.legalConsentAccepted) {
      throw new AppError('Legal guardian confirmation and consent are required', 400, 'GUARDIAN_CONSENT_REQUIRED');
    }
    const account = await this.users.registerPortalAccount({
      ...input,
      password: `Aa1!${randomBytes(32).toString('base64url')}`,
    }, metadata);
    if (input.accountType === 'GUARDIAN' && input.guardianProfile) {
      await this.repository.upsertGuardianProfile(account.id, {
        fullName: input.fullName, email: input.email, phone: input.phone, ...input.guardianProfile,
      });
    }
    if (input.accountType === 'GUARDIAN' && input.initialDependent) {
      await this.requireActiveBranch(input.initialDependent.preferredBranchId);
      const patientId = await this.repository.createPortalPatient({
        userId: account.id,
        ...input.initialDependent,
        relationship: input.initialDependent.relationship,
      });
      if (!patientId) {
        throw new AppError('A possible existing patient record was found. Hospital staff must verify and link that patient.', 409, 'DUPLICATE_PATIENT');
      }
    }
    return account;
  }

  async activateExistingPatient(input: ActivateExistingPatientInput, metadata: RequestMetadata) {
    const patient = await this.repository.findExistingPatientForPortal(input);
    if (!patient) {
      throw new AppError('MRN, registered mobile number and date of birth do not match an active patient record', 404, 'PATIENT_IDENTITY_NOT_MATCHED');
    }
    if (isMinor(patient.dateOfBirth.toISOString())) {
      throw new AppError('A minor patient must be linked through a parent or guardian account', 409, 'MINOR_GUARDIAN_REQUIRED');
    }
    const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    const email = input.email.trim() || patient.email || '';
    if (!email) throw new AppError('An email address is required to create portal access', 400, 'EMAIL_REQUIRED');
    const account = await this.users.registerPortalAccount({
      accountType: 'PATIENT', fullName, email, phone: input.phone,
      password: `Aa1!${randomBytes(32).toString('base64url')}`,
    }, metadata);
    await this.repository.linkPortalAccountToPatient(account.id, String(patient._id));
    return { account, patientId: String(patient._id), patientNumber: input.patientNumber.trim().toUpperCase() };
  }

  getUnlinkedPatientLoginStatus(phone: string) {
    return this.repository.getUnlinkedPatientLoginStatus(phone);
  }

  async activateExistingPatientByPhone(phone: string, metadata: RequestMetadata) {
    const patient = await this.repository.getUniqueUnlinkedAdultPatientByPhone(phone);
    if (!patient) {
      throw new AppError(
        'This patient record could not be linked automatically. Contact hospital reception for identity verification.',
        409,
        'PATIENT_AUTOMATIC_LINK_NOT_AVAILABLE',
      );
    }
    const account = await this.users.registerPortalAccount({
      accountType: 'PATIENT',
      fullName: patient.fullName,
      email: patient.portalEmail,
      phone,
      password: `Aa1!${randomBytes(32).toString('base64url')}`,
    }, metadata);
    await this.repository.linkPortalAccountToPatient(account.id, patient.id);
    return { account, patientId: patient.id, patientNumber: patient.patientNumber };
  }

  async activateGuardianForMinor(input: ActivateGuardianInput, metadata: RequestMetadata) {
    const child = await this.repository.getUnlinkedMinorByPhone(input.phone);
    if (!child) {
      throw new AppError(
        'This mobile number cannot be activated as a new guardian account. Contact hospital reception.',
        409,
        'GUARDIAN_ACTIVATION_NOT_AVAILABLE',
      );
    }

    const account = await this.users.registerPortalAccount({
      accountType: 'GUARDIAN',
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: `Aa1!${randomBytes(32).toString('base64url')}`,
    }, metadata);
    await this.repository.upsertGuardianProfile(account.id, {
      fullName: input.fullName, email: input.email, phone: input.phone, relationship: input.relationship,
      address: input.address, identification: input.identification, legalConsentAccepted: input.legalConsentAccepted,
    });
    await this.repository.ensureAccessGrant(account.id, child.id, input.relationship);
    await this.repository.auditGuardianLink(account.id, child.id, input.relationship);
    return { account, child };
  }

  async completePatientProfile(userId: string, input: PatientProfileInput) {
    const context = await this.context(userId);
    if (context.patients.some((patient) => patient.relationship === 'SELF')) throw new AppError('Your own patient profile is already linked to this account', 409, 'PATIENT_PROFILE_EXISTS');
    if (isMinor(input.dateOfBirth) && !input.emergencyContact?.name?.trim()) {
      throw new AppError('Parent or guardian full name is required for patients under 15.', 400, 'GUARDIAN_DETAILS_REQUIRED');
    }
    await this.requireActiveBranch(input.preferredBranchId);
    const existingPatientId = await this.repository.linkExistingSelfPatient({
      userId,
      ...input,
      email: context.account.email,
      phone: context.account.phone,
    });
    if (existingPatientId) return { patientId: existingPatientId };
    const patientId = await this.repository.createPortalPatient({
      userId,
      ...input,
      email: context.account.email,
      phone: context.account.phone,
      relationship: isMinor(input.dateOfBirth)
        ? (input.emergencyContact?.relationship as PatientAccessRelationship || 'PARENT')
        : 'SELF',
    });
    if (!patientId) throw new AppError('A possible existing patient record was found. Contact hospital staff to link it safely.', 409, 'DUPLICATE_PATIENT');
    return { patientId };
  }

  async addDependent(
    userId: string,
    input: PatientProfileInput & { relationship: 'PARENT' | 'LEGAL_GUARDIAN' },
  ) {
    const context = await this.context(userId);
    if (context.account.type !== 'GUARDIAN') throw new AppError('A guardian account is required to add a dependent', 403, 'GUARDIAN_ACCOUNT_REQUIRED');
    await this.requireActiveBranch(input.preferredBranchId);
    const patientId = await this.repository.createPortalPatient({
      userId,
      ...input,
      relationship: input.relationship,
    });
    if (!patientId) throw new AppError('A possible existing patient record was found. Hospital staff must verify and link that patient.', 409, 'DUPLICATE_PATIENT');
    return { patientId };
  }

  async linkExistingDependent(
    userId: string,
    input: { patientNumber: string; dateOfBirth: string; relationship: 'PARENT' | 'LEGAL_GUARDIAN'; legalConsentAccepted: boolean },
  ) {
    const context = await this.context(userId);
    if (context.account.type !== 'GUARDIAN') throw new AppError('A guardian account is required to link a dependent', 403, 'GUARDIAN_ACCOUNT_REQUIRED');
    if (!input.legalConsentAccepted) throw new AppError('Guardian confirmation and consent are required', 400, 'GUARDIAN_CONSENT_REQUIRED');
    const patient = await this.repository.findPatientToLinkAsDependent(input);
    if (!patient) throw new AppError('MRN and date of birth do not match an active patient record', 404, 'PATIENT_IDENTITY_NOT_MATCHED');
    await this.repository.ensureAccessGrant(userId, String(patient._id), input.relationship);
    await this.repository.auditGuardianLink(userId, String(patient._id), input.relationship);
    return { patientId: String(patient._id), patientNumber: input.patientNumber.trim().toUpperCase() };
  }

  async updatePatientProfile(userId: string, patientId: string, input: UpdatePatientProfileInput) {
    const accessiblePatientId = await this.repository.resolveAccessiblePatientId(userId, patientId);
    if (!accessiblePatientId || accessiblePatientId !== patientId) {
      throw new AppError('You cannot update this patient record', 403, 'PATIENT_ACCESS_DENIED');
    }
    await this.requireActiveBranch(input.preferredBranchId);
    const result = await this.repository.updatePortalPatient(userId, patientId, input);
    if (!result) throw new AppError('Patient record not found', 404, 'PATIENT_NOT_FOUND');
    return result;
  }

  async updateGuardianProfile(userId: string, patientId: string, input: UpdateGuardianProfileInput) {
    const context = await this.context(userId);
    if (context.account.type !== 'GUARDIAN') {
      throw new AppError('A guardian account is required', 403, 'GUARDIAN_ACCOUNT_REQUIRED');
    }
    const linkedPatient = context.patients.find((patient) => patient.id === patientId);
    if (!linkedPatient || linkedPatient.relationship === 'SELF') {
      throw new AppError('You cannot update guardian details for this patient', 403, 'PATIENT_ACCESS_DENIED');
    }
    if (!isMinor(linkedPatient.date_of_birth.toISOString())) {
      throw new AppError('Guardian details can only be updated for a minor patient', 409, 'PATIENT_NOT_MINOR');
    }
    const result = await this.repository.updateGuardianProfile(userId, patientId, input);
    if (!result) throw new AppError('Guardian profile was not found', 404, 'GUARDIAN_PROFILE_NOT_FOUND');
    return result;
  }

  async bookAppointment(
    userId: string,
    input: Pick<CreateAppointmentDTO, 'patient_id' | 'doctor_id' | 'appointment_date' | 'start_time' | 'duration_minutes' | 'visit_type' | 'reason'>,
  ) {
    const patientId = await this.repository.resolveAccessiblePatientId(userId, input.patient_id);
    if (!patientId || patientId !== input.patient_id) {
      throw new AppError('You cannot book an appointment for this patient', 403, 'PATIENT_ACCESS_DENIED');
    }
    return this.appointments.createForPortal({
      ...input,
      patient_id: patientId,
      priority: 'ROUTINE',
      notes: null,
    }, userId);
  }

  async provision(input: ProvisionInput, actorUserId: string, metadata: RequestMetadata) {
    const patient = await this.repository.getPatientForProvisioning(input.patientId);
    if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    if (patient.status !== 'ACTIVE') {
      throw new AppError('Only active patients can receive portal access', 409, 'PATIENT_NOT_ACTIVE');
    }
    const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    const account = await this.users.provisionPatientAccount({
      patientId: String(patient._id),
      patientNumber: patient.patientNumber,
      username: input.username,
      email: input.email,
      password: input.password,
      fullName,
      phone: patient.phone,
      branchId: patient.registrationBranchId ? String(patient.registrationBranchId) : null,
    }, actorUserId, metadata);
    await this.repository.ensureAccessGrant(account.id, input.patientId, 'SELF');
    return account;
  }

  async requestOtp(phone: string, metadata: RequestMetadata) {
    return this.otp.request(phone, metadata);
  }

  async verifyOtp(phone: string, otp: string, metadata?: RequestMetadata) {
    return this.otp.verifyAndIssueRegistrationToken(phone, otp, metadata);
  }

  async verifyAndConsumeOtp(phone: string, otp: string, metadata?: RequestMetadata) {
    return this.otp.verifyAndConsume(phone, otp, metadata);
  }

  async assertOtpValidForPendingFlow(phone: string, otp: string, metadata?: RequestMetadata) {
    return this.otp.assertValidForPendingFlow(phone, otp, metadata);
  }

  async verifyAndConsumeRegistrationToken(phone: string, token: string) {
    return this.otp.consumeRegistrationToken(phone, token);
  }

  private validateOptionalId(value: string | undefined, message: string) {
    if (value && !Types.ObjectId.isValid(value)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private async requireActiveBranch(branchId: string) {
    this.validateOptionalId(branchId, 'Preferred branch is invalid');
    if (!(await this.repository.activeBranchExists(branchId))) {
      throw new AppError('Select an active hospital branch', 400, 'INVALID_BRANCH');
    }
  }
}
